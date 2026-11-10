// build/lists.js : les pages de listes de crosshairs, dans chaque langue
//   - crosshairs/index.html : toutes les listes (« Best CS2 Crosshairs by Color and Style »)
//   - crosshairs/most-used.html : les codes partagés par plusieurs joueurs (cible « best cs2 crosshair »)
//   - crosshairs/dot.html, small.html, outline.html, green.html, cyan.html, white.html, yellow.html
// Tout est calculé à partir des codes de players.json : une liste se met à jour toute seule quand un joueur change
// de crosshair, et une liste vide n'a pas de page. Textes : section « lists » de i18n/<langue>.json.
// Appelé par build.js une fois par langue (c = la « boîte à outils » commune, voir build.js).
// Renvoie les listes, pour que les pages joueurs puissent faire un lien vers celles où le joueur apparaît.
const fs = require("fs");

function buildLists(c) {
    const { t, lang, LD, EN, SITE_URL, esc, slug, players, cardHTML, byTeamThenName, write, sitemapPages, photoFiles, logoFor,
        decode, colorName, listText, langUrl, teamLabel, HTML_OPEN, THEME_SCRIPT, PHOTO_FALLBACK_SCRIPT, CARDS_SCRIPT,
        head, pageTop, footer, crumbs, sectionBreadcrumb, commandData, newest, sponsorSlot } = c;

    const a = c.ap("../"); // chemin vers la racine du site (CSS, images) depuis crosshairs/
    const all = players.map(function (p) { return { player: p, c: decode(p.code) }; }).filter(function (x) {
        return x.c && x.c.format !== "legacy-v1";
    });
    const total = all.length;

    // Les codes utilisés par au moins deux joueurs, du plus utilisé au moins utilisé
    const byCode = {};
    all.forEach(function (x) {
        (byCode[x.player.code] = byCode[x.player.code] || []).push(x);
    });
    const shared = Object.keys(byCode).map(function (code) {
        return byCode[code].slice().sort(function (x, y) { return byTeamThenName(x.player, y.player); });
    }).filter(function (group) { return group.length > 1; }).sort(function (x, y) {
        return y.length - x.length || x[0].player.name.localeCompare(y[0].player.name, "en", { sensitivity: "base" });
    });

    // Chaque liste : sa clé (textes lists.items.<clé>), son adresse, et le test qui dit si un crosshair en fait partie
    const color = function (name) { return function (x) { return colorName(x.c) === name; }; };
    const lists = [
        { key: "mostUsed", file: "most-used.html", items: [].concat.apply([], shared) },
        { key: "dot", file: "dot.html", test: function (x) { return x.c.centerDotEnabled; } },
        { key: "small", file: "small.html", test: function (x) { return x.c.length <= 2 && x.c.thickness <= 1; } },
        { key: "outline", file: "outline.html", test: function (x) { return x.c.outlineMode > 0; } },
        { key: "green", file: "green.html", test: color("green") },
        { key: "cyan", file: "cyan.html", test: color("cyan") },
        { key: "white", file: "white.html", test: color("white") },
        { key: "yellow", file: "yellow.html", test: color("yellow") }
    ].map(function (list) {
        const items = list.items || all.filter(list.test).sort(function (x, y) { return byTeamThenName(x.player, y.player); });
        return Object.assign({}, list, { items: items, h1: t("lists.items." + list.key + ".h1") });
    }).filter(function (list) { return list.items.length > 0; });

    const hubUrl = langUrl("crosshairs/index.html");
    const hex = function (x) {
        return "#" + [x.c.red, x.c.green, x.c.blue].map(function (v) { return Number(v).toString(16).padStart(2, "0"); }).join("").toUpperCase();
    };

    // ===== Une page par liste =====
    lists.forEach(function (list) {
        const rel = "crosshairs/" + list.file;
        const url = langUrl(rel);
        const count = list.items.length;
        const key = "lists.items." + list.key;
        if (EN) {
            sitemapPages.push({ path: rel, lastmod: newest });
        }

        // « Most used » : le classement des codes (qui l'utilise, réglages, code + Copy)
        const ranking = list.key !== "mostUsed" ? "" : `
        <h2>${t("lists.rankTitle")}</h2>
        <ol class="history">
            ${shared.map(function (group) {
                const first = group[0];
                const spec = t("history.spec", { color: t("colors." + colorName(first.c)), length: first.c.length, thickness: first.c.thickness, gap: first.c.gap })
                    + (first.c.centerDotEnabled ? ", " + t("history.dot") : "");
                const links = listText(group.map(function (x) {
                    return `<a href="../players/${slug(x.player.name)}.html">${esc(x.player.name)}</a>`;
                }));
                return `<li>
                <span class="history-date">${t("lists.usedBy", { count: group.length, list: links })}</span>
                <span class="history-spec"><span class="swatch" style="background:${hex(first)}"></span>${esc(spec)} · <a href="../generator.html#${esc(first.player.code)}">${t("history.preview")}</a></span>
                <div class="field-row">
                    <code class="code">${esc(first.player.code)}</code>
                    <button type="button" class="copy-code mini btn-secondary">${t("common.copy")}</button>
                </div>
            </li>`;
            }).join("\n            ")}
        </ol>`;

        const cards = list.items.map(function (x, i) {
            const p = x.player;
            const photo = photoFiles(p);
            return cardHTML(p, { photo: photo.sm && a + photo.sm, eager: i < 4, logo: logoFor(p.team) && a + logoFor(p.team), t: t, teamLabel: teamLabel(p.team), base: "../" });
        }).join("\n            ");

        write(LD + rel, `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t(key + ".title"),
        ogTitle: list.h1,
        description: t(key + ".description"),
        url: url,
        path: rel,
        prefix: "../",
        cards: true,
        jsonLd: {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "CollectionPage",
                    "@id": url,
                    "url": url,
                    "name": list.h1,
                    "inLanguage": lang,
                    "isPartOf": { "@id": SITE_URL + "/#website" },
                    "breadcrumb": { "@id": url + "#breadcrumb" },
                    "dateModified": newest,
                    "mainEntity": {
                        "@type": "ItemList",
                        "numberOfItems": count,
                        "itemListElement": list.items.map(function (x, i) {
                            return { "@type": "ListItem", "position": i + 1, "name": x.player.name, "url": langUrl("players/" + slug(x.player.name) + ".html") };
                        })
                    }
                },
                sectionBreadcrumb(t("lists.crumb"), hubUrl, list.h1, url)
            ]
        }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${PHOTO_FALLBACK_SCRIPT}
    ${pageTop("../", "crosshairs")}

    <main class="player-page team-page">
        ${crumbs("../", `<a href="./">${t("lists.crumb")}</a> › <span>${list.h1}</span>`)}
        <h1>${list.h1}</h1>
        <p>${esc(t(key + ".intro", { count: count, total: total, percent: Math.round(count / total * 100), codes: shared.length }))}</p>
        ${sponsorSlot("list", a)}
${ranking}
        <h2>${t("lists.cardsTitle")}</h2>
        <div class="card-grid">
            ${cards}
        </div>

        <h2>${t("lists.howTitle")}</h2>
        <ol>
            <li>${t("player.how1")}</li>
            <li>${t("player.how2")}</li>
            <li>${t("player.how3")}</li>
        </ol>
        <p>${t("player.orConsole")}${commandData ? ` <a href="../commands/#crosshair">${t("player.commandsLink")}</a>` : ""} <a href="../faq.html">${t("player.faqLink")}</a></p>

        <h2>${t("lists.othersTitle")}</h2>
        <ul class="related">${lists.filter(function (o) { return o !== list; }).map(function (o) {
            return `<li><a href="${o.file}">${o.h1}</a></li>`;
        }).join("")}</ul>
    </main>

    ${footer("../")}

    ${CARDS_SCRIPT(a)}
</body>
</html>
`);
    });

    // ===== La page qui présente toutes les listes =====
    if (EN) {
        sitemapPages.push({ path: "crosshairs/", lastmod: newest });
    }
    write(LD + "crosshairs/index.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("lists.hubTitle"),
        ogTitle: t("lists.hubH1"),
        description: t("lists.hubDescription"),
        url: hubUrl,
        path: "crosshairs/",
        prefix: "../",
        jsonLd: {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "CollectionPage",
                    "@id": hubUrl,
                    "url": hubUrl,
                    "name": t("lists.hubH1"),
                    "inLanguage": lang,
                    "isPartOf": { "@id": SITE_URL + "/#website" },
                    "breadcrumb": { "@id": hubUrl + "#breadcrumb" },
                    "mainEntity": {
                        "@type": "ItemList",
                        "itemListElement": lists.map(function (list, i) {
                            return { "@type": "ListItem", "position": i + 1, "name": list.h1, "url": langUrl("crosshairs/" + list.file) };
                        })
                    }
                },
                sectionBreadcrumb(t("lists.crumb"), hubUrl)
            ]
        }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "crosshairs")}

    <main class="player-page team-page">
        ${crumbs("../", `<span>${t("lists.crumb")}</span>`)}
        <h1>${t("lists.hubH1")}</h1>
        <p>${t("lists.hubIntro", { total: total })}</p>

        <ul class="team-list">
            ${lists.map(function (list) {
                return `<li><a href="${list.file}"><span><strong>${list.h1}</strong><small>${t("lists.count", { count: list.key === "mostUsed" ? shared.length : list.items.length })}</small></span></a></li>`;
            }).join("\n            ")}
        </ul>
    </main>

    ${footer("../")}
</body>
</html>
`);

    // Supprimer les pages des listes qui n'existent plus (liste devenue vide)
    const wanted = lists.map(function (list) { return list.file; }).concat("index.html");
    fs.readdirSync(LD + "crosshairs").forEach(function (f) {
        if (f.endsWith(".html") && !wanted.includes(f)) {
            fs.unlinkSync(LD + "crosshairs/" + f);
            console.log("Page supprimée (liste vide) : " + LD + "crosshairs/" + f);
        }
    });

    return lists;
}

module.exports = { build: buildLists };
