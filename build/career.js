// build/career.js : la page du jeu « Zero to Major » (carrière de joueur pro CS2), /career et /fr/career
// Appelé par build.js pour les langues du jeu seulement (CAREER_LANGS : anglais et français).
// c = la « boîte à outils » commune préparée par build.js.
//   - rassemble les données du jeu dans la langue (career-src/assemble.js) et les écrit dans career.<langue>.json,
//     chargé par le jeu (career.js) avec une empreinte ?v= ;
//   - fabrique la page : titre, présentation, zone de jeu, mode d'emploi, FAQ, crédits des sources.
// Textes de la page : career-src/texts.json (section « page »). Le jeu lui-même est dans career.js et career-engine.js.
const fs = require("fs");
const crypto = require("crypto");
const { assemble, texts } = require("../career-src/assemble.js");

module.exports = {
    build: function (c) {
        const { lang, LD, EN, SITE_URL, esc, write, sitemapPages, isoDate, langUrl, HTML_OPEN, THEME_SCRIPT, head, pageTop, footer,
            crumbs, breadcrumb, faqGraph, faqItems, CAREER_LANGS, CAREER_HASH } = c;

        const data = assemble(lang);
        const page = texts(lang).page;
        // Les équipes que le site connaît déjà (teams.js) gardent leur logo et leur couleur dans le jeu ;
        // les autres auront un écusson avec leurs initiales. « Team Vitality » et « Vitality » = la même équipe.
        const core = function (s) { return String(s).toLowerCase().replace(/\b(team|esports?|gaming|clan)\b/g, "").replace(/[^a-z0-9]/g, ""); };
        data.teams.forEach(function (team) {
            const known = c.teams.find(function (x) { return core(x.name) === core(team.name); });
            if (known) {
                team.logo = c.logoFor(known.name);
                team.color = known.color;
                team.on = c.textOnColor(known.color);
            }
        });
        const a = c.ap(""); // chemin vers la racine du site (CSS, JS, données)

        // Les données du jeu : un fichier par langue, à la racine du site (fabriqué, ne pas modifier à la main)
        const json = JSON.stringify(data);
        const file = "career." + lang + ".json";
        if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== json) {
            fs.writeFileSync(file, json);
        }
        const dataHash = crypto.createHash("sha256").update(json).digest("hex").slice(0, 10);

        const url = langUrl("career.html");
        if (EN) {
            sitemapPages.push({ path: "career.html", lastmod: isoDate(data.updated), langs: CAREER_LANGS });
        }
        const jsonLd = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "WebPage",
                    "@id": url,
                    "url": url,
                    "name": page.h1 + ": " + page.tagline,
                    "inLanguage": lang,
                    "isPartOf": { "@id": SITE_URL + "/#website" },
                    "breadcrumb": { "@id": url + "#breadcrumb" },
                    "mainEntity": { "@id": url + "#game" }
                },
                {
                    "@type": "VideoGame",
                    "@id": url + "#game",
                    "name": page.h1,
                    "description": page.description,
                    "url": url,
                    "inLanguage": lang,
                    "genre": ["Text adventure", "Sports simulation"],
                    "gamePlatform": "Web browser",
                    "applicationCategory": "Game",
                    "operatingSystem": "Any",
                    "playMode": "SinglePlayer",
                    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
                    "publisher": { "@id": SITE_URL + "/#organization" }
                },
                breadcrumb(page.h1, url),
                faqGraph(url, page.faq)
            ]
        };

        write(LD + "career.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: esc(page.title),
        ogTitle: esc(page.h1 + ": " + page.tagline),
        description: page.description,
        url: url,
        path: "career.html",
        prefix: "",
        langs: CAREER_LANGS,
        jsonLd: jsonLd
    })}
    <link rel="modulepreload" href="${a}career.min.js?v=${CAREER_HASH}">
    <link rel="preload" href="${a}${file}?v=${dataHash}" as="fetch" type="application/json" crossorigin>
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("./", "career", CAREER_LANGS)}

    <main class="player-page zm-page">
        ${crumbs("./", `<span>${esc(page.h1)}</span>`)}
        <h1>${esc(page.h1)} <span class="zm-tagline">${esc(page.tagline)}</span></h1>
        <p class="zm-intro">${esc(page.intro)}</p>

        <div id="zm" class="zm" data-src="${a}${file}?v=${dataHash}" data-base="${a}" data-flags="${a}flags/" data-error="${esc(data.ui.error)}">
            <p class="zm-note">${esc(data.ui.loading)}</p>
        </div>
        <noscript><p class="zm-note">${esc(page.noscript)}</p></noscript>

        <h2>${esc(page.howTitle)}</h2>
        <ol>
            ${page.how.map(function (line) { return `<li>${esc(line)}</li>`; }).join("\n            ")}
        </ol>

        <h2>${esc(page.faqTitle)}</h2>
${faqItems(page.faq, "h3")}

        <p class="zm-credits">${esc(page.credits.replace("{date}", data.updated))}</p>
    </main>

    ${footer("")}

    <script type="module" src="${a}career.min.js?v=${CAREER_HASH}"></script>
</body>
</html>
`);
    }
};
