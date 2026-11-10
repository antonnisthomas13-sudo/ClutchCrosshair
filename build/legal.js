// build/legal.js : 4. legal.html : mentions légales (obligatoires en France)
// Un morceau de build.js (découpé le 10/11/2026) : build.js l'appelle une fois par langue.
// c = la « boîte à outils » commune préparée par build.js (textes traduits, en-tête, pied de page, données, outils…).
// Le code garde son retrait d'origine : les pages fabriquées sont identiques au caractère près.
module.exports = {
    build: function (c) {
        const {
            altHref, crumbs, esc, footer, head, HTML_OPEN, lang, LANGS, langUrl, LD, NAMES, pageTop, PUBLISHER_EMAIL,
            PUBLISHER_NAME, t, THEME_SCRIPT, tList, write
        } = c;

        // ===== 4. legal.html : mentions légales (obligatoires en France) =====
        write(LD + "legal.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("legal.title"),
        description: t("legal.description"),
        url: langUrl("legal.html"),
        path: "legal.html",
        prefix: "",
        noindex: true // page obligatoire mais sans intérêt dans Google (et absente du sitemap)
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("./")}
    <main class="player-page">
        ${crumbs("./", `<span>${t("legal.h1")}</span>`)}
        <h1>${t("legal.h1")}</h1>
${tList("legal.sections", { name: esc(PUBLISHER_NAME), email: `<a href="mailto:${esc(PUBLISHER_EMAIL)}">${esc(PUBLISHER_EMAIL)}</a>`, languages: LANGS.filter(function (l) { return l !== lang; }).map(function (l) { return `<a href="${altHref("", l, "legal.html")}" hreflang="${l}" lang="${l}">${NAMES[l]}</a>`; }).join(" · ") }).map(function (s) {
        return `
        <h2${s[2] ? ` id="${s[2]}"` : ""}>${s[0]}</h2>
        <p>${s[1]}</p>`;
    }).join("\n")}
    </main>
    ${footer("")}
</body>
</html>
`);
    }
};
