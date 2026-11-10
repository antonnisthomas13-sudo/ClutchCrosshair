// build/skins.js : 3 ter. Les skins des pros : skins/index.html + une page par joueur (skins/<pseudo>.html)
// Un morceau de build.js (découpé le 10/11/2026) : build.js l'appelle une fois par langue.
// c = la « boîte à outils » commune préparée par build.js (textes traduits, en-tête, pied de page, données, outils…).
// Le code garde son retrait d'origine : les pages fabriquées sont identiques au caractère près.
module.exports = {
    build: function (c) {
        const {
            ap, breadcrumb, categoryLabel, crumbs, EN, esc, faqGraph, faqItems, footer, fs, head, HTML_OPEN, isoDate,
            lang, langUrl, LD, logoFor, money, opt, pageTop, players, price, PRICE_NOTE, profileLinks, pros,
            sectionBreadcrumb, SITE_URL, sitemapPages, SKIN_CATEGORIES, skinCard, skinData, skinPhoto, skinPlayers,
            skinSummary, slug, t, teamColor, textOnColor, THEME_SCRIPT, write
        } = c;

        // ===== 3 ter. Les skins des pros : skins/index.html + une page par joueur (skins/<pseudo>.html) =====
        const skinFiles = ["index.html"];
        const skinsUrl = langUrl("skins/");
        const sa = ap("../"); // racine du site depuis skins/

        // "★ Butterfly Knife | Doppler Ruby (Factory New)" : la phase des Doppler explique leur prix
        function skinLabel(item) {
            return item.name + (item.phase ? " " + item.phase : "") + (item.exterior !== "Vanilla" ? " (" + opt("skins.exteriors." + item.exterior, item.exterior) + ")" : "");
        }

        function skinList(groups, max) {
            const names = groups.slice(0, max).map(function (g) {
                return skinLabel(g.item);
            });
            return names.length > 1 ? names.slice(0, -1).join(", ") + " " + t("common.and") + " " + names[names.length - 1] : names.join("");
        }

        skinPlayers.forEach(function (p) {
            const name = esc(p.name);
            const file = p.slug + ".html";
            const rel = "skins/" + file;
            const url = langUrl(rel);
            const known = players.find(function (x) { return x.name === p.name; });
            const byCategory = SKIN_CATEGORIES.map(function (key) {
                return { key: key, label: categoryLabel(key), groups: p.groups.filter(function (g) { return g.item.category === key; }) };
            }).filter(function (c) { return c.groups.length > 0; });
            const knives = p.groups.filter(function (g) { return g.item.category === "knives"; });
            const gloves = p.groups.filter(function (g) { return g.item.category === "gloves"; });
            const top = p.best.slice(0, 2);
            skinFiles.push(file);
            if (EN) {
                sitemapPages.push({ path: rel, lastmod: isoDate(p.updated), images: p.groups.slice(0, 10).map(function (g) { return `${SITE_URL}/skins/img/${g.item.image}.webp`; }) });
            }

            const faq = [];
            faq.push([t("skins.faqCountQ", { name: p.name }),
                t("skins.faqCountA", { name: p.name, count: p.items.length, different: p.groups.length, knives: t("skins.knifeCount", { count: knives.length }), gloves: t("skins.gloveCount", { count: gloves.length }), date: p.updated })]);
            if (knives.length) {
                faq.push([t("skins.faqKnifeQ", { name: p.name }), t("skins.faqOwns", { name: p.name, list: skinList(knives, 6) })]);
            }
            if (gloves.length) {
                faq.push([t("skins.faqGlovesQ", { name: p.name }), t("skins.faqOwns", { name: p.name, list: skinList(gloves, 6) })]);
            }
            if (p.hasPrices) {
                faq.unshift([t("skins.faqWorthQ", { name: p.name }),
                    t("skins.faqWorthA", { name: p.name, usd: money(p.value, "USD"), eur: money(p.valueEur, "EUR"), date: skinData.prices.updated, item: skinLabel(p.best[0].item), price: price(p.best[0].item.price, "USD") })]);
            }
            faq.push([t("skins.faqFloatQ"), t("skins.faqFloatA", { name: p.name })]);

            // Description Google : 160 caractères maximum (la fin n'est ajoutée que s'il reste de la place)
            const topNames = top.map(function (g) { return g.item.name; }).join(" " + t("common.and") + " ");
            const descriptionStart = p.hasPrices
                ? t("skins.descStartPrice", { name: p.name, usd: money(p.value, "USD"), count: p.items.length, top: topNames })
                : (top.length ? t("skins.descStartTop", { name: p.name, count: p.items.length, top: topNames }) : t("skins.descStart", { name: p.name, count: p.items.length }));
            const descriptionEnd = p.hasPrices ? t("skins.descEndPrice") : t("skins.descEnd", { date: p.updated });
            const description = descriptionStart + ((descriptionStart + descriptionEnd).length <= 160 ? descriptionEnd : "");
            const graph = [
                {
                    "@type": "CollectionPage",
                    "@id": url,
                    "url": url,
                    "name": t("skins.pageName", { name: p.name }),
                    "description": description,
                    "inLanguage": lang,
                    "isPartOf": { "@id": SITE_URL + "/#website" },
                    "about": { "@id": url + "#person" },
                    "breadcrumb": { "@id": url + "#breadcrumb" },
                    "dateModified": isoDate(p.updated),
                    "mainEntity": {
                        "@type": "ItemList",
                        "name": t("skins.listName", { name: p.name }),
                        "numberOfItems": p.groups.length,
                        "itemListElement": p.groups.slice(0, 30).map(function (g, i) {
                            return { "@type": "ListItem", "position": i + 1, "name": g.item.marketName, "image": `${SITE_URL}/skins/img/${g.item.image}.webp` };
                        })
                    }
                },
                sectionBreadcrumb(t("skins.breadcrumb"), skinsUrl, t("skins.playerBreadcrumb", { name: p.name }), url),
                {
                    "@type": "Person",
                    "@id": url + "#person",
                    "name": p.name,
                    "description": p.team ? t("skins.personTeam", { name: p.name, team: p.team }) : t("skins.person", { name: p.name }),
                    "url": known ? langUrl(`players/${slug(known.name)}.html`) : url
                },
                faqGraph(url, faq)
            ];
            if (profileLinks(known).length) {
                graph[2].sameAs = profileLinks(known);
            }
            if (p.team) {
                graph[2].memberOf = { "@type": "SportsTeam", "name": p.team, "sport": "Counter-Strike 2" };
            }
            const others = skinPlayers.filter(function (o) { return o !== p; });

            write(LD + "skins/" + file, `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: p.hasPrices ? t("skins.titleValue", { name: name }) : t("skins.title", { name: name }),
        ogTitle: t("skins.ogTitle", { name: name }),
        description: description,
        url: url,
        path: rel,
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": graph }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "skins")}

    <main class="player-page skins-page" style="--team: ${teamColor(p.team)}; --on-team: ${textOnColor(teamColor(p.team))}">
        ${crumbs("../", `<a href="./">${t("skins.crumb")}</a> › <span>${name}</span>`)}

        <div class="player-head">
            ${skinPhoto(p, sa, 120, 134, "player-photo", true)}
            <div>
                <h1>${t("skins.h1", { name: name })}</h1>
                ${p.team ? `<p class="player-team">${logoFor(p.team) ? `<img class="player-team-logo" src="${sa}${logoFor(p.team)}" alt="" width="20" height="20">` : ""}${esc(p.team)}</p>` : ""}
                <p class="player-date">${t("skins.count", { count: p.items.length })}${p.hasPrices ? ` · <strong>${money(p.value, "USD")}</strong> / ${money(p.valueEur, "EUR")}` : ""} · ${t("skins.updatedLabel")} <time datetime="${isoDate(p.updated)}">${esc(p.updated)}</time></p>
            </div>
        </div>

        <p>${esc(skinSummary(p))} ${top.length ? t(p.hasPrices ? "skins.topExpensive" : "skins.topRarest", { name: name, list: esc(skinList(top, 2)) }) : ""} ${t("skins.floatNote", { name: name })}${known ? ` ${t("skins.crosshairQuestion", { name: name })} <a href="../players/${slug(known.name)}.html">${t("skins.crosshairLink", { name: name })}</a>` : ""}</p>

        <nav class="skin-jump" aria-label="${t("skins.jumpAria")}">
            ${byCategory.map(function (c) {
                return `<a href="#${c.key}">${c.label} <span>${c.groups.reduce(function (n, g) { return n + g.count; }, 0)}</span></a>`;
            }).join("\n            ")}
        </nav>
        ${PRICE_NOTE ? `<p class="skin-note">${PRICE_NOTE}</p>` : ""}

${p.hasPrices ? `        <section class="skin-section" id="most-expensive" aria-labelledby="most-expensive-title">
            <h2 id="most-expensive-title">${t("skins.mostExpensive", { name: name })}</h2>
            <div class="skin-grid">
            ${p.best.slice(0, 8).map(function (g, i) { return skinCard(g, p.name, sa, i < 4); }).join("\n            ")}
            </div>
        </section>
` : ""}${byCategory.map(function (c, ci) {
        return `        <section class="skin-section" id="${c.key}" aria-labelledby="${c.key}-title">
            <h2 id="${c.key}-title">${t("skins.sectionTitle", { name: name, label: c.label.toLowerCase() })}</h2>
            <div class="skin-grid">
            ${c.groups.map(function (g, i) { return skinCard(g, p.name, sa, ci === 0 && i < 4); }).join("\n            ")}
            </div>
        </section>`;
    }).join("\n")}

        <h2>${t("skins.faqTitle", { name: name })}</h2>
${faqItems(faq, "h3")}

        ${others.length ? `<h2>${t("skins.othersTitle")}</h2>
        <ul class="related">${others.map(function (o) {
            return `<li><a href="${o.slug}.html">${t("skins.othersLink", { name: esc(o.name) })}</a></li>`;
        }).join("")}</ul>` : ""}
    </main>

    ${footer("../")}
</body>
</html>
`);
        });

        // La page d'accueil des skins : tous les pros + leurs couteaux et gants
        if (skinPlayers.length) {
            const hubDescription = t("skins.hubDescription", { names: skinPlayers.map(function (p) { return p.name; }).join(", "), date: skinData.updated });
            if (EN) {
                sitemapPages.push({ path: "skins/", lastmod: isoDate(skinData.updated) });
            }
            write(LD + "skins/index.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("skins.hubTitle"),
        ogTitle: t("skins.hubOgTitle"),
        description: hubDescription,
        url: skinsUrl,
        path: "skins/",
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": [
            {
                "@type": "CollectionPage",
                "@id": skinsUrl,
                "url": skinsUrl,
                "name": t("skins.hubOgTitle"),
                "description": hubDescription,
                "inLanguage": lang,
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "breadcrumb": { "@id": skinsUrl + "#breadcrumb" },
                "dateModified": isoDate(skinData.updated),
                "mainEntity": {
                    "@type": "ItemList",
                    "itemListElement": skinPlayers.map(function (p, i) {
                        return { "@type": "ListItem", "position": i + 1, "name": t("skins.hubListItem", { name: p.name }), "url": skinsUrl + p.slug + ".html" };
                    })
                }
            },
            sectionBreadcrumb(t("skins.breadcrumb"), skinsUrl)
        ] }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "skins")}

    <main class="player-page skins-page">
        ${crumbs("../", `<span>${t("skins.crumb")}</span>`)}
        <h1>${t("skins.hubH1")}</h1>
        <p>${t("skins.hubIntro", { date: esc(skinData.updated) })}</p>
        ${PRICE_NOTE ? `<p class="skin-note">${PRICE_NOTE}</p>` : ""}

        <div class="ps-tiles">
            ${skinPlayers.map(function (p) {
                const best = p.best[0];
                return `<a class="ps-tile" href="${p.slug}.html" style="--team: ${teamColor(p.team)}; --on-team: ${textOnColor(teamColor(p.team))}">
                ${skinPhoto(p, sa, 56, 63)}
                <span class="ps-text"><span class="ps-name">${esc(p.name)}</span>${p.team ? `<span class="ps-info">${esc(p.team)}</span>` : ""}<span class="ps-info">${t("skins.count", { count: p.items.length })}${p.hasPrices ? " · " + money(p.value, "USD") : ""}</span></span>
                <img class="ps-tile-skin" src="${EN ? "" : sa + "skins/"}img/${esc(best.item.image)}.webp" alt="${t("skins.altShort", { name: esc(p.name), skin: esc(best.item.name) })}" width="80" height="60" loading="lazy" decoding="async">
            </a>`;
            }).join("\n            ")}
        </div>

${skinPlayers.map(function (p) {
        const special = p.groups.filter(function (g) { return g.item.category === "knives" || g.item.category === "gloves"; });
        const shown = (special.length ? special : p.groups).slice(0, 8);
        return `        <section class="skin-section" aria-labelledby="hub-${p.slug}">
            <h2 id="hub-${p.slug}">${t(special.length ? "skins.hubKnivesGloves" : "skins.hubBest", { name: esc(p.name) })}</h2>
            <div class="skin-grid">
            ${shown.map(function (g) { return skinCard(g, p.name, sa, false); }).join("\n            ")}
            </div>
            <p><a href="${p.slug}.html">${t("skins.seeAll", { count: p.items.length, name: esc(p.name) })}</a></p>
        </section>`;
    }).join("\n")}
    </main>

    ${footer("../")}
</body>
</html>
`);
        }

        // Supprimer les pages de skins des joueurs retirés (ou devenus privés)
        if (fs.existsSync(LD + "skins")) {
            fs.readdirSync(LD + "skins").forEach(function (f) {
                if (f.endsWith(".html") && !skinFiles.includes(f)) {
                    fs.unlinkSync(LD + "skins/" + f);
                    console.log("Page supprimée : " + LD + "skins/" + f);
                }
            });
        }
    }
};
