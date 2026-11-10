// build.js : génère tout ce qui sert au référencement Google (SEO) et à la vitesse du site, dans chaque langue
//   - les images optimisées (vignettes des photos, logos, fond des aperçus, icônes, aperçu de lien) : voir images.js
//   - index.html (à partir du modèle index.template.html) : les cartes des joueurs (Pros, Creators, Trending),
//     le menu des équipes, les compteurs — lisibles par Google sans JavaScript
//   - une page complète par joueur (players/<slug>.html) — et supprime les pages des joueurs qui n'existent plus
//   - faq.html, generator.html, skins/, commands/, guides/, tools/, valorant.html, legal.html, 404.html
//   - sitemap.xml (toutes les langues, avec les liens hreflang entre les versions)
//   - les "empreintes" ?v=... des fichiers CSS/JS/images : changent toutes seules quand le fichier change
// LANGUES (voir i18n.js) : l'anglais à la racine (/players/zywoo), le français dans fr/ (/fr/players/zywoo).
//   Tous les textes sont dans i18n/en.json, i18n/fr.json (+ i18n/fr/guides.json, commands.json, binds.json).
//   Ne pas écrire de texte en dur ici : ajouter une clé dans i18n/en.json (et sa traduction dans i18n/fr.json).
// ORGANISATION (découpage du 10/11/2026) : ce fichier prépare les données, les morceaux communs à toutes les pages
//   (en-tête, pied de page, menu…), les pages joueurs, l'accueil, le sitemap. Chaque autre rubrique du site a son fichier
//   dans le dossier build/ (teams, lists, faq, generator, skins, commands, guides, tools, valorant, legal, methodology,
//   notfound). build.js leur passe une « boîte à outils » (ctx) : tout ce dont une page a besoin. Pour une nouvelle
//   rubrique : créer build/<nom>.js sur le modèle de build/teams.js, puis l'appeler dans buildSite().
// Lancer avec : node build.js   (à relancer après chaque changement de players.json, des photos, du CSS, du JS ou des textes)
// Vérifier ensuite le site fabriqué : node check.js (titres, liens cassés, langues… voir check.js)

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { optimizeImages, findChrome } = require("./images.js");
const { makePlayerOgImages } = require("./og.js");
const { extractCritical } = require("./critical.js");
const { LANGS, SOON, NAMES, makeI18n, readJson } = require("./i18n.js");

const SITE_URL = "https://clutchcrosshair.com";

// Mentions légales : À REMPLIR avant de publier
const PUBLISHER_NAME = "Anto";
const PUBLISHER_EMAIL = "clutchcrosshair@gmail.com";

// Nombre de cartes dont la photo est chargée tout de suite (la première rangée, visible sans défiler)
const EAGER_CARDS = 4;

// Crosshair de départ du générateur : vert, statique, sans contour, tailles en pixels pour un écran 1080p
const GENERATOR_DEFAULT = {
    format: "cs2-v1", style: 4, followRecoil: false, centerDotEnabled: false, tStyleEnabled: false, outlineMode: 0,
    red: 0, green: 255, blue: 0, alpha: 255, outlineRed: 0, outlineGreen: 0, outlineBlue: 0, outlineAlpha: 255,
    gap: 2, length: 4, thickness: 2, dynamicSpreadLimit: 181, splitDistance: 2, innerSplitAlpha: 0, outerSplitAlpha: 1,
    splitSizeRatio: 1, screenHeight: 1080, scopeDotScale: 1, scopeDotUseCrosshairColor: false
};

// Date "17/10/2026" -> "2026-10-17" (format demandé par le sitemap et les données structurées)
function isoDate(date) {
    const parts = String(date || "").split("/");
    return parts.length === 3 ? parts[2] + "-" + parts[1] + "-" + parts[0] : "";
}

// Empreinte courte du contenu d'un fichier (change dès que le fichier change)
function fingerprint(file) {
    return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 10);
}

// Remplace le contenu entre deux repères (<!-- NOM:START ... --> et <!-- NOM:END -->) dans un texte
function replaceBetween(text, name, content, indent) {
    const startMark = "<!-- " + name + ":START";
    const endMark = "<!-- " + name + ":END -->";
    const start = text.indexOf(startMark);
    const end = text.indexOf(endMark);
    if (start === -1 || end === -1) {
        console.log("Attention : repères " + name + " introuvables dans index.html");
        return text;
    }
    const startLineEnd = text.indexOf("-->", start) + 3;
    return text.slice(0, startLineEnd) + "\n" + indent + content + "\n" + indent + text.slice(end);
}

// Écrit un fichier en créant son dossier si besoin (fr/players/... par exemple)
function write(file, text) {
    fs.mkdirSync(path.dirname(file) || ".", { recursive: true });
    fs.writeFileSync(file, text);
}

async function main() {
    // 0. Images optimisées (ne refait que ce qui manque ou a changé)
    optimizeImages();

    // Ces fichiers sont des "modules" (export) : on les charge avec import()
    const sharecode = await import("./lib/csgo-sharecode.js");
    const { teams } = await import("./teams.js");
    const render = await import("./render.js");
    const { slug, esc, consoleCommands, teamInfo, teamColor, textOnColor, teamBadge, cardHTML, byTeamThenName, generatorHTML, SKIN_CATEGORIES, groupSkins, byPrice, formatPrice, skinCardHTML } = render;

    const players = JSON.parse(fs.readFileSync("players.json", "utf8"));

    // Skins des pros (rempli par update-skins.js) : seulement les inventaires publics qui contiennent des skins
    const skinData = fs.existsSync("skins.json") ? JSON.parse(fs.readFileSync("skins.json", "utf8")) : { players: [] };
    const skinPlayers = skinData.players.filter(function (p) {
        return p.status === "public" && p.items.length > 0;
    }).map(function (p) {
        const groups = groupSkins(p.items);
        const hasPrices = p.items.some(function (i) { return i.price != null; });
        // best = les plus chers d'abord (quand les prix sont branchés), sinon couteaux, gants... par rareté
        // Valeur de l'inventaire (somme des prix de tous les exemplaires)
        const value = p.items.reduce(function (n, i) { return n + (i.price || 0); }, 0);
        const valueEur = p.items.reduce(function (n, i) { return n + (i.priceEur || 0); }, 0);
        return Object.assign({}, p, { slug: slug(p.name), groups: groups, hasPrices: hasPrices, best: hasPrices ? byPrice(groups) : groups, value: value, valueEur: valueEur });
    });
    skinData.players.filter(function (p) { return p.status === "private"; }).forEach(function (p) {
        console.log("Attention : l'inventaire de " + p.name + " est privé (pas de page skins)");
    });

    // Empreintes des fichiers CSS / JS / images (voir tout en haut)
    // Ordre important : fonds -> crosshair.js -> generator.js (qui l'importe) -> script.js (qui importe les deux)
    // Images qui gardent leur nom quand on les remplace (photos, logos, fonds des aperçus) : elles reçoivent aussi
    // une empreinte ?v=, car _headers demande aux navigateurs de les garder 1 an (la nouvelle version a une autre adresse)
    const versions = new Map();
    function versioned(file) {
        if (file && !versions.has(file)) {
            versions.set(file, fs.existsSync(file) ? file + "?v=" + fingerprint(file) : file);
        }
        return file ? versions.get(file) : file;
    }
    const BG_HASH = fs.existsSync("preview-bg.webp") ? fingerprint("preview-bg.webp") : "";
    const BG_CROP_HASH = fs.existsSync("preview-bg-crop.webp") ? fingerprint("preview-bg-crop.webp") : "";
    // crosshair.js charge les fonds : on y écrit leurs empreintes (avant de calculer celle de crosshair.js)
    (function () {
        const text = fs.readFileSync("crosshair.js", "utf8");
        const updated = text
            .replace(/(["'])preview-bg\.webp(\?v=[^"']*)?(["'])/, "$1preview-bg.webp?v=" + BG_HASH + "$3")
            .replace(/(["'])preview-bg-crop\.webp(\?v=[^"']*)?(["'])/, "$1preview-bg-crop.webp?v=" + BG_CROP_HASH + "$3");
        if (updated !== text) {
            fs.writeFileSync("crosshair.js", updated);
        }
    })();
    // Versions « minifiées » (sans espaces ni commentaires) pour le site en ligne, fabriquées par esbuild (npm ci) :
    // style.min.css, crosshair.min.js, generator.min.js, script.min.js. Les sources restent lisibles et ne sont pas
    // appelées par les pages. Dans les .min.js, les imports pointent vers les autres .min.js avec leur empreinte ?v=.
    // Fins de ligne uniformisées : le PC (Windows) et GitHub fabriquent exactement les mêmes fichiers (mêmes empreintes).
    let esbuild = null;
    try {
        esbuild = require("esbuild");
    } catch (error) {
        console.log("Attention : esbuild n'est pas installé (lancer « npm ci ») : les fichiers .min sont copiés sans être minifiés");
    }
    // transform (facultatif) : retouche le code avant la minification (ex. textes ajoutés dans lang-banner.js)
    function minify(source, out, loader, imports, transform) {
        let code = fs.readFileSync(source, "utf8").replace(/\r\n/g, "\n");
        (imports || []).forEach(function (imp) {
            code = code.replace(new RegExp("([\"'])\\./" + imp.from.replace(".", "\\.") + "(\\?v=[^\"']*)?([\"'])", "g"), "$1./" + imp.to + "?v=" + imp.hash + "$3");
        });
        if (transform) {
            code = transform(code);
        }
        if (esbuild) {
            code = esbuild.transformSync(code, { loader: loader, minify: true, legalComments: "none" }).code;
        }
        if (!fs.existsSync(out) || fs.readFileSync(out, "utf8") !== code) {
            fs.writeFileSync(out, code);
        }
        return fingerprint(out);
    }
    const CSS_HASH = minify("style.css", "style.min.css", "css");
    const CROSSHAIR_HASH = minify("crosshair.js", "crosshair.min.js", "js");
    const GENERATOR_HASH = minify("generator.js", "generator.min.js", "js", [{ from: "crosshair.js", to: "crosshair.min.js", hash: CROSSHAIR_HASH }]);
    const CONSENT_HASH = minify("consent.js", "consent.min.js", "js");
    // Bandeau de suggestion de langue : textes « langBanner » de chaque langue, écrits dans la langue elle-même
    const LANG_BANNER_HASH = minify("lang-banner.js", "lang-banner.min.js", "js", null, function (code) {
        const texts = {};
        LANGS.forEach(function (l) {
            const i = makeI18n(l);
            texts[l] = { text: i.t("langBanner.text"), button: i.t("langBanner.button"), close: i.t("langBanner.close") };
        });
        if (!code.includes("var TEXTS = {};")) {
            throw new Error("lang-banner.js : la ligne « var TEXTS = {}; » est introuvable");
        }
        return code.replace("var TEXTS = {};", "var TEXTS = " + JSON.stringify(texts) + ";");
    });
    const SCRIPT_HASH = minify("script.js", "script.min.js", "js", [
        { from: "crosshair.js", to: "crosshair.min.js", hash: CROSSHAIR_HASH },
        { from: "generator.js", to: "generator.min.js", hash: GENERATOR_HASH }
    ]);

    // Le générateur : code de départ + liste des pros (codes CS2 valides seulement), par équipe
    const generatorCode = sharecode.encodeCrosshair(GENERATOR_DEFAULT);
    const generatorGroups = teams.map(function (t) {
        return {
            title: t.name,
            players: players.filter(function (p) {
                return p.team === t.name && /^CS(?!GO-)/.test(p.code) && decode(p.code);
            }).sort(byTeamThenName)
        };
    }).filter(function (g) {
        return g.players.length > 0;
    });

    // Photo d'origine, vignette (cartes) et photo moyenne (fiche, page joueur) d'un joueur
    function photoFiles(player) {
        let original = player.photo || "";
        if (!original) {
            for (const ext of ["webp", "png", "jpg"]) {
                const file = "photos/" + slug(player.name) + "." + ext;
                if (fs.existsSync(file)) {
                    original = file;
                    break;
                }
            }
        }
        if (!original) {
            return { original: "", sm: "", md: "" };
        }
        const base = original.replace(/^photos\//, "").replace(/\.\w+$/, "");
        const sm = "photos/sm/" + base + ".webp";
        const md = "photos/md/" + base + ".webp";
        return { original: original, sm: versioned(fs.existsSync(sm) ? sm : original), md: versioned(fs.existsSync(md) ? md : original) };
    }

    // Logo optimisé de l'équipe (logos/sm/...) s'il existe, sinon le logo d'origine
    function logoFor(teamName) {
        const team = teamInfo(teamName);
        if (!team) {
            return "";
        }
        const small = team.logo.replace(/^logos\//, "logos/sm/").replace(/\.\w+$/, ".webp");
        return versioned(fs.existsSync(small) ? small : team.logo);
    }

    // Adresse de la page d'une équipe : le nom de son logo ("logos/navi.png" -> "navi" -> teams/navi.html)
    function teamSlug(teamName) {
        const team = teamInfo(teamName);
        return team ? team.logo.replace(/^logos\//, "").replace(/\.\w+$/, "") : slug(teamName);
    }

    function decode(code) {
        try {
            return sharecode.decodeCrosshairShareCode(code);
        } catch (error) {
            return null;
        }
    }

    // Image d'aperçu de lien de chaque joueur (og/<pseudo>.jpg, voir og.js) : { "<slug>": "og/<slug>.jpg" }
    const ogImages = makePlayerOgImages(players, {
        decode: sharecode.decodeCrosshairShareCode, slug: slug, teamInfo: teamInfo, teamColor: teamColor, textOnColor: textOnColor,
        photoOf: function (p) { return photoFiles(p).original; }
    });

    // ===== Données communes à toutes les langues =====
    const COLOR_NAMES = [["green", 0, 255, 0], ["yellow", 255, 255, 0], ["cyan", 0, 255, 255], ["red", 255, 0, 0], ["pink", 255, 0, 255],
        ["white", 255, 255, 255], ["blue", 0, 0, 255], ["lightBlue", 100, 190, 255], ["orange", 255, 140, 0], ["purple", 150, 60, 255],
        ["lime", 170, 255, 0], ["teal", 0, 200, 150]];

    // La couleur la plus proche parmi des noms simples (ex. 0,255,255 -> "cyan") : renvoie la clé (traduite avec t("colors.<clé>"))
    function colorName(c) {
        let best = "";
        let distance = Infinity;
        COLOR_NAMES.forEach(function (n) {
            const d = (c.red - n[1]) ** 2 + (c.green - n[2]) ** 2 + (c.blue - n[3]) ** 2;
            if (d < distance) {
                distance = d;
                best = n[0];
            }
        });
        return best;
    }

    // Les crosshairs CS2 valides des pros, pour les comparaisons
    const proCrosshairs = players.filter(function (p) {
        return p.category === "pro";
    }).map(function (p) {
        return { player: p, c: decode(p.code) };
    }).filter(function (x) {
        return x.c && x.c.format !== "legacy-v1";
    });

    function percentOfPros(test) {
        return Math.round(proCrosshairs.filter(test).length / proCrosshairs.length * 100);
    }

    // Les autres joueurs (pros et créateurs) qui ont EXACTEMENT le même code : petite ligne « Same crosshair as … »
    function twins(player) {
        return players.filter(function (p) { return p !== player && p.code === player.code; });
    }

    // Profils officiels du joueur pour Google (sameAs) : son compte Steam (lu dans les démos) et sa page Liquipedia (vérifiée)
    function profileLinks(player) {
        const links = [];
        if (player && player.steamid) {
            links.push("https://steamcommunity.com/profiles/" + player.steamid);
        }
        if (player && player.liquipedia) {
            links.push("https://liquipedia.net/counterstrike/" + encodeURIComponent(player.liquipedia).replace(/%2F/g, "/"));
        }
        if (player && player.hltv) {
            links.push(player.hltv); // page HLTV donnée à la main (ex. art, dont la page Liquipedia est celle d'un homonyme)
        }
        if (player && player.faceit) {
            links.push(player.faceit); // profil FACEIT des créateurs (creators.csv, via import-creators.js)
        }
        return links;
    }

    const pros = players.filter(function (p) { return p.category === "pro"; });
    const creators = players.filter(function (p) { return p.category !== "pro"; });
    const trending = players.filter(function (p) { return p.trending; });

    // Statistiques des crosshairs des pros (FAQ, générateur)
    const decoded = pros.map(function (p) { return decode(p.code); }).filter(Boolean);
    const total = decoded.length;
    function percent(count) {
        return total ? Math.round((count / total) * 100) + "%" : "0%";
    }
    function colorFamily(c) {
        const r = c.red, g = c.green, b = c.blue;
        if (r > 200 && g > 200 && b > 200) return "white";
        if (g > 180 && b > 180 && r < 120) return "cyan";
        if (r > 180 && g > 180 && b < 120) return "yellow";
        if (g > 150 && r < 160 && b < 160) return "green";
        return "other";
    }
    const families = {};
    decoded.forEach(function (c) {
        const f = colorFamily(c);
        families[f] = (families[f] || 0) + 1;
    });
    const familyOrder = Object.keys(families).sort(function (a, b) {
        return families[b] - families[a];
    });
    const withDot = decoded.filter(function (c) { return c.centerDotEnabled; }).length;
    const withOutline = decoded.filter(function (c) { return c.outlineMode > 0; }).length;
    const smallGap = decoded.filter(function (c) { return c.gap <= 1; }).length;
    const newest = players.map(function (p) { return isoDate(p.updated); }).filter(Boolean).sort().pop() || "";
    function mostCommon(values) {
        const count = {};
        values.forEach(function (v) {
            count[v] = (count[v] || 0) + 1;
        });
        return Object.keys(count).sort(function (a, b) {
            return count[b] - count[a];
        })[0];
    }
    const famous = ["ZywOo", "donk", "m0NESY", "NiKo", "ropz", "sh1ro", "Twistzz", "b1t"].map(function (n) {
        return pros.find(function (p) { return p.name === n; });
    }).filter(Boolean);

    // Données des guides, des commandes et des outils (en anglais ; les traductions sont dans i18n/<langue>/)
    const commandData = fs.existsSync("commands.json") ? JSON.parse(fs.readFileSync("commands.json", "utf8")) : null;
    const guideData = readJson("guides.json"); // readJson remplace {year} par l'année en cours (titres « (2026) »)
    const bindData = fs.existsSync("binds.json") ? JSON.parse(fs.readFileSync("binds.json", "utf8")) : null;

    // Liens sponsorisés (sponsors.json) : seulement ceux dont la période est en cours aujourd'hui. Fichier vide = rien
    // ne s'affiche nulle part. Le site est refabriqué chaque jour : un sponsor disparaît tout seul à la fin de sa période.
    const todayIso = new Date().toISOString().slice(0, 10);
    const sponsors = ((readJson("sponsors.json") || {}).sponsors || []).filter(function (s) {
        if (!s.name || !/^https:\/\//.test(s.url || "")) {
            console.log("Attention : sponsor ignoré (il faut un nom et une adresse en https://) : " + JSON.stringify(s).slice(0, 80));
            return false;
        }
        return (!s.from || isoDate(s.from) <= todayIso) && (!s.until || isoDate(s.until) >= todayIso);
    });

    // Les pages publiées, pour le sitemap : { path, lastmod, images } (adresse sans la langue, ex. "players/zywoo.html")
    const sitemapPages = [];

    // ===== Toutes les pages, dans chaque langue =====
    for (const lang of LANGS) {
        buildSite(lang);
    }

    function buildSite(lang) {
        const I = makeI18n(lang);
        const t = I.t;
        const tList = I.tList;
        const LD = I.dir; // "" pour l'anglais, "fr/" pour le français
        const EN = lang === "en";

        // Chemin vers la racine du site (fichiers CSS/JS/images) depuis une page : prefix = chemin vers la racine de la langue
        function ap(prefix) {
            if (/^https?:/.test(prefix)) {
                return SITE_URL + "/";
            }
            if (EN) {
                return prefix;
            }
            return (prefix === "./" ? "" : prefix) + "../";
        }
        // Adresse complète d'une page dans cette langue
        function langUrl(rel) {
            return SITE_URL + "/" + LD + rel;
        }
        // Adresse relative de la même page dans une autre langue (pour le sélecteur)
        function altHref(prefix, target, rel) {
            const href = ap(prefix) + (target === "en" ? "" : target + "/") + rel;
            return href || "./";
        }
        // Le nom affiché de l'équipe ("Creator" est traduit, les vraies équipes jamais)
        function teamLabel(team) {
            return team === "Creator" ? t("common.creator") : team;
        }
        function listText(items) {
            return items.length > 1 ? items.slice(0, -1).join(", ") + " " + t("common.and") + " " + items[items.length - 1] : items.join("");
        }
        // Montant arrondi : 8551.4 -> "$8,551" / "€7,599" (en français : "8 551 $US" / "7 599 €")
        function money(value, currency) {
            return new Intl.NumberFormat(I.locale, { style: "currency", currency: currency, maximumFractionDigits: 0 }).format(value);
        }
        function price(value, currency) {
            return formatPrice(value, currency, I.locale);
        }
        // Texte traduit s'il existe, sinon la valeur d'origine (noms d'usure et de rareté des skins...)
        function opt(key, fallback) {
            return I.has(key) ? t(key) : fallback;
        }

        // ===== Morceaux communs à toutes les pages =====

        // Petite maison au début du fil d'Ariane (retour à l'accueil, présent sur toutes les pages)
        const HOME_ICON = `<svg class="crumb-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3L12 3Z"/></svg>`;

        // Thème : sombre par défaut (même 1re visite), clair seulement si le visiteur l'a choisi ; appliqué tout de suite (sans flash), sur <html> et <body>
        const THEME_SCRIPT = `<script>
        try {
            const saved = localStorage.getItem("theme");
            if (saved === "light") {
                document.documentElement.classList.add("light");
                document.body.classList.add("light");
            }
        } catch (error) {}
    </script>`;

        // <html lang="..."> (+ le mot « Copied » de la barre rouge, traduit, lu par le CSS)
        const HTML_OPEN = `<html lang="${lang}"${EN ? "" : ` style="--copied: '${t("js.copiedBar")}'"`}>`;

        // Textes du JavaScript (crosshair.js, script.js, generator.js) : seulement dans les langues autres que l'anglais
        const CLIENT_I18N = EN ? "" : `
    <script type="application/json" id="i18n">${JSON.stringify(tList("js")).replace(/</g, "\\u003c")}</script>`;

        // Langues : liens hreflang pour Google + petit script (sélecteur : change de page).
        // Plus aucune redirection automatique selon la langue du navigateur (26/10/2026) : lang-banner.js propose
        // la bonne langue dans un bandeau ; il lit les adresses traduites dans window.ccAlternates.
        function langHead(prefix, rel, withLinks) {
            const alts = {};
            LANGS.forEach(function (l) { alts[l] = altHref(prefix, l, rel); });
            const links = !withLinks ? "" : LANGS.map(function (l) {
                return `
    <link rel="alternate" hreflang="${l}" href="${SITE_URL}/${l === "en" ? "" : l + "/"}${rel}">`;
            }).join("") + `
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}/${rel}">`;
            return `${links}
    <script>(function () {
        var A = window.ccAlternates = ${JSON.stringify(alts).replace(/</g, "\\u003c")};
        document.addEventListener("change", function (event) {
            if (event.target && event.target.id === "lang" && A[event.target.value]) {
                try { localStorage.setItem("lang", event.target.value); } catch (error) {}
                location.href = A[event.target.value];
            }
        });
    })();</script>${CLIENT_I18N}`;
        }

        // Le sélecteur de langue (le même partout) : les langues publiées + celles qui arrivent bientôt
        function langSelect() {
            return `<select id="lang" class="lang" aria-label="${t("nav.language")}">
                    ${LANGS.map(function (l) {
                        return `<option value="${l}"${l === lang ? " selected" : ""}>${l === lang ? l.toUpperCase() : l.toUpperCase() + " · " + NAMES[l]}</option>`;
                    }).join("\n                    ")}
                    ${SOON.map(function (l) {
                        return `<option value="${l}" disabled>${l.toUpperCase()} · ${NAMES[l]} (${t("nav.soon")})</option>`;
                    }).join("\n                    ")}
                </select>`;
        }

        // Le <head> d'une page (titre, description, adresse officielle, aperçu de lien, langues, chargement rapide)
        // o.path = adresse de la page sans la langue (ex. "players/zywoo.html", "" pour l'accueil)
        // Titre affiché par Google : au-delà de ~60 caractères il est coupé. On retire alors la fin « | ClutchCrosshair »
        // (le nom du site est déjà affiché par Google au-dessus du résultat)
        function seoTitle(title) {
            const plain = String(title).replace(/&amp;/g, "&");
            return plain.length > 60 && / \| ClutchCrosshair$/.test(title) ? title.replace(/ \| ClutchCrosshair$/, "") : title;
        }

        function head(o) {
            const p = ap(o.prefix);
            return `<meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${seoTitle(o.title)}</title>
    <meta name="description" content="${esc(o.description)}">
    ${o.noindex ? '<meta name="robots" content="noindex">' : `<meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="canonical" href="${o.url}">`}${langHead(o.prefix, o.path, !o.noindex)}
    <link rel="icon" href="${p}favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="${p}apple-touch-icon.png">
    <link rel="manifest" href="${p}site.webmanifest">
    <meta name="theme-color" content="#111214">
    <meta name="color-scheme" content="dark light">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="ClutchCrosshair">
    <meta property="og:locale" content="${I.ogLocale}">${LANGS.filter(function (l) { return l !== lang; }).map(function (l) {
        return `
    <meta property="og:locale:alternate" content="${makeI18n(l).ogLocale}">`;
    }).join("")}
    <meta property="og:title" content="${o.ogTitle || o.title}">
    <meta property="og:description" content="${esc(o.description)}">
    <meta property="og:url" content="${o.url}">
    <meta property="og:image" content="${SITE_URL}/${o.ogImage ? versioned(o.ogImage.file) : "og-image.jpg"}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${o.ogImage ? esc(o.ogImage.alt) : t("meta.ogImageAlt")}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:site" content="@ClutchCrosshair">
    <meta name="twitter:title" content="${o.ogTitle || o.title}">
    <meta name="twitter:description" content="${esc(o.description)}">
    <meta name="twitter:image" content="${SITE_URL}/${o.ogImage ? versioned(o.ogImage.file) : "og-image.jpg"}">
    <link rel="preload" href="${p}fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="${p}fonts/barlow-condensed-700-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="${p}style.min.css?v=${CSS_HASH}">${o.crosshair || o.cards ? `
    <link rel="preload" href="${p}fonts/jetbrains-mono-400-latin.woff2" as="font" type="font/woff2" crossorigin>` : ""}${o.crosshair ? `
    <link rel="modulepreload" href="${p}crosshair.min.js?v=${CROSSHAIR_HASH}">
    <link rel="modulepreload" href="${p}lib/csgo-sharecode.js">
    ${o.generator
        ? `<link rel="preload" href="${p}preview-bg.webp?v=${BG_HASH}" as="image" type="image/webp">`
        // Page joueur : sur téléphone, crosshair.js prend le fond léger (33 Ko au lieu de 406 Ko, voir cropFits)
        : `<link rel="preload" href="${p}preview-bg.webp?v=${BG_HASH}" as="image" type="image/webp" media="(min-width: 801px)">
    <link rel="preload" href="${p}preview-bg-crop.webp?v=${BG_CROP_HASH}" as="image" type="image/webp" media="(max-width: 800px)">`}` : ""}${o.cards ? `
    <link rel="modulepreload" href="${p}crosshair.min.js?v=${CROSSHAIR_HASH}">
    <link rel="modulepreload" href="${p}lib/csgo-sharecode.js">
    <link rel="preload" href="${p}preview-bg-crop.webp?v=${BG_CROP_HASH}" as="image" type="image/webp" fetchpriority="low">` : ""}${o.generator ? `
    <link rel="modulepreload" href="${p}generator.min.js?v=${GENERATOR_HASH}">` : ""}${o.jsonLd ? `
    <script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
    ${consentScript(o.prefix)}`;
        }

        // Bandeau cookies (CNIL) + Google Analytics après accord : sur toutes les pages (voir consent.js)
        // + bandeau de suggestion de langue (voir lang-banner.js), lui aussi en defer : il ne ralentit pas l'affichage
        function consentScript(prefix) {
            return `<script src="${ap(prefix)}consent.min.js?v=${CONSENT_HASH}" data-legal="${prefix}legal.html" defer></script>
    <script src="${ap(prefix)}lang-banner.min.js?v=${LANG_BANNER_HASH}" defer></script>`;
        }

        // Le menu principal, le même sur toutes les pages. Une rubrique n'apparaît que si ses pages existent
        // (jamais de lien vers une page vide). current = la rubrique de la page (soulignée en rouge)
        function mainNav(prefix, current) {
            const sections = [
                { key: "crosshairs", label: t("nav.crosshairs"), href: "" },
                { key: "skins", label: t("nav.skins"), href: "skins/", show: skinPlayers.length > 0 },
                { key: "guides", label: t("nav.guides"), href: "guides/", show: Boolean(guideData) },
                { key: "commands", label: t("nav.commands"), href: "commands/", show: Boolean(commandData) },
                // Tant qu'il n'y a qu'un seul outil, le lien mène directement au générateur de crosshair
                bindData
                    ? { key: "tools", label: t("nav.tools"), href: "tools/" }
                    : { key: "tools", label: t("nav.generator"), href: "generator.html" }
            ].filter(function (s) { return s.show !== false; });
            return `<nav class="main-nav" aria-label="${t("nav.mainAria")}">
            ${sections.map(function (s) {
                return `<a href="${(prefix + s.href) || "./"}"${s.key === current ? ' aria-current="page"' : ""}>${s.label}</a>`;
            }).join("\n            ")}
        </nav>`;
        }

        // En haut des pages : le logo (retour à l'accueil) + le menu principal + le sélecteur de langue
        function pageTop(prefix, current) {
            const a = ap(prefix);
            return `<header class="page-top">
        <a href="${prefix}" class="logo" aria-label="${t("nav.homeAria")}">
            <img class="logo-img logo-dark" src="${a}logo-horizontal-dark.svg" alt="ClutchCrosshair" width="114" height="40">
            <img class="logo-img logo-light" src="${a}logo-horizontal-light.svg" alt="ClutchCrosshair" width="114" height="40">
        </a>
        ${mainNav(prefix, current)}
        ${langSelect()}
    </header>`;
        }

        function footer(prefix) {
            return `<footer>
        <nav class="footer-links" aria-label="${t("nav.footerAria")}">
            <a href="${prefix}generator.html">${t("footer.generator")}</a>
            <a href="${prefix}tools/bind-generator.html">${t("footer.bind")}</a>
            <a href="${prefix}crosshairs/">${t("footer.lists")}</a>
            <a href="${prefix}teams/">${t("footer.teams")}</a>
            <a href="${prefix}skins/">${t("footer.skins")}</a>
            <a href="${prefix}guides/">${t("footer.guides")}</a>
            <a href="${prefix}commands/">${t("footer.commands")}</a>
            <a href="${prefix}faq.html">${t("footer.faq")}</a>
            <a href="${prefix}methodology.html">${t("footer.method")}</a>
            <a href="${prefix}legal.html">${t("footer.legal")}</a>
            <button type="button" class="footer-cookies" data-consent-open>${t("footer.cookies")}</button>
        </nav>
        <p class="footer-contact">${t("footer.business")} <a href="mailto:${PUBLISHER_EMAIL}?subject=Business%20-%20ClutchCrosshair">${PUBLISHER_EMAIL}</a></p>
        <p>${t("footer.rights")}</p>
        <p>${t("footer.trademarks")}</p>
    </footer>`;
        }

        // Fil d'Ariane visible : 🏠 Home › ...
        function crumbs(prefix, items) {
            return `<nav class="breadcrumb" aria-label="${t("nav.breadcrumbAria")}"><a href="${prefix}" class="crumb-home">${HOME_ICON}${t("nav.home")}</a> › ${items}</nav>`;
        }

        // Fil d'Ariane pour Google : Home › (section) › page
        function breadcrumbList(id, steps) {
            return {
                "@type": "BreadcrumbList",
                "@id": id + "#breadcrumb",
                "itemListElement": [{ "@type": "ListItem", "position": 1, "name": t("nav.home"), "item": SITE_URL + "/" + LD }].concat(steps.map(function (s, i) {
                    return { "@type": "ListItem", "position": i + 2, "name": s[0], "item": s[1] };
                }))
            };
        }
        function breadcrumb(name, url) {
            return breadcrumbList(url, [[name, url]]);
        }
        // Home › section (› page)
        function sectionBreadcrumb(sectionName, sectionUrl, name, url) {
            return breadcrumbList(url || sectionUrl, name ? [[sectionName, sectionUrl], [name, url]] : [[sectionName, sectionUrl]]);
        }

        function faqGraph(url, faq) {
            return {
                "@type": "FAQPage",
                "@id": url + "#faq",
                "mainEntity": faq.map(function (q) {
                    return { "@type": "Question", "name": q[0], "acceptedAnswer": { "@type": "Answer", "text": q[1] } };
                })
            };
        }
        function faqItems(faq, tag) {
            return faq.map(function (q) {
                return `        <${tag}>${esc(q[0])}</${tag}>
        <p>${esc(q[1])}</p>`;
            }).join("\n");
        }

        // Petit tableau qui décrit les réglages du crosshair (contenu unique pour chaque page)
        function crosshairDetails(code) {
            const c = decode(code);
            if (!c) {
                return "";
            }
            const hex = "#" + [c.red, c.green, c.blue].map(function (v) {
                return Number(v).toString(16).padStart(2, "0");
            }).join("").toUpperCase();
            const yes = t("common.yes"), no = t("common.no");
            const rows = [
                [t("specs.color"), `<span class="swatch" style="background:${hex}"></span>${hex}`],
                [t("specs.length"), c.length],
                [t("specs.thickness"), c.thickness],
                [t("specs.gap"), c.gap],
                [t("specs.dot"), c.centerDotEnabled ? yes : no],
                [t("specs.outline"), c.outlineMode > 0 ? yes : no],
                [t("specs.tStyle"), c.tStyleEnabled ? yes : no],
                [t("specs.opacity"), Math.round((c.alpha / 255) * 100) + "%"]
            ];
            return `<dl class="specs">${rows.map(function (r) {
                return `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`;
            }).join("")}</dl>`;
        }

        function proLinks(list) {
            return `<ul class="related">${list.map(function (x) {
                return `<li><a href="${slug(x.player.name)}.html">${t("common.crosshairOf", { name: esc(x.player.name) })}</a></li>`;
            }).join("")}</ul>`;
        }

        // Description des réglages en phrases + comparaison avec les pros + pros au crosshair identique ou proche + FAQ
        function crosshairInsights(player) {
            const c = decode(player.code);
            if (!c || c.format === "legacy-v1") {
                return null;
            }
            const colorKey = colorName(c);
            const color = t("colors." + colorKey);
            const size = t("sizes." + (c.length <= 2 ? "veryShort" : c.length <= 4 ? "short" : c.length <= 7 ? "medium" : "long"));
            const parts = [t("insights.length", { n: c.length }), t("insights.thickness", { n: c.thickness }), t("insights.gap", { n: c.gap }),
                t(c.outlineMode > 0 ? "insights.outline" : "insights.noOutline"), t(c.centerDotEnabled ? "insights.dot" : "insights.noDot")];
            if (c.tStyleEnabled) {
                parts.push(t("insights.tStyle"));
            }
            if (c.alpha < 255) {
                parts.push(t("insights.opacity", { n: Math.round(c.alpha / 255 * 100) }));
            }
            const style = c.style === 4 ? t("insights.styleStatic") : c.style === 9 ? t("insights.styleX") : "";
            const settings = t("insights.settings", { name: player.name, size: size, color: color, style: style, parts: listText(parts), height: c.screenHeight });
            const longer = percentOfPros(function (x) { return x.c.length > c.length; });
            const sameColor = percentOfPros(function (x) { return colorName(x.c) === colorKey; });
            const comparison = t("insights.comparison", { longer: longer, total: proCrosshairs.length, same: sameColor, color: color });
            const same = proCrosshairs.filter(function (x) {
                return x.player !== player && x.player.code === player.code;
            });
            const similar = proCrosshairs.filter(function (x) {
                return x.player !== player && x.player.code !== player.code && colorName(x.c) === colorKey && x.c.thickness === c.thickness
                    && Math.abs(x.c.length - c.length) <= 1 && Math.abs(x.c.gap - c.gap) <= 1;
            }).slice(0, 8);
            const name = esc(player.name);
            const html = `<p>${esc(settings)} ${esc(comparison)}</p>
        ${same.length ? `<h2>${t("insights.sameTitle", { name: name })}</h2>
        <p>${t("insights.sameText", { list: listText(same.map(function (x) { return esc(x.player.name); })), name: name, count: same.length })}</p>
        ${proLinks(same)}` : ""}
        ${similar.length ? `<h2>${t("insights.similarTitle", { name: name })}</h2>
        <p>${t("insights.similarText", { color: esc(color) })}</p>
        ${proLinks(similar)}` : ""}`;
            const faq = [
                [t("insights.faqCodeQ", { name: player.name }), t("insights.faqCodeA", { name: player.name, code: player.code, source: t(player.category === "pro" ? "insights.sourcePro" : "insights.sourceCreator"), date: player.updated })],
                [t("insights.faqSettingsQ", { name: player.name }), settings]
            ];
            if (same.length) {
                faq.push([t("insights.faqSameQ", { name: player.name }), t("insights.sameText", { list: listText(same.map(function (x) { return x.player.name; })), name: player.name, count: same.length })]);
            }
            return { html: html, faq: faq };
        }

        // Les anciens crosshairs d'un joueur (players.json : "history" = [{ code, from, to }], rempli par read_demo.py
        // quand le code change ; "since" = premier match du crosshair actuel). Du plus récent au plus ancien :
        // dates des matchs, réglages, code + Copy, lien vers l'aperçu dans le générateur. Rien si le joueur n'a jamais changé.
        function crosshairHistory(player) {
            const runs = (player.history || []).filter(function (r) { return decode(r.code); }).slice().reverse();
            if (!runs.length) {
                return null;
            }
            const name = esc(player.name);
            const day = function (date) { return `<time datetime="${isoDate(date)}">${esc(date)}</time>`; };
            const rows = runs.map(function (r) {
                const c = decode(r.code);
                const hex = "#" + [c.red, c.green, c.blue].map(function (v) { return Number(v).toString(16).padStart(2, "0"); }).join("").toUpperCase();
                const spec = t("history.spec", { color: t("colors." + colorName(c)), length: c.length, thickness: c.thickness, gap: c.gap })
                    + (c.centerDotEnabled ? ", " + t("history.dot") : "");
                return `<li>
                <span class="history-date">${r.from === r.to ? t("history.single", { date: day(r.to) }) : t("history.range", { from: day(r.from), to: day(r.to) })}</span>
                <span class="history-spec"><span class="swatch" style="background:${hex}"></span>${esc(spec)} · <a href="../generator.html#${esc(r.code)}">${t("history.preview")}</a></span>
                <div class="field-row">
                    <code class="code">${esc(r.code)}</code>
                    <button type="button" class="mini btn-secondary">${t("common.copy")}</button>
                </div>
            </li>`;
            }).join("\n            ");
            const first = runs[runs.length - 1].from;
            const since = player.since || player.updated;
            return {
                html: `<h2>${t("history.title", { name: name })}</h2>
        <p>${t("history.since", { name: name, date: day(since) })} ${t("history.intro", { name: name, count: runs.length })}</p>
        <ol class="history">
            ${rows}
        </ol>`,
                faq: [t("history.faqQ", { name: player.name }), t("history.faqA", { name: player.name, count: runs.length, first: first, since: since })]
            };
        }

        // Emplacement sponsorisé : rien tant que sponsors.json est vide. place = "home", "player", "team" ou "list"
        // (champ "places" du sponsor ; absent = partout). a = chemin vers la racine du site (logo du sponsor).
        // Chaque lien porte rel="sponsored" (demandé par Google pour un lien payé) et la mention « Sponsored »
        // (la publicité doit être signalée clairement). Ne jamais vendre un lien sans passer par ici.
        function sponsorSlot(place, a) {
            const list = sponsors.filter(function (s) { return !s.places || s.places === "all" || s.places.includes(place); });
            if (!list.length) {
                return "";
            }
            return `<aside class="sponsor" aria-label="${t("sponsor.label")}">
            <span class="sponsor-label">${t("sponsor.label")}</span>
            ${list.map(function (s) {
                const text = s.text && typeof s.text === "object" ? (s.text[lang] || s.text.en || "") : (s.text || "");
                return `<a class="sponsor-link" href="${esc(s.url)}" target="_blank" rel="sponsored noopener">${s.logo ? `<img src="${a}${esc(versioned(s.logo))}" alt="" width="24" height="24" loading="lazy" decoding="async">` : ""}<strong>${esc(s.name)}</strong>${text ? `<span>${esc(text)}</span>` : ""}</a>`;
            }).join("\n            ")}
        </aside>`;
        }

        // Si une photo ne se charge pas : les initiales du joueur à la place (pages qui affichent des cartes)
        const PHOTO_FALLBACK_SCRIPT = `<script>
        window.photoFallback = function (img) {
            const div = document.createElement("div");
            div.className = img.className;
            div.textContent = img.dataset.initials || "";
            img.replaceWith(div);
        };
    </script>`;

        // Le JavaScript des pages qui affichent des cartes de joueurs (équipes, listes) : aperçus des crosshairs
        // (dessinés à l'approche de l'écran), boutons Copy ; un clic ailleurs sur la carte ouvre la page du joueur.
        // a = chemin vers la racine du site
        function cardsScript(a) {
            return `<script type="module">
        import { copyText, drawCrosshair } from "${a}crosshair.min.js?v=${CROSSHAIR_HASH}";

        document.querySelectorAll(".card").forEach(function (card) {
            drawCrosshair(card.querySelector(".preview"), card.querySelector(".code").textContent);
        });
        document.addEventListener("click", function (event) {
            const button = event.target.closest(".copy-code, .copy-console");
            if (button) {
                copyText(button.closest(".field-row").querySelector("code").textContent, button);
                return;
            }
            const card = event.target.closest(".card");
            if (card && !event.target.closest("a, code")) {
                location.href = card.querySelector("h3 a").href;
            }
        });
    </script>`;
        }

        // La « boîte à outils » commune, donnée aux fichiers du dossier build/ (une rubrique du site par fichier)
        const ctx = {
            fs, SITE_URL, LANGS, lang, I, t, tList, LD, EN, write, sitemapPages, isoDate,
            players, pros, creators, teams, proCrosshairs, skinPlayers, commandData, guideData, bindData, newest,
            slug, esc, consoleCommands, teamInfo, teamColor, textOnColor, teamBadge, cardHTML, byTeamThenName, teamSlug,
            photoFiles, logoFor, decode, colorName, colorFamily, percentOfPros, twins, versioned,
            ap, langUrl, altHref, teamLabel, listText,
            HTML_OPEN, THEME_SCRIPT, PHOTO_FALLBACK_SCRIPT, CARDS_SCRIPT: cardsScript, CROSSHAIR_HASH,
            head, pageTop, footer, crumbs, breadcrumbList, breadcrumb, sectionBreadcrumb, faqGraph, faqItems,
            crosshairDetails, crosshairInsights, sponsorSlot
        };

        // ===== 0. Les pages des équipes (teams/) : voir build/teams.js =====
        require("./build/teams.js").build(ctx);

        // ===== 0 bis. Les pages de listes (crosshairs/ : most used, dot, small, par couleur) : voir build/lists.js =====
        const crosshairLists = require("./build/lists.js").build(ctx);

        // ===== 1. Une page par joueur =====
        const pageFiles = [];

        players.forEach(function (player) {
            const name = esc(player.name);
            const team = esc(teamLabel(player.team));
            const isPro = player.category === "pro";
            const file = slug(player.name) + ".html";
            const rel = "players/" + file;
            const url = langUrl(rel);
            const photo = photoFiles(player);
            const logo = logoFor(player.team);
            const a = ap("../");
            // L'image du crosshair (og/<pseudo>.jpg, voir og.js) : aperçu de lien, mais aussi une vraie image dans la page
            // et dans le sitemap, pour Google Images (l'aperçu en haut de page est un dessin calculé, invisible pour Google)
            const ogImage = ogImages[slug(player.name)] || "";
            pageFiles.push(file);
            if (EN) {
                sitemapPages.push({ path: rel, lastmod: isoDate(player.updated), images: (ogImage ? [SITE_URL + "/" + ogImage] : []).concat(photo.original ? [SITE_URL + "/" + photo.original] : []) });
            }

            // Photo moyenne, chargée en priorité (c'est le plus gros élément en haut de la page)
            const photoHtml = photo.md
                ? `<img class="player-photo" src="${a}${esc(photo.md)}" alt="${name}, ${team}" width="120" height="134" fetchpriority="high" decoding="async">`
                : `<div class="player-photo">${esc(player.name.slice(0, 2).toUpperCase())}</div>`;
            const badge = logo ? `<img class="player-team-logo" src="${a}${logo}" alt="" width="20" height="20">` : "";

            // Coéquipiers (ou autres créateurs) : liens internes, bons pour Google et pour les visiteurs
            const mates = players.filter(function (p) {
                return p !== player && p.team === player.team;
            });
            const matesHtml = mates.length
                ? `<h2>${isPro ? t("player.matesTeam", { team: team }) : t("player.matesCreator")}</h2>
        <ul class="related">${mates.map(function (p) {
                    return `<li><a href="${slug(p.name)}.html">${t("common.crosshairOf", { name: esc(p.name) })}</a></li>`;
                }).join("")}</ul>${isPro ? `
        <p><a href="../teams/${teamSlug(player.team)}.html">${t("teams.allLink", { team: team })}</a></p>` : ""}`
                : "";

            const insights = crosshairInsights(player);
            const history = crosshairHistory(player);
            // Les listes (crosshairs/) dans lesquelles ce joueur apparaît : liens internes
            const memberOf = crosshairLists.filter(function (list) {
                return list.items.some(function (x) { return x.player === player; });
            });
            // La FAQ de la page (visible + données structurées) : réglages, puis l'historique s'il y en a un
            const pageFaq = (insights ? insights.faq : []).concat(history ? [history.faq] : []);
            const intro = isPro
                ? t("player.introPro", { name: name, team: team, date: esc(player.updated) })
                : t("player.introCreator", { name: name, date: esc(player.updated) });

            // Données structurées reliées entre elles : la page, son fil d'Ariane et le joueur (membre de son équipe)
            const webPage = {
                "@type": "WebPage",
                "@id": url,
                "url": url,
                "name": t("player.webPageName", { name: player.name }),
                "inLanguage": lang,
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "about": { "@id": url + "#person" },
                "breadcrumb": { "@id": url + "#breadcrumb" }
            };
            if (isoDate(player.updated)) {
                webPage.dateModified = isoDate(player.updated);
            }
            if (photo.original) {
                webPage.primaryImageOfPage = { "@type": "ImageObject", "url": `${SITE_URL}/${photo.original}` };
            }
            if (ogImage) {
                webPage.image = { "@type": "ImageObject", "url": `${SITE_URL}/${ogImage}`, "width": 1200, "height": 630, "caption": t("player.ogImageAlt", { name: player.name }) };
            }
            const person = {
                "@type": "Person",
                "@id": url + "#person",
                "name": player.name,
                "description": isPro
                    ? t("player.personPro", { name: player.name, team: player.team })
                    : t("player.personCreator", { name: player.name }),
                "url": url
            };
            if (isPro) {
                person.memberOf = { "@type": "SportsTeam", "name": player.team, "sport": "Counter-Strike 2" };
            }
            if (photo.original) {
                person.image = `${SITE_URL}/${photo.original}`;
            }
            if (profileLinks(player).length) {
                person.sameAs = profileLinks(player);
            }

            const page = `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("player.title", { name: name }),
        ogTitle: t("player.ogTitle", { name: name }),
        description: isPro
            ? t("player.descriptionPro", { name: player.name, team: player.team, date: player.updated })
            : t("player.descriptionCreator", { name: player.name, date: player.updated }),
        url: url,
        path: rel,
        prefix: "../",
        crosshair: true,
        ogImage: ogImage ? { file: ogImage, alt: t("player.ogImageAlt", { name: player.name }) } : null,
        jsonLd: { "@context": "https://schema.org", "@graph": [webPage, breadcrumb(t("player.breadcrumb", { name: player.name }), url), person].concat(pageFaq.length ? [faqGraph(url, pageFaq)] : []) }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "crosshairs")}

    <main class="player-page" style="--team: ${teamColor(player.team)}; --on-team: ${textOnColor(teamColor(player.team))}">
        ${crumbs("../", `<span>${name}</span>`)}

        <div class="player-head">
            ${photoHtml}
            <div>
                <h1>${t("player.h1", { name: name })}</h1>
                <p class="player-team">${badge}${team}</p>
                <p class="player-date">${t("player.lastUpdate")} <time datetime="${isoDate(player.updated)}">${esc(player.updated)}</time></p>
                ${player.faceit ? `<a class="faceit-btn" href="${esc(player.faceit)}" target="_blank" rel="external noopener"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3h8v8h-2V6.4l-6.3 6.3-1.4-1.4L9.6 5H5z"/></svg>${t("player.faceit", { name: name })}</a>` : ""}
            </div>
        </div>

        <canvas id="preview" class="preview player-preview" width="760" height="300" role="img" aria-label="${t("card.previewAria", { name: name })}"></canvas>
        ${twins(player).length ? `<p class="same-xhair">${t("player.same", { list: listText(twins(player).map(function (p) { return `<a href="${slug(p.name)}.html">${esc(p.name)}</a>`; })) })}</p>` : ""}

        <div class="field">
            <div class="field-label">${t("field.shareCode")} <span>· ${t("field.shareHelp")}</span></div>
            <div class="field-row">
                <code id="code" class="code">${esc(player.code)}</code>
                <button type="button" id="copy" class="mini">${t("common.copy")}</button>
            </div>
        </div>

        <div class="field">
            <div class="field-label">${t("field.console")} <span>· ${t("field.consoleHelp")}</span></div>
            <div class="field-row">
                <code id="console" class="console">${esc(consoleCommands(player.code))}</code>
                <button type="button" id="copy-console" class="mini btn-secondary">${t("common.copy")}</button>
            </div>
        </div>
        ${sponsorSlot("player", a)}

        <h2>${t("player.about", { name: name })}</h2>
        <p>${intro}</p>
        ${crosshairDetails(player.code)}
        ${insights ? insights.html : ""}
        ${memberOf.length ? `<p>${t("lists.memberOf", { name: name })}</p>
        <ul class="related">${memberOf.map(function (list) {
            return `<li><a href="../crosshairs/${list.file}">${list.h1}</a></li>`;
        }).join("")}</ul>` : ""}

        ${ogImage ? `<figure class="xhair-figure">
            <img src="${a}${versioned(ogImage)}" alt="${t("player.ogImageAlt", { name: name })}" width="1200" height="630" loading="lazy" decoding="async">
            <figcaption>${t("player.figure", { name: name })}</figcaption>
        </figure>` : ""}

        ${history ? history.html : ""}

        <h2>${t("player.howTitle", { name: name })}</h2>
        <ol>
            <li>${t("player.how1")}</li>
            <li>${t("player.how2")}</li>
            <li>${t("player.how3")}</li>
        </ol>
        <p>${t("player.orConsole")}${commandData ? ` <a href="../commands/#crosshair">${t("player.commandsLink")}</a>` : ""} <a href="../faq.html">${t("player.faqLink")}</a></p>
        ${/^CS(?!GO-)/.test(player.code) ? `<p><a href="../generator.html#${esc(player.code)}">${t("player.editLink", { name: name })}</a></p>` : ""}
        ${skinPlayers.some(function (s) { return s.name === player.name; }) ? `<p><a href="../skins/${slug(player.name)}.html">${t("player.skinsLink", { name: name })}</a></p>` : ""}

        ${pageFaq.length ? `<h2>${t("player.faqTitle", { name: name })}</h2>
${faqItems(pageFaq, "h3")}` : ""}

        ${matesHtml}
    </main>

    ${footer("../")}

    <script type="module">
        import { copyText, drawCrosshair } from "${a}crosshair.min.js?v=${CROSSHAIR_HASH}";

        drawCrosshair(document.getElementById("preview"), document.getElementById("code").textContent);

        document.getElementById("copy").addEventListener("click", function (event) {
            copyText(document.getElementById("code").textContent, event.currentTarget);
        });
        document.getElementById("copy-console").addEventListener("click", function (event) {
            copyText(document.getElementById("console").textContent, event.currentTarget);
        });
        // Anciens crosshairs : chaque bouton Copy copie le code de sa ligne
        document.querySelectorAll(".history button").forEach(function (button) {
            button.addEventListener("click", function () {
                copyText(button.closest(".field-row").querySelector("code").textContent, button);
            });
        });
    </script>
</body>
</html>
`;
            write(LD + "players/" + file, page);
        });

        // Supprimer les pages des joueurs qui ne sont plus dans players.json (ex. ancien nom)
        fs.readdirSync(LD + "players").forEach(function (f) {
            if (f.endsWith(".html") && !pageFiles.includes(f)) {
                fs.unlinkSync(LD + "players/" + f);
                console.log("Page supprimée (joueur absent de players.json) : " + LD + "players/" + f);
            }
        });

        // ===== Skins : résumé, liste, note sur les prix (accueil + pages skins) =====
        const PRICE_NOTE = skinData.prices ? t("skins.priceNote", { date: esc(skinData.prices.updated) }) : "";
        const categoryLabel = function (key) { return t("skins.categories." + key); };

        // "ZywOo (Team Vitality) owns 631 CS2 skins, including 4 knife skins and 3 pairs of gloves."
        function skinSummary(p) {
            const count = function (category) {
                return p.items.filter(function (i) { return i.category === category; }).length;
            };
            const knives = count("knives");
            const gloves = count("gloves");
            const extras = [];
            if (knives) {
                extras.push(t("skins.knifeCount", { count: knives }));
            }
            if (gloves) {
                extras.push(t("skins.gloveCount", { count: gloves }));
            }
            return t("skins.summary", {
                name: p.name,
                team: p.team ? t("skins.summaryTeam", { team: p.team }) : "",
                count: p.items.length,
                extras: extras.length ? t("skins.summaryExtras", { list: extras.join(" " + t("common.and") + " ") }) : "",
                value: p.hasPrices ? t("skins.summaryValue", { usd: money(p.value, "USD"), eur: money(p.valueEur, "EUR") }) : ""
            });
        }

        // Photo d'un joueur des skins (petite pour les boutons, moyenne pour l'en-tête de sa page), sinon ses initiales
        // assets = chemin vers la racine du site (photos)
        function skinPhoto(p, assets, w, h, className, eager) {
            const known = players.find(function (x) { return x.name === p.name; });
            const photo = known ? photoFiles(known) : { sm: "", md: "" };
            const file = w > 60 ? photo.md : photo.sm;
            const cls = className || "ps-photo";
            return file
                ? `<img class="${cls}" src="${assets}${esc(file)}" alt="${esc(p.name)}" width="${w}" height="${h}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
                : `<span class="${cls}" aria-hidden="true">${esc(p.name.slice(0, 2).toUpperCase())}</span>`;
        }

        function skinCard(g, playerName, assets, eager) {
            return skinCardHTML(g, playerName, assets, eager, t, I.locale);
        }

        // ===== 2. index.html : tout le contenu écrit d'avance (lisible par Google, rien à télécharger en plus) =====
        // Modèle : index.template.html ({{clé}} = texte traduit, {{@...}} = valeurs calculées ici)
        const A = ap("");
        function cardsFor(list) {
            return list.slice().sort(byTeamThenName).map(function (p, i) {
                const photo = photoFiles(p);
                return cardHTML(p, { photo: photo.sm && A + photo.sm, photoMd: photo.md && A + photo.md, eager: i < EAGER_CARDS, logo: logoFor(p.team) && A + logoFor(p.team), twins: twins(p), t: t, teamLabel: teamLabel(p.team) });
            }).join("\n                        ");
        }
        const homeVars = { count: pros.length };
        const homeSpecial = {
            lang: lang,
            A: A,
            url: SITE_URL + "/" + LD,
            ogLocale: I.ogLocale,
            ogAlternates: LANGS.filter(function (l) { return l !== lang; }).map(function (l) { return `
    <meta property="og:locale:alternate" content="${makeI18n(l).ogLocale}">`; }).join(""),
            langHead: langHead("", "", true),
            langSelect: langSelect(),
            consent: consentScript(""),
            htmlStyle: EN ? "" : ` style="--copied: '${t("js.copiedBar")}'"`
        };
        let index = fs.readFileSync("index.template.html", "utf8").replace(/^<!-- MODÈLE[\s\S]*?-->\r?\n/, "")
            .replace(/\{\{@(\w+)\}\}/g, function (all, key) {
                if (!(key in homeSpecial)) {
                    throw new Error("index.template.html : valeur inconnue {{@" + key + "}}");
                }
                return homeSpecial[key];
            })
            .replace(/\{\{([\w.]+)\}\}/g, function (all, key) {
                return t(key, homeVars);
            });

        index = replaceBetween(index, "CARDS:pros", cardsFor(pros), "                        ");
        index = replaceBetween(index, "CARDS:creators", cardsFor(creators), "                        ");
        index = replaceBetween(index, "CARDS:trending", trending.slice().sort(byTeamThenName).map(function (p) {
            const photo = photoFiles(p);
            return cardHTML(p, { photo: photo.sm && A + photo.sm, photoMd: photo.md && A + photo.md, eager: false, logo: logoFor(p.team) && A + logoFor(p.team), twins: twins(p), t: t, teamLabel: teamLabel(p.team) });
        }).join("\n                        "), "                        ");

        // Menu des équipes (à gauche)
        const teamButtons = [`<button type="button" class="side-btn active" data-team="" aria-pressed="true">${t("home.allCrosshairs")}</button>`].concat(teams.map(function (tm) {
            return `<button type="button" class="side-btn" data-team="${esc(tm.name)}" aria-pressed="false">${teamBadge(tm.name, logoFor(tm.name) && A + logoFor(tm.name), 22)}${esc(tm.name)}</button>`;
        })).join("\n                ");
        index = replaceBetween(index, "TEAMS", teamButtons, "                ");

        // Compteurs des accès rapides ("70 pro players", "1 creator"...)
        const counts = {
            pros: t("home.countPros", { count: pros.length }),
            creators: t("home.countCreators", { count: creators.length }),
            trending: t("home.countTrending", { count: trending.length }),
            skins: t("home.countSkins", { count: skinPlayers.length })
        };
        Object.keys(counts).forEach(function (key) {
            index = index.replace(new RegExp(`(<span class="quick-count" data-count="${key}">)[^<]*(</span>)`), "$1" + counts[key] + "$2");
        });

        // Emplacement sponsorisé de l'accueil (vide tant que sponsors.json est vide)
        index = replaceBetween(index, "SPONSOR", sponsorSlot("home", A), "            ");

        // Le menu principal (le même que sur les autres pages)
        index = replaceBetween(index, "MAINNAV", mainNav("", "crosshairs"), "                ");

        // En bas de l'accueil : un lien vers la page de chaque équipe (teams/, voir build/teams.js)
        index = replaceBetween(index, "TEAMLINKS", `<h2>${t("teams.homeTitle")}</h2>
                <ul class="related">${teams.filter(function (tm) {
                    return pros.some(function (p) { return p.team === tm.name; });
                }).map(function (tm) {
                    return `<li><a href="teams/${teamSlug(tm.name)}.html">${t("teams.teamLink", { team: esc(tm.name) })}</a></li>`;
                }).join("")}</ul>
                <h2>${t("lists.homeTitle")}</h2>
                <ul class="related">${crosshairLists.map(function (list) {
                    return `<li><a href="crosshairs/${list.file}">${list.h1}</a></li>`;
                }).join("")}</ul>`, "                ");

        // Le générateur dans l'onglet Generator (son JavaScript ne se charge qu'au clic sur l'onglet)
        const generatorBlock = generatorHTML(generatorCode, generatorGroups, t);
        index = replaceBetween(index, "GENERATOR", generatorBlock, "                        ");

        // Menu de gauche, sous les équipes : les inventaires des pros, avec leur plus beau couteau (lien vers leur page)
        index = replaceBetween(index, "SKINSIDE", skinPlayers.length ? `<nav class="side-skins" aria-label="${t("home.inventoriesTitle")}">
                <p class="side-title">${t("home.inventoriesTitle")}</p>
                ${skinPlayers.map(function (p) {
                    const star = p.best.find(function (g) { return g.item.category === "knives"; }) || p.best[0];
                    return `<a class="side-skin" href="skins/${p.slug}.html" title="${t("home.sideSkinTitle", { name: esc(p.name) })}"><span>${esc(p.name)}</span><img src="${A}skins/img/${esc(star.item.image)}.webp" alt="${t("skins.altShort", { name: esc(p.name), skin: esc(star.item.name) })}" width="48" height="36" loading="lazy" decoding="async"></a>`;
                }).join("\n                ")}
                <a class="side-skins-all" href="skins/">${t("home.allSkins")}</a>
            </nav>` : "", "            ");

        // L'onglet Pro Skins : un bouton par joueur + ses 12 plus beaux skins (la page complète est dans skins/)
        index = replaceBetween(index, "PROSKINS", skinPlayers.length ? `<div class="ps">
                            <div class="ps-players" role="group" aria-label="${t("home.choosePro")}">
                                ${skinPlayers.map(function (p, i) {
                                    return `<button type="button" class="ps-player" data-ps="${p.slug}" aria-pressed="${i === 0}" style="--team: ${teamColor(p.team)}; --on-team: ${textOnColor(teamColor(p.team))}">${skinPhoto(p, A, 40, 45)}<span class="ps-text"><span class="ps-name">${esc(p.name)}</span><span class="ps-info">${t("skins.count", { count: p.items.length })}${p.hasPrices ? " · " + money(p.value, "USD") : ""}</span></span></button>`;
                                }).join("\n                                ")}
                            </div>
                            ${skinPlayers.map(function (p, i) {
                                return `<div class="ps-panel${i === 0 ? "" : " hidden"}" data-ps-panel="${p.slug}">
                                <p class="ps-summary">${esc(skinSummary(p))} <a href="skins/${p.slug}.html">${t("skins.seeAll", { count: p.items.length, name: esc(p.name) })}</a></p>
                                <div class="skin-grid">
                                ${p.best.slice(0, 12).map(function (g) { return skinCard(g, p.name, A, false); }).join("\n                                ")}
                                </div>
                            </div>`;
                            }).join("\n                            ")}
                            <p class="ps-more"><a href="skins/">${t("home.allInventories")}</a> · ${t("common.updated", { date: esc(skinData.updated || "") })}</p>
                            ${PRICE_NOTE ? `<p class="skin-note">${PRICE_NOTE}</p>` : ""}
                        </div>` : `<p class="empty">${t("home.skinsSoon")}</p>`, "                        ");

        // Empreintes des fichiers CSS/JS/images dans l'accueil
        index = index
            .replace(/href="((?:\.\.\/)?)crosshair(\.min)?\.js\?v=[^"]*"/, 'href="$1crosshair.min.js?v=' + CROSSHAIR_HASH + '"')
            .replace(/src="((?:\.\.\/)?)script(\.min)?\.js\?v=[^"]*"/, 'src="$1script.min.js?v=' + SCRIPT_HASH + '"')
            .replace(/(href="(?:\.\.\/)?preview-bg-crop\.webp)(\?v=[^"]*)?"/, "$1?v=" + BG_CROP_HASH + "\"");
        write(LD + "index.html", index);

        // Le reste de la boîte à outils, pour les rubriques du dossier build/ ci-dessous
        Object.assign(ctx, {
            categoryLabel, decoded, families, familyOrder, famous, GENERATOR_HASH, generatorBlock, money, mostCommon,
            NAMES, opt, percent, price, PRICE_NOTE, profileLinks, PUBLISHER_EMAIL, PUBLISHER_NAME, SKIN_CATEGORIES,
            skinCard, skinData, skinPhoto, skinSummary, smallGap, total, withDot, withOutline
        });

        // ===== 3. faq.html : la FAQ complète, avec des statistiques calculées sur les pros : voir build/faq.js =====
        Object.assign(ctx, require("./build/faq.js").build(ctx)); // fournit : familyText

        // ===== 3 bis. generator.html : le générateur de crosshair CS2 (cible la recherche « CS2 crosshair generator ») : voir build/generator.js =====
        Object.assign(ctx, require("./build/generator.js").build(ctx)); // fournit : genUrl, toolsUrl

        // ===== 3 ter. Les skins des pros : skins/index.html + une page par joueur (skins/<pseudo>.html) : voir build/skins.js =====
        require("./build/skins.js").build(ctx);

        // ===== 3 quater. Les commandes console CS2 : commands/index.html + une page par commande importante : voir build/commands.js =====
        Object.assign(ctx, require("./build/commands.js").build(ctx)); // fournit : guideTr, guides

        // ===== 3 quinquies. Les guides CS2 : guides/index.html + une page par guide (données : guides.json) : voir build/guides.js =====
        require("./build/guides.js").build(ctx);

        // ===== 3 sexies. Les outils : tools/index.html + tools/bind-generator.html (données : binds.json) : voir build/tools.js =====
        require("./build/tools.js").build(ctx);

        // ===== 3 septies. valorant.html : page "Coming soon" façon Killjoy (noindex, pas dans le sitemap) : voir build/valorant.js =====
        require("./build/valorant.js").build(ctx);

        // ===== 4. legal.html : mentions légales (obligatoires en France) : voir build/legal.js =====
        require("./build/legal.js").build(ctx);

        // ===== 5. methodology.html : d'où viennent les codes (confiance / E-E-A-T pour Google) : voir build/methodology.js =====
        require("./build/methodology.js").build(ctx);

        // ===== 6. La page 404 (adresses absolues : elle peut s'afficher à n'importe quelle adresse) : voir build/notfound.js =====
        require("./build/notfound.js").build(ctx);
    }

    // ===== 5. Le sitemap : toutes les pages dans toutes les langues, leur date de mise à jour, les photos (Google Images)
    //          et les liens entre les versions (hreflang) =====
    function pageUrl(lang, rel) {
        return SITE_URL + "/" + (lang === "en" ? "" : lang + "/") + rel;
    }
    // Date de dernière modification (lastmod) : le jour où le TEXTE de la page a vraiment changé, dans chaque langue.
    // lastmod.json garde, pour chaque page, une empreinte de son texte (contenu de <main>, sans les balises) et la date
    // de son dernier changement. Texte identique au build précédent = même date ; texte différent = aujourd'hui.
    // Page jamais vue : la date fournie par la page (date du match pour un joueur, champ « updated » des données).
    const LASTMOD_FILE = "lastmod.json";
    const lastmodBefore = fs.existsSync(LASTMOD_FILE) ? JSON.parse(fs.readFileSync(LASTMOD_FILE, "utf8")) : {};
    const lastmodNow = {};
    const today = new Date().toISOString().slice(0, 10);
    function lastmodOf(l, page) {
        const dir = l === "en" ? "" : l + "/";
        const file = dir + (page.path === "" || page.path.endsWith("/") ? page.path + "index.html" : page.path);
        if (!fs.existsSync(file)) {
            return page.lastmod;
        }
        const html = fs.readFileSync(file, "utf8");
        const main = (html.match(/<main[\s\S]*<\/main>/) || [html])[0];
        const text = main.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 10);
        const before = lastmodBefore[dir + page.path];
        const date = before && before.hash === hash ? before.date : (before ? today : page.lastmod || today);
        lastmodNow[dir + page.path] = { hash: hash, date: date };
        return date;
    }
    let urls = "";
    [{ path: "", lastmod: newest }].concat(sitemapPages).forEach(function (page) {
        const alternates = LANGS.map(function (l) {
            return `<xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l, page.path)}"/>`;
        }).join("") + `<xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl("en", page.path)}"/>`;
        const images = (page.images || []).map(function (src) {
            return `<image:image><image:loc>${esc(src)}</image:loc></image:image>`;
        }).join("");
        LANGS.forEach(function (l) {
            const lastmod = lastmodOf(l, page);
            urls += `    <url><loc>${pageUrl(l, page.path)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}${alternates}${images}</url>\n`;
        });
    });
    fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}</urlset>
`);
    // Une ligne par page, triées : les changements restent lisibles dans Git
    fs.writeFileSync(LASTMOD_FILE, "{\n" + Object.keys(lastmodNow).sort().map(function (key) {
        return "  " + JSON.stringify(key) + ": " + JSON.stringify(lastmodNow[key]);
    }).join(",\n") + "\n}\n");

    // ===== llms.txt et llms-full.txt (format llmstxt.org) : un résumé du site en texte simple pour les assistants IA =====
    // llms.txt = sommaire avec des liens (une ligne par joueur) ; llms-full.txt = tous les joueurs avec leur code complet.
    // Fabriqués depuis players.json à chaque build : ils restent à jour tout seuls. Contenu factuel uniquement.
    const pagesUrl = function (rel) { return SITE_URL + "/" + rel.replace(/(?:index)?\.html$/, ""); };
    const sortedPlayers = players.slice().sort(function (a, b) {
        return a.team.localeCompare(b.team) || a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    });
    const llmsPros = sortedPlayers.filter(function (p) { return p.category === "pro"; });
    const llmsCreators = sortedPlayers.filter(function (p) { return p.category !== "pro"; });
    const guideList = guideData ? guideData.guides : [];
    const llmsIntro = `# ClutchCrosshair

> ClutchCrosshair lists the CS2 (Counter-Strike 2) crosshair share codes of ${llmsPros.length} pro players and ${llmsCreators.length} content creators. Pro crosshairs are read from official match demos played after the CS2 crosshair code update of 30 September 2026 (new "CS..." code format). Each player page shows the share code, the equivalent console commands, a real-size preview and the date of the match the crosshair comes from. Valorant crosshairs are not available yet.

Codes are in the current CS2 format (they start with "CS", no dashes). To use one in CS2: Settings › Game › Crosshair › Share or Import, then paste the code. Older "CSGO-" codes no longer import in CS2 and are not listed. The site is also available in ${LANGS.filter(function (l) { return l !== "en"; }).map(function (l) { return NAMES[l] + " (" + SITE_URL + "/" + l + "/)"; }).join(", ")}.
`;
    const llmsLine = function (p) {
        return `- [${p.name}](${pagesUrl("players/" + slug(p.name) + ".html")}): ${p.category === "creator" ? "content creator" : p.team}, CS2 crosshair code updated ${isoDate(p.updated)}`;
    };
    fs.writeFileSync("llms.txt", `${llmsIntro}
## Main pages

- [CS2 pro crosshairs](${SITE_URL}/): all pro and creator crosshair codes, searchable, grouped by team
- [CS2 crosshairs by team](${pagesUrl("teams/index.html")}): one page per pro team with the crosshair of each player
- [CS2 crosshair lists](${pagesUrl("crosshairs/index.html")}): most used pro codes, dot crosshairs, small crosshairs, crosshairs by color
- [CS2 crosshair generator](${pagesUrl("generator.html")}): build a crosshair and get a working CS2 share code
- [CS2 crosshair FAQ](${pagesUrl("faq.html")}): importing codes, CSGO- codes, pro crosshair statistics
- [How the codes are collected](${pagesUrl("methodology.html")}): pro codes read from official match demos, match dates, checks, skin prices
- [All crosshair codes as plain text](${SITE_URL}/llms-full.txt): every player with full share code and console commands
${fs.existsSync("skins/index.html") ? `- [CS2 pro skins](${pagesUrl("skins/index.html")}): public Steam inventories of pro players with exact floats and prices\n` : ""}${fs.existsSync("commands/index.html") ? `- [CS2 console commands](${pagesUrl("commands/index.html")}): what each console command does, with values and examples\n` : ""}${fs.existsSync("tools/index.html") ? `- [CS2 tools](${pagesUrl("tools/index.html")}): crosshair generator and bind generator\n` : ""}
## Pro players (CS2)

${llmsPros.map(llmsLine).join("\n")}

## Content creators (CS2)

${llmsCreators.map(llmsLine).join("\n")}
${guideList.length ? `
## Guides

${guideList.map(function (g) { return `- [${g.title}](${pagesUrl("guides/" + g.slug + ".html")}): ${g.description}`; }).join("\n")}
` : ""}`);
    const llmsPlayer = function (p) {
        return `### ${p.name}

- Game: CS2
- ${p.category === "creator" ? "Category: content creator" : "Team: " + p.team}
- Crosshair share code: ${p.code}
- Console commands: ${consoleCommands(p.code)}
- Last update: ${isoDate(p.updated)}${p.category === "creator" ? "" : " (date of the official match the crosshair was read from)"}${p.since && p.since !== p.updated ? `
- In use since: ${isoDate(p.since)} (first match read with this code)` : ""}${(p.history || []).length ? `
- Previous crosshair codes (oldest first): ${p.history.map(function (r) { return r.code + " (" + (r.from === r.to ? isoDate(r.to) : isoDate(r.from) + " to " + isoDate(r.to)) + ")"; }).join(", ")}` : ""}
- Page: ${pagesUrl("players/" + slug(p.name) + ".html")}
`;
    };
    fs.writeFileSync("llms-full.txt", `${llmsIntro}
Most recent crosshair update: ${newest}.

## Pro players (CS2)

${llmsPros.map(llmsPlayer).join("\n")}
## Content creators (CS2)

${llmsCreators.map(llmsPlayer).join("\n")}`);

    // ===== Adresses officielles sans « .html » =====
    // Cloudflare Pages sert chaque page sans son extension (/players/zywoo.html redirige vers /players/zywoo,
    // /tools/index.html vers /tools/). Les adresses données à Google (canonical, sitemap, og:url, JSON-LD, hreflang)
    // doivent être celles qui répondent directement, sans redirection. Les liens internes relatifs aussi
    // (href, data-legal, adresses du sélecteur de langue) : « donk.html » → « donk », « tools/index.html » → « tools/ »,
    // « index.html » → « ./ ». Pour tester sur le PC : node serve.js (Live Server ne sait pas ouvrir ces adresses).
    const absoluteHtml = new RegExp(SITE_URL.split(".").join("\\.") + "/([^\"'<>\\s#?]*?)(?:index)?\\.html", "g");
    const relativeHtml = /((?:href|data-legal)="|":")([^"'<>\s:#?]*?)\.html(?=[#?"])/g;
    function cleanRelative(match, before, path) {
        if (path === "index") {
            return before + "./";
        }
        return before + (path.endsWith("/index") ? path.slice(0, -5) : path);
    }
    const generated = ["sitemap.xml"];
    LANGS.forEach(function (lang) {
        const dir = lang === "en" ? "" : lang + "/";
        ["index.html", "404.html", "faq.html", "methodology.html", "generator.html", "legal.html", "valorant.html"].forEach(function (f) { generated.push(dir + f); });
        ["players", "teams", "crosshairs", "commands", "guides", "skins", "tools"].forEach(function (sub) {
            if (fs.existsSync(dir + sub)) {
                fs.readdirSync(dir + sub).filter(function (f) { return f.endsWith(".html"); }).forEach(function (f) { generated.push(dir + sub + "/" + f); });
            }
        });
    });
    generated.filter(function (file) { return fs.existsSync(file); }).forEach(function (file) {
        const text = fs.readFileSync(file, "utf8");
        const cleaned = text.replace(absoluteHtml, SITE_URL + "/$1").replace(relativeHtml, cleanRelative);
        if (cleaned !== text) {
            fs.writeFileSync(file, cleaned);
        }
    });

    // Redirections 301 « /page.html » -> « /page » dans _redirects (Cloudflare le ferait seul, mais en 308) :
    // une ligne par page (pas les 404), entre « # HTML:START » et « # HTML:END ». Limite Cloudflare : 2 000 lignes simples.
    if (fs.existsSync("_redirects")) {
        // Seulement les pages .html (la liste contient aussi sitemap.xml : une ligne pour lui ferait une boucle)
        const lines = generated.filter(function (file) {
            return /\.html$/.test(file) && fs.existsSync(file) && !/(^|\/)404\.html$/.test(file);
        }).map(function (file) {
            return "/" + file + " /" + file.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "") + " 301";
        }).sort();
        const text = fs.readFileSync("_redirects", "utf8").replace(/\r\n/g, "\n");
        const updated = text.replace(/(# HTML:START\n)[\s\S]*?(# HTML:END)/, "$1" + lines.map(function (l) { return l + "\n"; }).join("") + "$2");
        if (updated !== text) {
            fs.writeFileSync("_redirects", updated);
        }
        const simple = updated.split("\n").filter(function (l) { return /^\/\S+ \S+ 30[1278]$/.test(l) && !l.includes("*"); }).length;
        if (simple > 2000) {
            console.log("Attention : " + simple + " redirections simples dans _redirects (Cloudflare n'en lit que 2 000)");
        }
    }

    // ===== CSS critique de l'accueil (voir critical.js) =====
    // Le CSS du haut de page est écrit dans index.html (affichage immédiat), style.min.css se charge ensuite sans bloquer.
    // Gardé dans critical.css avec l'empreinte de style.min.css : recalculé seulement si le CSS change
    // (ou « node build.js --critical »). Sans Chrome ou en cas d'erreur : feuille de style normale (rien ne casse).
    // Le même CSS sert à l'accueil de chaque langue (même mise en page).
    await (async function () {
        const header = "/* style.min.css " + CSS_HASH + " */\n";
        const saved = fs.existsSync("critical.css") ? fs.readFileSync("critical.css", "utf8").replace(/\r\n/g, "\n") : "";
        let critical = "";
        if (saved.startsWith(header) && !process.argv.includes("--critical")) {
            critical = saved.slice(header.length).trim();
        } else {
            const chrome = findChrome();
            if (!chrome) {
                console.log("Attention : Chrome introuvable, pas de CSS critique (feuille de style normale)");
            } else {
                try {
                    const home = fs.readFileSync("index.html", "utf8");
                    const raw = await extractCritical(chrome, replaceBetween(home, "CSS", `<link rel="stylesheet" href="style.min.css?v=${CSS_HASH}">`, "    "));
                    critical = esbuild ? esbuild.transformSync(raw, { loader: "css", minify: true, legalComments: "none" }).code.trim() : raw;
                    fs.writeFileSync("critical.css", header + critical + "\n");
                    console.log("CSS critique recalculé : " + (critical.length / 1024).toFixed(1) + " Ko");
                } catch (error) {
                    critical = "";
                    console.log("Attention : CSS critique impossible (" + error.message + "), feuille de style normale");
                }
            }
        }
        LANGS.forEach(function (lang) {
            const dir = lang === "en" ? "" : lang + "/";
            const up = lang === "en" ? "" : "../"; // depuis fr/ : les fichiers sont un dossier plus haut
            const blocking = `<link rel="stylesheet" href="${up}style.min.css?v=${CSS_HASH}">`;
            const css = up ? critical.replace(/url\((["']?)(?!data:|https?:|\/)/g, "url($1" + up) : critical;
            const block = critical
                ? `<style>${css}</style>
    <link rel="preload" href="${up}style.min.css?v=${CSS_HASH}" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript>${blocking}</noscript>`
                : blocking;
            const file = dir + "index.html";
            fs.writeFileSync(file, replaceBetween(fs.readFileSync(file, "utf8"), "CSS", block, "    "));
        });
    })();

    console.log(players.length + " pages joueurs × " + LANGS.length + " langues (" + LANGS.join(", ") + ") + accueil + generator.html + faq.html + legal.html + sitemap.xml + 404.html (css " + CSS_HASH + ", js " + SCRIPT_HASH + ")");
}

main();
