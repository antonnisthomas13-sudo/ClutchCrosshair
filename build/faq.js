// build/faq.js : 3. faq.html : la FAQ complète, avec des statistiques calculées sur les pros
// Un morceau de build.js (découpé le 10/11/2026) : build.js l'appelle une fois par langue.
// c = la « boîte à outils » commune préparée par build.js (textes traduits, en-tête, pied de page, données, outils…).
// Le code garde son retrait d'origine : les pages fabriquées sont identiques au caractère près.
module.exports = {
    build: function (c) {
        const {
            breadcrumb, crumbs, EN, esc, families, familyOrder, faqItems, footer, head, HTML_OPEN, langUrl, LD,
            newest, pageTop, percent, pros, PUBLISHER_EMAIL, SITE_URL, sitemapPages, smallGap, t, THEME_SCRIPT,
            tList, total, withDot, withOutline, write
        } = c;

        // ===== 3. faq.html : la FAQ complète, avec des statistiques calculées sur les pros =====
        const familyText = familyOrder.map(function (f) {
            return `${t("colorFamily." + f)} (${percent(families[f])})`;
        }).join(", ");
        const faq = tList("faq.items", {
            total: total,
            families: familyText,
            smallGap: percent(smallGap),
            dot: percent(withDot),
            outline: percent(withOutline),
            email: PUBLISHER_EMAIL
        });

        const faqUrl = langUrl("faq.html");
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
        if (EN) {
            sitemapPages.push({ path: "faq.html", lastmod: newest });
        }

        write(LD + "faq.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("faq.title"),
        ogTitle: t("faq.ogTitle"),
        description: t("faq.description"),
        url: faqUrl,
        path: "faq.html",
        prefix: "",
        jsonLd: { "@context": "https://schema.org", "@graph": [breadcrumb(t("faq.breadcrumb"), faqUrl), faqPage] }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("./")}
    <main class="player-page">
        ${crumbs("./", `<span>${t("faq.crumb")}</span>`)}
        <h1>${t("faq.h1")}</h1>
        <p>${t("faq.intro", { date: newest ? esc(newest.split("-").reverse().join("/")) : "-" })}</p>
${faqItems(faq, "h2")}
        <p><a href="./">${t("common.browseAll")}</a></p>
    </main>
    ${footer("")}
</body>
</html>
`);

        // Ce que cette rubrique fournit aux suivantes
        return { familyText };
    }
};
