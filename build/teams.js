// build/teams.js : les pages des équipes, dans chaque langue
//   - teams/index.html : la liste des équipes (« CS2 Crosshairs by Team »)
//   - teams/<équipe>.html : les crosshairs de tous les joueurs d'une équipe (cible « vitality crosshair », « navi crosshairs »…)
// Appelé par build.js une fois par langue. c = la « boîte à outils » commune préparée par build.js
// (textes traduits t(), en-tête head(), pied de page footer(), liste des joueurs…).
// Textes : section « teams » de i18n/<langue>.json. Adresse d'une équipe : le nom de son logo (logos/navi.png -> teams/navi).
const fs = require("fs");

function buildTeams(c) {
    const { t, lang, LD, EN, SITE_URL, esc, slug, teams, players, teamSlug, teamColor, textOnColor, teamBadge, cardHTML,
        byTeamThenName, isoDate, write, sitemapPages, photoFiles, logoFor, decode, colorName, listText, langUrl,
        HTML_OPEN, THEME_SCRIPT, PHOTO_FALLBACK_SCRIPT, CARDS_SCRIPT, head, pageTop, footer, crumbs, sectionBreadcrumb,
        faqGraph, faqItems, commandData, newest, sponsorSlot } = c;

    const a = c.ap("../"); // chemin vers la racine du site (CSS, images) depuis teams/

    // Les équipes qui ont des joueurs, avec leurs joueurs triés par pseudo
    const rosters = teams.map(function (team) {
        const list = players.filter(function (p) { return p.category === "pro" && p.team === team.name; }).sort(byTeamThenName);
        // Le match le plus récent de l'équipe (date la plus récente parmi ses joueurs)
        const last = list.map(function (p) { return p.updated; }).sort(function (x, y) { return isoDate(y).localeCompare(isoDate(x)); })[0] || "";
        return { team: team, file: teamSlug(team.name) + ".html", players: list, last: last };
    }).filter(function (r) { return r.players.length > 0; });

    const hubUrl = langUrl("teams/index.html");
    const names = function (list) { return list.map(function (p) { return p.name; }); };

    // ===== Une page par équipe =====
    rosters.forEach(function (r) {
        const team = esc(r.team.name);
        const rel = "teams/" + r.file;
        const url = langUrl(rel);
        const color = teamColor(r.team.name);
        const logo = logoFor(r.team.name);
        const count = r.players.length;
        const list = listText(names(r.players));
        if (EN) {
            sitemapPages.push({ path: rel, lastmod: isoDate(r.last) });
        }

        // Statistiques de l'équipe (contenu propre à chaque page) : couleur la plus utilisée, point central
        const decoded = r.players.map(function (p) { return { player: p, c: decode(p.code) }; }).filter(function (x) { return x.c; });
        const colors = {};
        decoded.forEach(function (x) {
            const key = colorName(x.c);
            colors[key] = (colors[key] || 0) + 1;
        });
        const topColor = Object.keys(colors).sort(function (x, y) { return colors[y] - colors[x]; })[0];
        const dots = decoded.filter(function (x) { return x.c.centerDotEnabled; }).length;
        const stats = (topColor ? t("teams.statsColor", { count: colors[topColor], total: decoded.length, color: t("colors." + topColor) }) + " " : "")
            + (dots ? t("teams.statsDot", { count: dots }) : t("teams.statsNoDot"));

        const faq = [
            [t("teams.faqRosterQ", { team: r.team.name }), t("teams.faqRosterA", { list: list, date: r.last })],
            [t("teams.faqSpecQ", { team: r.team.name }), decoded.map(function (x) {
                return t("teams.faqSpec", { name: x.player.name, color: t("colors." + colorName(x.c)), length: x.c.length, thickness: x.c.thickness, gap: x.c.gap });
            }).join(" ")]
        ];

        // Description Google : 160 caractères au plus (sinon la version courte)
        const long = t("teams.description", { team: r.team.name, list: list });
        const description = long.length <= 160 ? long : t("teams.descriptionShort", { team: r.team.name, list: list });

        const cards = r.players.map(function (p, i) {
            const photo = photoFiles(p);
            return cardHTML(p, { photo: photo.sm && a + photo.sm, eager: i < 4, logo: logo && a + logo, t: t, teamLabel: p.team, base: "../" });
        }).join("\n            ");

        const jsonLd = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "CollectionPage",
                    "@id": url,
                    "url": url,
                    "name": t("teams.ogTitle", { team: r.team.name }),
                    "inLanguage": lang,
                    "isPartOf": { "@id": SITE_URL + "/#website" },
                    "about": { "@id": url + "#team" },
                    "breadcrumb": { "@id": url + "#breadcrumb" },
                    "dateModified": isoDate(r.last)
                },
                sectionBreadcrumb(t("teams.hubCrumb"), hubUrl, r.team.name, url),
                {
                    "@type": "SportsTeam",
                    "@id": url + "#team",
                    "name": r.team.name,
                    "sport": "Counter-Strike 2",
                    "url": url,
                    "logo": SITE_URL + "/" + r.team.logo,
                    "athlete": r.players.map(function (p) {
                        const playerUrl = langUrl("players/" + slug(p.name) + ".html");
                        return { "@type": "Person", "@id": playerUrl + "#person", "name": p.name, "url": playerUrl };
                    })
                },
                faqGraph(url, faq)
            ]
        };

        write(LD + rel, `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("teams.title", { team: team }),
        ogTitle: t("teams.ogTitle", { team: team }),
        description: description,
        url: url,
        path: rel,
        prefix: "../",
        cards: true,
        jsonLd: jsonLd
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${PHOTO_FALLBACK_SCRIPT}
    ${pageTop("../", "crosshairs")}

    <main class="player-page team-page" style="--team: ${color}; --on-team: ${textOnColor(color)}">
        ${crumbs("../", `<a href="./">${t("teams.hubCrumb")}</a> › <span>${team}</span>`)}

        <div class="player-head team-head">
            <div>
                <h1>${t("teams.h1", { team: team })}</h1>
                <p class="player-team">${logo ? `<img class="player-team-logo" src="${a}${logo}" alt="" width="20" height="20">` : ""}${t("teams.players", { count: count })}</p>
                <p class="player-date">${t("teams.lastMatch", { date: `<time datetime="${isoDate(r.last)}">${esc(r.last)}</time>` })}</p>
            </div>
        </div>

        <p>${esc(t("teams.intro", { team: r.team.name, count: count, list: list, date: r.last }))} ${esc(stats)}</p>
        ${sponsorSlot("team", a)}

        <h2>${t("teams.listTitle", { team: team })}</h2>
        <div class="card-grid">
            ${cards}
        </div>

        <h2>${t("teams.howTitle", { team: team })}</h2>
        <ol>
            <li>${t("player.how1")}</li>
            <li>${t("player.how2")}</li>
            <li>${t("player.how3")}</li>
        </ol>
        <p>${t("player.orConsole")}${commandData ? ` <a href="../commands/#crosshair">${t("player.commandsLink")}</a>` : ""} <a href="../faq.html">${t("player.faqLink")}</a></p>

        <h2>${t("teams.faqTitle", { team: team })}</h2>
${faqItems(faq, "h3")}

        <h2>${t("teams.othersTitle")}</h2>
        <ul class="related">${rosters.filter(function (o) { return o !== r; }).map(function (o) {
            return `<li><a href="${o.file}">${t("teams.teamLink", { team: esc(o.team.name) })}</a></li>`;
        }).join("")}</ul>
    </main>

    ${footer("../")}

    ${CARDS_SCRIPT(a)}
</body>
</html>
`);
    });

    // ===== La liste des équipes =====
    if (EN) {
        sitemapPages.push({ path: "teams/", lastmod: newest });
    }
    const playerCount = rosters.reduce(function (n, r) { return n + r.players.length; }, 0);
    write(LD + "teams/index.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("teams.hubTitle"),
        description: t("teams.hubDescription", { teams: rosters.length, players: playerCount }),
        url: hubUrl,
        path: "teams/",
        prefix: "../",
        jsonLd: {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "CollectionPage",
                    "@id": hubUrl,
                    "url": hubUrl,
                    "name": t("teams.hubH1"),
                    "inLanguage": lang,
                    "isPartOf": { "@id": SITE_URL + "/#website" },
                    "breadcrumb": { "@id": hubUrl + "#breadcrumb" },
                    "mainEntity": {
                        "@type": "ItemList",
                        "itemListElement": rosters.map(function (r, i) {
                            return { "@type": "ListItem", "position": i + 1, "name": r.team.name, "url": langUrl("teams/" + r.file) };
                        })
                    }
                },
                sectionBreadcrumb(t("teams.hubCrumb"), hubUrl)
            ]
        }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "crosshairs")}

    <main class="player-page team-page">
        ${crumbs("../", `<span>${t("teams.hubCrumb")}</span>`)}
        <h1>${t("teams.hubH1")}</h1>
        <p>${t("teams.hubIntro")}</p>

        <ul class="team-list">
            ${rosters.map(function (r) {
                const logo = logoFor(r.team.name);
                return `<li><a href="${r.file}" style="--team: ${teamColor(r.team.name)}">${teamBadge(r.team.name, logo && a + logo, 22)}<span><strong>${t("teams.teamLink", { team: esc(r.team.name) })}</strong><small>${esc(names(r.players).join(", "))}</small></span></a></li>`;
            }).join("\n            ")}
        </ul>
    </main>

    ${footer("../")}
</body>
</html>
`);

    // Supprimer les pages des équipes qui n'existent plus
    const wanted = rosters.map(function (r) { return r.file; }).concat("index.html");
    fs.readdirSync(LD + "teams").forEach(function (f) {
        if (f.endsWith(".html") && !wanted.includes(f)) {
            fs.unlinkSync(LD + "teams/" + f);
            console.log("Page supprimée (équipe sans joueur) : " + LD + "teams/" + f);
        }
    });

    return rosters;
}

module.exports = { build: buildTeams };
