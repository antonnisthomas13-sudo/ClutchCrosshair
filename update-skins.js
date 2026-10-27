// update-skins.js : récupère l'inventaire CS2 public des pros sur Steam et l'enregistre dans skins.json
// Lancer avec : node update-skins.js   puis   node build.js   (qui fabrique les pages et les images)
//
// Ce que Steam donne gratuitement (inventaire public) : le nom du skin, l'état (Factory New...), la rareté,
// l'image, et depuis 2025 le FLOAT EXACT ("Wear Rating") et le pattern. Le prix vient de CSFloat (liste de prix :
// prix le plus bas en vente, en dollars ; clé dans csfloat-key.txt) et l'euro du taux officiel de la BCE.
//
// Pour ajouter / changer un joueur : modifier la liste SKIN_PLAYERS ci-dessous
// (le SteamID est pris dans players.json ; sinon l'écrire à la main, ex. s1mple).

const fs = require("fs");
const crypto = require("crypto");

const SKIN_PLAYERS = [
    { name: "ZywOo" },
    { name: "donk" },
    { name: "m0NESY" },
    { name: "NiKo" },
    { name: "molodoy" }
    // s1mple (76561198034202275) : inventaire privé au 19/10/2026, remplacé par molodoy
];

// Types d'objets gardés (les vrais skins) et leur rubrique sur le site
const CATEGORIES = {
    "Knife": "knives",
    "Gloves": "gloves",
    "Rifle": "rifles",
    "Sniper Rifle": "snipers",
    "Pistol": "pistols",
    "SMG": "smgs",
    "Shotgun": "heavy",
    "Machinegun": "heavy"
};

const STEAM_IMAGE = "https://community.akamai.steamstatic.com/economy/image/";
const sleep = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
};

function today() {
    const d = new Date();
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}

// Une page de l'inventaire Steam (avec 3 essais si Steam demande de ralentir)
async function fetchPage(steamid, startAssetId) {
    const url = `https://steamcommunity.com/inventory/${steamid}/730/2?l=english&count=2000` + (startAssetId ? `&start_assetid=${startAssetId}` : "");
    for (let attempt = 1; attempt <= 3; attempt++) {
        const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (ClutchCrosshair inventory updater)" } });
        if (response.status === 403 || response.status === 401) {
            return { private: true };
        }
        if (response.status === 429) {
            console.log("  Steam demande de ralentir, pause de 60 secondes...");
            await sleep(60000);
            continue;
        }
        if (!response.ok) {
            throw new Error("Steam a répondu " + response.status);
        }
        return await response.json();
    }
    throw new Error("Steam refuse encore après 3 essais (trop de demandes)");
}

// Tout l'inventaire (Steam le découpe en pages de 2000 objets)
async function fetchInventory(steamid) {
    const all = { assets: [], descriptions: [], asset_properties: [] };
    let start = null;
    do {
        const page = await fetchPage(steamid, start);
        if (page.private) {
            return null;
        }
        all.assets.push(...(page.assets || []));
        all.descriptions.push(...(page.descriptions || []));
        all.asset_properties.push(...(page.asset_properties || []));
        start = page.more_items ? page.last_assetid : null;
        if (start) {
            await sleep(3000);
        }
    } while (start);
    return all;
}

function tag(description, category) {
    return (description.tags || []).find(function (t) {
        return t.category === category;
    });
}

// Transforme l'inventaire brut de Steam en liste de skins propre
function readSkins(inventory) {
    const descriptions = new Map(inventory.descriptions.map(function (d) {
        return [d.classid + "_" + d.instanceid, d];
    }));
    const properties = new Map(inventory.asset_properties.map(function (p) {
        return [p.assetid, p.asset_properties || []];
    }));
    const items = [];
    inventory.assets.forEach(function (asset) {
        const d = descriptions.get(asset.classid + "_" + asset.instanceid);
        const type = d && tag(d, "Type");
        const category = type && CATEGORIES[type.localized_tag_name];
        if (!category) {
            return; // caisses, stickers, graffitis, agents... : pas des skins d'armes
        }
        const exterior = tag(d, "Exterior");
        const rarity = tag(d, "Rarity");
        const painted = exterior && exterior.localized_tag_name !== "Not Painted";
        if (!painted && category !== "knives") {
            return; // arme de base sans skin (sauf les couteaux "Vanilla", qui sont de vrais skins)
        }
        const props = properties.get(asset.assetid) || [];
        const prop = function (name) {
            return props.find(function (p) { return p.name === name; });
        };
        const wear = prop("Wear Rating");
        const pattern = prop("Pattern Template");
        const finish = prop("Finish Catalog"); // numéro exact du motif : distingue les phases des Doppler (416 = Sapphire...)
        const weapon = tag(d, "Weapon");
        items.push({
            id: asset.assetid,
            name: d.name,                                   // ex. "StatTrak™ AK-47 | Redline"
            marketName: d.market_hash_name,                 // ex. "StatTrak™ AK-47 | Redline (Field-Tested)" (pour le prix plus tard)
            weapon: weapon ? weapon.localized_tag_name : "",
            category: category,
            exterior: painted ? exterior.localized_tag_name : "Vanilla",
            rarity: rarity ? rarity.localized_tag_name : "",
            rarityColor: rarity && rarity.color ? "#" + rarity.color.toUpperCase() : "",
            float: wear ? Number(wear.float_value) : null,
            pattern: pattern ? Number(pattern.int_value) : null,
            paintIndex: finish ? Number(finish.int_value) : null,
            phase: null,                                    // ex. "Sapphire", "Phase 2" (Doppler seulement, rempli avec le prix)
            statTrak: /^(★ )?StatTrak™/.test(d.name),
            souvenir: /^Souvenir /.test(d.name),
            image: crypto.createHash("sha1").update(d.icon_url).digest("hex").slice(0, 16),
            iconUrl: d.icon_url,
            price: null,                                    // en dollars (CSFloat), rempli plus bas
            priceEur: null                                  // en euros (taux BCE)
        });
    });
    return items;
}

// Prix : la liste de prix de CSFloat (UNE seule demande pour tous les objets CS2 : prix le plus bas en vente)
// La clé API est dans csfloat-key.txt (fichier secret, jamais envoyé sur GitHub)
// Sur GitHub (mise à jour automatique), la clé vient du coffre-fort de GitHub (secret CSFLOAT_KEY)
async function fetchPrices() {
    let key = process.env.CSFLOAT_KEY || "";
    if (!key && fs.existsSync("csfloat-key.txt")) {
        key = fs.readFileSync("csfloat-key.txt", "utf8");
    }
    key = key.trim();
    if (!key) {
        console.log("Pas de clé CSFloat (csfloat-key.txt ou secret CSFLOAT_KEY) : prix non mis à jour");
        return null;
    }
    const response = await fetch("https://csfloat.com/api/v1/listings/price-list", { headers: { Authorization: key } });
    if (!response.ok) {
        throw new Error("CSFloat a répondu " + response.status);
    }
    const list = await response.json();
    const prices = new Map();
    (Array.isArray(list) ? list : list.data || []).forEach(function (entry) {
        prices.set(entry.market_hash_name, entry.min_price / 100); // CSFloat compte en centimes de dollar
    });
    prices.key = key;
    return prices;
}

// Les Doppler et Gamma Doppler ont le même nom sur le marché quelle que soit leur phase, mais pas le même prix
// (une Sapphire vaut 3 à 4 fois une Phase 1). La liste de prix ne donne que la phase la moins chère :
// pour ces skins on demande à CSFloat l'annonce la moins chère avec le numéro de motif exact (paint_index).
function needsPhasePrice(item) {
    return /Doppler/.test(item.marketName) && item.paintIndex != null;
}

async function fetchPhasePrices(items, key) {
    const cache = new Map();
    let problems = 0;
    for (const item of items.filter(needsPhasePrice)) {
        const id = item.marketName + "#" + item.paintIndex;
        if (!cache.has(id)) {
            let found = null;
            try {
                const url = "https://csfloat.com/api/v1/listings?type=buy_now&sort_by=lowest_price&limit=1&market_hash_name=" + encodeURIComponent(item.marketName) + "&paint_index=" + item.paintIndex;
                const response = await fetch(url, { headers: { Authorization: key } });
                if (response.ok) {
                    const json = await response.json();
                    const listing = (Array.isArray(json) ? json : json.data || [])[0];
                    if (listing && listing.item && listing.item.paint_index === item.paintIndex) {
                        found = { usd: listing.price / 100, phase: listing.item.phase || null };
                    }
                }
            } catch (error) {
                // laissé à null : signalé plus bas
            }
            cache.set(id, found);
            await sleep(1500); // politesse envers CSFloat
        }
        const found = cache.get(id);
        if (found) {
            item.price = found.usd;
            item.phase = found.phase;
        } else {
            // Pas d'annonce pour cette phase : on retire le prix plutôt que d'afficher celui d'une autre phase
            item.price = null;
            problems++;
            console.log("  ATTENTION : pas de prix pour " + item.marketName + " (motif " + item.paintIndex + ")");
        }
    }
    return problems;
}

// Taux de change officiel du jour (Banque centrale européenne, gratuit) : combien de dollars pour 1 euro
async function fetchEuroRate() {
    const response = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml");
    const match = (await response.text()).match(/currency='USD' rate='([\d.]+)'/);
    if (!match) {
        throw new Error("taux introuvable");
    }
    return Number(match[1]);
}

// Télécharge les images qui manquent (skins/src/<id>.png) ; build.js en fait des .webp légers
async function downloadImages(items) {
    fs.mkdirSync("skins/src", { recursive: true });
    const missing = [];
    const seen = new Set();
    items.forEach(function (item) {
        // On ne télécharge que les images vraiment nouvelles (ni l'originale ni la version du site n'existent)
        if (!seen.has(item.image) && !fs.existsSync("skins/src/" + item.image + ".png") && !fs.existsSync("skins/img/" + item.image + ".webp")) {
            seen.add(item.image);
            missing.push(item);
        }
    });
    let done = 0;
    for (let i = 0; i < missing.length; i += 6) {
        await Promise.all(missing.slice(i, i + 6).map(async function (item) {
            try {
                const response = await fetch(STEAM_IMAGE + item.iconUrl + "/360fx360f");
                if (response.ok) {
                    fs.writeFileSync("skins/src/" + item.image + ".png", Buffer.from(await response.arrayBuffer()));
                    done++;
                }
            } catch (error) {
                console.log("  Image non téléchargée : " + item.name);
            }
        }));
    }
    return done;
}

async function main() {
    const players = JSON.parse(fs.readFileSync("players.json", "utf8"));
    const previous = fs.existsSync("skins.json") ? JSON.parse(fs.readFileSync("skins.json", "utf8")) : { players: [] };
    const result = { updated: today(), players: [] };

    for (const entry of SKIN_PLAYERS) {
        const known = players.find(function (p) { return p.name === entry.name; }) || {};
        const steamid = entry.steamid || known.steamid;
        const old = previous.players.find(function (p) { return p.name === entry.name; });
        const player = { name: entry.name, steamid: steamid, team: entry.team !== undefined ? entry.team : (known.team || ""), status: "public", updated: today(), items: [] };
        if (!steamid) {
            console.log(entry.name + " : SteamID inconnu, ignoré");
            continue;
        }
        try {
            const inventory = await fetchInventory(steamid);
            if (!inventory && old && old.status === "public" && old.items.length) {
                // Inventaire public hier, refusé aujourd'hui : souvent Steam qui bloque un moment (surtout depuis GitHub).
                // Par sécurité on garde les données d'hier (sinon sa page serait supprimée)
                console.log(entry.name + " : accès refusé par Steam, données d'hier gardées (vérifier s'il est passé en privé)");
                Object.assign(player, old);
            } else if (!inventory) {
                player.status = "private";
                console.log(entry.name + " : INVENTAIRE PRIVÉ (à remplacer par un autre joueur)");
            } else {
                player.items = readSkins(inventory);
                console.log(entry.name + " : " + player.items.length + " skins (" + inventory.assets.length + " objets dans l'inventaire)");
            }
        } catch (error) {
            // Problème de connexion ou Steam surchargé : on garde les données d'avant pour ce joueur
            console.log(entry.name + " : erreur (" + error.message + "), anciennes données gardées");
            if (old) {
                Object.assign(player, old);
            }
        }
        result.players.push(player);
        await sleep(4000); // politesse envers Steam : une demande toutes les 4 secondes
    }

    const allItems = result.players.flatMap(function (p) { return p.items; });
    console.log((await downloadImages(allItems)) + " nouvelle(s) image(s) téléchargée(s)");

    // Prix en dollars (CSFloat) et en euros (taux BCE) ; en cas de problème on garde les anciens prix
    try {
        const prices = await fetchPrices();
        if (prices) {
            const rate = await fetchEuroRate();
            allItems.forEach(function (item) {
                const usd = prices.get(item.marketName);
                item.price = usd !== undefined ? usd : null;
            });
            const problems = await fetchPhasePrices(allItems, prices.key);
            let found = 0;
            allItems.forEach(function (item) {
                item.priceEur = item.price != null ? Math.round(item.price / rate * 100) / 100 : null;
                if (item.price != null) {
                    found++;
                }
            });
            result.prices = { source: "CSFloat", updated: today(), usdPerEur: rate };
            console.log("Prix : " + found + " skins sur " + allItems.length + " (taux 1 € = " + rate + " $), dont " + allItems.filter(needsPhasePrice).length + " Doppler au prix de leur phase" + (problems ? ", " + problems + " SANS PRIX (voir ATTENTION)" : ""));
        }
    } catch (error) {
        console.log("Prix non mis à jour (" + error.message + "), anciens prix gardés");
        const oldItems = new Map(previous.players.flatMap(function (p) { return p.items; }).map(function (i) { return [i.id, i]; }));
        allItems.forEach(function (item) {
            const old = oldItems.get(item.id);
            if (old) {
                item.price = old.price;
                item.priceEur = old.priceEur;
                item.phase = old.phase || null;
            }
        });
        result.prices = previous.prices;
    }

    // On enlève les images de skins qui ne servent plus (skin vendu...)
    const used = new Set(allItems.map(function (i) { return i.image; }));
    ["skins/src", "skins/img"].forEach(function (dir) {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(function (f) {
                if (!used.has(f.replace(/\.\w+$/, ""))) {
                    fs.unlinkSync(dir + "/" + f);
                }
            });
        }
    });

    // iconUrl ne sert qu'au téléchargement : on ne le garde pas dans skins.json (fichier plus léger)
    result.players.forEach(function (p) {
        p.items.forEach(function (i) { delete i.iconUrl; });
    });
    fs.writeFileSync("skins.json", JSON.stringify(result, null, 1));
    console.log("skins.json mis à jour. Lance maintenant : node build.js");
}

main();
