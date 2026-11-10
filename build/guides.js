// build/guides.js : 3 quinquies. Les guides CS2 : guides/index.html + une page par guide (données : guides.json)
// Un morceau de build.js (découpé le 10/11/2026) : build.js l'appelle une fois par langue.
// c = la « boîte à outils » commune préparée par build.js (textes traduits, en-tête, pied de page, données, outils…).
// Le code garde son retrait d'origine : les pages fabriquées sont identiques au caractère près.
module.exports = {
    build: function (c) {
        const {
            ap, breadcrumb, colorName, commandData, CROSSHAIR_HASH, crumbs, EN, esc, faqGraph, faqItems, footer, fs,
            guideData, guides, guideTr, head, HTML_OPEN, isoDate, lang, langUrl, LD, pageTop, proCrosshairs, pros,
            sectionBreadcrumb, SITE_URL, sitemapPages, slug, t, THEME_SCRIPT, tList, total, write
        } = c;

        // ===== 3 quinquies. Les guides CS2 : guides/index.html + une page par guide (données : guides.json) =====
        const guideFiles = [];
        const guidesUrl = langUrl("guides/");
        if (guideData) {
            // Commandes qui ont leur propre page (pour les liens automatiques)
            const commandPages = new Set(commandData ? commandData.commands.filter(function (c) {
                return c.status !== "check" && c.page && /^[a-z0-9_]+$/.test(c.name);
            }).map(function (c) { return c.name; }) : []);
            const guidesUpdated = guideTr.updated || guideData.updated;

            // Ancre d'un titre de section (sommaire « On this page ») : sans accents (« Réglages » -> reglages),
            // russe translittéré en lettres latines (« Настройки » -> nastroyki), « ı » turc -> i
            const CYRILLIC = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya" };
            function anchor(text) {
                const latin = String(text).toLowerCase().replace(/[а-яё]/g, function (c) { return CYRILLIC[c]; }).replace(/ı/g, "i");
                return slug(latin.normalize("NFD").replace(/[\u0300-\u036f]/g, "")).slice(0, 60);
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
            <thead><tr><th scope="col">${t("guides.statsSetting")}</th><th scope="col">${t("guides.statsWhat")}</th><th scope="col">${t("guides.statsShare")}</th></tr></thead>
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
                        return `<div class="field-row"><code>${esc(line)}</code><button type="button" class="mini" data-copy>${t("common.copy")}</button></div>`;
                    }).join("\n        ");
                }
                if (b.type === "config") {
                    return `<div class="code-block"><pre><code>${b.lines.map(esc).join("\n")}</code></pre><button type="button" class="mini" data-copy>${t("common.copy")}</button></div>`;
                }
                if (b.type === "pro-crosshair-stats" && proCrosshairs.length) {
                    const colors = mostCommonValue(colorName);
                    const length = mostCommonValue(function (c) { return c.length; });
                    const thick = mostCommonValue(function (c) { return c.thickness; });
                    const gap = mostCommonValue(function (c) { return c.gap; });
                    return statsTable([
                        [t("specs.color"), esc(t("colors." + colors.value)), colors.share + "%"],
                        [t("guides.statsStyle"), t("guides.statsStatic") + " (<code>cl_crosshairstyle 4</code>)", share(function (x) { return x.c.style === 4; }) + "%"],
                        [t("specs.length"), "<code>cl_crosshair_length " + esc(length.value) + "</code>", length.share + "%"],
                        [t("specs.thickness"), "<code>cl_crosshair_thickness " + esc(thick.value) + "</code>", thick.share + "%"],
                        [t("specs.gap"), "<code>cl_crosshair_gap " + esc(gap.value) + "</code>", gap.share + "%"],
                        [t("specs.dot"), t("guides.statsNoDot"), share(function (x) { return !x.c.centerDotEnabled; }) + "%"],
                        [t("specs.outline"), t("guides.statsNoOutline"), share(function (x) { return !(x.c.outlineMode > 0); }) + "%"],
                        [t("specs.tStyle"), t("guides.statsNormal"), share(function (x) { return !x.c.tStyleEnabled; }) + "%"]
                    ]) + `\n        <p class="guide-note">${t("guides.statsNote", { total: proCrosshairs.length })}</p>`;
                }
                if (b.type === "pro-resolution-stats" && proCrosshairs.length) {
                    const count = {};
                    proCrosshairs.forEach(function (x) { count[x.c.screenHeight] = (count[x.c.screenHeight] || 0) + 1; });
                    const heights = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 5);
                    const label = tList("guides.resolutions");
                    return `<div class="table-wrap"><table class="cmd-values">
            <thead><tr><th scope="col">${t("guides.resHeight")}</th><th scope="col">${t("guides.resUsual")}</th><th scope="col">${t("guides.resPros")}</th></tr></thead>
            <tbody>${heights.map(function (h) {
                return `<tr><td><code>${esc(h)} px</code></td><td>${esc(label[h] || "-")}</td><td>${count[h]} (${Math.round(count[h] / proCrosshairs.length * 100)}%)</td></tr>`;
            }).join("")}</tbody>
        </table></div>`;
                }
                if (b.type === "sens-calc") {
                    return `<form class="sens-calc" id="sens-calc" onsubmit="return false">
            <label>${t("guides.calcDpi")} <input type="number" id="calc-dpi" value="800" min="100" max="32000" step="50" inputmode="numeric"></label>
            <label>${t("guides.calcSens")} <input type="number" id="calc-sens" value="1" min="0.01" max="20" step="0.01" inputmode="decimal"></label>
            <p class="sens-out" aria-live="polite">eDPI <strong id="out-edpi">800</strong> · <strong id="out-cm">52.0</strong> cm/360 · <strong id="out-in">20.5</strong> in/360</p>
            <label>${t("guides.calcValorant")} <input type="number" id="calc-val" min="0.01" max="10" step="0.001" inputmode="decimal" placeholder="${t("guides.calcExample")}"></label>
            <p class="sens-out" aria-live="polite">${t("guides.calcSame")} <strong id="out-val">-</strong></p>
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

            const GUIDE_COPY_SCRIPT = `import { copyText } from "${ap("../")}crosshair.min.js?v=${CROSSHAIR_HASH}";
        document.addEventListener("click", function (event) {
            const button = event.target.closest("[data-copy]");
            if (button) {
                copyText(button.closest(".field-row, .code-block").querySelector("code").textContent, button);
            }
        });`;

            function guideBreadcrumb(name, url) {
                return sectionBreadcrumb(t("guides.breadcrumb"), guidesUrl, name, url);
            }

            const bySlug = new Map(guides.map(function (g) { return [g.slug, g]; }));

            guides.forEach(function (g) {
                const file = g.slug + ".html";
                const rel = "guides/" + file;
                const url = langUrl(rel);
                guideFiles.push(file);
                if (EN) {
                    sitemapPages.push({ path: rel, lastmod: isoDate(guideData.updated) });
                }
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
                        "inLanguage": lang,
                        "isPartOf": { "@id": SITE_URL + "/#website" },
                        "author": { "@id": SITE_URL + "/#organization" },
                        "publisher": { "@id": SITE_URL + "/#organization" },
                        "dateModified": isoDate(guidesUpdated),
                        "image": SITE_URL + "/og-image.jpg",
                        "about": { "@type": "Thing", "name": "Counter-Strike 2" }
                    },
                    guideBreadcrumb(g.title, url),
                    faqGraph(url, g.faq)
                ];
                const hasCalc = g.sections.some(function (s) { return s.blocks.some(function (b) { return b.type === "sens-calc"; }); });

                write(LD + "guides/" + file, `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({ title: esc(g.seoTitle), ogTitle: esc(g.title), description: g.description, url: url, path: rel, prefix: "../", jsonLd: { "@context": "https://schema.org", "@graph": graph } })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "guides")}

    <main class="player-page guide-page">
        ${crumbs("../", `<a href="./">${t("guides.crumb")}</a> › <span>${esc(g.title)}</span>`)}
        <h1 class="guide-title">${esc(g.title)}</h1>
        <p class="guide-meta">${esc(g.category)} · ${t("guides.updated")} <time datetime="${isoDate(guidesUpdated)}">${esc(guidesUpdated)}</time> · ${t("guides.minutes", { count: minutes })}</p>
        <p class="guide-lead">${fmt(g.intro)}</p>

        <nav class="guide-toc" aria-label="${t("guides.toc")}">
            <p class="guide-toc-title">${t("guides.toc")}</p>
            <ol>${g.sections.map(function (s) { return `<li><a href="#${anchor(s.title)}">${esc(plainText(s.title))}</a></li>`; }).join("")}<li><a href="#faq">${t("common.faq")}</a></li></ol>
        </nav>

${body}

        ${commands.length ? `<h2>${t("guides.commandsTitle")}</h2>
        <ul class="related">${commands.map(function (n) { return `<li><a href="../commands/${n}.html">${esc(n)}</a></li>`; }).join("")}</ul>` : ""}

        <h2 id="faq">${t("guides.faqTitle", { title: esc(g.title.replace(/\s*\(\d{4}\)\s*/, " ").replace(/:.*$/, "").trim()) })}</h2>
${faqItems(g.faq, "h3")}

        ${related.length ? `<h2>${t("guides.moreTitle")}</h2>
        <ul class="related">${related.map(function (r) { return `<li><a href="${r.slug}.html">${esc(r.title)}</a></li>`; }).join("")}</ul>` : ""}
        <p><a href="./">${t("guides.allLink")}</a></p>
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
            const hubDescription = t("guides.hubDescription");
            const categories = [...new Set(guides.map(function (g) { return g.category; }))];
            if (EN) {
                sitemapPages.push({ path: "guides/", lastmod: isoDate(guideData.updated) });
            }
            write(LD + "guides/index.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("guides.hubTitle"),
        ogTitle: t("guides.hubOgTitle"),
        description: hubDescription,
        url: guidesUrl,
        path: "guides/",
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": [
            {
                "@type": "CollectionPage",
                "@id": guidesUrl,
                "url": guidesUrl,
                "name": t("guides.hubOgTitle"),
                "description": hubDescription,
                "inLanguage": lang,
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "breadcrumb": { "@id": guidesUrl + "#breadcrumb" },
                "dateModified": isoDate(guidesUpdated),
                "mainEntity": {
                    "@type": "ItemList",
                    "itemListElement": guides.map(function (g, i) {
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
        ${crumbs("../", `<span>${t("guides.crumb")}</span>`)}
        <h1>${t("guides.hubH1")}</h1>
        <p>${t("guides.hubIntro", { date: esc(guidesUpdated) })}</p>
${categories.map(function (cat) {
        return `        <section aria-labelledby="cat-${anchor(cat)}">
            <h2 id="cat-${anchor(cat)}">${esc(cat)}</h2>
            <div class="guide-cards">
            ${guides.filter(function (g) { return g.category === cat; }).map(function (g) {
                return `<a class="guide-card" href="${g.slug}.html"><span class="guide-card-title">${esc(g.title)}</span><span class="guide-card-desc">${esc(g.description)}</span></a>`;
            }).join("\n            ")}
            </div>
        </section>`;
    }).join("\n")}
        <h2>${t("guides.moreTools")}</h2>
        <ul class="related">
            <li><a href="../commands/">${t("links.commands")}</a></li>
            <li><a href="../generator.html">${t("links.generator")}</a></li>
            <li><a href="../">${t("links.pros")}</a></li>
        </ul>
    </main>

    ${footer("../")}
</body>
</html>
`);
            guideFiles.push("index.html");
            fs.readdirSync(LD + "guides").forEach(function (f) {
                if (f.endsWith(".html") && !guideFiles.includes(f)) {
                    fs.unlinkSync(LD + "guides/" + f);
                }
            });
            if (EN) {
                console.log((guideFiles.length - 1) + " guides + guides/index.html");
            }
        }
    }
};
