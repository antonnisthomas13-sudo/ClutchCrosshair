// build/notfound.js : 6. La page 404 (adresses absolues : elle peut s'afficher à n'importe quelle adresse)
// Un morceau de build.js (découpé le 10/11/2026) : build.js l'appelle une fois par langue.
// c = la « boîte à outils » commune préparée par build.js (textes traduits, en-tête, pied de page, données, outils…).
// Le code garde son retrait d'origine : les pages fabriquées sont identiques au caractère près.
module.exports = {
    build: function (c) {
        const {
            EN, footer, head, HTML_OPEN, LD, pageTop, SITE_URL, skinPlayers, t, THEME_SCRIPT, write
        } = c;

        // ===== 6. La page 404 (adresses absolues : elle peut s'afficher à n'importe quelle adresse) =====
        const abs = SITE_URL + "/" + LD;
        write(LD + "404.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("notFound.title"),
        description: t("notFound.description"),
        url: abs,
        path: "",
        prefix: abs,
        noindex: true
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop(abs)}
    <main class="player-page not-found">
        <h1>${t("notFound.h1")}</h1>
        <p>${t("notFound.text")}</p>
        <p><a class="contact-btn" href="${abs}">${t("notFound.back")}</a></p>
    </main>
    ${footer(abs)}
</body>
</html>
`);

        if (EN) {
            console.log(skinPlayers.length + " pages skins + skins/index.html");
        }
    }
};
