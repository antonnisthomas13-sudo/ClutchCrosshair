// build.js : génère tout ce qui sert au référencement Google (SEO) et à la vitesse du site
//   - les images optimisées (vignettes des photos, logos, fond des aperçus, icônes, aperçu de lien) : voir images.js
//   - dans index.html : les cartes des joueurs (Pros, Creators, Trending), le menu des équipes, les compteurs
//     et la liste de tous les joueurs — lisibles par Google sans JavaScript
//   - une page complète par joueur (players/<slug>.html) — et supprime les pages des joueurs qui n'existent plus
//   - faq.html (FAQ complète, avec des statistiques calculées sur les crosshairs des pros)
//   - generator.html (générateur de crosshair CS2) — le même générateur est aussi écrit dans l'onglet Generator de l'accueil
//   - legal.html (mentions légales)
//   - sitemap.xml (avec la date de mise à jour et la photo de chaque page) et 404.html
//   - les "empreintes" ?v=... des fichiers CSS/JS : changent toutes seules quand le fichier change
//     (le navigateur recharge alors la nouvelle version) — plus besoin de les modifier à la main
// Lancer avec : node build.js   (à relancer après chaque changement de players.json, des photos, du CSS ou du JS)

const fs = require("fs");
const crypto = require("crypto");
const { optimizeImages } = require("./images.js");

const SITE_URL = "https://antonnisthomas13-sudo.github.io/ClutchCrosshair";

// Mentions légales : À REMPLIR avant de publier
const PUBLISHER_NAME = "Anto";
const PUBLISHER_EMAIL = "[À REMPLIR : ton e-mail de contact]";

// Nombre de cartes dont la photo est chargée tout de suite (la première rangée, visible sans défiler)
const EAGER_CARDS = 4;

// Crosshair de départ du générateur : vert, statique, sans contour, tailles en pixels pour un écran 1080p
const GENERATOR_DEFAULT = {
    format: "cs2-v1", style: 4, followRecoil: false, centerDotEnabled: false, tStyleEnabled: false, outlineMode: 0,
    red: 0, green: 255, blue: 0, alpha: 255, outlineRed: 0, outlineGreen: 0, outlineBlue: 0, outlineAlpha: 255,
    gap: 2, length: 4, thickness: 2, dynamicSpreadLimit: 181, splitDistance: 2, innerSplitAlpha: 0, outerSplitAlpha: 1,
    splitSizeRatio: 1, screenHeight: 1080, scopeDotScale: 1, scopeDotUseCrosshairColor: false
};

// Date "17/10/2026" -> "2026-10-17" (format demandé par le sitemap et les données structurées)
function isoDate(date) {
    const parts = String(date || "").split("/");
    return parts.length === 3 ? parts[2] + "-" + parts[1] + "-" + parts[0] : "";
}

// Empreinte courte du contenu d'un fichier (change dès que le fichier change)
function fingerprint(file) {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
}

// Remplace le contenu entre deux repères (<!-- NOM:START ... --> et <!-- NOM:END -->) dans un texte
function replaceBetween(text, name, content, indent) {
    const startMark = "<!-- " + name + ":START";
    const endMark = "<!-- " + name + ":END -->";
    const start = text.indexOf(startMark);
    const end = text.indexOf(endMark);
    if (start === -1 || end === -1) {
        console.log("Attention : repères " + name + " introuvables dans index.html");
        return text;
    }
    const startLineEnd = text.indexOf("-->", start) + 3;
    return text.slice(0, startLineEnd) + "\n" + indent + content + "\n" + indent + text.slice(end);
}

async function main() {
    // 0. Images optimisées (ne refait que ce qui manque ou a changé)
    optimizeImages();

    // Ces fichiers sont des "modules" (export) : on les charge avec import()
    const sharecode = await import("./lib/csgo-sharecode.js");
    const { teams } = await import("./teams.js");
    const render = await import("./render.js");
    const { slug, esc, consoleCommands, teamInfo, teamColor, textOnColor, teamBadge, cardHTML, byTeamThenName, generatorHTML, SKIN_CATEGORIES, groupSkins, byPrice, formatPrice, skinCardHTML, skinParts } = render;

    const players = JSON.parse(fs.readFileSync("players.json", "utf8"));

    // Skins des pros (rempli par update-skins.js) : seulement les inventaires publics qui contiennent des skins
    const skinData = fs.existsSync("skins.json") ? JSON.parse(fs.readFileSync("skins.json", "utf8")) : { players: [] };
    const skinPlayers = skinData.players.filter(function (p) {
        return p.status === "public" && p.items.length > 0;
    }).map(function (p) {
        const groups = groupSkins(p.items);
        const hasPrices = p.items.some(function (i) { return i.price != null; });
        // best = les plus chers d'abord (quand les prix sont branchés), sinon couteaux, gants... par rareté
        // Valeur de l'inventaire (somme des prix de tous les exemplaires)
        const value = p.items.reduce(function (n, i) { return n + (i.price || 0); }, 0);
        const valueEur = p.items.reduce(function (n, i) { return n + (i.priceEur || 0); }, 0);
        return Object.assign({}, p, { slug: slug(p.name), groups: groups, hasPrices: hasPrices, best: hasPrices ? byPrice(groups) : groups, value: value, valueEur: valueEur });
    });
    skinData.players.filter(function (p) { return p.status === "private"; }).forEach(function (p) {
        console.log("Attention : l'inventaire de " + p.name + " est privé (pas de page skins)");
    });

    // Empreintes des fichiers CSS / JS (voir tout en haut)
    // Ordre important : crosshair.js -> generator.js (qui l'importe) -> script.js (qui importe les deux)
    function setImportVersion(file, imported, hash) {
        const text = fs.readFileSync(file, "utf8");
        const updated = text.replace(new RegExp("(\\./" + imported.replace(".", "\\.") + "\\?v=)[^\"']*", "g"), "$1" + hash);
        if (updated !== text) {
            fs.writeFileSync(file, updated);
        }
    }
    const CSS_HASH = fingerprint("style.css");
    const CROSSHAIR_HASH = fingerprint("crosshair.js");
    setImportVersion("generator.js", "crosshair.js", CROSSHAIR_HASH);
    setImportVersion("script.js", "crosshair.js", CROSSHAIR_HASH);
    const GENERATOR_HASH = fingerprint("generator.js");
    setImportVersion("script.js", "generator.js", GENERATOR_HASH);
    const SCRIPT_HASH = fingerprint("script.js");

    // Le générateur : code de départ + liste des pros (codes CS2 valides seulement), par équipe
    const generatorCode = sharecode.encodeCrosshair(GENERATOR_DEFAULT);
    const generatorGroups = teams.map(function (t) {
        return {
            title: t.name,
            players: players.filter(function (p) {
                return p.team === t.name && /^CS(?!GO-)/.test(p.code) && decode(p.code);
            }).sort(byTeamThenName)
        };
    }).filter(function (g) {
        return g.players.length > 0;
    });
    const generatorBlock = generatorHTML(generatorCode, generatorGroups);

    // Photo d'origine, vignette (cartes) et photo moyenne (fiche, page joueur) d'un joueur
    function photoFiles(player) {
        let original = player.photo || "";
        if (!original) {
            for (const ext of ["webp", "png", "jpg"]) {
                const file = "photos/" + slug(player.name) + "." + ext;
                if (fs.existsSync(file)) {
                    original = file;
                    break;
                }
            }
        }
        if (!original) {
            return { original: "", sm: "", md: "" };
        }
        const base = original.replace(/^photos\//, "").replace(/\.\w+$/, "");
        const sm = "photos/sm/" + base + ".webp";
        const md = "photos/md/" + base + ".webp";
        return { original: original, sm: fs.existsSync(sm) ? sm : original, md: fs.existsSync(md) ? md : original };
    }

    // Photo d'un joueur des skins (petite pour les boutons, moyenne pour l'en-tête de sa page), sinon ses initiales
    function skinPhoto(p, prefix, w, h, className, eager) {
        const known = players.find(function (x) { return x.name === p.name; });
        const photo = known ? photoFiles(known) : { sm: "", md: "" };
        const file = w > 60 ? photo.md : photo.sm;
        const cls = className || "ps-photo";
        return file
            ? `<img class="${cls}" src="${prefix}${esc(file)}" alt="${esc(p.name)}" width="${w}" height="${h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
            : `<span class="${cls}" aria-hidden="true">${esc(p.name.slice(0, 2).toUpperCase())}</span>`;
    }

    // "ZywOo (Team Vitality) owns 631 CS2 skins, including 4 knife skins and 3 pairs of gloves."
    function skinSummary(p) {
        const count = function (category) {
            return p.items.filter(function (i) { return i.category === category; }).length;
        };
        const knives = count("knives");
        const gloves = count("gloves");
        const extras = [];
        if (knives) {
            extras.push(knives + " knife skin" + (knives === 1 ? "" : "s"));
        }
        if (gloves) {
            extras.push(gloves + (gloves === 1 ? " pair" : " pairs") + " of gloves");
        }
        return `${p.name}${p.team ? " (" + p.team + ")" : ""} owns ${p.items.length} CS2 skins${extras.length ? ", including " + extras.join(" and ") : ""}${p.hasPrices ? ", for a total value of about " + money(p.value, "USD") + " (" + money(p.valueEur, "EUR") + ")" : ""}.`;
    }

    // Montant arrondi : 8551.4 -> "$8,551" / "€7,599"
    function money(value, currency) {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: currency, maximumFractionDigits: 0 }).format(value);
    }

    // D'où viennent les prix (affiché sous les skins : transparence)
    const PRICE_NOTE = skinData.prices
        ? `Prices: lowest listing on <a href="https://csfloat.com" rel="nofollow noopener" target="_blank">CSFloat</a> in US dollars, euros at the ECB exchange rate, updated ${esc(skinData.prices.updated)}. Doppler phases are not priced separately.`
        : "";

    // Logo optimisé de l'équipe (logos/sm/...) s'il existe, sinon le logo d'origine
    function logoFor(teamName) {
        const team = teamInfo(teamName);
        if (!team) {
            return "";
        }
        const small = team.logo.replace(/^logos\//, "logos/sm/").replace(/\.\w+$/, ".webp");
        return fs.existsSync(small) ? small : team.logo;
    }

    function decode(code) {
        try {
            return sharecode.decodeCrosshairShareCode(code);
        } catch (error) {
            return null;
        }
    }

    // ===== Morceaux communs à toutes les pages =====

    // Thème clair/sombre appliqué tout de suite (sans flash), sur <html> et <body>
    const THEME_SCRIPT = `<script>
        try {
            const saved = localStorage.getItem("theme");
            if (saved === "light" || (!saved && window.matchMedia("(prefers-color-scheme: light)").matches)) {
                document.documentElement.classList.add("light");
                document.body.classList.add("light");
            }
        } catch (error) {}
    </script>`;

    // Le <head> d'une page (titre, description, adresse officielle, aperçu de lien, chargement rapide)
    function head(o) {
        const p = o.prefix;
        return `<meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${o.title}</title>
    <meta name="description" content="${esc(o.description)}">
    ${o.noindex ? '<meta name="robots" content="noindex">' : `<meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="${o.url}">`}
    <link rel="icon" href="${p}favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="${p}apple-touch-icon.png">
    <link rel="manifest" href="${p}site.webmanifest">
    <meta name="theme-color" content="#111214">
    <meta name="color-scheme" content="dark light">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="ClutchCrosshair">
    <meta property="og:locale" content="en_US">
    <meta property="og:title" content="${o.ogTitle || o.title}">
    <meta property="og:description" content="${esc(o.description)}">
    <meta property="og:url" content="${o.url}">
    <meta property="og:image" content="${SITE_URL}/og-image.jpg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="ClutchCrosshair: find your perfect CS2 crosshair">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${o.ogTitle || o.title}">
    <meta name="twitter:description" content="${esc(o.description)}">
    <meta name="twitter:image" content="${SITE_URL}/og-image.jpg">
    <link rel="preload" href="${p}fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="${p}fonts/barlow-condensed-700-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="${p}style.css?v=${CSS_HASH}">${o.crosshair ? `
    <link rel="modulepreload" href="${p}crosshair.js?v=${CROSSHAIR_HASH}">
    <link rel="modulepreload" href="${p}lib/csgo-sharecode.js">
    <link rel="preload" href="${p}preview-bg.webp" as="image" type="image/webp">` : ""}${o.generator ? `
    <link rel="modulepreload" href="${p}generator.js?v=${GENERATOR_HASH}">` : ""}${o.jsonLd ? `
    <script type="application/ld+json">${JSON.stringify(o.jsonLd)}</script>` : ""}`;
    }

    // En haut des pages : le logo (retour à l'accueil)
    function pageTop(prefix) {
        return `<header class="page-top">
        <a href="${prefix}" class="logo" aria-label="ClutchCrosshair home">
            <img class="logo-img logo-dark" src="${prefix}logo-horizontal-dark.svg" alt="ClutchCrosshair" width="114" height="40">
            <img class="logo-img logo-light" src="${prefix}logo-horizontal-light.svg" alt="ClutchCrosshair" width="114" height="40">
        </a>
        <nav class="page-top-links">
            <a href="${prefix}generator.html" class="back-link">Generator</a>
            <a href="${prefix}skins/" class="back-link">Pro Skins</a>
            <a href="${prefix}faq.html" class="back-link">FAQ</a>
            <a href="${prefix}" class="back-link back-home">← All CS2 crosshairs</a>
        </nav>
    </header>`;
    }

    function footer(prefix) {
        return `<footer>
        <nav class="footer-links" aria-label="Footer">
            <a href="${prefix}generator.html">Crosshair Generator</a>
            <a href="${prefix}skins/">CS2 Pro Skins</a>
            <a href="${prefix}faq.html">FAQ</a>
            <a href="${prefix}legal.html">Legal notice</a>
        </nav>
        <p>© 2026 ClutchCrosshair. All rights reserved.</p>
        <p>Team logos are trademarks of their respective owners. ClutchCrosshair is not affiliated with these teams.</p>
    </footer>`;
    }

    // Fil d'Ariane (Accueil › page) pour Google
    function breadcrumb(name, url) {
        return {
            "@type": "BreadcrumbList",
            "@id": url + "#breadcrumb",
            "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "CS2 Crosshairs", "item": SITE_URL + "/" },
                { "@type": "ListItem", "position": 2, "name": name, "item": url }
            ]
        };
    }

    // Petit tableau qui décrit les réglages du crosshair (contenu unique pour chaque page)
    function crosshairDetails(code) {
        const c = decode(code);
        if (!c) {
            return "";
        }
        const hex = "#" + [c.red, c.green, c.blue].map(function (v) {
            return Number(v).toString(16).padStart(2, "0");
        }).join("").toUpperCase();
        const rows = [
            ["Color", `<span class="swatch" style="background:${hex}"></span>${hex}`],
            ["Length", c.length],
            ["Thickness", c.thickness],
            ["Gap", c.gap],
            ["Center dot", c.centerDotEnabled ? "Yes" : "No"],
            ["Outline", c.outlineMode > 0 ? "Yes" : "No"],
            ["T-style", c.tStyleEnabled ? "Yes" : "No"],
            ["Opacity", Math.round((c.alpha / 255) * 100) + "%"]
        ];
        return `<dl class="specs">${rows.map(function (r) {
            return `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`;
        }).join("")}</dl>`;
    }

    // ===== Textes uniques pour chaque page joueur (calculés à partir de son vrai crosshair) =====
    const COLOR_NAMES = [["green", 0, 255, 0], ["yellow", 255, 255, 0], ["cyan", 0, 255, 255], ["red", 255, 0, 0], ["pink", 255, 0, 255],
        ["white", 255, 255, 255], ["blue", 0, 0, 255], ["light blue", 100, 190, 255], ["orange", 255, 140, 0], ["purple", 150, 60, 255],
        ["lime", 170, 255, 0], ["teal", 0, 200, 150]];

    // La couleur la plus proche parmi des noms simples (ex. 0,255,255 -> "cyan")
    function colorName(c) {
        let best = "";
        let distance = Infinity;
        COLOR_NAMES.forEach(function (n) {
            const d = (c.red - n[1]) ** 2 + (c.green - n[2]) ** 2 + (c.blue - n[3]) ** 2;
            if (d < distance) {
                distance = d;
                best = n[0];
            }
        });
        return best;
    }

    function listText(items) {
        return items.length > 1 ? items.slice(0, -1).join(", ") + " and " + items[items.length - 1] : items.join("");
    }

    // Les crosshairs CS2 valides des pros, pour les comparaisons
    const proCrosshairs = players.filter(function (p) {
        return p.category === "pro";
    }).map(function (p) {
        return { player: p, c: decode(p.code) };
    }).filter(function (x) {
        return x.c && x.c.format !== "legacy-v1";
    });

    function percentOfPros(test) {
        return Math.round(proCrosshairs.filter(test).length / proCrosshairs.length * 100);
    }

    function proLinks(list) {
        return `<ul class="related">${list.map(function (x) {
            return `<li><a href="${slug(x.player.name)}.html">${esc(x.player.name)} crosshair</a></li>`;
        }).join("")}</ul>`;
    }

    // Description des réglages en phrases + comparaison avec les pros + pros au crosshair identique ou proche + FAQ
    function crosshairInsights(player) {
        const c = decode(player.code);
        if (!c || c.format === "legacy-v1") {
            return null;
        }
        const color = colorName(c);
        const size = c.length <= 2 ? "very short" : c.length <= 4 ? "short" : c.length <= 7 ? "medium" : "long";
        const parts = [c.length + " px long", c.thickness + " px thick", "a gap of " + c.gap, c.outlineMode > 0 ? "an outline" : "no outline", c.centerDotEnabled ? "a center dot" : "no center dot"];
        if (c.tStyleEnabled) {
            parts.push("the T-style (no top line)");
        }
        if (c.alpha < 255) {
            parts.push(Math.round(c.alpha / 255 * 100) + "% opacity");
        }
        const settings = `${player.name} uses a ${size} ${color}${c.style === 4 ? " static" : ""} crosshair: ${listText(parts)}, set for a ${c.screenHeight}p screen height.`;
        const longer = percentOfPros(function (x) { return x.c.length > c.length; });
        const sameColor = percentOfPros(function (x) { return colorName(x.c) === color; });
        const comparison = `${longer}% of the ${proCrosshairs.length} pros on ClutchCrosshair use a longer crosshair, and ${sameColor}% play with a ${color} one.`;
        const same = proCrosshairs.filter(function (x) {
            return x.player !== player && x.player.code === player.code;
        });
        const similar = proCrosshairs.filter(function (x) {
            return x.player !== player && x.player.code !== player.code && colorName(x.c) === color && x.c.thickness === c.thickness
                && Math.abs(x.c.length - c.length) <= 1 && Math.abs(x.c.gap - c.gap) <= 1;
        }).slice(0, 8);
        const name = esc(player.name);
        const html = `<p>${esc(settings)} ${esc(comparison)}</p>
        ${same.length ? `<h2>Pros with the same crosshair as ${name}</h2>
        <p>${listText(same.map(function (x) { return esc(x.player.name); }))} use${same.length === 1 ? "s" : ""} exactly the same CS2 crosshair code as ${name}.</p>
        ${proLinks(same)}` : ""}
        ${similar.length ? `<h2>Crosshairs similar to ${name}'s</h2>
        <p>These pros also play with a ${esc(color)} crosshair of almost the same size and gap.</p>
        ${proLinks(similar)}` : ""}`;
        const faq = [
            [`What is ${player.name}'s CS2 crosshair code?`, `${player.name}'s CS2 crosshair code is ${player.code}. It was read from ${player.category === "pro" ? "an official match demo" : "a match"} on ${player.updated}.`],
            [`What crosshair settings does ${player.name} use?`, settings]
        ];
        if (same.length) {
            faq.push([`Which pros use the same crosshair as ${player.name}?`, `${listText(same.map(function (x) { return x.player.name; }))} use${same.length === 1 ? "s" : ""} exactly the same CS2 crosshair code as ${player.name}.`]);
        }
        return { html: html, faq: faq };
    }

    // Profils officiels du joueur pour Google (sameAs) : son compte Steam (lu dans les démos) et sa page Liquipedia (vérifiée)
    function profileLinks(player) {
        const links = [];
        if (player && player.steamid) {
            links.push("https://steamcommunity.com/profiles/" + player.steamid);
        }
        if (player && player.liquipedia) {
            links.push("https://liquipedia.net/counterstrike/" + encodeURIComponent(player.liquipedia).replace(/%2F/g, "/"));
        }
        if (player && player.hltv) {
            links.push(player.hltv); // page HLTV donnée à la main (ex. art, dont la page Liquipedia est celle d'un homonyme)
        }
        return links;
    }

    // ===== 1. Une page par joueur =====
    if (!fs.existsSync("players")) {
        fs.mkdirSync("players");
    }
    const pageFiles = [];

    players.forEach(function (player) {
        const name = esc(player.name);
        const team = esc(player.team);
        const isPro = player.category === "pro";
        const file = slug(player.name) + ".html";
        const url = `${SITE_URL}/players/${file}`;
        const photo = photoFiles(player);
        const logo = logoFor(player.team);
        pageFiles.push(file);

        // Photo moyenne, chargée en priorité (c'est le plus gros élément en haut de la page)
        const photoHtml = photo.md
            ? `<img class="player-photo" src="../${esc(photo.md)}" alt="${name}, ${team}" width="120" height="134" fetchpriority="high" decoding="async">`
            : `<div class="player-photo">${esc(player.name.slice(0, 2).toUpperCase())}</div>`;
        const badge = logo ? `<img class="player-team-logo" src="../${logo}" alt="" width="20" height="20">` : "";

        // Coéquipiers (ou autres créateurs) : liens internes, bons pour Google et pour les visiteurs
        const mates = players.filter(function (p) {
            return p !== player && p.team === player.team;
        });
        const matesHtml = mates.length
            ? `<h2>${isPro ? `Other ${team} crosshairs` : "Other creator crosshairs"}</h2>
        <ul class="related">${mates.map(function (p) {
                return `<li><a href="${slug(p.name)}.html">${esc(p.name)} crosshair</a></li>`;
            }).join("")}</ul>`
            : "";

        const insights = crosshairInsights(player);
        const intro = isPro
            ? `${name} plays for ${team}. This is the exact CS2 crosshair ${name} used in an official match on ${esc(player.updated)}, read directly from the match demo.`
            : `${name} is a CS2 content creator. This is ${name}'s CS2 crosshair, last checked on ${esc(player.updated)}.`;

        // Données structurées reliées entre elles : la page, son fil d'Ariane et le joueur (membre de son équipe)
        const webPage = {
            "@type": "WebPage",
            "@id": url,
            "url": url,
            "name": `${player.name} CS2 Crosshair Code`,
            "inLanguage": "en",
            "isPartOf": { "@id": SITE_URL + "/#website" },
            "about": { "@id": url + "#person" },
            "breadcrumb": { "@id": url + "#breadcrumb" }
        };
        if (isoDate(player.updated)) {
            webPage.dateModified = isoDate(player.updated);
        }
        if (photo.original) {
            webPage.primaryImageOfPage = { "@type": "ImageObject", "url": `${SITE_URL}/${photo.original}` };
        }
        const person = {
            "@type": "Person",
            "@id": url + "#person",
            "name": player.name,
            "description": isPro
                ? `${player.name} is a CS2 pro player for ${player.team}. CS2 crosshair code read from an official match demo.`
                : `${player.name} is a CS2 content creator.`,
            "url": url
        };
        if (isPro) {
            person.memberOf = { "@type": "SportsTeam", "name": player.team, "sport": "Counter-Strike 2" };
        }
        if (photo.original) {
            person.image = `${SITE_URL}/${photo.original}`;
        }
        if (profileLinks(player).length) {
            person.sameAs = profileLinks(player);
        }

        const page = `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: `${name} CS2 Crosshair Code (2026) | ClutchCrosshair`,
        ogTitle: `${name} CS2 Crosshair Code`,
        description: isPro
            ? `Copy ${player.name}'s CS2 crosshair code (${player.team}) in one click: real-size preview, console commands and settings. From a match on ${player.updated}.`
            : `Copy ${player.name}'s CS2 crosshair code in one click: real-size preview, console commands and full settings. Updated ${player.updated}.`,
        url: url,
        prefix: "../",
        crosshair: true,
        jsonLd: { "@context": "https://schema.org", "@graph": [webPage, breadcrumb(player.name + " crosshair", url), person].concat(insights ? [{
            "@type": "FAQPage",
            "@id": url + "#faq",
            "mainEntity": insights.faq.map(function (q) {
                return { "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } };
            })
        }] : []) }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../")}

    <main class="player-page" style="--team: ${teamColor(player.team)}; --on-team: ${textOnColor(teamColor(player.team))}">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../">CS2 Crosshairs</a> › <span>${name}</span></nav>

        <div class="player-head">
            ${photoHtml}
            <div>
                <h1>${name} CS2 Crosshair</h1>
                <p class="player-team">${badge}${team}</p>
                <p class="player-date">Last update: <time datetime="${isoDate(player.updated)}">${esc(player.updated)}</time></p>
            </div>
        </div>

        <canvas id="preview" class="preview player-preview" width="760" height="300" role="img" aria-label="${name} CS2 crosshair preview"></canvas>

        <div class="field">
            <div class="field-label">Share code <span>· Settings › Crosshair › Import</span></div>
            <div class="field-row">
                <code id="code" class="code">${esc(player.code)}</code>
                <button type="button" id="copy" class="mini">Copy</button>
            </div>
        </div>

        <div class="field">
            <div class="field-label">Console <span>· Paste in the CS2 console (~)</span></div>
            <div class="field-row">
                <code id="console" class="console">${esc(consoleCommands(player.code))}</code>
                <button type="button" id="copy-console" class="mini btn-secondary">Copy</button>
            </div>
        </div>

        <h2>About ${name}'s crosshair</h2>
        <p>${intro}</p>
        ${crosshairDetails(player.code)}
        ${insights ? insights.html : ""}

        <h2>How to use ${name}'s crosshair in CS2</h2>
        <ol>
            <li>Click <strong>Copy</strong> next to the share code.</li>
            <li>In CS2, open <strong>Settings › Game › Crosshair</strong>.</li>
            <li>Click <strong>Share or Import</strong> and paste the code.</li>
        </ol>
        <p>Or copy the console commands, open the CS2 console (~) and paste them. <a href="../faq.html">More questions in the FAQ ›</a></p>
        ${/^CS(?!GO-)/.test(player.code) ? `<p><a href="../generator.html#${esc(player.code)}">Edit ${name}'s crosshair in the CS2 crosshair generator ›</a></p>` : ""}
        ${skinPlayers.some(function (s) { return s.name === player.name; }) ? `<p><a href="../skins/${slug(player.name)}.html">See ${name}'s CS2 skins &amp; inventory ›</a></p>` : ""}

        ${insights ? `<h2>${name} crosshair FAQ</h2>
${insights.faq.map(function (q) {
            return `        <h3>${esc(q[0])}</h3>
        <p>${esc(q[1])}</p>`;
        }).join("\n")}` : ""}

        ${matesHtml}
    </main>

    ${footer("../")}

    <script type="module">
        import { copyText, drawCrosshair } from "../crosshair.js?v=${CROSSHAIR_HASH}";

        drawCrosshair(document.getElementById("preview"), document.getElementById("code").textContent);

        document.getElementById("copy").addEventListener("click", function (event) {
            copyText(document.getElementById("code").textContent, event.currentTarget);
        });
        document.getElementById("copy-console").addEventListener("click", function (event) {
            copyText(document.getElementById("console").textContent, event.currentTarget);
        });
    </script>
</body>
</html>
`;
        fs.writeFileSync("players/" + file, page);
    });

    // Supprimer les pages des joueurs qui ne sont plus dans players.json (ex. ancien nom)
    fs.readdirSync("players").forEach(function (f) {
        if (f.endsWith(".html") && !pageFiles.includes(f)) {
            fs.unlinkSync("players/" + f);
            console.log("Page supprimée (joueur absent de players.json) : players/" + f);
        }
    });

    // ===== 2. index.html : tout le contenu écrit d'avance (lisible par Google, rien à télécharger en plus) =====
    let index = fs.readFileSync("index.html", "utf8");

    function cardsFor(list) {
        return list.slice().sort(byTeamThenName).map(function (p, i) {
            const photo = photoFiles(p);
            return cardHTML(p, { photo: photo.sm, photoMd: photo.md, eager: i < EAGER_CARDS, logo: logoFor(p.team) });
        }).join("\n                        ");
    }
    const pros = players.filter(function (p) { return p.category === "pro"; });
    const creators = players.filter(function (p) { return p.category !== "pro"; });
    const trending = players.filter(function (p) { return p.trending; });
    index = replaceBetween(index, "CARDS:pros", cardsFor(pros), "                        ");
    index = replaceBetween(index, "CARDS:creators", cardsFor(creators), "                        ");
    index = replaceBetween(index, "CARDS:trending", trending.slice().sort(byTeamThenName).map(function (p) {
        const photo = photoFiles(p);
        return cardHTML(p, { photo: photo.sm, photoMd: photo.md, eager: false, logo: logoFor(p.team) });
    }).join("\n                        "), "                        ");

    // Menu des équipes (à gauche)
    const teamButtons = [`<button type="button" class="side-btn active" data-team="" aria-pressed="true">All crosshairs</button>`].concat(teams.map(function (t) {
        return `<button type="button" class="side-btn" data-team="${esc(t.name)}" aria-pressed="false">${teamBadge(t.name, logoFor(t.name), 22)}${esc(t.name)}</button>`;
    })).join("\n                ");
    index = replaceBetween(index, "TEAMS", teamButtons, "                ");

    // Compteurs des accès rapides ("70 pro players", "1 creator"...)
    function plural(n, one, many) {
        return n + " " + (n === 1 ? one : many);
    }
    const counts = {
        pros: plural(pros.length, "pro player", "pro players"),
        creators: plural(creators.length, "creator", "creators"),
        trending: trending.length + " trending now",
        skins: plural(skinPlayers.length, "inventory", "inventories")
    };
    // Le nombre de pros dans la description Google de l'accueil
    index = index.replace(/(NiKo and )\d+( pros in one click)/, "$1" + pros.length + "$2");
    Object.keys(counts).forEach(function (key) {
        index = index.replace(new RegExp(`(<span class="quick-count" data-count="${key}">)[^<]*(</span>)`), "$1" + counts[key] + "$2");
    });

    // Liste de tous les joueurs (en bas de page)
    const groups = teams.map(function (t) {
        return { title: t.name, list: players.filter(function (p) { return p.team === t.name; }) };
    });
    groups.push({ title: "Content creators", list: creators });
    const directory = `<div class="directory">\n${groups.filter(function (g) {
        return g.list.length > 0;
    }).map(function (g) {
        return `                    <div><h3>${esc(g.title)}</h3><p>${g.list.map(function (p) {
            return `<a href="players/${slug(p.name)}.html">${esc(p.name)}</a>`;
        }).join(", ")}</p></div>`;
    }).join("\n")}\n                </div>`;
    index = replaceBetween(index, "PLAYERS", directory, "                ");

    // Le générateur dans l'onglet Generator (son JavaScript ne se charge qu'au clic sur l'onglet)
    index = replaceBetween(index, "GENERATOR", generatorBlock, "                        ");

    // Menu de gauche, sous les équipes : les inventaires des pros, avec leur plus beau couteau (lien vers leur page)
    index = replaceBetween(index, "SKINSIDE", skinPlayers.length ? `<nav class="side-skins" aria-label="Pro inventories">
                <p class="side-title">Pro inventories</p>
                ${skinPlayers.map(function (p) {
                    const star = p.best.find(function (g) { return g.item.category === "knives"; }) || p.best[0];
                    return `<a class="side-skin" href="skins/${p.slug}.html" title="${esc(p.name)}'s CS2 skins"><span>${esc(p.name)}</span><img src="skins/img/${esc(star.item.image)}.webp" alt="${esc(p.name)}'s ${esc(star.item.name)}" width="48" height="36" loading="lazy" decoding="async"></a>`;
                }).join("\n                ")}
                <a class="side-skins-all" href="skins/">All pro skins ›</a>
            </nav>` : "", "            ");

    // L'onglet Pro Skins : un bouton par joueur + ses 12 plus beaux skins (la page complète est dans skins/)
    index = replaceBetween(index, "PROSKINS", skinPlayers.length ? `<div class="ps">
                            <div class="ps-players" role="group" aria-label="Choose a pro player">
                                ${skinPlayers.map(function (p, i) {
                                    return `<button type="button" class="ps-player" data-ps="${p.slug}" aria-pressed="${i === 0}" style="--team: ${teamColor(p.team)}; --on-team: ${textOnColor(teamColor(p.team))}">${skinPhoto(p, "", 40, 45)}<span class="ps-text"><span class="ps-name">${esc(p.name)}</span><span class="ps-info">${p.items.length} skins${p.hasPrices ? " · " + money(p.value, "USD") : ""}</span></span></button>`;
                                }).join("\n                                ")}
                            </div>
                            ${skinPlayers.map(function (p, i) {
                                return `<div class="ps-panel${i === 0 ? "" : " hidden"}" data-ps-panel="${p.slug}">
                                <p class="ps-summary">${esc(skinSummary(p))} <a href="skins/${p.slug}.html">See all ${p.items.length} skins of ${esc(p.name)} ›</a></p>
                                <div class="skin-grid">
                                ${p.best.slice(0, 12).map(function (g) { return skinCardHTML(g, p.name, "", false); }).join("\n                                ")}
                                </div>
                            </div>`;
                            }).join("\n                            ")}
                            <p class="ps-more"><a href="skins/">All CS2 pro inventories ›</a> · Updated ${esc(skinData.updated || "")}</p>
                            ${PRICE_NOTE ? `<p class="skin-note">${PRICE_NOTE}</p>` : ""}
                        </div>` : `<p class="empty">The weapon skins, knives and gloves of CS2 pro players. Coming soon!</p>`, "                        ");

    // Empreintes des fichiers CSS/JS dans index.html
    index = index
        .replace(/(href="style\.css\?v=)[^"]*/, "$1" + CSS_HASH)
        .replace(/(href="crosshair\.js\?v=)[^"]*/, "$1" + CROSSHAIR_HASH)
        .replace(/(src="script\.js\?v=)[^"]*/, "$1" + SCRIPT_HASH);
    fs.writeFileSync("index.html", index);

    // ===== 3. faq.html : la FAQ complète, avec des statistiques calculées sur les pros =====
    const decoded = pros.map(function (p) { return decode(p.code); }).filter(Boolean);
    const total = decoded.length;
    function percent(count) {
        return total ? Math.round((count / total) * 100) + "%" : "0%";
    }
    function colorFamily(c) {
        const r = c.red, g = c.green, b = c.blue;
        if (r > 200 && g > 200 && b > 200) return "white";
        if (g > 180 && b > 180 && r < 120) return "cyan";
        if (r > 180 && g > 180 && b < 120) return "yellow";
        if (g > 150 && r < 160 && b < 160) return "green";
        return "other colors";
    }
    const families = {};
    decoded.forEach(function (c) {
        const f = colorFamily(c);
        families[f] = (families[f] || 0) + 1;
    });
    const familyText = Object.keys(families).sort(function (a, b) {
        return families[b] - families[a];
    }).map(function (f) {
        return `${f} (${percent(families[f])})`;
    }).join(", ");
    const withDot = decoded.filter(function (c) { return c.centerDotEnabled; }).length;
    const withOutline = decoded.filter(function (c) { return c.outlineMode > 0; }).length;
    const smallGap = decoded.filter(function (c) { return c.gap <= 1; }).length;
    const newest = players.map(function (p) { return isoDate(p.updated); }).filter(Boolean).sort().pop() || "";

    const faq = [
        ["How do I import a crosshair code in CS2?",
            "Copy the share code, then in CS2 open Settings › Game › Crosshair, click Share or Import and paste the code. The crosshair is applied right away."],
        ["How do I use console commands instead of a share code?",
            "Open the CS2 console with the ~ key (enable the developer console in Settings › Game if needed), paste the console commands copied from ClutchCrosshair and press Enter."],
        ["Why don't old CSGO- crosshair codes work anymore?",
            "Since the CS2 update of September 30, 2026, crosshair share codes use a new format starting with CS (without dashes), and sizes are stored in pixels. Old CSGO-xxxxx codes can no longer be imported. Every code on ClutchCrosshair uses the new CS2 format."],
        ["Where do these pro crosshair codes come from?",
            "They are read directly from official CS2 match demos. Each code is the exact crosshair the player used in that match, and the date shown is the date of the match."],
        ["How often are the crosshairs updated?",
            "Every time we read a new official match demo of a team, the crosshairs of its players are checked and updated. The \"Last update\" date shows the most recent match where the crosshair was confirmed."],
        ["What is the most used crosshair by CS2 pros?",
            `Based on the ${total} pro crosshairs on ClutchCrosshair, the most used colors are ${familyText}. ${percent(smallGap)} of pros use a gap of 1 or less, ${percent(withDot)} use a center dot and ${percent(withOutline)} use an outline. Most pros play with a small static crosshair.`],
        ["What is the best CS2 crosshair?",
            "There is no single best crosshair: it should be easy to see on every map and not hide the enemy's head. A good start is to copy the crosshair of a pro you like, then adjust the color and the size to your screen."],
        ["Why does a crosshair look different in my game?",
            "In CS2, crosshair sizes are in pixels for a given screen height. If you play in a different resolution (for example 4:3 stretched) the crosshair can look slightly bigger or smaller than for the pro."],
        ["How do I share my own CS2 crosshair?",
            "In CS2, open Settings › Game › Crosshair and click Share or Import, then copy your code. Anyone can import it with the same button."],
        ["A crosshair is wrong or missing. How can I report it?",
            "Use the Contact us button on the home page. We check every report against the latest official match demos."]
    ];

    const faqUrl = `${SITE_URL}/faq.html`;
    const faqPage = {
        "@type": "FAQPage",
        "@id": faqUrl,
        "url": faqUrl,
        "isPartOf": { "@id": SITE_URL + "/#website" },
        "breadcrumb": { "@id": faqUrl + "#breadcrumb" },
        "mainEntity": faq.map(function (q) {
            return { "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } };
        })
    };
    if (newest) {
        faqPage.dateModified = newest;
    }

    fs.writeFileSync("faq.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: "CS2 Crosshair FAQ: Import Codes &amp; Pro Stats | ClutchCrosshair",
        ogTitle: "CS2 Crosshair FAQ",
        description: "How to import a CS2 crosshair code, why old CSGO- codes don't work anymore, and which crosshair CS2 pros use the most, with live stats.",
        url: faqUrl,
        prefix: "",
        jsonLd: { "@context": "https://schema.org", "@graph": [breadcrumb("CS2 crosshair FAQ", faqUrl), faqPage] }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("./")}
    <main class="player-page">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="./">CS2 Crosshairs</a> › <span>FAQ</span></nav>
        <h1>CS2 Crosshair FAQ</h1>
        <p>Everything about CS2 crosshair codes: how to import them, the new CS2 format, and what the pros use. Stats updated on ${newest ? esc(newest.split("-").reverse().join("/")) : "-"}.</p>
${faq.map(function (q) {
        return `        <h2>${esc(q[0])}</h2>
        <p>${esc(q[1])}</p>`;
    }).join("\n")}
        <p><a href="./">Browse all CS2 pro crosshairs ›</a></p>
    </main>
    ${footer("")}
</body>
</html>
`);

    // ===== 3 bis. generator.html : le générateur de crosshair CS2 (cible la recherche « CS2 crosshair generator ») =====
    function mostCommon(values) {
        const count = {};
        values.forEach(function (v) {
            count[v] = (count[v] || 0) + 1;
        });
        return Object.keys(count).sort(function (a, b) {
            return count[b] - count[a];
        })[0];
    }
    const famous = ["ZywOo", "donk", "m0NESY", "NiKo", "ropz", "sh1ro", "Twistzz", "b1t"].map(function (n) {
        return pros.find(function (p) { return p.name === n; });
    }).filter(Boolean);

    const genFaq = [
        ["Is this CS2 crosshair generator free?",
            "Yes. It is free, with no sign-up and no download. Everything runs in your browser."],
        ["How do I put my new crosshair in CS2?",
            "Click Copy next to your share code, then in CS2 open Settings › Game › Crosshair, click Share or Import and paste the code. You can also copy the console commands and paste them in the CS2 console (~)."],
        ["Why does my crosshair look different in 4:3 stretched?",
            "In 4:3 stretched (1280×960, 1024×768...) or 5:4 stretched (1280×1024), the game image is stretched to fill a 16:9 screen, so the crosshair gets wider: horizontal lines look longer and vertical lines thicker. Pick your resolution under the preview (16:9, 4:3, 16:10 or 5:4) to see exactly how your crosshair will look in game. Your crosshair code stays the same."],
        ["Can I start from a pro player's crosshair?",
            "Yes. Pick a pro in the Start from list, or paste any CS2 crosshair code, then change the color, size or gap. The new code updates instantly."],
        ["Does it work with old CSGO- crosshair codes?",
            "No. Since the CS2 update of September 30, 2026, only the new codes starting with CS can be imported in the game. The generator only creates new CS2 codes."]
    ];

    const genUrl = `${SITE_URL}/generator.html`;
    const genGraph = [
        {
            "@type": "WebPage",
            "@id": genUrl,
            "url": genUrl,
            "name": "CS2 Crosshair Generator",
            "inLanguage": "en",
            "isPartOf": { "@id": SITE_URL + "/#website" },
            "breadcrumb": { "@id": genUrl + "#breadcrumb" },
            "mainEntity": { "@id": genUrl + "#app" }
        },
        {
            "@type": "WebApplication",
            "@id": genUrl + "#app",
            "name": "CS2 Crosshair Generator",
            "url": genUrl,
            "description": "Free online CS2 crosshair generator: choose the color, length, thickness, gap and outline, see a real-size preview, then copy your CS2 crosshair code or console commands.",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Any",
            "browserRequirements": "Requires JavaScript",
            "isAccessibleForFree": true,
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
            "publisher": { "@id": SITE_URL + "/#organization" }
        },
        breadcrumb("CS2 crosshair generator", genUrl),
        {
            "@type": "FAQPage",
            "@id": genUrl + "#faq",
            "mainEntity": genFaq.map(function (q) {
                return { "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } };
            })
        }
    ];

    fs.writeFileSync("generator.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: "CS2 Crosshair Generator: Create Your Code | ClutchCrosshair",
        ogTitle: "CS2 Crosshair Generator",
        description: "Free CS2 crosshair generator: pick the color, size, gap and outline, see a real-size preview on a CS2 map, then copy your crosshair code or console commands.",
        url: genUrl,
        prefix: "",
        crosshair: true,
        generator: true,
        jsonLd: { "@context": "https://schema.org", "@graph": genGraph }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("./")}
    <main class="player-page gen-page">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="./">CS2 Crosshairs</a> › <span>Crosshair generator</span></nav>
        <h1>CS2 Crosshair Generator</h1>
        <p>Create your own CS2 crosshair in a few seconds: choose the color, length, thickness, gap and outline, see it live at real size on a CS2 map, then copy your crosshair code or console commands. Free, no sign-up, made for the new CS2 crosshair codes.</p>

        ${generatorBlock}

        <h2>How to use the CS2 crosshair generator</h2>
        <ol>
            <li>Start from scratch, from a <strong>pro crosshair</strong>, or paste your own code.</li>
            <li>Choose the <strong>color</strong>, then adjust the <strong>length</strong>, <strong>thickness</strong> and <strong>gap</strong>. The preview updates live.</li>
            <li>Pick <strong>your CS2 resolution</strong> under the preview to see the crosshair exactly as in game (4:3 stretched included).</li>
            <li>Click <strong>Copy</strong>, then in CS2 open <strong>Settings › Game › Crosshair › Share or Import</strong> and paste the code.</li>
        </ol>

        <h2>What crosshair do CS2 pros use?</h2>
        <p>Based on the ${total} pro crosshairs on ClutchCrosshair, the most used colors are ${esc(familyText)}. The most common settings are a length of ${mostCommon(decoded.map(function (c) { return c.length; }))}, a thickness of ${mostCommon(decoded.map(function (c) { return c.thickness; }))} and a gap of ${mostCommon(decoded.map(function (c) { return c.gap; }))} pixels; ${percent(withDot)} use a center dot and ${percent(withOutline)} an outline. <a href="faq.html">More stats in the FAQ ›</a></p>
        ${famous.length ? `<ul class="related">${famous.map(function (p) {
            return `<li><a href="players/${slug(p.name)}.html">${esc(p.name)} crosshair</a></li>`;
        }).join("")}</ul>` : ""}

        <h2>Crosshair generator FAQ</h2>
${genFaq.map(function (q) {
        return `        <h3>${esc(q[0])}</h3>
        <p>${esc(q[1])}</p>`;
    }).join("\n")}
        <p><a href="./">Browse all CS2 pro crosshairs ›</a></p>
    </main>
    ${footer("")}

    <script type="module">
        import { initGenerator } from "./generator.js?v=${GENERATOR_HASH}";
        initGenerator(document.getElementById("gen"), { syncHash: true });
    </script>
</body>
</html>
`);

    // ===== 3 ter. Les skins des pros : skins/index.html + une page par joueur (skins/<pseudo>.html) =====
    if (!fs.existsSync("skins")) {
        fs.mkdirSync("skins");
    }
    const skinFiles = ["index.html"];
    const skinsUrl = `${SITE_URL}/skins/`;
    const categoryLabel = Object.fromEntries(SKIN_CATEGORIES);

    function skinList(groups, max) {
        const names = groups.slice(0, max).map(function (g) {
            return g.item.name + (g.item.exterior !== "Vanilla" ? " (" + g.item.exterior + ")" : "");
        });
        return names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names.join("");
    }

    function skinBreadcrumb(name, url) {
        const list = [
            { "@type": "ListItem", "position": 1, "name": "CS2 Crosshairs", "item": SITE_URL + "/" },
            { "@type": "ListItem", "position": 2, "name": "CS2 Pro Skins", "item": skinsUrl }
        ];
        if (name) {
            list.push({ "@type": "ListItem", "position": 3, "name": name, "item": url });
        }
        return { "@type": "BreadcrumbList", "@id": (url || skinsUrl) + "#breadcrumb", "itemListElement": list };
    }

    skinPlayers.forEach(function (p) {
        const name = esc(p.name);
        const file = p.slug + ".html";
        const url = skinsUrl + file;
        const known = players.find(function (x) { return x.name === p.name; });
        const byCategory = SKIN_CATEGORIES.map(function (c) {
            return { key: c[0], label: c[1], groups: p.groups.filter(function (g) { return g.item.category === c[0]; }) };
        }).filter(function (c) { return c.groups.length > 0; });
        const knives = p.groups.filter(function (g) { return g.item.category === "knives"; });
        const gloves = p.groups.filter(function (g) { return g.item.category === "gloves"; });
        const top = p.best.slice(0, 2);
        skinFiles.push(file);

        const faq = [];
        faq.push([`How many CS2 skins does ${p.name} have?`,
            `${p.name}'s public Steam inventory has ${p.items.length} CS2 weapon skins (${p.groups.length} different), including ${knives.length} knife skin${knives.length === 1 ? "" : "s"} and ${gloves.length} pair${gloves.length === 1 ? "" : "s"} of gloves. Updated on ${p.updated}.`]);
        if (knives.length) {
            faq.push([`What knife does ${p.name} have in CS2?`, `${p.name} owns ${skinList(knives, 6)}.`]);
        }
        if (gloves.length) {
            faq.push([`What gloves does ${p.name} have in CS2?`, `${p.name} owns ${skinList(gloves, 6)}.`]);
        }
        if (p.hasPrices) {
            faq.unshift([`How much is ${p.name}'s CS2 inventory worth?`,
                `${p.name}'s CS2 skins are worth about ${money(p.value, "USD")} (${money(p.valueEur, "EUR")}), based on the lowest CSFloat listing of each skin on ${skinData.prices.updated}. The most expensive one is ${p.best[0].item.marketName} at ${formatPrice(p.best[0].item.price, "USD")}.`]);
        }
        faq.push([`Are these skin floats exact?`,
            `Yes. Every float on this page is the exact wear value of the item, read from ${p.name}'s public Steam inventory.`]);

        // Description Google : 160 caractères maximum (la fin n'est ajoutée que s'il reste de la place)
        const descriptionStart = p.hasPrices
            ? `${p.name}'s CS2 inventory is worth about ${money(p.value, "USD")}: ${p.items.length} skins incl. ${top.map(function (g) { return g.item.name; }).join(" and ")}.`
            : `${p.name}'s CS2 inventory: ${p.items.length} skins${top.length ? " incl. " + top.map(function (g) { return g.item.name; }).join(" and ") : ""}.`;
        const descriptionEnd = p.hasPrices ? " Prices, exact floats and wear." : ` Exact floats and wear, updated ${p.updated}.`;
        const description = descriptionStart + ((descriptionStart + descriptionEnd).length <= 160 ? descriptionEnd : "");
        const graph = [
            {
                "@type": "CollectionPage",
                "@id": url,
                "url": url,
                "name": `${p.name} CS2 Skins & Inventory`,
                "description": description,
                "inLanguage": "en",
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "about": { "@id": url + "#person" },
                "breadcrumb": { "@id": url + "#breadcrumb" },
                "dateModified": isoDate(p.updated),
                "mainEntity": {
                    "@type": "ItemList",
                    "name": `${p.name}'s CS2 skins`,
                    "numberOfItems": p.groups.length,
                    "itemListElement": p.groups.slice(0, 30).map(function (g, i) {
                        return { "@type": "ListItem", "position": i + 1, "name": g.item.marketName, "image": `${SITE_URL}/skins/img/${g.item.image}.webp` };
                    })
                }
            },
            skinBreadcrumb(p.name + " skins", url),
            {
                "@type": "Person",
                "@id": url + "#person",
                "name": p.name,
                "description": `${p.name} is a CS2 pro player${p.team ? " for " + p.team : ""}.`,
                "url": known ? `${SITE_URL}/players/${slug(known.name)}.html` : url
            },
            {
                "@type": "FAQPage",
                "@id": url + "#faq",
                "mainEntity": faq.map(function (q) {
                    return { "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } };
                })
            }
        ];
        if (profileLinks(known).length) {
            graph[2].sameAs = profileLinks(known);
        }
        if (p.team) {
            graph[2].memberOf = { "@type": "SportsTeam", "name": p.team, "sport": "Counter-Strike 2" };
        }
        const others = skinPlayers.filter(function (o) { return o !== p; });

        fs.writeFileSync("skins/" + file, `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: `${name} CS2 Skins &amp; Inventory${p.hasPrices ? " Value" : ""} (2026) | ClutchCrosshair`,
        ogTitle: `${name} CS2 Skins & Inventory`,
        description: description,
        url: url,
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": graph }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../")}

    <main class="player-page skins-page" style="--team: ${teamColor(p.team)}; --on-team: ${textOnColor(teamColor(p.team))}">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../">CS2 Crosshairs</a> › <a href="./">Pro skins</a> › <span>${name}</span></nav>

        <div class="player-head">
            ${skinPhoto(p, "../", 120, 134, "player-photo", true)}
            <div>
                <h1>${name} CS2 Skins</h1>
                ${p.team ? `<p class="player-team">${logoFor(p.team) ? `<img class="player-team-logo" src="../${logoFor(p.team)}" alt="" width="20" height="20">` : ""}${esc(p.team)}</p>` : ""}
                <p class="player-date">${p.items.length} skins${p.hasPrices ? ` · <strong>${money(p.value, "USD")}</strong> / ${money(p.valueEur, "EUR")}` : ""} · Updated <time datetime="${isoDate(p.updated)}">${esc(p.updated)}</time></p>
            </div>
        </div>

        <p>${esc(skinSummary(p))} ${top.length ? `${name}'s ${p.hasPrices ? "most expensive" : "rarest"} items are ${esc(skinList(top, 2))}.` : ""} Every float is the exact wear value read from ${name}'s public Steam inventory.${known ? ` Looking for ${name}'s crosshair? <a href="../players/${slug(known.name)}.html">Copy ${name}'s CS2 crosshair ›</a>` : ""}</p>

        <nav class="skin-jump" aria-label="Skin categories">
            ${byCategory.map(function (c) {
                return `<a href="#${c.key}">${c.label} <span>${c.groups.reduce(function (n, g) { return n + g.count; }, 0)}</span></a>`;
            }).join("\n            ")}
        </nav>
        ${PRICE_NOTE ? `<p class="skin-note">${PRICE_NOTE}</p>` : ""}

${p.hasPrices ? `        <section class="skin-section" id="most-expensive" aria-labelledby="most-expensive-title">
            <h2 id="most-expensive-title">${name}'s most expensive skins</h2>
            <div class="skin-grid">
            ${p.best.slice(0, 8).map(function (g, i) { return skinCardHTML(g, p.name, "../", i < 4); }).join("\n            ")}
            </div>
        </section>
` : ""}${byCategory.map(function (c, ci) {
        return `        <section class="skin-section" id="${c.key}" aria-labelledby="${c.key}-title">
            <h2 id="${c.key}-title">${name}'s ${c.label.toLowerCase()}</h2>
            <div class="skin-grid">
            ${c.groups.map(function (g, i) { return skinCardHTML(g, p.name, "../", ci === 0 && i < 4); }).join("\n            ")}
            </div>
        </section>`;
    }).join("\n")}

        <h2>${name} skins FAQ</h2>
${faq.map(function (q) {
        return `        <h3>${esc(q[0])}</h3>
        <p>${esc(q[1])}</p>`;
    }).join("\n")}

        ${others.length ? `<h2>Other CS2 pro inventories</h2>
        <ul class="related">${others.map(function (o) {
            return `<li><a href="${o.slug}.html">${esc(o.name)} skins</a></li>`;
        }).join("")}</ul>` : ""}
    </main>

    ${footer("../")}
</body>
</html>
`);
    });

    // La page d'accueil des skins : tous les pros + leurs couteaux et gants
    if (skinPlayers.length) {
        const hubDescription = `CS2 pro skins and inventories: the knives, gloves and weapon skins of ${skinPlayers.map(function (p) { return p.name; }).join(", ")}, with exact floats. Updated ${skinData.updated}.`;
        fs.writeFileSync("skins/index.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: "CS2 Pro Skins &amp; Inventories (2026) | ClutchCrosshair",
        ogTitle: "CS2 Pro Skins & Inventories",
        description: hubDescription,
        url: skinsUrl,
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": [
            {
                "@type": "CollectionPage",
                "@id": skinsUrl,
                "url": skinsUrl,
                "name": "CS2 Pro Skins & Inventories",
                "description": hubDescription,
                "inLanguage": "en",
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "breadcrumb": { "@id": skinsUrl + "#breadcrumb" },
                "dateModified": isoDate(skinData.updated),
                "mainEntity": {
                    "@type": "ItemList",
                    "itemListElement": skinPlayers.map(function (p, i) {
                        return { "@type": "ListItem", "position": i + 1, "name": p.name + " CS2 skins", "url": skinsUrl + p.slug + ".html" };
                    })
                }
            },
            skinBreadcrumb(null, null)
        ] }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../")}

    <main class="player-page skins-page">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../">CS2 Crosshairs</a> › <span>Pro skins</span></nav>
        <h1>CS2 Pro Skins</h1>
        <p>The real CS2 inventories of the best pro players: every knife, pair of gloves and weapon skin, with its exact float and wear, read from their public Steam inventories, with the price of every skin and the total value of each inventory. Updated on ${esc(skinData.updated)}.</p>
        ${PRICE_NOTE ? `<p class="skin-note">${PRICE_NOTE}</p>` : ""}

        <div class="ps-tiles">
            ${skinPlayers.map(function (p) {
                const best = p.best[0];
                return `<a class="ps-tile" href="${p.slug}.html" style="--team: ${teamColor(p.team)}; --on-team: ${textOnColor(teamColor(p.team))}">
                ${skinPhoto(p, "../", 56, 63)}
                <span class="ps-text"><span class="ps-name">${esc(p.name)}</span>${p.team ? `<span class="ps-info">${esc(p.team)}</span>` : ""}<span class="ps-info">${p.items.length} skins${p.hasPrices ? " · " + money(p.value, "USD") : ""}</span></span>
                <img class="ps-tile-skin" src="img/${esc(best.item.image)}.webp" alt="${esc(p.name)}'s ${esc(best.item.name)}" width="80" height="60" loading="lazy" decoding="async">
            </a>`;
            }).join("\n            ")}
        </div>

${skinPlayers.map(function (p) {
        const special = p.groups.filter(function (g) { return g.item.category === "knives" || g.item.category === "gloves"; });
        const shown = (special.length ? special : p.groups).slice(0, 8);
        return `        <section class="skin-section" aria-labelledby="hub-${p.slug}">
            <h2 id="hub-${p.slug}">${esc(p.name)}'s ${special.length ? "knives &amp; gloves" : "best skins"}</h2>
            <div class="skin-grid">
            ${shown.map(function (g) { return skinCardHTML(g, p.name, "../", false); }).join("\n            ")}
            </div>
            <p><a href="${p.slug}.html">See all ${p.items.length} skins of ${esc(p.name)} ›</a></p>
        </section>`;
    }).join("\n")}
    </main>

    ${footer("../")}
</body>
</html>
`);
    }

    // Supprimer les pages de skins des joueurs retirés (ou devenus privés)
    fs.readdirSync("skins").forEach(function (f) {
        if (f.endsWith(".html") && !skinFiles.includes(f)) {
            fs.unlinkSync("skins/" + f);
            console.log("Page supprimée : skins/" + f);
        }
    });

    // ===== 4. legal.html : mentions légales (obligatoires en France) =====
    fs.writeFileSync("legal.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: "Legal notice | ClutchCrosshair",
        description: "Legal notice of ClutchCrosshair: publisher, hosting, trademarks and privacy. No ads, no tracking cookies and no personal data collected.",
        url: `${SITE_URL}/legal.html`,
        prefix: ""
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("./")}
    <main class="player-page">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="./">CS2 Crosshairs</a> › <span>Legal notice</span></nav>
        <h1>Legal notice</h1>

        <h2>Publisher</h2>
        <p>ClutchCrosshair is published by ${esc(PUBLISHER_NAME)}, private individual (France).<br>
        Contact: ${esc(PUBLISHER_EMAIL)}<br>
        Publication director: ${esc(PUBLISHER_NAME)}.</p>

        <h2>Hosting</h2>
        <p>GitHub Pages, GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, United States (pages.github.com).</p>

        <h2>Intellectual property</h2>
        <p>Counter-Strike and CS2 are trademarks of Valve Corporation. Team names and logos are trademarks of their respective owners. Player photos belong to their respective owners. ClutchCrosshair is not affiliated with Valve, the teams or the players. If you own a content and want it removed, contact us and we will remove it quickly.</p>
        <p>Crosshair codes are game settings read from public match demos. Fonts (Inter, Barlow Condensed, JetBrains Mono) are used under the SIL Open Font License.</p>

        <h2>Privacy</h2>
        <p>ClutchCrosshair does not use advertising or tracking cookies and does not collect personal data. Your light/dark mode choice is only stored in your own browser (localStorage). Everything, fonts included, is served from this site: your browser does not contact any third-party server.</p>

        <h2>Mentions légales (français)</h2>
        <p>Éditeur et directeur de la publication : ${esc(PUBLISHER_NAME)}, particulier (France). Contact : ${esc(PUBLISHER_EMAIL)}.<br>
        Hébergeur : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.<br>
        Counter-Strike et CS2 sont des marques de Valve Corporation. Les noms et logos des équipes et les photos des joueurs appartiennent à leurs propriétaires respectifs. Le site n'utilise pas de cookies publicitaires ni de suivi, et ne contacte aucun serveur tiers.</p>
    </main>
    ${footer("")}
</body>
</html>
`);

    // ===== 5. Le sitemap : toutes les pages, leur date de mise à jour et la photo des joueurs (Google Images) =====
    let urls = `    <url><loc>${SITE_URL}/</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>\n`;
    urls += `    <url><loc>${genUrl}</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>\n`;
    urls += `    <url><loc>${faqUrl}</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>\n`;
    if (skinPlayers.length) {
        urls += `    <url><loc>${skinsUrl}</loc>${isoDate(skinData.updated) ? `<lastmod>${isoDate(skinData.updated)}</lastmod>` : ""}</url>\n`;
    }
    skinPlayers.forEach(function (p) {
        // Les 10 plus beaux skins de la page dans le sitemap (Google Images : "ZywOo knife"...)
        const images = p.groups.slice(0, 10).map(function (g) {
            return `<image:image><image:loc>${SITE_URL}/skins/img/${g.item.image}.webp</image:loc></image:image>`;
        }).join("");
        urls += `    <url><loc>${skinsUrl}${p.slug}.html</loc>${isoDate(p.updated) ? `<lastmod>${isoDate(p.updated)}</lastmod>` : ""}${images}</url>\n`;
    });
    players.forEach(function (player) {
        const lastmod = isoDate(player.updated);
        const photo = photoFiles(player).original;
        urls += `    <url><loc>${SITE_URL}/players/${slug(player.name)}.html</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${photo ? `<image:image><image:loc>${SITE_URL}/${esc(photo)}</image:loc></image:image>` : ""}</url>\n`;
    });
    fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}</urlset>
`);

    // ===== 6. La page 404 (adresses absolues : elle peut s'afficher à n'importe quelle adresse) =====
    fs.writeFileSync("404.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: "Page not found | ClutchCrosshair",
        description: "This page doesn't exist.",
        url: SITE_URL + "/",
        prefix: SITE_URL + "/",
        noindex: true
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop(SITE_URL + "/")}
    <main class="player-page not-found">
        <h1>404 · Page not found</h1>
        <p>This page doesn't exist (or a player changed their name). Find every CS2 pro crosshair on the home page.</p>
        <p><a class="contact-btn" href="${SITE_URL}/">Back to all CS2 crosshairs</a></p>
    </main>
    ${footer(SITE_URL + "/")}
</body>
</html>
`);

    console.log(skinPlayers.length + " pages skins + skins/index.html");
    console.log(players.length + " pages joueurs + accueil + generator.html + faq.html + legal.html + sitemap.xml + 404.html (css " + CSS_HASH + ", js " + SCRIPT_HASH + ")");
}

main();
