// build.js : génère tout ce qui sert au référencement Google (SEO)
//   - les cartes des joueurs, écrites directement dans index.html (entre CARDS:...:START et CARDS:...:END)
//   - la liste de tous les joueurs dans index.html (entre PLAYERS:START et PLAYERS:END)
//   - une page complète par joueur (players/<slug>.html) — et supprime les pages des joueurs qui n'existent plus
//   - faq.html (FAQ complète, avec des statistiques calculées sur les crosshairs des pros)
//   - legal.html (mentions légales)
//   - sitemap.xml (avec la date de mise à jour de chaque page) et 404.html
// Lancer avec : node build.js   (à relancer après chaque changement de players.json)

const fs = require("fs");

const SITE_URL = "https://antonnisthomas13-sudo.github.io/ClutchCrosshair";

// Numéros de version des fichiers CSS/JS (comme dans index.html) : à augmenter quand on les modifie
const CSS_VERSION = 17;
const CROSSHAIR_JS_VERSION = 4;

// Mentions légales : À REMPLIR avant de publier
const PUBLISHER_NAME = "[À REMPLIR : ton nom]";
const PUBLISHER_EMAIL = "[À REMPLIR : ton e-mail de contact]";

// Date "17/10/2026" -> "2026-10-17" (format demandé par le sitemap)
function isoDate(date) {
    const parts = String(date || "").split("/");
    return parts.length === 3 ? parts[2] + "-" + parts[1] + "-" + parts[0] : "";
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
    // Ces fichiers sont des "modules" (export) partagés avec le site : on les charge avec import()
    const sharecode = await import("./lib/csgo-sharecode.js");
    const { teams } = await import("./teams.js?v=1");
    const render = await import("./render.js?v=1");
    const { slug, esc, consoleCommands, teamInfo, teamColor, cardHTML, byTeamThenName } = render;

    const players = JSON.parse(fs.readFileSync("players.json", "utf8"));

    // Cherche la photo du joueur (.webp, .png ou .jpg) ; renvoie "" s'il n'y en a pas
    function findPhoto(player) {
        if (player.photo) {
            return player.photo;
        }
        for (const ext of ["webp", "png", "jpg"]) {
            const file = "photos/" + slug(player.name) + "." + ext;
            if (fs.existsSync(file)) {
                return file;
            }
        }
        return "";
    }

    function decode(code) {
        try {
            return sharecode.decodeCrosshairShareCode(code);
        } catch (error) {
            return null;
        }
    }

    // ===== Morceaux communs à toutes les pages =====
    const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">`;

    // Thème clair/sombre appliqué tout de suite (sans flash)
    const THEME_SCRIPT = `<script>
        try {
            const saved = localStorage.getItem("theme");
            if (saved === "light" || (!saved && window.matchMedia("(prefers-color-scheme: light)").matches)) {
                document.body.classList.add("light");
            }
        } catch (error) {}
    </script>`;

    // Le <head> d'une page (titre, description, adresse officielle, aperçu de lien)
    function head(o) {
        return `<meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${o.title}</title>
    <meta name="description" content="${esc(o.description)}">
    ${o.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${o.url}">`}
    <link rel="icon" href="${o.prefix}favicon.svg">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="ClutchCrosshair">
    <meta property="og:title" content="${o.ogTitle || o.title}">
    <meta property="og:description" content="${esc(o.description)}">
    <meta property="og:url" content="${o.url}">
    <meta property="og:image" content="${SITE_URL}/preview-bg.jpg">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#E3262E">
    ${FONTS}
    <link rel="stylesheet" href="${o.prefix}style.css?v=${CSS_VERSION}">${o.jsonLd ? `
    <script type="application/ld+json">${JSON.stringify(o.jsonLd)}</script>` : ""}`;
    }

    // En haut des pages : le logo (retour à l'accueil)
    function pageTop(prefix) {
        return `<header class="page-top">
        <a href="${prefix}" class="logo" aria-label="ClutchCrosshair home">
            <img class="logo-img logo-dark" src="${prefix}logo-horizontal-dark.svg" alt="ClutchCrosshair">
            <img class="logo-img logo-light" src="${prefix}logo-horizontal-light.svg" alt="ClutchCrosshair">
        </a>
        <nav class="page-top-links">
            <a href="${prefix}faq.html" class="back-link">FAQ</a>
            <a href="${prefix}" class="back-link">← All CS2 crosshairs</a>
        </nav>
    </header>`;
    }

    function footer(prefix) {
        return `<footer>
        <nav class="footer-links" aria-label="Footer">
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
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
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
        const info = teamInfo(player.team);
        const photo = findPhoto(player);
        pageFiles.push(file);

        const photoHtml = photo
            ? `<img class="player-photo" src="../${esc(photo)}" alt="${name}, ${team}" width="120" height="120">`
            : `<div class="player-photo">${esc(player.name.slice(0, 2).toUpperCase())}</div>`;
        const badge = info ? `<img class="player-team-logo" src="../${info.logo}" alt="" width="20" height="20">` : "";

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

        const intro = isPro
            ? `${name} plays for ${team}. This is the exact CS2 crosshair ${name} used in an official match on ${esc(player.updated)}, read directly from the match demo.`
            : `${name} is a CS2 content creator. This is ${name}'s CS2 crosshair, last checked on ${esc(player.updated)}.`;

        const page = `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: `${name} CS2 Crosshair Code (2026) | ClutchCrosshair`,
        ogTitle: `${name} CS2 Crosshair Code`,
        description: `Copy ${player.name}'s CS2 crosshair code (${player.team}), with a live preview and console commands. Updated ${player.updated}.`,
        url: url,
        prefix: "../",
        jsonLd: breadcrumb(player.name + " crosshair", url)
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../")}

    <main class="player-page" style="--team: ${teamColor(player.team)}">
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
                <button id="copy" class="mini">Copy</button>
            </div>
        </div>

        <div class="field">
            <div class="field-label">Console <span>· Paste in the CS2 console (~)</span></div>
            <div class="field-row">
                <code id="console" class="console">${esc(consoleCommands(player.code))}</code>
                <button id="copy-console" class="mini btn-secondary">Copy</button>
            </div>
        </div>

        <h2>About ${name}'s crosshair</h2>
        <p>${intro}</p>
        ${crosshairDetails(player.code)}

        <h2>How to use ${name}'s crosshair in CS2</h2>
        <ol>
            <li>Click <strong>Copy</strong> next to the share code.</li>
            <li>In CS2, open <strong>Settings › Game › Crosshair</strong>.</li>
            <li>Click <strong>Share or Import</strong> and paste the code.</li>
        </ol>
        <p>Or copy the console commands, open the CS2 console (~) and paste them. <a href="../faq.html">More questions in the FAQ ›</a></p>

        ${matesHtml}
    </main>

    ${footer("../")}

    <script type="module">
        import { copyText, drawCrosshair } from "../crosshair.js?v=${CROSSHAIR_JS_VERSION}";

        drawCrosshair(document.getElementById("preview"), document.getElementById("code").textContent);

        document.getElementById("copy").addEventListener("click", function (event) {
            copyText(document.getElementById("code").textContent, event.target);
        });
        document.getElementById("copy-console").addEventListener("click", function (event) {
            copyText(document.getElementById("console").textContent, event.target);
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

    // ===== 2. index.html : les cartes + la liste de tous les joueurs (lisibles par Google sans JavaScript) =====
    let index = fs.readFileSync("index.html", "utf8");

    function cardsFor(list) {
        return list.slice().sort(byTeamThenName).map(function (p) {
            return cardHTML(p, findPhoto(p));
        }).join("\n                        ");
    }
    index = replaceBetween(index, "CARDS:pros", cardsFor(players.filter(function (p) { return p.category === "pro"; })), "                        ");
    index = replaceBetween(index, "CARDS:creators", cardsFor(players.filter(function (p) { return p.category !== "pro"; })), "                        ");

    const groups = teams.map(function (t) {
        return { title: t.name, list: players.filter(function (p) { return p.team === t.name; }) };
    });
    groups.push({ title: "Content creators", list: players.filter(function (p) { return p.category !== "pro"; }) });
    const directory = `<div class="directory">\n${groups.filter(function (g) {
        return g.list.length > 0;
    }).map(function (g) {
        return `                    <div><h3>${esc(g.title)}</h3><p>${g.list.map(function (p) {
            return `<a href="players/${slug(p.name)}.html">${esc(p.name)}</a>`;
        }).join(", ")}</p></div>`;
    }).join("\n")}\n                </div>`;
    index = replaceBetween(index, "PLAYERS", directory, "                ");
    fs.writeFileSync("index.html", index);

    // ===== 3. faq.html : la FAQ complète, avec des statistiques calculées sur les pros =====
    const pros = players.filter(function (p) { return p.category === "pro"; });
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
    const faqLd = {
        "@context": "https://schema.org",
        "@graph": [
            breadcrumb("CS2 crosshair FAQ", faqUrl),
            {
                "@type": "FAQPage",
                "mainEntity": faq.map(function (q) {
                    return { "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } };
                })
            }
        ]
    };

    fs.writeFileSync("faq.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: "CS2 Crosshair FAQ: Codes, Import, Pro Stats (2026) | ClutchCrosshair",
        ogTitle: "CS2 Crosshair FAQ",
        description: "How to import a CS2 crosshair code, why old CSGO- codes don't work anymore, and which crosshair CS2 pros use the most, with live stats.",
        url: faqUrl,
        prefix: "",
        jsonLd: faqLd
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

    // ===== 4. legal.html : mentions légales (obligatoires en France) =====
    fs.writeFileSync("legal.html", `<!DOCTYPE html>
<html lang="en">
<head>
    ${head({
        title: "Legal notice | ClutchCrosshair",
        description: "Legal notice and privacy information of ClutchCrosshair.",
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
        <p>Crosshair codes are game settings read from public match demos.</p>

        <h2>Privacy</h2>
        <p>ClutchCrosshair does not use advertising or tracking cookies and does not collect personal data. Your light/dark mode choice is only stored in your own browser (localStorage). Fonts are loaded from Google Fonts, which receives your IP address when the page loads.</p>

        <h2>Mentions légales (français)</h2>
        <p>Éditeur et directeur de la publication : ${esc(PUBLISHER_NAME)}, particulier (France). Contact : ${esc(PUBLISHER_EMAIL)}.<br>
        Hébergeur : GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis.<br>
        Counter-Strike et CS2 sont des marques de Valve Corporation. Les noms et logos des équipes et les photos des joueurs appartiennent à leurs propriétaires respectifs. Le site n'utilise pas de cookies publicitaires ni de suivi.</p>
    </main>
    ${footer("")}
</body>
</html>
`);

    // ===== 5. Le sitemap : la liste de toutes les pages, avec leur date de mise à jour =====
    let urls = `    <url><loc>${SITE_URL}/</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>\n`;
    urls += `    <url><loc>${faqUrl}</loc>${newest ? `<lastmod>${newest}</lastmod>` : ""}</url>\n`;
    players.forEach(function (player) {
        const lastmod = isoDate(player.updated);
        urls += `    <url><loc>${SITE_URL}/players/${slug(player.name)}.html</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>\n`;
    });
    fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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

    console.log(players.length + " pages joueurs + cartes et liste dans index.html + faq.html + legal.html + sitemap.xml + 404.html");
}

main();
