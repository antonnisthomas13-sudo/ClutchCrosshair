// build/commands.js : 3 quater. Les commandes console CS2 : commands/index.html + une page par commande importante
// Un morceau de build.js (découpé le 10/11/2026) : build.js l'appelle une fois par langue.
// c = la « boîte à outils » commune préparée par build.js (textes traduits, en-tête, pied de page, données, outils…).
// Le code garde son retrait d'origine : les pages fabriquées sont identiques au caractère près.
module.exports = {
    build: function (c) {
        const {
            ap, breadcrumb, commandData, CROSSHAIR_HASH, crumbs, EN, esc, faqGraph, faqItems, footer, fs, guideData,
            head, HTML_OPEN, I, isoDate, lang, langUrl, LD, pageTop, proCrosshairs, pros, sectionBreadcrumb,
            SITE_URL, sitemapPages, slug, t, THEME_SCRIPT, tList, total, write
        } = c;

        // ===== 3 quater. Les commandes console CS2 : commands/index.html + une page par commande importante =====
        // Données : commands.json (status "check" = pas encore vérifiée en jeu -> pas publiée)
        // Traductions : i18n/<langue>/commands.json (catégories + summary / description / valeurs de chaque commande)
        const cmdTr = I.content("commands") || {};
        const guideTr = I.content("guides") || {};
        // Les guides dans cette langue (la traduction remplace le guide anglais du même slug, s'il existe)
        const guides = guideData ? guideData.guides.map(function (g) {
            return (guideTr.guides || []).find(function (x) { return x.slug === g.slug; }) || g;
        }) : [];
        // Les guides qui parlent d'une commande (liens "Learn more" sur la page de la commande)
        function guidesFor(name) {
            return guides.filter(function (g) { return (g.commands || []).includes(name); });
        }
        const commandFiles = [];
        const commandsUrl = langUrl("commands/");
        if (commandData) {
            const published = commandData.commands.filter(function (c) { return c.status !== "check"; }).map(function (c) {
                const tr = (cmdTr.commands || {})[c.name];
                if (!tr) {
                    return c;
                }
                const merged = Object.assign({}, c, { summary: tr.summary || c.summary, description: tr.description || c.description });
                if (c.values && tr.values) {
                    merged.values = c.values.map(function (v, i) { return [v[0], tr.values[i] || v[1]]; });
                }
                return merged;
            });
            const byCmd = new Map(published.map(function (c) { return [c.name, c]; }));
            const categoryNames = commandData.categories.map(function (cat) { return [cat[0], (cmdTr.categories || {})[cat[0]] || cat[1]]; });
            const categoryName = Object.fromEntries(categoryNames);
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
                <button type="button" class="mini" data-copy>${t("common.copy")}</button>
            </div>`;
            }

            function badges(c) {
                return (c.status === "removed" ? `<span class="cmd-badge cmd-removed">${t("commands.removedBadge")}</span>` : "")
                    + (c.cheat ? `<span class="cmd-badge">${t("commands.cheatBadge")}</span>` : "");
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
                return `<h2>${t("commands.prosTitle")}</h2>
        <p>${t("commands.prosText", { total: proCrosshairs.length, value: `<code>${esc(c.name)} ${esc(top)}</code>`, share: Math.round(count[top] / proCrosshairs.length * 100) })}</p>
        <dl class="cmd-stats">${rows}</dl>
        <p>${t("commands.prosWho", { value: `<code>${esc(c.name)} ${esc(top)}</code>` })}</p>
        <ul class="related">${examples.map(function (x) {
            return `<li><a href="../players/${slug(x.player.name)}.html">${t("common.crosshairOf", { name: esc(x.player.name) })}</a></li>`;
        }).join("")}</ul>`;
            }

            function cmdBreadcrumb(name, url) {
                return sectionBreadcrumb(t("commands.breadcrumb"), commandsUrl, name, url);
            }

            function faqHtml(faq, title) {
                return `<h2>${title}</h2>
${faqItems(faq, "h3")}`;
            }

            // Petit script des pages de commandes : boutons Copy (+ recherche et filtres sur la liste)
            const COPY_SCRIPT = `import { copyText } from "${ap("../")}crosshair.min.js?v=${CROSSHAIR_HASH}";
        document.addEventListener("click", function (event) {
            const button = event.target.closest("[data-copy]");
            if (button) {
                copyText(button.closest(".field-row").querySelector("code").textContent, button);
            }
        });`;

            // --- Une page par commande importante ---
            published.filter(hasPage).forEach(function (c) {
                const rel = "commands/" + cmdFile(c.name);
                const url = langUrl(rel);
                const name = esc(c.name);
                const removed = c.status === "removed";
                const replacement = c.replacement && byCmd.get(c.replacement);
                commandFiles.push(cmdFile(c.name));
                if (EN) {
                    sitemapPages.push({ path: rel, lastmod: isoDate(commandData.updated) });
                }

                const faq = [[t("commands.faqWhatQ", { name: c.name }), `${c.summary} ${c.description}`]];
                if (removed) {
                    faq.push([t("commands.faqWorkQ", { name: c.name }), t("commands.faqWorkA", { name: c.name }) + (replacement ? t("commands.faqWorkInstead", { name: replacement.name }) : "")]);
                } else {
                    if (c.default) {
                        faq.push([t("commands.faqDefaultQ", { name: c.name }), t("commands.faqDefaultA", { name: c.name, value: c.default })]);
                    }
                    faq.push([t("commands.faqCheatsQ", { name: c.name }), c.cheat
                        ? t("commands.faqCheatsYes", { name: c.name })
                        : t("commands.faqCheatsNo", { name: c.name })]);
                }

                // Titre : le plus complet qui tient en 60 caractères (au-delà, Google le coupe ; les noms de commandes peuvent être longs)
                const titles = tList(removed ? "commands.titlesRemoved" : "commands.titles", { name: c.name });
                const title = esc(titles.find(function (x) { return x.length <= 60; }) || titles[titles.length - 1]);
                // Description : résumé + première phrase de l'explication + fin, tant que ça tient en 160 caractères
                const sentences = c.description.split(/(?<=\.)\s/);
                const descEnd = removed ? t("commands.descEndRemoved") : (c.default ? t("commands.descEndDefault", { value: c.default }) : t("commands.descEnd"));
                let descStart = t("commands.descStart", { name: c.name, summary: c.summary });
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
                        "headline": t("commands.headline", { name: c.name }),
                        "description": description,
                        "url": url,
                        "inLanguage": lang,
                        "isPartOf": { "@id": SITE_URL + "/#website" },
                        "publisher": { "@id": SITE_URL + "/#organization" },
                        "dateModified": isoDate(commandData.updated),
                        "about": { "@type": "Thing", "name": "Counter-Strike 2" }
                    },
                    cmdBreadcrumb(c.name, url),
                    faqGraph(url, faq)
                ];
                const related = (c.related || []).map(function (n) { return byCmd.get(n); }).filter(Boolean);

                write(LD + "commands/" + cmdFile(c.name), `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({ title: title, ogTitle: t("commands.headline", { name: c.name }), description: description, url: url, path: rel, prefix: "../", jsonLd: { "@context": "https://schema.org", "@graph": graph } })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "commands")}

    <main class="player-page cmd-page">
        ${crumbs("../", `<a href="./">${t("commands.crumb")}</a> › <span>${name}</span>`)}
        <h1 class="cmd-title">${name}</h1>
        <p class="cmd-meta"><a href="./#${esc(c.category)}">${esc(categoryName[c.category] || c.category)}</a>${badges(c)}</p>
        <p class="cmd-lead">${linkify(c.summary, c.name, "")}${removed ? "" : " " + linkify(c.description, c.name, "")}</p>
        ${removed ? "" : copyRow(c.examples && c.examples[0] ? c.examples[0] : c.syntax)}

        ${removed ? `<h2>${t("commands.insteadTitle")}</h2>
        <p>${linkify(c.description, c.name, "")}</p>
        ${replacement ? `<p>${t("commands.useInstead", { command: `<a href="${cmdHref(replacement.name, "")}"><code>${esc(replacement.name)}</code></a>`, summary: esc(replacement.summary.charAt(0).toLowerCase() + replacement.summary.slice(1)) })}</p>
        ${copyRow(replacement.examples && replacement.examples[0] ? replacement.examples[0] : replacement.syntax)}` : (c.examples || []).map(copyRow).join("\n        ")}` : `<h2>${t("commands.syntax")}</h2>
        <p><code class="cmd-syntax">${esc(c.syntax)}</code>${c.default ? ` · ${t("commands.defaultValue")} <code>${esc(c.default)}</code>` : ""}</p>
        ${c.values ? `<table class="cmd-values">
            <thead><tr><th scope="col">${t("commands.value")}</th><th scope="col">${t("commands.whatItDoes")}</th></tr></thead>
            <tbody>${c.values.map(function (v) { return `<tr><td><code>${esc(v[0])}</code></td><td>${esc(v[1])}</td></tr>`; }).join("")}</tbody>
        </table>` : ""}
        ${c.cheat ? `<p>${t("commands.cheatNote", { link: `<a href="${cmdHref("sv_cheats", "")}"><code>sv_cheats 1</code></a>` })}</p>` : ""}

        <h2>${t("commands.examples")}</h2>
        ${(c.examples || []).map(copyRow).join("\n        ")}

        <h2>${t("commands.howTitle", { name: name })}</h2>
        <ol>
            <li>${t("commands.how1")}</li>
            <li>${t("commands.how2")}</li>
            <li>${t("commands.how3")}</li>
        </ol>`}

        ${proStats(c)}
        ${c.category === "crosshair" ? `<p>${t("commands.tryGenerator")}</p>` : ""}

        ${related.length ? `<h2>${t("commands.related")}</h2>
        <ul class="related">${related.map(function (r) {
            return `<li><a href="${cmdHref(r.name, "")}">${esc(r.name)}</a></li>`;
        }).join("")}</ul>` : ""}

        ${guidesFor(c.name).length ? `<h2>${t("commands.learnMore")}</h2>
        <ul class="related">${guidesFor(c.name).map(function (g) {
            return `<li><a href="../guides/${g.slug}.html">${esc(g.title)}</a></li>`;
        }).join("")}</ul>` : ""}

        ${faqHtml(faq, t("commands.faqTitle", { name: name }))}
        <p><a href="./">${t("commands.allLink")}</a></p>
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
            const hubFaq = tList("commands.hubFaq");
            const hubDescription = t("commands.hubDescription");
            const pageList = published.filter(hasPage);
            const categoriesUsed = categoryNames.filter(function (cat) {
                return published.some(function (c) { return c.category === cat[0]; });
            });
            if (EN) {
                sitemapPages.push({ path: "commands/", lastmod: isoDate(commandData.updated) });
            }
            write(LD + "commands/index.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("commands.hubTitle"),
        ogTitle: t("commands.hubOgTitle"),
        description: hubDescription,
        url: commandsUrl,
        path: "commands/",
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": [
            {
                "@type": "CollectionPage",
                "@id": commandsUrl,
                "url": commandsUrl,
                "name": t("commands.hubOgTitle"),
                "description": hubDescription,
                "inLanguage": lang,
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
        ${crumbs("../", `<span>${t("commands.crumb")}</span>`)}
        <h1>${t("commands.hubH1")}</h1>
        <p>${t("commands.hubIntro", { count: published.length, date: esc(commandData.updated) })}</p>

        <div class="cmd-tools">
            <div class="hero-search cmd-search">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/></svg>
                <input type="search" id="cmd-search" placeholder="${t("commands.searchPlaceholder")}" aria-label="${t("commands.searchAria")}" autocomplete="off" spellcheck="false">
            </div>
            <div class="cmd-filters" role="group" aria-label="${t("commands.filterAria")}">
                <button type="button" class="cmd-filter" data-cat="" aria-pressed="true">${t("commands.all")} <span>${published.length}</span></button>
                ${categoriesUsed.map(function (cat) {
                    return `<button type="button" class="cmd-filter" data-cat="${cat[0]}" aria-pressed="false">${esc(cat[1])} <span>${published.filter(function (c) { return c.category === cat[0]; }).length}</span></button>`;
                }).join("\n                ")}
            </div>
        </div>
        <p class="cmd-empty hidden" id="cmd-empty">${t("commands.empty")}</p>

${categoriesUsed.map(function (cat) {
        return `        <section class="cmd-section" id="${cat[0]}" data-cat="${cat[0]}" aria-labelledby="${cat[0]}-title">
            <h2 id="${cat[0]}-title">${t("commands.sectionTitle", { category: esc(cat[1]) })}</h2>
            <div class="cmd-grid">
            ${published.filter(function (c) { return c.category === cat[0]; }).map(function (c) {
                const search = [c.name, c.summary, c.description, cat[1]].join(" ").toLowerCase();
                const example = c.status === "removed" ? (byCmd.get(c.replacement) ? byCmd.get(c.replacement).examples[0] : null) : (c.examples && c.examples[0]) || c.syntax;
                return `<article class="cmd${c.status === "removed" ? " cmd-is-removed" : ""}" id="${esc(c.name)}" data-cat="${cat[0]}" data-search="${esc(search)}">
                <h3 class="cmd-name">${hasPage(c) ? `<a href="${cmdFile(c.name)}">${esc(c.name)}</a>` : esc(c.name)}${badges(c)}</h3>
                <p>${esc(c.summary)}${c.default ? ` <span class="cmd-default">${t("commands.default")} <code>${esc(c.default)}</code></span>` : ""}</p>
                ${example ? copyRow(example) : ""}
            </article>`;
            }).join("\n            ")}
            </div>
        </section>`;
    }).join("\n")}

        ${faqHtml(hubFaq, t("commands.hubFaqTitle"))}
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
            fs.readdirSync(LD + "commands").forEach(function (f) {
                if (f.endsWith(".html") && !commandFiles.includes(f)) {
                    fs.unlinkSync(LD + "commands/" + f);
                }
            });
            if (EN) {
                console.log((commandFiles.length - 1) + " pages de commandes + commands/index.html (" + published.length + " commandes publiées, " + (commandData.commands.length - published.length) + " à vérifier)");
            }
        }

        // Ce que cette rubrique fournit aux suivantes
        return { guideTr, guides };
    }
};
