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
// Lancer avec : node build.js   (à relancer après chaque changement de players.json, des photos, du CSS, du JS ou des textes)

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { optimizeImages, findChrome } = require("./images.js");
const { makePlayerOgImages } = require("./og.js");
const { extractCritical } = require("./critical.js");
const { LANGS, SOON, NAMES, makeI18n } = require("./i18n.js");

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
    function minify(source, out, loader, imports) {
        let code = fs.readFileSync(source, "utf8").replace(/\r\n/g, "\n");
        (imports || []).forEach(function (imp) {
            code = code.replace(new RegExp("([\"'])\\./" + imp.from.replace(".", "\\.") + "(\\?v=[^\"']*)?([\"'])", "g"), "$1./" + imp.to + "?v=" + imp.hash + "$3");
        });
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
    const guideData = fs.existsSync("guides.json") ? JSON.parse(fs.readFileSync("guides.json", "utf8")) : null;
    const bindData = fs.existsSync("binds.json") ? JSON.parse(fs.readFileSync("binds.json", "utf8")) : null;

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

        // Langues : liens hreflang pour Google + petit script (1re visite : langue du navigateur ; sélecteur : change de page)
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
        var A = ${JSON.stringify(alts)};
        try {
            var saved = localStorage.getItem("lang");
            var nav = ((navigator.languages && navigator.languages[0]) || navigator.language || "").slice(0, 2).toLowerCase();
            if (!saved && document.documentElement.lang === "en" && nav !== "en" && A[nav]) {
                location.replace(A[nav]);
            }
        } catch (error) {}
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
    <meta name="twitter:title" content="${o.ogTitle || o.title}">
    <meta name="twitter:description" content="${esc(o.description)}">
    <meta name="twitter:image" content="${SITE_URL}/${o.ogImage ? versioned(o.ogImage.file) : "og-image.jpg"}">
    <link rel="preload" href="${p}fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="${p}fonts/barlow-condensed-700-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="${p}style.min.css?v=${CSS_HASH}">${o.crosshair ? `
    <link rel="modulepreload" href="${p}crosshair.min.js?v=${CROSSHAIR_HASH}">
    <link rel="modulepreload" href="${p}lib/csgo-sharecode.js">
    <link rel="preload" href="${p}preview-bg.webp?v=${BG_HASH}" as="image" type="image/webp">` : ""}${o.generator ? `
    <link rel="modulepreload" href="${p}generator.min.js?v=${GENERATOR_HASH}">` : ""}${o.jsonLd ? `
    <script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, "\\u003c")}</script>` : ""}
    ${consentScript(o.prefix)}`;
        }

        // Bandeau cookies (CNIL) + Google Analytics après accord : sur toutes les pages (voir consent.js)
        function consentScript(prefix) {
            return `<script src="${ap(prefix)}consent.min.js?v=${CONSENT_HASH}" data-legal="${prefix}legal.html" defer></script>`;
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
            pageFiles.push(file);
            if (EN) {
                sitemapPages.push({ path: rel, lastmod: isoDate(player.updated), images: photo.original ? [SITE_URL + "/" + photo.original] : [] });
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
                }).join("")}</ul>`
                : "";

            const insights = crosshairInsights(player);
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
        ogImage: ogImages[slug(player.name)] ? { file: ogImages[slug(player.name)], alt: t("player.ogImageAlt", { name: player.name }) } : null,
        jsonLd: { "@context": "https://schema.org", "@graph": [webPage, breadcrumb(t("player.breadcrumb", { name: player.name }), url), person].concat(insights ? [faqGraph(url, insights.faq)] : []) }
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

        <h2>${t("player.about", { name: name })}</h2>
        <p>${intro}</p>
        ${crosshairDetails(player.code)}
        ${insights ? insights.html : ""}

        <h2>${t("player.howTitle", { name: name })}</h2>
        <ol>
            <li>${t("player.how1")}</li>
            <li>${t("player.how2")}</li>
            <li>${t("player.how3")}</li>
        </ol>
        <p>${t("player.orConsole")}${commandData ? ` <a href="../commands/#crosshair">${t("player.commandsLink")}</a>` : ""} <a href="../faq.html">${t("player.faqLink")}</a></p>
        ${/^CS(?!GO-)/.test(player.code) ? `<p><a href="../generator.html#${esc(player.code)}">${t("player.editLink", { name: name })}</a></p>` : ""}
        ${skinPlayers.some(function (s) { return s.name === player.name; }) ? `<p><a href="../skins/${slug(player.name)}.html">${t("player.skinsLink", { name: name })}</a></p>` : ""}

        ${insights ? `<h2>${t("player.faqTitle", { name: name })}</h2>
${faqItems(insights.faq, "h3")}` : ""}

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

        // Le menu principal (le même que sur les autres pages)
        index = replaceBetween(index, "MAINNAV", mainNav("", "crosshairs"), "                ");

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

        // ===== 3 ter. Les skins des pros : skins/index.html + une page par joueur (skins/<pseudo>.html) =====
        const skinFiles = ["index.html"];
        const skinsUrl = langUrl("skins/");
        const sa = ap("../"); // racine du site depuis skins/

        function skinList(groups, max) {
            const names = groups.slice(0, max).map(function (g) {
                return g.item.name + (g.item.exterior !== "Vanilla" ? " (" + opt("skins.exteriors." + g.item.exterior, g.item.exterior) + ")" : "");
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
                    t("skins.faqWorthA", { name: p.name, usd: money(p.value, "USD"), eur: money(p.valueEur, "EUR"), date: skinData.prices.updated, item: p.best[0].item.marketName, price: price(p.best[0].item.price, "USD") })]);
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

        // ===== 3 sexies. Les outils : tools/index.html + tools/bind-generator.html (données : binds.json) =====
        const bindUrl = toolsUrl + "bind-generator.html";
        if (bindData) {
            // Libellés traduits (i18n/<langue>/binds.json : même structure que binds.json, mêmes commandes)
            const binds = I.content("binds") || bindData;
            const bq = function (key, cmd) { return `bind "${key}" "${cmd}"`; };
            const bindFaq = tList("bind.faq");
            const bindDescription = t("bind.description");
            const allBuy = binds.buy.flatMap(function (g) { return g[1]; });
            if (EN) {
                sitemapPages.push({ path: "tools/", lastmod: isoDate(bindData.updated) });
                sitemapPages.push({ path: "tools/bind-generator.html", lastmod: isoDate(bindData.updated) });
            }
            const bindGraph = [
                {
                    "@type": "WebPage",
                    "@id": bindUrl,
                    "url": bindUrl,
                    "name": t("bind.name"),
                    "inLanguage": lang,
                    "isPartOf": { "@id": SITE_URL + "/#website" },
                    "breadcrumb": { "@id": bindUrl + "#breadcrumb" },
                    "mainEntity": { "@id": bindUrl + "#app" },
                    "dateModified": isoDate(bindData.updated)
                },
                {
                    "@type": "WebApplication",
                    "@id": bindUrl + "#app",
                    "name": t("bind.name"),
                    "url": bindUrl,
                    "description": bindDescription,
                    "applicationCategory": "GameApplication",
                    "operatingSystem": "Any",
                    "browserRequirements": "Requires JavaScript",
                    "isAccessibleForFree": true,
                    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
                    "publisher": { "@id": SITE_URL + "/#organization" }
                },
                sectionBreadcrumb(t("tools.breadcrumb"), toolsUrl, t("bind.breadcrumb"), bindUrl),
                faqGraph(bindUrl, bindFaq)
            ];
            const options = function (list) {
                return list.map(function (o) { return `<option value="${esc(o[o.length === 3 ? 2 : 0])}">${esc(o[1])}</option>`; }).join("");
            };
            const copyRowHtml = function (command) {
                return `<div class="field-row"><code>${esc(command)}</code><button type="button" class="mini" data-copy>${t("common.copy")}</button></div>`;
            };
            // Textes du petit programme de la page (traduits ici, directement dans le script)
            const BJ = JSON.stringify({
                tick: t("bind.js.tick"), type: t("bind.js.type"), careful: t("bind.js.careful"), keySet: t("bind.js.keySet"),
                press: t("bind.capture"), waiting: t("bind.js.waiting"), pressNow: t("bind.js.pressNow"), unsupported: t("bind.js.unsupported"),
                remove: t("bind.js.remove"), removeAria: t("bind.js.removeAria")
            }).replace(/</g, "\\u003c");

            write(LD + "tools/bind-generator.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({ title: t("bind.title"), ogTitle: t("bind.name"), description: bindDescription, url: bindUrl, path: "tools/bind-generator.html", prefix: "../", jsonLd: { "@context": "https://schema.org", "@graph": bindGraph } })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "tools")}

    <main class="player-page bind-page">
        ${crumbs("../", `<a href="./">${t("tools.crumb")}</a> › <span>${t("bind.crumb")}</span>`)}
        <h1>${t("bind.h1")}</h1>
        <p>${t("bind.intro")}</p>

        <div class="bind" id="bind-tool">
            <div class="bind-controls">
                <fieldset class="gen-group">
                    <legend>${t("bind.step1")}</legend>
                    <div class="bind-key">
                        <select id="bind-key" aria-label="${t("bind.keyAria")}">
                            ${binds.keys.map(function (g) {
                                return `<optgroup label="${esc(g[0])}">${g[1].map(function (k) { return `<option value="${esc(k[0])}">${esc(k[1])}</option>`; }).join("")}</optgroup>`;
                            }).join("")}
                        </select>
                        <button type="button" class="bind-capture" id="bind-capture">${t("bind.capture")}</button>
                    </div>
                    <p class="gen-status" id="bind-key-status" aria-live="polite"></p>
                </fieldset>

                <fieldset class="gen-group">
                    <legend>${t("bind.step2")}</legend>
                    <div class="bind-actions" role="group" aria-label="${t("bind.actionAria")}">
                        <button type="button" data-action="buy" aria-pressed="true">${t("bind.actions.buy")}</button>
                        <button type="button" data-action="jumpthrow" aria-pressed="false">${t("bind.actions.jumpthrow")}</button>
                        <button type="button" data-action="toggle" aria-pressed="false">${t("bind.actions.toggle")}</button>
                        <button type="button" data-action="volume" aria-pressed="false">${t("bind.actions.volume")}</button>
                        <button type="button" data-action="grenade" aria-pressed="false">${t("bind.actions.grenade")}</button>
                        <button type="button" data-action="other" aria-pressed="false">${t("bind.actions.other")}</button>
                        <button type="button" data-action="custom" aria-pressed="false">${t("bind.actions.custom")}</button>
                    </div>

                    <div class="bind-panel" data-panel="buy">
                        ${binds.buy.map(function (g) {
                            return `<div class="bind-buy-group"><p class="gen-label">${esc(g[0])}</p><div class="bind-checks">${g[1].map(function (it) {
                                return `<label class="gen-toggle"><input type="checkbox" value="${esc(it[0])}" data-buy><span>${esc(it[1])}</span></label>`;
                            }).join("")}</div></div>`;
                        }).join("\n                        ")}
                    </div>
                    <div class="bind-panel hidden" data-panel="jumpthrow">
                        <p class="gen-hint">${t("bind.jumpthrowHint")}</p>
                    </div>
                    <div class="bind-panel hidden" data-panel="toggle">
                        <label class="gen-label" for="bind-toggle">${t("bind.toggleLabel")}</label>
                        <select id="bind-toggle">${options(binds.toggles)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="volume">
                        <label class="gen-label" for="bind-volume">${t("bind.volumeLabel")}</label>
                        <select id="bind-volume">${options(binds.volume)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="grenade">
                        <label class="gen-label" for="bind-grenade">${t("bind.grenadeLabel")}</label>
                        <select id="bind-grenade">${options(binds.grenades)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="other">
                        <label class="gen-label" for="bind-other">${t("bind.otherLabel")}</label>
                        <select id="bind-other">${options(binds.other)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="custom">
                        <label class="gen-label" for="bind-custom">${t("bind.customLabel")}</label>
                        <input type="text" id="bind-custom" placeholder="${t("bind.customPlaceholder")}" autocomplete="off" spellcheck="false">
                    </div>
                </fieldset>
            </div>

            <div class="bind-result">
                <div class="bind-now">
                    <div class="field-label">${t("bind.yourBind")} <span><i class="sep">· </i>${t("bind.consoleHelp")}</span></div>
                    <div class="code-block"><pre><code id="bind-output">${esc(bq("kp_end", "buy ak47"))}</code></pre><button type="button" class="mini" data-copy>${t("common.copy")}</button></div>
                    <button type="button" class="bind-add" id="bind-add">${t("bind.add")}</button>
                </div>

                <div class="bind-mine">
                    <div class="field-label">${t("bind.mine")} <span id="bind-count"></span></div>
                    <ul class="bind-list" id="bind-list"></ul>
                    <p class="gen-hint" id="bind-empty">${t("bind.empty")}</p>
                    <div class="bind-buttons">
                        <button type="button" class="mini" id="bind-copy-all">${t("bind.copyAll")}</button>
                        <button type="button" class="mini btn-secondary" id="bind-download">${t("bind.download")}</button>
                        <button type="button" class="mini btn-secondary" id="bind-clear">${t("bind.clear")}</button>
                    </div>
                </div>
            </div>
            <noscript><p class="gen-status gen-status-error">${t("bind.noscript")}</p></noscript>
        </div>

        <h2>${t("bind.howTitle")}</h2>
        <ol>
            <li>${t("bind.how1")}</li>
            <li>${t("bind.how2")}</li>
            <li>${t("bind.how3")}</li>
        </ol>

        <h2>${t("bind.popularTitle")}</h2>
        <p>${t("bind.popularIntro")}</p>
        ${binds.presets.map(function (p) {
            return `<h3>${esc(p[0])}</h3>
        ${copyRowHtml(bq(p[1], p[2]))}`;
        }).join("\n        ")}

        <h2>${t("bind.jumpTitle")}</h2>
        <p>${t("bind.jumpText")}</p>
        <div class="code-block"><pre><code>alias "+jumpthrow" "+jump;-attack;-attack2"
alias "-jumpthrow" "-jump"
bind "v" "+jumpthrow"</code></pre><button type="button" class="mini" data-copy>${t("common.copy")}</button></div>

        <h2>${t("bind.buyTitle")}</h2>
        <p>${t("bind.buyIntro")}</p>
        <div class="table-wrap"><table class="cmd-values">
            <thead><tr><th scope="col">${t("bind.buyItem")}</th><th scope="col">${t("bind.buyCommand")}</th></tr></thead>
            <tbody>${allBuy.map(function (it) { return `<tr><td>${esc(it[1])}</td><td><code>buy ${esc(it[0])}</code></td></tr>`; }).join("")}</tbody>
        </table></div>

        <h2>${t("bind.faqTitle")}</h2>
${faqItems(bindFaq, "h3")}

        <h2>${t("bind.relatedTitle")}</h2>
        <ul class="related">
            <li><a href="../commands/bind.html">${t("bind.relatedBind")}</a></li>
            <li><a href="../commands/alias.html">${t("bind.relatedAlias")}</a></li>
            <li><a href="../commands/exec.html">${t("bind.relatedExec")}</a></li>
            <li><a href="../generator.html">${t("links.generator")}</a></li>
            <li><a href="../guides/cs2-launch-options.html">${t("bind.relatedLaunch")}</a></li>
        </ul>
    </main>

    ${footer("../")}
    <script type="application/json" id="bind-data">${JSON.stringify({ toggles: binds.toggles, volume: binds.volume, grenades: binds.grenades, other: binds.other }).replace(/</g, "\\u003c")}</script>
    <script type="module">
        import { copyText } from "${ap("../")}crosshair.min.js?v=${CROSSHAIR_HASH}";
        const TX = ${BJ};

        // Boutons Copy (lignes simples et blocs de plusieurs lignes)
        document.addEventListener("click", function (event) {
            const button = event.target.closest("[data-copy]");
            if (button) {
                copyText(button.closest(".field-row, .code-block").querySelector("code").textContent, button);
            }
        });

        const $ = function (id) { return document.getElementById(id); };
        const keySelect = $("bind-key");
        const output = $("bind-output");
        let action = "buy";

        // Le texte du bind selon la touche et l'action choisies
        function lines() {
            const key = keySelect.value;
            const bind = function (cmd) { return ["bind \\"" + key + "\\" \\"" + cmd + "\\""]; };
            if (action === "buy") {
                const items = Array.from(document.querySelectorAll("[data-buy]:checked")).map(function (c) { return "buy " + c.value; });
                return items.length ? bind(items.join("; ")) : [];
            }
            if (action === "jumpthrow") {
                return ["alias \\"+jumpthrow\\" \\"+jump;-attack;-attack2\\"", "alias \\"-jumpthrow\\" \\"-jump\\"", "bind \\"" + key + "\\" \\"+jumpthrow\\""];
            }
            if (action === "custom") {
                const cmd = $("bind-custom").value.replace(/"/g, "").trim();
                return cmd ? bind(cmd) : [];
            }
            return bind($("bind-" + action).value);
        }

        function render() {
            const l = lines();
            output.textContent = l.length ? l.join("\\n") : (action === "buy" ? TX.tick : TX.type);
            $("bind-add").disabled = !l.length;
        }

        // Choix de l'action
        document.querySelectorAll("[data-action]").forEach(function (button) {
            button.addEventListener("click", function () {
                action = button.dataset.action;
                document.querySelectorAll("[data-action]").forEach(function (b) { b.setAttribute("aria-pressed", b === button ? "true" : "false"); });
                document.querySelectorAll("[data-panel]").forEach(function (p) { p.classList.toggle("hidden", p.dataset.panel !== action); });
                render();
            });
        });
        document.getElementById("bind-tool").addEventListener("input", render);
        document.getElementById("bind-tool").addEventListener("change", render);

        // "Press a key" : on lit la prochaine touche (ou bouton de souris) et on la traduit en nom CS2
        const CODES = { Space: "space", Tab: "tab", CapsLock: "capslock", ShiftLeft: "shift", ShiftRight: "rshift", ControlLeft: "ctrl", ControlRight: "rctrl", AltLeft: "alt", AltRight: "ralt",
            Insert: "ins", Delete: "del", Home: "home", End: "end", PageUp: "pgup", PageDown: "pgdn", ArrowUp: "uparrow", ArrowDown: "downarrow", ArrowLeft: "leftarrow", ArrowRight: "rightarrow",
            Numpad0: "kp_ins", Numpad1: "kp_end", Numpad2: "kp_downarrow", Numpad3: "kp_pgdn", Numpad4: "kp_leftarrow", Numpad5: "kp_5", Numpad6: "kp_rightarrow", Numpad7: "kp_home",
            Numpad8: "kp_uparrow", Numpad9: "kp_pgup", NumpadDecimal: "kp_del", NumpadDivide: "kp_slash", NumpadMultiply: "kp_multiply", NumpadSubtract: "kp_minus", NumpadAdd: "kp_plus", NumpadEnter: "kp_enter",
            Backquote: "\`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Semicolon: "semicolon", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\\\", Enter: "enter", Backspace: "backspace" };
        const DEFAULT_KEYS = ["w", "a", "s", "d", "space", "ctrl", "shift", "e", "r", "q", "b", "tab", "mouse1", "mouse2", "1", "2", "3", "4", "5"];
        const status = $("bind-key-status");
        const capture = $("bind-capture");
        let listening = false;

        function setKey(name, label) {
            let option = Array.from(keySelect.options).find(function (o) { return o.value === name; });
            if (!option) {
                option = new Option(label || name.toUpperCase(), name);
                keySelect.add(option);
            }
            keySelect.value = name;
            status.textContent = DEFAULT_KEYS.includes(name) ? TX.careful.replace("{key}", name) : TX.keySet.replace("{key}", name);
            status.classList.toggle("gen-status-error", DEFAULT_KEYS.includes(name));
            render();
        }

        function stopListening() {
            listening = false;
            capture.textContent = TX.press;
            capture.setAttribute("aria-pressed", "false");
        }

        capture.addEventListener("click", function () {
            listening = true;
            capture.textContent = TX.waiting;
            capture.setAttribute("aria-pressed", "true");
            status.textContent = TX.pressNow;
            status.classList.remove("gen-status-error");
        });
        document.addEventListener("keydown", function (event) {
            if (!listening) {
                return;
            }
            event.preventDefault();
            stopListening();
            if (event.code === "Escape") {
                status.textContent = "";
                return;
            }
            let name = CODES[event.code];
            if (!name && /^Key[A-Z]$/.test(event.code)) {
                name = event.code.slice(3).toLowerCase();
            } else if (!name && /^Digit\\d$/.test(event.code)) {
                name = event.code.slice(5);
            } else if (!name && /^F\\d{1,2}$/.test(event.code)) {
                name = event.code.toLowerCase();
            }
            if (name) {
                setKey(name);
            } else {
                status.textContent = TX.unsupported;
            }
        });
        document.addEventListener("mousedown", function (event) {
            const mouse = { 1: "mouse3", 3: "mouse4", 4: "mouse5" }[event.button];
            if (listening && mouse && event.target !== capture) {
                event.preventDefault();
                stopListening();
                setKey(mouse);
            }
        });

        // Ma liste de binds (gardée dans ce navigateur)
        let mine = [];
        try { mine = JSON.parse(localStorage.getItem("cc-binds") || "[]"); } catch (error) { mine = []; }
        function save() {
            try { localStorage.setItem("cc-binds", JSON.stringify(mine)); } catch (error) {}
        }
        function allText() {
            const out = [];
            mine.forEach(function (b) { b.lines.forEach(function (l) { if (!out.includes(l)) { out.push(l); } }); });
            return out.join("\\n");
        }
        function renderList() {
            const list = $("bind-list");
            list.textContent = "";
            mine.forEach(function (b, i) {
                const li = document.createElement("li");
                const code = document.createElement("code");
                code.textContent = b.lines[b.lines.length - 1];
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "bind-remove";
                remove.textContent = TX.remove;
                remove.setAttribute("aria-label", TX.removeAria.replace("{key}", b.key));
                remove.addEventListener("click", function () {
                    mine.splice(i, 1);
                    save();
                    renderList();
                });
                li.append(code, remove);
                list.appendChild(li);
            });
            $("bind-empty").classList.toggle("hidden", mine.length > 0);
            $("bind-count").textContent = mine.length ? "· " + mine.length : "";
            ["bind-copy-all", "bind-download", "bind-clear"].forEach(function (id) { $(id).disabled = !mine.length; });
        }
        $("bind-add").addEventListener("click", function () {
            const l = lines();
            if (!l.length) {
                return;
            }
            // Une seule action par touche : un nouveau bind sur la même touche remplace l'ancien
            mine = mine.filter(function (b) { return b.key !== keySelect.value; });
            mine.push({ key: keySelect.value, lines: l });
            save();
            renderList();
        });
        $("bind-copy-all").addEventListener("click", function (event) {
            copyText(allText(), event.currentTarget);
        });
        $("bind-download").addEventListener("click", function () {
            const text = "// CS2 binds made with ClutchCrosshair bind generator\\n" + allText() + "\\n";
            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
            link.download = "autoexec.cfg";
            document.body.appendChild(link);
            link.click();
            setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
        });
        $("bind-clear").addEventListener("click", function () {
            mine = [];
            save();
            renderList();
        });

        // Départ : AK-47 coché pour montrer un exemple
        const ak = document.querySelector("[data-buy][value=ak47]");
        if (ak && !document.querySelector("[data-buy]:checked")) {
            ak.checked = true;
        }
        render();
        renderList();
    </script>
</body>
</html>
`);

            // La page d'accueil des outils
            const toolsDescription = t("tools.description");
            write(LD + "tools/index.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("tools.title"),
        ogTitle: t("tools.ogTitle"),
        description: toolsDescription,
        url: toolsUrl,
        path: "tools/",
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": [
            {
                "@type": "CollectionPage",
                "@id": toolsUrl,
                "url": toolsUrl,
                "name": t("tools.ogTitle"),
                "description": toolsDescription,
                "inLanguage": lang,
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "breadcrumb": { "@id": toolsUrl + "#breadcrumb" },
                "mainEntity": { "@type": "ItemList", "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": t("generator.name"), "url": genUrl },
                    { "@type": "ListItem", "position": 2, "name": t("bind.name"), "url": bindUrl }
                ] }
            },
            sectionBreadcrumb(t("tools.breadcrumb"), toolsUrl)
        ] }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "tools")}

    <main class="player-page guide-hub">
        ${crumbs("../", `<span>${t("tools.crumb")}</span>`)}
        <h1>${t("tools.h1")}</h1>
        <p>${t("tools.intro1")}</p>
        <p>${t("tools.intro2")}</p>
        <p>${t("tools.intro3")}</p>
        <div class="guide-cards">
            <a class="guide-card" href="../generator.html"><span class="guide-card-title">${t("generator.name")}</span><span class="guide-card-desc">${t("tools.cardGenerator")}</span></a>
            <a class="guide-card" href="bind-generator.html"><span class="guide-card-title">${t("bind.name")}</span><span class="guide-card-desc">${t("tools.cardBind")}</span></a>
        </div>
        <h2>${t("tools.moreTitle")}</h2>
        <ul class="related">
            <li><a href="../commands/">${t("links.commands")}</a></li>
            <li><a href="../guides/">${t("links.guides")}</a></li>
            <li><a href="../">${t("links.pros")}</a></li>
        </ul>
    </main>

    ${footer("../")}
</body>
</html>
`);
            if (EN) {
                console.log("tools/index.html + tools/bind-generator.html");
            }
        }

        // ===== 3 septies. valorant.html : page "Coming soon" façon Killjoy (noindex, pas dans le sitemap) =====
        // Tourelle 100 % SVG/CSS (aucune image de Riot), barre bloquée à 87 %, phrases drôles qui changent
        const VALORANT_JOKES = tList("valorant.jokes");
        write(LD + "valorant.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({ title: t("valorant.title"), description: t("valorant.description"), url: langUrl("valorant.html"), path: "valorant.html", prefix: "", noindex: true })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("./")}

    <main class="player-page vk-page">
        ${crumbs("./", "<span>Valorant</span>")}

        <div class="vk-stage" aria-hidden="true">
            <svg class="vk-turret" viewBox="0 0 240 220">
                <ellipse class="vk-shadow" cx="120" cy="204" rx="70" ry="7"/>
                <g class="vk-legs">
                    <path d="M120 150 L62 200"/>
                    <path d="M120 150 L178 200"/>
                    <path d="M120 150 L120 204"/>
                </g>
                <g class="vk-body">
                    <rect x="78" y="96" width="84" height="58" rx="6"/>
                    <rect class="vk-panel" x="90" y="108" width="28" height="8" rx="2"/>
                    <rect class="vk-panel" x="90" y="122" width="18" height="8" rx="2"/>
                </g>
                <g class="vk-barrel">
                    <rect x="160" y="114" width="54" height="12" rx="3"/>
                    <rect class="vk-panel" x="206" y="111" width="10" height="18" rx="2"/>
                </g>
                <g class="vk-head">
                    <rect x="92" y="58" width="56" height="42" rx="8"/>
                    <circle class="vk-eye-socket" cx="120" cy="79" r="13"/>
                    <circle class="vk-eye" cx="120" cy="79" r="6"/>
                    <path class="vk-antenna" d="M136 58 L144 38"/>
                    <circle class="vk-antenna-tip" cx="144" cy="36" r="3.5"/>
                </g>
                <g class="vk-sparks">
                    <circle cx="160" cy="120" r="2.5"/>
                    <circle cx="167" cy="110" r="1.8"/>
                    <circle cx="154" cy="108" r="1.6"/>
                </g>
            </svg>
        </div>

        <h1 class="vk-title">${t("valorant.h1")}</h1>
        <p class="vk-lead">${t("valorant.lead")}</p>

        <div class="vk-progress" role="progressbar" aria-label="${t("valorant.progressAria")}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="87">
            <div class="vk-bar"><i></i></div>
            <span class="vk-percent" id="vk-percent">87%</span>
        </div>
        <p class="vk-eta">${t("valorant.eta")}</p>

        <p class="vk-joke" id="vk-joke" aria-live="polite">${esc(VALORANT_JOKES[0])}</p>

        <p class="vk-actions">
            <a class="vk-back" href="./">${t("valorant.back")}</a>
            <a class="vk-alt" href="generator.html">${t("valorant.alt")}</a>
        </p>
    </main>

    ${footer("")}
    <script type="module">
        // Compteur qui monte jusqu'à 87 % en même temps que la barre (directement 87 % si moins d'animations)
        const percent = document.getElementById("vk-percent");
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const start = performance.now();
        function count(now) {
            const t = Math.min(1, (now - start) / 3200);
            percent.textContent = Math.round(87 * (1 - Math.pow(1 - t, 3))) + "%";
            if (t < 1) {
                requestAnimationFrame(count);
            }
        }
        if (!calm) {
            percent.textContent = "0%";
            requestAnimationFrame(count);
        }

        // Une phrase drôle toutes les 3,5 secondes, avec un petit fondu
        const jokes = ${JSON.stringify(VALORANT_JOKES)};
        const joke = document.getElementById("vk-joke");
        let i = 0;
        setInterval(function () {
            joke.classList.add("vk-fade");
            setTimeout(function () {
                i = (i + 1) % jokes.length;
                joke.textContent = jokes[i];
                joke.classList.remove("vk-fade");
            }, calm ? 0 : 250);
        }, 3500);
    </script>
</body>
</html>
`);

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

    // ===== 5. Le sitemap : toutes les pages dans toutes les langues, leur date de mise à jour, les photos (Google Images)
    //          et les liens entre les versions (hreflang) =====
    function pageUrl(lang, rel) {
        return SITE_URL + "/" + (lang === "en" ? "" : lang + "/") + rel;
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
            urls += `    <url><loc>${pageUrl(l, page.path)}</loc>${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ""}${alternates}${images}</url>\n`;
        });
    });
    fs.writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}</urlset>
`);

    // ===== llms.txt et llms-full.txt (format llmstxt.org) : un résumé du site en texte simple pour les assistants IA =====
    // llms.txt = sommaire avec des liens (une ligne par joueur) ; llms-full.txt = tous les joueurs avec leur code complet.
    // Fabriqués depuis players.json à chaque build : ils restent à jour tout seuls. Contenu factuel uniquement.
    const pagesUrl = function (rel) { return SITE_URL + "/" + rel.replace(/(?:index)?\.html$/, ""); };
    const sortedPlayers = players.slice().sort(function (a, b) {
        return a.team.localeCompare(b.team) || a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    });
    const llmsPros = sortedPlayers.filter(function (p) { return p.category === "pro"; });
    const llmsCreators = sortedPlayers.filter(function (p) { return p.category !== "pro"; });
    const guideList = fs.existsSync("guides.json") ? JSON.parse(fs.readFileSync("guides.json", "utf8")).guides : [];
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
- Last update: ${isoDate(p.updated)}${p.category === "creator" ? "" : " (date of the official match the crosshair was read from)"}
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
        ["players", "commands", "guides", "skins", "tools"].forEach(function (sub) {
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
