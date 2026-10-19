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

    // Petite maison au début du fil d'Ariane (retour à l'accueil, présent sur toutes les pages)
    const HOME_ICON = `<svg class="crumb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3L12 3Z"/></svg>`;

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

    // Le menu principal, le même sur toutes les pages. Une rubrique n'apparaît que si ses pages existent
    // (jamais de lien vers une page vide). current = la rubrique de la page (soulignée en rouge)
    function mainNav(prefix, current) {
        const sections = [
            { key: "crosshairs", label: "Crosshairs", href: "" },
            { key: "skins", label: "Pro Skins", href: "skins/", show: skinPlayers.length > 0 },
            { key: "guides", label: "Guides", href: "guides/", show: fs.existsSync("guides.json") },
            { key: "commands", label: "Commands", href: "commands/", show: fs.existsSync("commands.json") },
            // Tant qu'il n'y a qu'un seul outil, le lien mène directement au générateur de crosshair
            fs.existsSync("tools/bind-generator.html") || fs.existsSync("binds.json")
                ? { key: "tools", label: "Tools", href: "tools/" }
                : { key: "tools", label: "Generator", href: "generator.html" }
        ].filter(function (s) { return s.show !== false; });
        return `<nav class="main-nav" aria-label="Main">
            ${sections.map(function (s) {
                return `<a href="${(prefix + s.href) || "./"}"${s.key === current ? ' aria-current="page"' : ""}>${s.label}</a>`;
            }).join("\n            ")}
        </nav>`;
    }

    // En haut des pages : le logo (retour à l'accueil) + le menu principal
    function pageTop(prefix, current) {
        return `<header class="page-top">
        <a href="${prefix}" class="logo" aria-label="ClutchCrosshair home">
            <img class="logo-img logo-dark" src="${prefix}logo-horizontal-dark.svg" alt="ClutchCrosshair" width="114" height="40">
            <img class="logo-img logo-light" src="${prefix}logo-horizontal-light.svg" alt="ClutchCrosshair" width="114" height="40">
        </a>
        ${mainNav(prefix, current)}
    </header>`;
    }

    function footer(prefix) {
        return `<footer>
        <nav class="footer-links" aria-label="Footer">
            <a href="${prefix}generator.html">Crosshair Generator</a>
            <a href="${prefix}tools/bind-generator.html">Bind Generator</a>
            <a href="${prefix}skins/">CS2 Pro Skins</a>
            <a href="${prefix}guides/">CS2 Guides</a>
            <a href="${prefix}commands/">Console Commands</a>
            <a href="${prefix}faq.html">FAQ</a>
            <a href="${prefix}legal.html">Legal notice</a>
        </nav>
        <p>© 2026 ClutchCrosshair. All rights reserved.</p>
        <p>Counter-Strike 2 and CS2 skins are trademarks of Valve Corporation. Team logos are trademarks of their respective owners. ClutchCrosshair is not affiliated with Valve or the teams.</p>
    </footer>`;
    }

    // Fil d'Ariane (Accueil › page) pour Google
    function breadcrumb(name, url) {
        return {
            "@type": "BreadcrumbList",
            "@id": url + "#breadcrumb",
            "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL + "/" },
                { "@type": "ListItem", "position": 2, "name": name, "item": url }
            ]
        };
    }

    // Fil d'Ariane des outils pour Google : Home › Tools (› outil)
    function toolsBreadcrumb(name, url) {
        const list = [
            { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL + "/" },
            { "@type": "ListItem", "position": 2, "name": "CS2 Tools", "item": SITE_URL + "/tools/" }
        ];
        if (name) {
            list.push({ "@type": "ListItem", "position": 3, "name": name, "item": url });
        }
        return { "@type": "BreadcrumbList", "@id": (url || SITE_URL + "/tools/") + "#breadcrumb", "itemListElement": list };
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
    ${pageTop("../", "crosshairs")}

    <main class="player-page" style="--team: ${teamColor(player.team)}; --on-team: ${textOnColor(teamColor(player.team))}">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../" class="crumb-home">${HOME_ICON}Home</a> › <span>${name}</span></nav>

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
        <p>Or copy the console commands, open the CS2 console (~) and paste them.${fs.existsSync("commands.json") ? ` <a href="../commands/#crosshair">What does each crosshair command do? ›</a>` : ""} <a href="../faq.html">More questions in the FAQ ›</a></p>
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


    // Le menu principal (le même que sur les autres pages)
    index = replaceBetween(index, "MAINNAV", mainNav("", "crosshairs"), "                ");

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
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="./" class="crumb-home">${HOME_ICON}Home</a> › <span>FAQ</span></nav>
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
        toolsBreadcrumb("CS2 crosshair generator", genUrl),
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
    ${pageTop("./", "tools")}
    <main class="player-page gen-page">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="./" class="crumb-home">${HOME_ICON}Home</a> › <a href="tools/">Tools</a> › <span>Crosshair generator</span></nav>
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
            { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL + "/" },
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
    ${pageTop("../", "skins")}

    <main class="player-page skins-page" style="--team: ${teamColor(p.team)}; --on-team: ${textOnColor(teamColor(p.team))}">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../" class="crumb-home">${HOME_ICON}Home</a> › <a href="./">Pro skins</a> › <span>${name}</span></nav>

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
    ${pageTop("../", "skins")}

    <main class="player-page skins-page">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../" class="crumb-home">${HOME_ICON}Home</a> › <span>Pro skins</span></nav>
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

    // ===== 3 quater. Les commandes console CS2 : commands/index.html + une page par commande importante =====
    // Données : commands.json (status "check" = pas encore vérifiée en jeu -> pas publiée)
    const commandData = fs.existsSync("commands.json") ? JSON.parse(fs.readFileSync("commands.json", "utf8")) : null;
    const guideData = fs.existsSync("guides.json") ? JSON.parse(fs.readFileSync("guides.json", "utf8")) : null;
    // Les guides qui parlent d'une commande (liens "Learn more" sur la page de la commande)
    function guidesFor(name) {
        return guideData ? guideData.guides.filter(function (g) { return (g.commands || []).includes(name); }) : [];
    }
    const commandFiles = [];
    const commandsUrl = `${SITE_URL}/commands/`;
    if (commandData) {
        if (!fs.existsSync("commands")) {
            fs.mkdirSync("commands");
        }
        const published = commandData.commands.filter(function (c) { return c.status !== "check"; });
        const byCmd = new Map(published.map(function (c) { return [c.name, c]; }));
        const categoryName = Object.fromEntries(commandData.categories);
        const hasPage = function (c) { return c && c.page && /^[a-z0-9_]+$/.test(c.name); };
        const cmdFile = function (name) { return name + ".html"; };

        // Lien vers une commande : sa page si elle en a une, sinon sa ligne dans la liste
        function cmdHref(name, prefix) {
            const c = byCmd.get(name);
            if (!c) {
                return "";
            }
            return hasPage(c) ? prefix + cmdFile(name) : prefix + "#" + encodeURIComponent(name);
        }

        // Transforme les noms de commandes cités dans un texte en liens (sauf la commande de la page)
        // Seulement les noms techniques avec un "_" : "crosshair", "volume" ou "rate" sont aussi des mots normaux
        const linkable = published.map(function (c) { return c.name; }).filter(function (n) { return /^[a-z0-9_]+$/.test(n) && n.includes("_"); })
            .sort(function (a, b) { return b.length - a.length; });
        const linkPattern = new RegExp("(?<![\\w+])(" + linkable.join("|") + ")(?![\\w])", "g");
        function linkify(text, self, prefix) {
            return esc(text).replace(linkPattern, function (name) {
                return name === self ? `<code>${name}</code>` : `<a href="${cmdHref(name, prefix)}"><code>${name}</code></a>`;
            });
        }

        function copyRow(command) {
            return `<div class="field-row">
                <code>${esc(command)}</code>
                <button type="button" class="mini" data-copy>Copy</button>
            </div>`;
        }

        function badges(c) {
            return (c.status === "removed" ? `<span class="cmd-badge cmd-removed">Removed in CS2</span>` : "")
                + (c.cheat ? `<span class="cmd-badge">Needs sv_cheats</span>` : "");
        }

        // Statistiques réelles des pros pour les commandes de crosshair (contenu unique)
        const CROSSHAIR_FIELDS = {
            cl_crosshair_length: function (c) { return c.length; },
            cl_crosshair_thickness: function (c) { return c.thickness; },
            cl_crosshair_gap: function (c) { return c.gap; },
            cl_crosshair_screen_height: function (c) { return c.screenHeight; },
            cl_crosshairstyle: function (c) { return c.style; },
            cl_crosshairdot: function (c) { return c.centerDotEnabled ? 1 : 0; },
            cl_crosshair_t: function (c) { return c.tStyleEnabled ? 1 : 0; },
            cl_crosshair_drawoutline: function (c) { return c.outlineMode > 0 ? 1 : 0; },
            cl_crosshair_recoil: function (c) { return c.followRecoil ? 1 : 0; },
            cl_crosshaircolor_a: function (c) { return c.alpha; }
        };
        function proStats(c) {
            const read = CROSSHAIR_FIELDS[c.name];
            if (!read || !proCrosshairs.length) {
                return "";
            }
            const count = {};
            proCrosshairs.forEach(function (x) {
                const v = read(x.c);
                count[v] = (count[v] || 0) + 1;
            });
            const values = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; });
            const top = values[0];
            const examples = proCrosshairs.filter(function (x) { return String(read(x.c)) === top; }).slice(0, 6);
            const rows = values.slice(0, 5).map(function (v) {
                const share = Math.round(count[v] / proCrosshairs.length * 100);
                return `<div><dt><code>${esc(c.name)} ${esc(v)}</code></dt><dd><span class="cmd-bar"><i style="width: ${share}%"></i></span>${share}%</dd></div>`;
            }).join("");
            return `<h2>What value do CS2 pros use?</h2>
        <p>Among the ${proCrosshairs.length} pro crosshairs on ClutchCrosshair, read from official match demos, the most common value is <code>${esc(c.name)} ${esc(top)}</code> (${Math.round(count[top] / proCrosshairs.length * 100)}% of pros).</p>
        <dl class="cmd-stats">${rows}</dl>
        <p>Pros who use <code>${esc(c.name)} ${esc(top)}</code>:</p>
        <ul class="related">${examples.map(function (x) {
            return `<li><a href="../players/${slug(x.player.name)}.html">${esc(x.player.name)} crosshair</a></li>`;
        }).join("")}</ul>`;
        }

        function cmdBreadcrumb(name, url) {
            const list = [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL + "/" },
                { "@type": "ListItem", "position": 2, "name": "CS2 Console Commands", "item": commandsUrl }
            ];
            if (name) {
                list.push({ "@type": "ListItem", "position": 3, "name": name, "item": url });
            }
            return { "@type": "BreadcrumbList", "@id": (url || commandsUrl) + "#breadcrumb", "itemListElement": list };
        }

        function faqGraph(url, faq) {
            return {
                "@type": "FAQPage",
                "@id": url + "#faq",
                "mainEntity": faq.map(function (q) {
                    return { "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } };
                })
            };
        }

        function faqHtml(faq, title) {
            return `<h2>${title}</h2>
${faq.map(function (q) {
            return `        <h3>${esc(q[0])}</h3>
        <p>${esc(q[1])}</p>`;
        }).join("\n")}`;
        }

        // Petit script des pages de commandes : boutons Copy (+ recherche et filtres sur la liste)
        const COPY_SCRIPT = `import { copyText } from "../crosshair.js?v=${CROSSHAIR_HASH}";
        document.addEventListener("click", function (event) {
            const button = event.target.closest("[data-copy]");
            if (button) {
                copyText(button.closest(".field-row").querySelector("code").textContent, button);
            }
        });`;

        // --- Une page par commande importante ---
        published.filter(hasPage).forEach(function (c) {
            const url = commandsUrl + cmdFile(c.name);
            const name = esc(c.name);
            const removed = c.status === "removed";
            const replacement = c.replacement && byCmd.get(c.replacement);
            commandFiles.push(cmdFile(c.name));

            const faq = [[`What does ${c.name} do in CS2?`, `${c.summary} ${c.description}`]];
            if (removed) {
                faq.push([`Does ${c.name} work in CS2?`, `No. ${c.name} was a CS:GO command and does not exist in CS2.${replacement ? " Use " + replacement.name + " instead." : ""}`]);
            } else {
                if (c.default) {
                    faq.push([`What is the default value of ${c.name}?`, `The default value of ${c.name} in CS2 is ${c.default}.`]);
                }
                faq.push([`Does ${c.name} need sv_cheats?`, c.cheat
                    ? `Yes. ${c.name} only works with sv_cheats 1, on a server you host (a private match with bots, for example), never in official matchmaking.`
                    : `No. ${c.name} works without sv_cheats, including in official matchmaking.`]);
            }

            // Titre : le plus complet qui tient en 65 caractères (les noms de commandes peuvent être longs)
            const titles = removed
                ? [`${c.name} in CS2: Removed, What to Use Instead | ClutchCrosshair`, `${c.name} in CS2: Removed, Use This Instead`, `${c.name} removed in CS2`]
                : [`${c.name} CS2 Command: Values & Examples | ClutchCrosshair`, `${c.name} CS2 Command | ClutchCrosshair`, `${c.name} CS2 Command: Values & Examples`, `${c.name} CS2 Command`];
            const title = esc(titles.find(function (t) { return t.length <= 65; }) || titles[titles.length - 1]);
            // Description : résumé + première phrase de l'explication + fin, tant que ça tient en 160 caractères
            const sentences = c.description.split(/(?<=\.)\s/);
            const descEnd = removed ? " See what to use instead." : (c.default ? ` Default ${c.default}, values and examples.` : " Values and examples.");
            let descStart = `${c.name} in CS2: ${c.summary}`;
            let added = 0;
            sentences.forEach(function (s) {
                if (added === sentences.indexOf(s) && (descStart + " " + s + descEnd).length <= 160) {
                    descStart += " " + s;
                    added++;
                }
            });
            let description = descStart + descEnd;
            if (!added) {
                // Première phrase trop longue : on la coupe proprement à la fin d'un mot
                description = (descStart + " " + sentences[0]).slice(0, 157).replace(/\s+\S*$/, "") + "…";
            }
            const graph = [
                {
                    "@type": "TechArticle",
                    "@id": url + "#article",
                    "headline": `${c.name} CS2 console command`,
                    "description": description,
                    "url": url,
                    "inLanguage": "en",
                    "isPartOf": { "@id": SITE_URL + "/#website" },
                    "publisher": { "@id": SITE_URL + "/#organization" },
                    "dateModified": isoDate(commandData.updated),
                    "about": { "@type": "Thing", "name": "Counter-Strike 2" }
                },
                cmdBreadcrumb(c.name, url),
                faqGraph(url, faq)
            ];
            const related = (c.related || []).map(function (n) { return byCmd.get(n); }).filter(Boolean);

            fs.writeFileSync("commands/" + cmdFile(c.name), `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({ title: title, ogTitle: `${c.name} CS2 console command`, description: description, url: url, prefix: "../", jsonLd: { "@context": "https://schema.org", "@graph": graph } })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "commands")}

    <main class="player-page cmd-page">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../" class="crumb-home">${HOME_ICON}Home</a> › <a href="./">Commands</a> › <span>${name}</span></nav>
        <h1 class="cmd-title">${name}</h1>
        <p class="cmd-meta"><a href="./#${esc(c.category)}">${esc(categoryName[c.category] || c.category)}</a>${badges(c)}</p>
        <p class="cmd-lead">${linkify(c.summary, c.name, "")}${removed ? "" : " " + linkify(c.description, c.name, "")}</p>
        ${removed ? "" : copyRow(c.examples && c.examples[0] ? c.examples[0] : c.syntax)}

        ${removed ? `<h2>What to use instead in CS2</h2>
        <p>${linkify(c.description, c.name, "")}</p>
        ${replacement ? `<p>Use <a href="${cmdHref(replacement.name, "")}"><code>${esc(replacement.name)}</code></a> instead: ${esc(replacement.summary.charAt(0).toLowerCase() + replacement.summary.slice(1))}</p>
        ${copyRow(replacement.examples && replacement.examples[0] ? replacement.examples[0] : replacement.syntax)}` : (c.examples || []).map(copyRow).join("\n        ")}` : `<h2>Syntax</h2>
        <p><code class="cmd-syntax">${esc(c.syntax)}</code>${c.default ? ` · Default value: <code>${esc(c.default)}</code>` : ""}</p>
        ${c.values ? `<table class="cmd-values">
            <thead><tr><th scope="col">Value</th><th scope="col">What it does</th></tr></thead>
            <tbody>${c.values.map(function (v) { return `<tr><td><code>${esc(v[0])}</code></td><td>${esc(v[1])}</td></tr>`; }).join("")}</tbody>
        </table>` : ""}
        ${c.cheat ? `<p>This command needs <a href="${cmdHref("sv_cheats", "")}"><code>sv_cheats 1</code></a>: it only works on a server you host, never in official matchmaking.</p>` : ""}

        <h2>Examples</h2>
        ${(c.examples || []).map(copyRow).join("\n        ")}

        <h2>How to use ${name} in CS2</h2>
        <ol>
            <li>Enable the developer console in <strong>Settings › Game › Enable Developer Console</strong>.</li>
            <li>Press <strong>~</strong> to open the console, type the command and press <strong>Enter</strong>.</li>
            <li>To apply it every time you launch CS2, add the line to an <code>autoexec.cfg</code> file in your cfg folder.</li>
        </ol>`}

        ${proStats(c)}
        ${c.category === "crosshair" ? `<p>Want to try a crosshair before typing commands? Use the <a href="../generator.html">CS2 crosshair generator</a> or copy a <a href="../">pro crosshair</a>: every pro page gives you the full list of console commands.</p>` : ""}

        ${related.length ? `<h2>Related commands</h2>
        <ul class="related">${related.map(function (r) {
            return `<li><a href="${cmdHref(r.name, "")}">${esc(r.name)}</a></li>`;
        }).join("")}</ul>` : ""}

        ${guidesFor(c.name).length ? `<h2>Learn more</h2>
        <ul class="related">${guidesFor(c.name).map(function (g) {
            return `<li><a href="../guides/${g.slug}.html">${esc(g.title)}</a></li>`;
        }).join("")}</ul>` : ""}

        ${faqHtml(faq, `${name} FAQ`)}
        <p><a href="./">All CS2 console commands ›</a></p>
    </main>

    ${footer("../")}
    <script type="module">
        ${COPY_SCRIPT}
    </script>
</body>
</html>
`);
        });

        // --- La liste de toutes les commandes : recherche instantanée + filtres par catégorie ---
        const hubFaq = [
            ["How do I open the console in CS2?", "Go to Settings › Game and set Enable Developer Console to Yes. Then press the ~ key (under Escape) in game to open it. If your keyboard has no ~ key, bind toggleconsole to another key."],
            ["Do console commands work in competitive matchmaking?", "Most commands that change your own settings (crosshair, HUD, radar, mouse, audio) work everywhere. Commands marked Needs sv_cheats, and server commands starting with mp_ or bot_, only work on a server you host, for example a private match with bots."],
            ["How do I save my console commands?", "Put them in a file named autoexec.cfg in the game's cfg folder (game/csgo/cfg) and add +exec autoexec to your launch options, or type exec autoexec in the console."],
            ["Why does a CS:GO command not work in CS2?", "Many CS:GO commands were removed or renamed in CS2, such as net_graph. Commands marked Removed in CS2 on this page tell you what to use instead."]
        ];
        const hubDescription = `Every useful CS2 console command explained: crosshair, HUD, radar, FPS, network, practice and bot commands, with default values, examples and a Copy button.`;
        const pageList = published.filter(hasPage);
        const categoriesUsed = commandData.categories.filter(function (cat) {
            return published.some(function (c) { return c.category === cat[0]; });
        });
        fs.writeFileSync("commands/index.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: "CS2 Console Commands List (2026) | ClutchCrosshair",
        ogTitle: "CS2 Console Commands",
        description: hubDescription,
        url: commandsUrl,
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": [
            {
                "@type": "CollectionPage",
                "@id": commandsUrl,
                "url": commandsUrl,
                "name": "CS2 Console Commands",
                "description": hubDescription,
                "inLanguage": "en",
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "breadcrumb": { "@id": commandsUrl + "#breadcrumb" },
                "dateModified": isoDate(commandData.updated),
                "mainEntity": {
                    "@type": "ItemList",
                    "numberOfItems": pageList.length,
                    "itemListElement": pageList.map(function (c, i) {
                        return { "@type": "ListItem", "position": i + 1, "name": c.name, "url": commandsUrl + cmdFile(c.name) };
                    })
                }
            },
            cmdBreadcrumb(null, null),
            faqGraph(commandsUrl, hubFaq)
        ] }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "commands")}

    <main class="player-page cmd-hub">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../" class="crumb-home">${HOME_ICON}Home</a> › <span>Commands</span></nav>
        <h1>CS2 Console Commands</h1>
        <p>${published.length} useful CS2 console commands explained in plain English: what each one does, its values, its default and ready-to-copy examples. Commands from CS:GO that no longer work are marked <strong>Removed in CS2</strong>. Updated ${esc(commandData.updated)}.</p>

        <div class="cmd-tools">
            <div class="hero-search cmd-search">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>
                <input type="search" id="cmd-search" placeholder="Search a command, e.g. crosshair, fps, radar..." aria-label="Search a CS2 console command" autocomplete="off" spellcheck="false">
            </div>
            <div class="cmd-filters" role="group" aria-label="Filter by category">
                <button type="button" class="cmd-filter" data-cat="" aria-pressed="true">All <span>${published.length}</span></button>
                ${categoriesUsed.map(function (cat) {
                    return `<button type="button" class="cmd-filter" data-cat="${cat[0]}" aria-pressed="false">${esc(cat[1])} <span>${published.filter(function (c) { return c.category === cat[0]; }).length}</span></button>`;
                }).join("\n                ")}
            </div>
        </div>
        <p class="cmd-empty hidden" id="cmd-empty">No command found. Try another word, or type <code>find</code> followed by a word in the CS2 console.</p>

${categoriesUsed.map(function (cat) {
        return `        <section class="cmd-section" id="${cat[0]}" data-cat="${cat[0]}" aria-labelledby="${cat[0]}-title">
            <h2 id="${cat[0]}-title">${esc(cat[1])} commands</h2>
            <div class="cmd-grid">
            ${published.filter(function (c) { return c.category === cat[0]; }).map(function (c) {
                const search = [c.name, c.summary, c.description, cat[1]].join(" ").toLowerCase();
                const example = c.status === "removed" ? (byCmd.get(c.replacement) ? byCmd.get(c.replacement).examples[0] : null) : (c.examples && c.examples[0]) || c.syntax;
                return `<article class="cmd${c.status === "removed" ? " cmd-is-removed" : ""}" id="${esc(c.name)}" data-cat="${cat[0]}" data-search="${esc(search)}">
                <h3 class="cmd-name">${hasPage(c) ? `<a href="${cmdFile(c.name)}">${esc(c.name)}</a>` : esc(c.name)}${badges(c)}</h3>
                <p>${esc(c.summary)}${c.default ? ` <span class="cmd-default">Default: <code>${esc(c.default)}</code></span>` : ""}</p>
                ${example ? copyRow(example) : ""}
            </article>`;
            }).join("\n            ")}
            </div>
        </section>`;
    }).join("\n")}

        ${faqHtml(hubFaq, "CS2 console FAQ")}
    </main>

    ${footer("../")}
    <script type="module">
        ${COPY_SCRIPT}

        // Recherche instantanée + filtres par catégorie (#crosshair dans l'adresse = filtre direct)
        const input = document.getElementById("cmd-search");
        const filters = Array.from(document.querySelectorAll(".cmd-filter"));
        const items = Array.from(document.querySelectorAll(".cmd"));
        const sections = Array.from(document.querySelectorAll(".cmd-section"));
        const empty = document.getElementById("cmd-empty");
        let category = "";

        function apply() {
            const words = input.value.toLowerCase().trim().split(/\\s+/).filter(Boolean);
            items.forEach(function (item) {
                const show = (!category || item.dataset.cat === category) && words.every(function (w) { return item.dataset.search.includes(w); });
                item.classList.toggle("hidden", !show);
            });
            let any = false;
            sections.forEach(function (section) {
                const visible = section.querySelector(".cmd:not(.hidden)") !== null;
                section.classList.toggle("hidden", !visible);
                any = any || visible;
            });
            empty.classList.toggle("hidden", any);
        }

        function setCategory(value) {
            category = value;
            filters.forEach(function (f) { f.setAttribute("aria-pressed", f.dataset.cat === value ? "true" : "false"); });
            apply();
        }

        let frame = 0;
        input.addEventListener("input", function () {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(apply);
        });
        filters.forEach(function (f) {
            f.addEventListener("click", function () { setCategory(f.dataset.cat); });
        });
        function categoryFromAddress() {
            const fromAddress = decodeURIComponent(location.hash.slice(1));
            if (fromAddress && filters.some(function (f) { return f.dataset.cat === fromAddress; })) {
                setCategory(fromAddress);
            }
        }
        categoryFromAddress();
        window.addEventListener("hashchange", categoryFromAddress);
    </script>
</body>
</html>
`);
        commandFiles.push("index.html");

        // Supprimer les pages de commandes qui n'existent plus
        fs.readdirSync("commands").forEach(function (f) {
            if (f.endsWith(".html") && !commandFiles.includes(f)) {
                fs.unlinkSync("commands/" + f);
            }
        });
        console.log((commandFiles.length - 1) + " pages de commandes + commands/index.html (" + published.length + " commandes publiées, " + (commandData.commands.length - published.length) + " à vérifier)");
    }

    // ===== 3 quinquies. Les guides CS2 : guides/index.html + une page par guide (données : guides.json) =====
    const guideFiles = [];
    const guidesUrl = `${SITE_URL}/guides/`;
    if (guideData) {
        if (!fs.existsSync("guides")) {
            fs.mkdirSync("guides");
        }
        // Commandes qui ont leur propre page (pour les liens automatiques)
        const commandPages = new Set(commandData ? commandData.commands.filter(function (c) {
            return c.status !== "check" && c.page && /^[a-z0-9_]+$/.test(c.name);
        }).map(function (c) { return c.name; }) : []);

        function anchor(text) {
            return slug(text).slice(0, 60);
        }

        // Mise en forme simple des textes : `code` (lien si la commande a une page), **gras**, [texte](lien)
        function fmt(text) {
            return esc(text)
                .replace(/`([^`]+)`/g, function (all, code) {
                    return commandPages.has(code) ? `<a href="../commands/${code}.html"><code>${code}</code></a>` : `<code>${code}</code>`;
                })
                .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (all, label, href) {
                    return `<a href="${href.replace(/&amp;/g, "&")}">${label}</a>`;
                });
        }

        function plainText(text) {
            return String(text).replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
        }

        // Statistiques réelles des crosshairs des pros (blocs calculés)
        function share(test) {
            return Math.round(proCrosshairs.filter(test).length / proCrosshairs.length * 100);
        }
        function mostCommonValue(read) {
            const count = {};
            proCrosshairs.forEach(function (x) {
                const v = read(x.c);
                count[v] = (count[v] || 0) + 1;
            });
            const top = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
            return { value: top, share: Math.round(count[top] / proCrosshairs.length * 100) };
        }
        function statsTable(rows) {
            return `<table class="cmd-values">
            <thead><tr><th scope="col">Setting</th><th scope="col">What pros use</th><th scope="col">Share of pros</th></tr></thead>
            <tbody>${rows.map(function (r) { return `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`; }).join("")}</tbody>
        </table>`;
        }

        function block(b) {
            if (b.type === "p") {
                return `<p>${fmt(b.text)}</p>`;
            }
            if (b.type === "tip") {
                return `<p class="guide-tip">${fmt(b.text)}</p>`;
            }
            if (b.type === "list") {
                return `<ul>${b.items.map(function (i) { return `<li>${fmt(i)}</li>`; }).join("")}</ul>`;
            }
            if (b.type === "steps") {
                return `<ol>${b.items.map(function (i) { return `<li>${fmt(i)}</li>`; }).join("")}</ol>`;
            }
            if (b.type === "table") {
                return `<div class="table-wrap"><table class="cmd-values">
            <thead><tr>${b.head.map(function (h) { return `<th scope="col">${fmt(h)}</th>`; }).join("")}</tr></thead>
            <tbody>${b.rows.map(function (r) { return `<tr>${r.map(function (cell) { return `<td>${fmt(cell)}</td>`; }).join("")}</tr>`; }).join("")}</tbody>
        </table></div>`;
            }
            if (b.type === "copy") {
                return b.items.map(function (line) {
                    return `<div class="field-row"><code>${esc(line)}</code><button type="button" class="mini" data-copy>Copy</button></div>`;
                }).join("\n        ");
            }
            if (b.type === "config") {
                return `<div class="code-block"><pre><code>${b.lines.map(esc).join("\n")}</code></pre><button type="button" class="mini" data-copy>Copy</button></div>`;
            }
            if (b.type === "pro-crosshair-stats" && proCrosshairs.length) {
                const colors = mostCommonValue(colorName);
                const length = mostCommonValue(function (c) { return c.length; });
                const thick = mostCommonValue(function (c) { return c.thickness; });
                const gap = mostCommonValue(function (c) { return c.gap; });
                return statsTable([
                    ["Color", esc(colors.value), colors.share + "%"],
                    ["Style", "Static (<code>cl_crosshairstyle 4</code>)", share(function (x) { return x.c.style === 4; }) + "%"],
                    ["Length", "<code>cl_crosshair_length " + esc(length.value) + "</code>", length.share + "%"],
                    ["Thickness", "<code>cl_crosshair_thickness " + esc(thick.value) + "</code>", thick.share + "%"],
                    ["Gap", "<code>cl_crosshair_gap " + esc(gap.value) + "</code>", gap.share + "%"],
                    ["Center dot", "No dot", share(function (x) { return !x.c.centerDotEnabled; }) + "%"],
                    ["Outline", "No outline", share(function (x) { return !(x.c.outlineMode > 0); }) + "%"],
                    ["T-style", "Normal (with top line)", share(function (x) { return !x.c.tStyleEnabled; }) + "%"]
                ]) + `\n        <p class="guide-note">Based on ${proCrosshairs.length} pro crosshairs read from official match demos. Browse them all on the <a href="../">CS2 pro crosshairs page</a>.</p>`;
            }
            if (b.type === "pro-resolution-stats" && proCrosshairs.length) {
                const count = {};
                proCrosshairs.forEach(function (x) { count[x.c.screenHeight] = (count[x.c.screenHeight] || 0) + 1; });
                const heights = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 5);
                const label = { 960: "1280×960 (4:3)", 1080: "1920×1080 (16:9) or 1440×1080 (4:3)", 768: "1024×768 (4:3)", 1024: "1280×1024 (5:4)", 864: "1152×864 (4:3)", 1050: "1680×1050 (16:10)", 800: "1280×800 (16:10)", 1440: "2560×1440 (16:9)" };
                return `<div class="table-wrap"><table class="cmd-values">
            <thead><tr><th scope="col">Screen height in the code</th><th scope="col">Usual resolution</th><th scope="col">Pros</th></tr></thead>
            <tbody>${heights.map(function (h) {
                return `<tr><td><code>${esc(h)} px</code></td><td>${esc(label[h] || "-")}</td><td>${count[h]} (${Math.round(count[h] / proCrosshairs.length * 100)}%)</td></tr>`;
            }).join("")}</tbody>
        </table></div>`;
            }
            if (b.type === "sens-calc") {
                return `<form class="sens-calc" id="sens-calc" onsubmit="return false">
            <label>Mouse DPI <input type="number" id="calc-dpi" value="800" min="100" max="32000" step="50" inputmode="numeric"></label>
            <label>CS2 sensitivity <input type="number" id="calc-sens" value="1" min="0.01" max="20" step="0.01" inputmode="decimal"></label>
            <p class="sens-out" aria-live="polite">eDPI <strong id="out-edpi">800</strong> · <strong id="out-cm">52.0</strong> cm/360 · <strong id="out-in">20.5</strong> in/360</p>
            <label>Valorant sensitivity (optional) <input type="number" id="calc-val" min="0.01" max="10" step="0.001" inputmode="decimal" placeholder="e.g. 0.4"></label>
            <p class="sens-out" aria-live="polite">Same speed in CS2: <strong id="out-val">-</strong></p>
        </form>`;
            }
            return "";
        }

        const CALC_SCRIPT = `
        // Calculatrice de sensibilité : eDPI = DPI × sensibilité ; cm/360 = 2,54 × 360 / (DPI × sensibilité × 0,022)
        const dpi = document.getElementById("calc-dpi");
        const sens = document.getElementById("calc-sens");
        const val = document.getElementById("calc-val");
        function update() {
            const d = Number(dpi.value), s = Number(sens.value);
            const ok = d > 0 && s > 0;
            document.getElementById("out-edpi").textContent = ok ? Math.round(d * s) : "-";
            document.getElementById("out-cm").textContent = ok ? (2.54 * 360 / (d * s * 0.022)).toFixed(1) : "-";
            document.getElementById("out-in").textContent = ok ? (360 / (d * s * 0.022)).toFixed(1) : "-";
            const v = Number(val.value);
            document.getElementById("out-val").textContent = v > 0 ? (v * 0.07 / 0.022).toFixed(3) : "-";
        }
        [dpi, sens, val].forEach(function (input) { input.addEventListener("input", update); });
        update();`;

        const GUIDE_COPY_SCRIPT = `import { copyText } from "../crosshair.js?v=${CROSSHAIR_HASH}";
        document.addEventListener("click", function (event) {
            const button = event.target.closest("[data-copy]");
            if (button) {
                copyText(button.closest(".field-row, .code-block").querySelector("code").textContent, button);
            }
        });`;

        function guideBreadcrumb(name, url) {
            const list = [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_URL + "/" },
                { "@type": "ListItem", "position": 2, "name": "CS2 Guides", "item": guidesUrl }
            ];
            if (name) {
                list.push({ "@type": "ListItem", "position": 3, "name": name, "item": url });
            }
            return { "@type": "BreadcrumbList", "@id": (url || guidesUrl) + "#breadcrumb", "itemListElement": list };
        }

        const bySlug = new Map(guideData.guides.map(function (g) { return [g.slug, g]; }));

        guideData.guides.forEach(function (g) {
            const file = g.slug + ".html";
            const url = guidesUrl + file;
            guideFiles.push(file);
            const body = g.sections.map(function (s) {
                return `        <section aria-labelledby="${anchor(s.title)}">
            <h2 id="${anchor(s.title)}">${fmt(s.title)}</h2>
            ${s.blocks.map(block).join("\n            ")}
        </section>`;
            }).join("\n");
            const words = (g.intro + " " + body.replace(/<[^>]+>/g, " ")).split(/\s+/).filter(Boolean).length;
            const minutes = Math.max(2, Math.round(words / 220));
            const related = (g.related || []).map(function (s) { return bySlug.get(s); }).filter(Boolean);
            const commands = (g.commands || []).filter(function (n) { return commandPages.has(n); });
            const graph = [
                {
                    "@type": "Article",
                    "@id": url + "#article",
                    "headline": g.title,
                    "description": g.description,
                    "url": url,
                    "inLanguage": "en",
                    "isPartOf": { "@id": SITE_URL + "/#website" },
                    "author": { "@id": SITE_URL + "/#organization" },
                    "publisher": { "@id": SITE_URL + "/#organization" },
                    "dateModified": isoDate(guideData.updated),
                    "image": SITE_URL + "/og-image.jpg",
                    "about": { "@type": "Thing", "name": "Counter-Strike 2" }
                },
                guideBreadcrumb(g.title, url),
                {
                    "@type": "FAQPage",
                    "@id": url + "#faq",
                    "mainEntity": g.faq.map(function (q) {
                        return { "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } };
                    })
                }
            ];
            const hasCalc = g.sections.some(function (s) { return s.blocks.some(function (b) { return b.type === "sens-calc"; }); });

            fs.writeFileSync("guides/" + file, `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({ title: esc(g.seoTitle), ogTitle: esc(g.title), description: g.description, url: url, prefix: "../", jsonLd: { "@context": "https://schema.org", "@graph": graph } })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "guides")}

    <main class="player-page guide-page">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../" class="crumb-home">${HOME_ICON}Home</a> › <a href="./">Guides</a> › <span>${esc(g.title)}</span></nav>
        <h1 class="guide-title">${esc(g.title)}</h1>
        <p class="guide-meta">${esc(g.category)} · Updated <time datetime="${isoDate(guideData.updated)}">${esc(guideData.updated)}</time> · ${minutes} min read</p>
        <p class="guide-lead">${fmt(g.intro)}</p>

        <nav class="guide-toc" aria-label="On this page">
            <p class="guide-toc-title">On this page</p>
            <ol>${g.sections.map(function (s) { return `<li><a href="#${anchor(s.title)}">${esc(plainText(s.title))}</a></li>`; }).join("")}<li><a href="#faq">FAQ</a></li></ol>
        </nav>

${body}

        ${commands.length ? `<h2>Commands in this guide</h2>
        <ul class="related">${commands.map(function (n) { return `<li><a href="../commands/${n}.html">${esc(n)}</a></li>`; }).join("")}</ul>` : ""}

        <h2 id="faq">${esc(g.title.replace(/\s*\(\d{4}\)\s*/, " ").replace(/:.*$/, "").trim())} FAQ</h2>
${g.faq.map(function (q) {
        return `        <h3>${esc(q[0])}</h3>
        <p>${esc(q[1])}</p>`;
    }).join("\n")}

        ${related.length ? `<h2>More CS2 guides</h2>
        <ul class="related">${related.map(function (r) { return `<li><a href="${r.slug}.html">${esc(r.title)}</a></li>`; }).join("")}</ul>` : ""}
        <p><a href="./">All CS2 guides ›</a></p>
    </main>

    ${footer("../")}
    <script type="module">
        ${GUIDE_COPY_SCRIPT}${hasCalc ? CALC_SCRIPT : ""}
    </script>
</body>
</html>
`);
        });

        // La page d'accueil des guides
        const hubDescription = "Practical CS2 guides for every player: best settings, launch options, stretched resolution, sensitivity, FPS boost, crosshairs and aim training.";
        const categories = [...new Set(guideData.guides.map(function (g) { return g.category; }))];
        fs.writeFileSync("guides/index.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: "CS2 Guides: Settings, Aim &amp; Crosshair (2026) | ClutchCrosshair",
        ogTitle: "CS2 Guides",
        description: hubDescription,
        url: guidesUrl,
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": [
            {
                "@type": "CollectionPage",
                "@id": guidesUrl,
                "url": guidesUrl,
                "name": "CS2 Guides",
                "description": hubDescription,
                "inLanguage": "en",
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "breadcrumb": { "@id": guidesUrl + "#breadcrumb" },
                "dateModified": isoDate(guideData.updated),
                "mainEntity": {
                    "@type": "ItemList",
                    "itemListElement": guideData.guides.map(function (g, i) {
                        return { "@type": "ListItem", "position": i + 1, "name": g.title, "url": guidesUrl + g.slug + ".html" };
                    })
                }
            },
            guideBreadcrumb(null, null)
        ] }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "guides")}

    <main class="player-page guide-hub">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../" class="crumb-home">${HOME_ICON}Home</a> › <span>Guides</span></nav>
        <h1>CS2 Guides</h1>
        <p>Clear, practical guides to set up CS2 and play better: the settings that matter, the myths to forget, and what the pros really use. Updated ${esc(guideData.updated)}.</p>
${categories.map(function (cat) {
        return `        <section aria-labelledby="cat-${slug(cat)}">
            <h2 id="cat-${slug(cat)}">${esc(cat)}</h2>
            <div class="guide-cards">
            ${guideData.guides.filter(function (g) { return g.category === cat; }).map(function (g) {
                return `<a class="guide-card" href="${g.slug}.html"><span class="guide-card-title">${esc(g.title)}</span><span class="guide-card-desc">${esc(g.description)}</span></a>`;
            }).join("\n            ")}
            </div>
        </section>`;
    }).join("\n")}
        <h2>More tools</h2>
        <ul class="related">
            <li><a href="../commands/">CS2 console commands</a></li>
            <li><a href="../generator.html">CS2 crosshair generator</a></li>
            <li><a href="../">CS2 pro crosshairs</a></li>
        </ul>
    </main>

    ${footer("../")}
</body>
</html>
`);
        guideFiles.push("index.html");
        fs.readdirSync("guides").forEach(function (f) {
            if (f.endsWith(".html") && !guideFiles.includes(f)) {
                fs.unlinkSync("guides/" + f);
            }
        });
        console.log((guideFiles.length - 1) + " guides + guides/index.html");
    }

    // ===== 3 sexies. Les outils : tools/index.html + tools/bind-generator.html (données : binds.json) =====
    const bindData = fs.existsSync("binds.json") ? JSON.parse(fs.readFileSync("binds.json", "utf8")) : null;
    const toolsUrl = `${SITE_URL}/tools/`;
    const bindUrl = toolsUrl + "bind-generator.html";
    if (bindData) {
        if (!fs.existsSync("tools")) {
            fs.mkdirSync("tools");
        }
        const bq = function (key, cmd) { return `bind "${key}" "${cmd}"`; };
        const bindFaq = [
            ["How do I make a bind in CS2?", "Open the console (~) and type bind followed by the key and the command between quotes, for example bind \"kp_end\" \"buy ak47; buy m4a1\". The ClutchCrosshair bind generator writes the line for you."],
            ["Do buy binds still work in CS2?", "Yes. Buy commands such as buy ak47 or buy vesthelm work in CS2. They buy the weapon equipped in that slot of your loadout, so buy m4a1 gives you the M4A1-S if that is the one you equipped."],
            ["How do I remove a bind in CS2?", "Type unbind followed by the key in the console, for example unbind kp_end."],
            ["How do I save my CS2 binds?", "Binds you type in the console are saved automatically. To keep a full list safe, put your binds in an autoexec.cfg file in game/csgo/cfg and add +exec autoexec to your launch options. The generator can download that file for you."],
            ["What is a jump throw bind?", "A bind that jumps and releases your grenade at the same moment, so you throw the same lineup every time. Hold the grenade with the attack button pressed, then press your jump throw key."]
        ];
        const bindDescription = "Free CS2 bind generator: pick a key, choose what to buy or what to do, copy your bind command or download a ready-made autoexec.cfg. Buy binds, jump throw and more.";
        const allBuy = bindData.buy.flatMap(function (g) { return g[1]; });
        const bindGraph = [
            {
                "@type": "WebPage",
                "@id": bindUrl,
                "url": bindUrl,
                "name": "CS2 Bind Generator",
                "inLanguage": "en",
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "breadcrumb": { "@id": bindUrl + "#breadcrumb" },
                "mainEntity": { "@id": bindUrl + "#app" },
                "dateModified": isoDate(bindData.updated)
            },
            {
                "@type": "WebApplication",
                "@id": bindUrl + "#app",
                "name": "CS2 Bind Generator",
                "url": bindUrl,
                "description": bindDescription,
                "applicationCategory": "GameApplication",
                "operatingSystem": "Any",
                "browserRequirements": "Requires JavaScript",
                "isAccessibleForFree": true,
                "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
                "publisher": { "@id": SITE_URL + "/#organization" }
            },
            toolsBreadcrumb("CS2 bind generator", bindUrl),
            {
                "@type": "FAQPage",
                "@id": bindUrl + "#faq",
                "mainEntity": bindFaq.map(function (q) {
                    return { "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } };
                })
            }
        ];
        const options = function (list) {
            return list.map(function (o) { return `<option value="${esc(o[o.length === 3 ? 2 : 0])}">${esc(o[1])}</option>`; }).join("");
        };
        const copyRowHtml = function (command) {
            return `<div class="field-row"><code>${esc(command)}</code><button type="button" class="mini" data-copy>Copy</button></div>`;
        };

        fs.writeFileSync("tools/bind-generator.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({ title: "CS2 Bind Generator: Buy Binds &amp; Jump Throw | ClutchCrosshair", ogTitle: "CS2 Bind Generator", description: bindDescription, url: bindUrl, prefix: "../", jsonLd: { "@context": "https://schema.org", "@graph": bindGraph } })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "tools")}

    <main class="player-page bind-page">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../" class="crumb-home">${HOME_ICON}Home</a> › <a href="./">Tools</a> › <span>Bind generator</span></nav>
        <h1>CS2 Bind Generator</h1>
        <p>Create CS2 binds in a few clicks: choose a key, choose what it does (buy your weapons, jump throw, toggle the radar zoom...), then copy the command or download a ready-made autoexec.cfg. Free, no sign-up.</p>

        <div class="bind" id="bind-tool">
            <div class="bind-controls">
                <fieldset class="gen-group">
                    <legend>1. Choose a key</legend>
                    <div class="bind-key">
                        <select id="bind-key" aria-label="Key">
                            ${bindData.keys.map(function (g) {
                                return `<optgroup label="${esc(g[0])}">${g[1].map(function (k) { return `<option value="${esc(k[0])}">${esc(k[1])}</option>`; }).join("")}</optgroup>`;
                            }).join("")}
                        </select>
                        <button type="button" class="bind-capture" id="bind-capture">Press a key…</button>
                    </div>
                    <p class="gen-status" id="bind-key-status" aria-live="polite"></p>
                </fieldset>

                <fieldset class="gen-group">
                    <legend>2. Choose an action</legend>
                    <div class="bind-actions" role="group" aria-label="Action">
                        <button type="button" data-action="buy" aria-pressed="true">Buy</button>
                        <button type="button" data-action="jumpthrow" aria-pressed="false">Jump throw</button>
                        <button type="button" data-action="toggle" aria-pressed="false">Toggle</button>
                        <button type="button" data-action="volume" aria-pressed="false">Volume</button>
                        <button type="button" data-action="grenade" aria-pressed="false">Grenade</button>
                        <button type="button" data-action="other" aria-pressed="false">Other</button>
                        <button type="button" data-action="custom" aria-pressed="false">Custom</button>
                    </div>

                    <div class="bind-panel" data-panel="buy">
                        ${bindData.buy.map(function (g) {
                            return `<div class="bind-buy-group"><p class="gen-label">${esc(g[0])}</p><div class="bind-checks">${g[1].map(function (it) {
                                return `<label class="gen-toggle"><input type="checkbox" value="${esc(it[0])}" data-buy><span>${esc(it[1])}</span></label>`;
                            }).join("")}</div></div>`;
                        }).join("\n                        ")}
                    </div>
                    <div class="bind-panel hidden" data-panel="jumpthrow">
                        <p class="gen-hint">Hold your grenade with the attack button pressed, then press this key: you jump and throw at the same moment, for perfectly repeatable lineups.</p>
                    </div>
                    <div class="bind-panel hidden" data-panel="toggle">
                        <label class="gen-label" for="bind-toggle">Setting to switch</label>
                        <select id="bind-toggle">${options(bindData.toggles)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="volume">
                        <label class="gen-label" for="bind-volume">Direction</label>
                        <select id="bind-volume">${options(bindData.volume)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="grenade">
                        <label class="gen-label" for="bind-grenade">Grenade to select</label>
                        <select id="bind-grenade">${options(bindData.grenades)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="other">
                        <label class="gen-label" for="bind-other">Action</label>
                        <select id="bind-other">${options(bindData.other)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="custom">
                        <label class="gen-label" for="bind-custom">Any console command (separate several with ;)</label>
                        <input type="text" id="bind-custom" placeholder="e.g. say gg; disconnect" autocomplete="off" spellcheck="false">
                    </div>
                </fieldset>
            </div>

            <div class="bind-result">
                <div class="bind-now">
                    <div class="field-label">Your bind <span><i class="sep">· </i>Paste it in the CS2 console (~)</span></div>
                    <div class="code-block"><pre><code id="bind-output">${esc(bq("kp_end", "buy ak47"))}</code></pre><button type="button" class="mini" data-copy>Copy</button></div>
                    <button type="button" class="bind-add" id="bind-add">Add to my binds</button>
                </div>

                <div class="bind-mine">
                    <div class="field-label">My binds <span id="bind-count"></span></div>
                    <ul class="bind-list" id="bind-list"></ul>
                    <p class="gen-hint" id="bind-empty">Your binds will appear here. Add as many as you want, then copy them all or download your autoexec.cfg.</p>
                    <div class="bind-buttons">
                        <button type="button" class="mini" id="bind-copy-all">Copy all</button>
                        <button type="button" class="mini btn-secondary" id="bind-download">Download autoexec.cfg</button>
                        <button type="button" class="mini btn-secondary" id="bind-clear">Clear</button>
                    </div>
                </div>
            </div>
            <noscript><p class="gen-status gen-status-error">Turn on JavaScript to use the bind generator.</p></noscript>
        </div>

        <h2>How to use your CS2 binds</h2>
        <ol>
            <li>Build your bind above, then click <strong>Copy</strong>.</li>
            <li>In CS2, open the console with <strong>~</strong> (enable it in Settings › Game if needed), paste and press <strong>Enter</strong>.</li>
            <li>To keep several binds safe, click <strong>Download autoexec.cfg</strong>, put the file in <code>Counter-Strike Global Offensive/game/csgo/cfg</code> and add <code>+exec autoexec</code> to your <a href="../guides/cs2-launch-options.html">launch options</a>.</li>
        </ol>

        <h2>Popular CS2 binds</h2>
        <p>Ready-to-copy binds most players use. Change the key name if you want another key.</p>
        ${bindData.presets.map(function (p) {
            return `<h3>${esc(p[0])}</h3>
        ${copyRowHtml(bq(p[1], p[2]))}`;
        }).join("\n        ")}

        <h2>CS2 jump throw bind</h2>
        <p>A jump throw bind makes you jump and release the grenade at the exact same moment, so your smokes and flashes land in the same place every time. Paste these three lines (change the key in the last line):</p>
        <div class="code-block"><pre><code>alias "+jumpthrow" "+jump;-attack;-attack2"
alias "-jumpthrow" "-jump"
bind "v" "+jumpthrow"</code></pre><button type="button" class="mini" data-copy>Copy</button></div>

        <h2>CS2 buy commands list</h2>
        <p>Every buy command works in a bind, alone or several at once separated by <code>;</code>. Buy commands give you the weapon equipped in that slot of your loadout.</p>
        <div class="table-wrap"><table class="cmd-values">
            <thead><tr><th scope="col">Item</th><th scope="col">Buy command</th></tr></thead>
            <tbody>${allBuy.map(function (it) { return `<tr><td>${esc(it[1])}</td><td><code>buy ${esc(it[0])}</code></td></tr>`; }).join("")}</tbody>
        </table></div>

        <h2>CS2 bind generator FAQ</h2>
${bindFaq.map(function (q) {
        return `        <h3>${esc(q[0])}</h3>
        <p>${esc(q[1])}</p>`;
    }).join("\n")}

        <h2>Related</h2>
        <ul class="related">
            <li><a href="../commands/bind.html">bind command</a></li>
            <li><a href="../commands/alias.html">alias command</a></li>
            <li><a href="../commands/exec.html">exec command</a></li>
            <li><a href="../generator.html">CS2 crosshair generator</a></li>
            <li><a href="../guides/cs2-launch-options.html">CS2 launch options</a></li>
        </ul>
    </main>

    ${footer("../")}
    <script type="application/json" id="bind-data">${JSON.stringify({ toggles: bindData.toggles, volume: bindData.volume, grenades: bindData.grenades, other: bindData.other }).replace(/</g, "\\u003c")}</script>
    <script type="module">
        import { copyText } from "../crosshair.js?v=${CROSSHAIR_HASH}";

        // Boutons Copy (lignes simples et blocs de plusieurs lignes)
        document.addEventListener("click", function (event) {
            const button = event.target.closest("[data-copy]");
            if (button) {
                copyText(button.closest(".field-row, .code-block").querySelector("code").textContent, button);
            }
        });

        const $ = function (id) { return document.getElementById(id); };
        const keySelect = $("bind-key");
        const output = $("bind-output");
        let action = "buy";

        // Le texte du bind selon la touche et l'action choisies
        function lines() {
            const key = keySelect.value;
            const bind = function (cmd) { return ["bind \\"" + key + "\\" \\"" + cmd + "\\""]; };
            if (action === "buy") {
                const items = Array.from(document.querySelectorAll("[data-buy]:checked")).map(function (c) { return "buy " + c.value; });
                return items.length ? bind(items.join("; ")) : [];
            }
            if (action === "jumpthrow") {
                return ["alias \\"+jumpthrow\\" \\"+jump;-attack;-attack2\\"", "alias \\"-jumpthrow\\" \\"-jump\\"", "bind \\"" + key + "\\" \\"+jumpthrow\\""];
            }
            if (action === "custom") {
                const cmd = $("bind-custom").value.replace(/"/g, "").trim();
                return cmd ? bind(cmd) : [];
            }
            return bind($("bind-" + action).value);
        }

        function render() {
            const l = lines();
            output.textContent = l.length ? l.join("\\n") : (action === "buy" ? "Tick what to buy" : "Type a command");
            $("bind-add").disabled = !l.length;
        }

        // Choix de l'action
        document.querySelectorAll("[data-action]").forEach(function (button) {
            button.addEventListener("click", function () {
                action = button.dataset.action;
                document.querySelectorAll("[data-action]").forEach(function (b) { b.setAttribute("aria-pressed", b === button ? "true" : "false"); });
                document.querySelectorAll("[data-panel]").forEach(function (p) { p.classList.toggle("hidden", p.dataset.panel !== action); });
                render();
            });
        });
        document.getElementById("bind-tool").addEventListener("input", render);
        document.getElementById("bind-tool").addEventListener("change", render);

        // "Press a key" : on lit la prochaine touche (ou bouton de souris) et on la traduit en nom CS2
        const CODES = { Space: "space", Tab: "tab", CapsLock: "capslock", ShiftLeft: "shift", ShiftRight: "rshift", ControlLeft: "ctrl", ControlRight: "rctrl", AltLeft: "alt", AltRight: "ralt",
            Insert: "ins", Delete: "del", Home: "home", End: "end", PageUp: "pgup", PageDown: "pgdn", ArrowUp: "uparrow", ArrowDown: "downarrow", ArrowLeft: "leftarrow", ArrowRight: "rightarrow",
            Numpad0: "kp_ins", Numpad1: "kp_end", Numpad2: "kp_downarrow", Numpad3: "kp_pgdn", Numpad4: "kp_leftarrow", Numpad5: "kp_5", Numpad6: "kp_rightarrow", Numpad7: "kp_home",
            Numpad8: "kp_uparrow", Numpad9: "kp_pgup", NumpadDecimal: "kp_del", NumpadDivide: "kp_slash", NumpadMultiply: "kp_multiply", NumpadSubtract: "kp_minus", NumpadAdd: "kp_plus", NumpadEnter: "kp_enter",
            Backquote: "\`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Semicolon: "semicolon", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\\\", Enter: "enter", Backspace: "backspace" };
        const DEFAULT_KEYS = ["w", "a", "s", "d", "space", "ctrl", "shift", "e", "r", "q", "b", "tab", "mouse1", "mouse2", "1", "2", "3", "4", "5"];
        const status = $("bind-key-status");
        const capture = $("bind-capture");
        let listening = false;

        function setKey(name, label) {
            let option = Array.from(keySelect.options).find(function (o) { return o.value === name; });
            if (!option) {
                option = new Option(label || name.toUpperCase(), name);
                keySelect.add(option);
            }
            keySelect.value = name;
            status.textContent = DEFAULT_KEYS.includes(name) ? "Careful: " + name + " already has an important default action in CS2." : "Key set: " + name;
            status.classList.toggle("gen-status-error", DEFAULT_KEYS.includes(name));
            render();
        }

        function stopListening() {
            listening = false;
            capture.textContent = "Press a key…";
            capture.setAttribute("aria-pressed", "false");
        }

        capture.addEventListener("click", function () {
            listening = true;
            capture.textContent = "Waiting for a key…";
            capture.setAttribute("aria-pressed", "true");
            status.textContent = "Press the key you want to use (Escape to cancel).";
            status.classList.remove("gen-status-error");
        });
        document.addEventListener("keydown", function (event) {
            if (!listening) {
                return;
            }
            event.preventDefault();
            stopListening();
            if (event.code === "Escape") {
                status.textContent = "";
                return;
            }
            let name = CODES[event.code];
            if (!name && /^Key[A-Z]$/.test(event.code)) {
                name = event.code.slice(3).toLowerCase();
            } else if (!name && /^Digit\\d$/.test(event.code)) {
                name = event.code.slice(5);
            } else if (!name && /^F\\d{1,2}$/.test(event.code)) {
                name = event.code.toLowerCase();
            }
            if (name) {
                setKey(name);
            } else {
                status.textContent = "This key is not supported, choose one in the list.";
            }
        });
        document.addEventListener("mousedown", function (event) {
            const mouse = { 1: "mouse3", 3: "mouse4", 4: "mouse5" }[event.button];
            if (listening && mouse && event.target !== capture) {
                event.preventDefault();
                stopListening();
                setKey(mouse);
            }
        });

        // Ma liste de binds (gardée dans ce navigateur)
        let mine = [];
        try { mine = JSON.parse(localStorage.getItem("cc-binds") || "[]"); } catch (error) { mine = []; }
        function save() {
            try { localStorage.setItem("cc-binds", JSON.stringify(mine)); } catch (error) {}
        }
        function allText() {
            const out = [];
            mine.forEach(function (b) { b.lines.forEach(function (l) { if (!out.includes(l)) { out.push(l); } }); });
            return out.join("\\n");
        }
        function renderList() {
            const list = $("bind-list");
            list.textContent = "";
            mine.forEach(function (b, i) {
                const li = document.createElement("li");
                const code = document.createElement("code");
                code.textContent = b.lines[b.lines.length - 1];
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "bind-remove";
                remove.textContent = "Remove";
                remove.setAttribute("aria-label", "Remove the bind on " + b.key);
                remove.addEventListener("click", function () {
                    mine.splice(i, 1);
                    save();
                    renderList();
                });
                li.append(code, remove);
                list.appendChild(li);
            });
            $("bind-empty").classList.toggle("hidden", mine.length > 0);
            $("bind-count").textContent = mine.length ? "· " + mine.length : "";
            ["bind-copy-all", "bind-download", "bind-clear"].forEach(function (id) { $(id).disabled = !mine.length; });
        }
        $("bind-add").addEventListener("click", function () {
            const l = lines();
            if (!l.length) {
                return;
            }
            // Une seule action par touche : un nouveau bind sur la même touche remplace l'ancien
            mine = mine.filter(function (b) { return b.key !== keySelect.value; });
            mine.push({ key: keySelect.value, lines: l });
            save();
            renderList();
        });
        $("bind-copy-all").addEventListener("click", function (event) {
            copyText(allText(), event.currentTarget);
        });
        $("bind-download").addEventListener("click", function () {
            const text = "// CS2 binds made with ClutchCrosshair bind generator\\n" + allText() + "\\n";
            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
            link.download = "autoexec.cfg";
            document.body.appendChild(link);
            link.click();
            setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
        });
        $("bind-clear").addEventListener("click", function () {
            mine = [];
            save();
            renderList();
        });

        // Départ : AK-47 coché pour montrer un exemple
        const ak = document.querySelector("[data-buy][value=ak47]");
        if (ak && !document.querySelector("[data-buy]:checked")) {
            ak.checked = true;
        }
        render();
        renderList();
    </script>
</body>
</html>
`);

        // La page d'accueil des outils
        const toolsDescription = "Free CS2 tools: a crosshair generator with real-size preview and a bind generator for buy binds, jump throw and more.";
        fs.writeFileSync("tools/index.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: "Free CS2 Tools: Crosshair &amp; Bind Generator | ClutchCrosshair",
        ogTitle: "CS2 Tools",
        description: toolsDescription,
        url: toolsUrl,
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": [
            {
                "@type": "CollectionPage",
                "@id": toolsUrl,
                "url": toolsUrl,
                "name": "CS2 Tools",
                "description": toolsDescription,
                "inLanguage": "en",
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "breadcrumb": { "@id": toolsUrl + "#breadcrumb" },
                "mainEntity": { "@type": "ItemList", "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": "CS2 Crosshair Generator", "url": `${SITE_URL}/generator.html` },
                    { "@type": "ListItem", "position": 2, "name": "CS2 Bind Generator", "url": bindUrl }
                ] }
            },
            toolsBreadcrumb(null, null)
        ] }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "tools")}

    <main class="player-page guide-hub">
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="../" class="crumb-home">${HOME_ICON}Home</a> › <span>Tools</span></nav>
        <h1>CS2 Tools</h1>
        <p>Free tools to set up CS2 faster. Everything runs in your browser, with no sign-up.</p>
        <div class="guide-cards">
            <a class="guide-card" href="../generator.html"><span class="guide-card-title">CS2 Crosshair Generator</span><span class="guide-card-desc">Build your crosshair with a real-size preview on a CS2 map, see it in your resolution (4:3 stretched included), start from a pro crosshair and copy the code.</span></a>
            <a class="guide-card" href="bind-generator.html"><span class="guide-card-title">CS2 Bind Generator</span><span class="guide-card-desc">Pick a key and an action (buy binds, jump throw, radar zoom, volume...), copy the command or download a ready-made autoexec.cfg.</span></a>
        </div>
        <h2>More resources</h2>
        <ul class="related">
            <li><a href="../commands/">CS2 console commands</a></li>
            <li><a href="../guides/">CS2 guides</a></li>
            <li><a href="../">CS2 pro crosshairs</a></li>
        </ul>
    </main>

    ${footer("../")}
</body>
</html>
`);
        console.log("tools/index.html + tools/bind-generator.html");
    }

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
        <nav class="breadcrumb" aria-label="Breadcrumb"><a href="./" class="crumb-home">${HOME_ICON}Home</a> › <span>Legal notice</span></nav>
        <h1>Legal notice</h1>

        <h2>Publisher</h2>
        <p>ClutchCrosshair is published by ${esc(PUBLISHER_NAME)}, private individual (France).<br>
        Contact: ${esc(PUBLISHER_EMAIL)}<br>
        Publication director: ${esc(PUBLISHER_NAME)}.</p>

        <h2>Hosting</h2>
        <p>GitHub Pages, GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, United States (pages.github.com).</p>

        <h2>Intellectual property</h2>
        <p>Counter-Strike and CS2 are trademarks of Valve Corporation. Team names and logos are trademarks of their respective owners. Player photos belong to their respective owners. ClutchCrosshair is not affiliated with Valve, the teams or the players. If you own a content and want it removed, contact us and we will remove it quickly.</p>
        <p>Crosshair codes are game settings read from public match demos. Pro skins come from the players' public Steam inventories: skin names and images belong to Valve Corporation; skin prices come from CSFloat (lowest listing) and the euro rate from the European Central Bank. Fonts (Inter, Barlow Condensed, JetBrains Mono) are used under the SIL Open Font License.</p>

        <h2>Privacy</h2>
        <p>ClutchCrosshair does not use advertising or tracking cookies and does not collect personal data. Your light/dark mode choice is only stored in your own browser (localStorage). Everything, fonts included, is served from this site: your browser does not contact any third-party server.</p>

        <h2>Mentions légales (français)</h2>
        <p>Éditeur et directeur de la publication : ${esc(PUBLISHER_NAME)}, particulier (France). Contact : ${esc(PUBLISHER_EMAIL)}.<br>
        Hébergeur : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.<br>
        Counter-Strike et CS2 sont des marques de Valve Corporation ; les noms et images des skins appartiennent à Valve, les inventaires viennent de Steam et les prix de CSFloat. Les noms et logos des équipes et les photos des joueurs appartiennent à leurs propriétaires respectifs. Le site n'utilise pas de cookies publicitaires ni de suivi, et ne contacte aucun serveur tiers.</p>
    </main>
    ${footer("")}
</body>
</html>
`);

    // ===== 5. Le sitemap : toutes les pages, leur date de mise à jour et la photo des joueurs (Google Images) =====
    let urls = `    <url><loc>${SITE_URL}/</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>\n`;
    urls += `    <url><loc>${genUrl}</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>\n`;
    if (bindData) {
        urls += `    <url><loc>${toolsUrl}</loc><lastmod>${isoDate(bindData.updated)}</lastmod></url>\n`;
        urls += `    <url><loc>${bindUrl}</loc><lastmod>${isoDate(bindData.updated)}</lastmod></url>\n`;
    }
    if (guideData) {
        guideFiles.forEach(function (f) {
            urls += `    <url><loc>${guidesUrl}${f === "index.html" ? "" : f}</loc><lastmod>${isoDate(guideData.updated)}</lastmod></url>\n`;
        });
    }
    if (commandData) {
        commandFiles.forEach(function (f) {
            urls += `    <url><loc>${commandsUrl}${f === "index.html" ? "" : f}</loc><lastmod>${isoDate(commandData.updated)}</lastmod></url>\n`;
        });
    }
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
