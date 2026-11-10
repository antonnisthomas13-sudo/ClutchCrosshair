// build/generator.js : 3 bis. generator.html : le générateur de crosshair CS2 (cible la recherche « CS2 crosshair generator »)
// Un morceau de build.js (découpé le 10/11/2026) : build.js l'appelle une fois par langue.
// c = la « boîte à outils » commune préparée par build.js (textes traduits, en-tête, pied de page, données, outils…).
// Le code garde son retrait d'origine : les pages fabriquées sont identiques au caractère près.
module.exports = {
    build: function (c) {
        const {
            ap, breadcrumb, crumbs, decoded, EN, esc, families, familyText, famous, faqGraph, faqItems, footer,
            GENERATOR_HASH, generatorBlock, head, HTML_OPEN, lang, langUrl, LD, mostCommon, newest, pageTop, percent,
            sectionBreadcrumb, SITE_URL, sitemapPages, slug, t, THEME_SCRIPT, tList, total, withDot, withOutline,
            write
        } = c;

        // ===== 3 bis. generator.html : le générateur de crosshair CS2 (cible la recherche « CS2 crosshair generator ») =====
        const genFaq = tList("generator.faq");
        const genUrl = langUrl("generator.html");
        const toolsUrl = langUrl("tools/");
        const genGraph = [
            {
                "@type": "WebPage",
                "@id": genUrl,
                "url": genUrl,
                "name": t("generator.name"),
                "inLanguage": lang,
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "breadcrumb": { "@id": genUrl + "#breadcrumb" },
                "mainEntity": { "@id": genUrl + "#app" }
            },
            {
                "@type": "WebApplication",
                "@id": genUrl + "#app",
                "name": t("generator.name"),
                "url": genUrl,
                "description": t("generator.appDescription"),
                "applicationCategory": "GameApplication",
                "operatingSystem": "Any",
                "browserRequirements": "Requires JavaScript",
                "isAccessibleForFree": true,
                "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
                "publisher": { "@id": SITE_URL + "/#organization" }
            },
            sectionBreadcrumb(t("tools.breadcrumb"), toolsUrl, t("generator.breadcrumb"), genUrl),
            faqGraph(genUrl, genFaq)
        ];
        if (EN) {
            sitemapPages.push({ path: "generator.html", lastmod: newest });
        }

        write(LD + "generator.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("generator.title"),
        ogTitle: t("generator.ogTitle"),
        description: t("generator.description"),
        url: genUrl,
        path: "generator.html",
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
        ${crumbs("./", `<a href="tools/">${t("tools.crumb")}</a> › <span>${t("generator.crumb")}</span>`)}
        <h1>${t("generator.h1")}</h1>
        <p>${t("generator.intro")}</p>

        ${generatorBlock}

        <h2>${t("generator.howTitle")}</h2>
        <ol>
            <li>${t("generator.how1")}</li>
            <li>${t("generator.how2")}</li>
            <li>${t("generator.how3")}</li>
            <li>${t("generator.how4")}</li>
        </ol>

        <h2>${t("generator.prosTitle")}</h2>
        <p>${t("generator.prosText", { total: total, families: esc(familyText), length: mostCommon(decoded.map(function (c) { return c.length; })), thickness: mostCommon(decoded.map(function (c) { return c.thickness; })), gap: mostCommon(decoded.map(function (c) { return c.gap; })), dot: percent(withDot), outline: percent(withOutline) })} <a href="faq.html">${t("generator.statsLink")}</a></p>
        ${famous.length ? `<ul class="related">${famous.map(function (p) {
            return `<li><a href="players/${slug(p.name)}.html">${t("common.crosshairOf", { name: esc(p.name) })}</a></li>`;
        }).join("")}</ul>` : ""}

        <h2>${t("generator.faqTitle")}</h2>
${faqItems(genFaq, "h3")}
        <p><a href="./">${t("common.browseAll")}</a></p>
    </main>
    ${footer("")}

    <script type="module">
        import { initGenerator } from "${ap("./")}generator.min.js?v=${GENERATOR_HASH}";
        initGenerator(document.getElementById("gen"), { syncHash: true });
    </script>
</body>
</html>
`);

        // Ce que cette rubrique fournit aux suivantes
        return { genUrl, toolsUrl };
    }
};
