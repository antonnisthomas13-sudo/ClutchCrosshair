// build/methodology.js : 5. methodology.html : d'où viennent les codes (confiance / E-E-A-T pour Google)
// Un morceau de build.js (découpé le 10/11/2026) : build.js l'appelle une fois par langue.
// c = la « boîte à outils » commune préparée par build.js (textes traduits, en-tête, pied de page, données, outils…).
// Le code garde son retrait d'origine : les pages fabriquées sont identiques au caractère près.
module.exports = {
    build: function (c) {
        const {
            breadcrumb, creators, crumbs, EN, esc, footer, head, HTML_OPEN, isoDate, lang, langUrl, LD, pageTop,
            pros, PUBLISHER_EMAIL, SITE_URL, sitemapPages, t, teams, THEME_SCRIPT, tList, write
        } = c;

        // ===== 5. methodology.html : d'où viennent les codes (confiance / E-E-A-T pour Google) =====
        // Chiffres recalculés à chaque build ; dernier match = la date la plus récente d'un pro (date d'un match officiel)
        const methodUrl = langUrl("methodology.html");
        const lastMatch = pros.map(function (p) { return p.updated; }).sort(function (a, b) { return isoDate(a) < isoDate(b) ? -1 : 1; }).pop() || "";
        const methodVars = {
            pros: pros.length,
            teams: new Set(pros.map(function (p) { return p.team; })).size,
            creators: creators.length,
            date: lastMatch,
            email: `<a href="mailto:${esc(PUBLISHER_EMAIL)}">${esc(PUBLISHER_EMAIL)}</a>`
        };
        if (EN) {
            sitemapPages.push({ path: "methodology.html", lastmod: isoDate(lastMatch) });
        }
        write(LD + "methodology.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("method.title"),
        ogTitle: t("method.h1"),
        description: t("method.description"),
        url: methodUrl,
        path: "methodology.html",
        prefix: "",
        jsonLd: { "@context": "https://schema.org", "@graph": [
            { "@type": "AboutPage", "@id": methodUrl, "url": methodUrl, "name": t("method.h1"), "description": t("method.description"), "inLanguage": lang, "isPartOf": { "@id": SITE_URL + "/#website" }, "publisher": { "@id": SITE_URL + "/#organization" }, "dateModified": isoDate(lastMatch), "breadcrumb": { "@id": methodUrl + "#breadcrumb" } },
            breadcrumb(t("method.h1"), methodUrl)
        ] }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("./")}
    <main class="player-page">
        ${crumbs("./", `<span>${t("method.h1")}</span>`)}
        <h1>${t("method.h1")}</h1>
        <p>${t("method.intro", methodVars)}</p>
${tList("method.sections", methodVars).map(function (s) {
        return `
        <h2>${s[0]}</h2>
        <p>${s[1]}</p>`;
    }).join("\n")}
    </main>
    ${footer("")}
</body>
</html>
`);
    }
};
