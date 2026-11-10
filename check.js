// check.js : vérifie le site fabriqué par build.js (à lancer après « node build.js » : node check.js)
// Il relit toutes les pages .html et signale ce qui gênerait Google ou les visiteurs :
//   - titres : absents, en double, de plus de 60 caractères ; descriptions : absentes, en double, de plus de 160 caractères
//   - un seul titre H1 par page, bonne langue dans <html lang>
//   - adresse officielle (canonical), og:url, liens hreflang complets et réciproques entre les 5 langues
//   - liens internes cassés ou qui passent encore par « .html » (redirection inutile)
//   - données structurées (JSON-LD) illisibles, images sans texte alternatif ou sans dimensions
// Il ne modifie rien. Il se termine en erreur (code 1) s'il trouve un problème : pratique avant de sauvegarder.
const fs = require("fs");
const path = require("path");
const { LANGS } = require("./i18n.js");

const SITE = "https://clutchcrosshair.com";
const OTHER = LANGS.filter(function (l) { return l !== "en"; });
const SKIP = new Set(["node_modules", ".git", "demos", "captures", "faceit-test", "fonts", "photos", "logos", "og", "lib", "i18n", "build"]);

// Toutes les pages : la racine (anglais) et les dossiers des autres langues
function walk(dir, out) {
    fs.readdirSync(dir || ".", { withFileTypes: true }).forEach(function (entry) {
        const rel = dir ? dir + "/" + entry.name : entry.name;
        if (entry.isDirectory()) {
            if (!SKIP.has(entry.name) && !entry.name.startsWith(".")) {
                walk(rel, out);
            }
        } else if (entry.name.endsWith(".html") && rel !== "index.template.html") {
            out.push(rel);
        }
    });
    return out;
}

function decodeEntities(text) {
    return String(text || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function attr(tag, name) {
    const m = tag.match(new RegExp("\\s" + name + '\\s*=\\s*"([^"]*)"', "i"));
    return m ? decodeEntities(m[1]) : null;
}
function langOf(file) {
    const m = file.match(/^([a-z]{2})\//);
    return m && OTHER.includes(m[1]) ? m[1] : "en";
}
function urlOf(file) {
    return SITE + "/" + file.replace(/index\.html$/, "").replace(/\.html$/, "");
}

const pages = {};
walk("", []).forEach(function (file) {
    const html = fs.readFileSync(file, "utf8");
    const head = (html.match(/<head[\s\S]*?<\/head>/i) || [""])[0];
    const body = html.slice(html.indexOf("</head>"));
    const metas = (head.match(/<meta\b[^>]*>/gi) || []);
    const links = (head.match(/<link\b[^>]*>/gi) || []);
    const meta = function (name) {
        const tag = metas.find(function (t) { return attr(t, "name") === name || attr(t, "property") === name; });
        return tag ? attr(tag, "content") : null;
    };
    const page = pages[file] = { file: file, lang: langOf(file) };
    page.htmlLang = attr((html.match(/<html\b[^>]*>/i) || [""])[0], "lang");
    page.title = decodeEntities((head.match(/<title>([\s\S]*?)<\/title>/i) || ["", ""])[1]).trim();
    page.description = meta("description");
    page.noindex = /noindex/.test(meta("robots") || "");
    page.canonical = links.map(function (l) { return attr(l, "rel") === "canonical" ? attr(l, "href") : null; }).find(Boolean) || null;
    page.ogUrl = meta("og:url");
    page.hreflang = {};
    links.forEach(function (l) {
        if (attr(l, "rel") === "alternate" && attr(l, "hreflang")) {
            page.hreflang[attr(l, "hreflang")] = attr(l, "href");
        }
    });
    page.h1 = (body.match(/<h1\b/gi) || []).length;
    page.badJson = (html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi) || []).filter(function (block) {
        try {
            JSON.parse(block.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, ""));
            return false;
        } catch (error) {
            return true;
        }
    }).length;
    const images = body.match(/<img\b[^>]*>/gi) || [];
    page.noAlt = images.filter(function (t) { return attr(t, "alt") === null; }).length;
    page.noSize = images.filter(function (t) { return !attr(t, "width") || !attr(t, "height"); }).length;
    page.hrefs = (body.match(/<a\b[^>]*\shref="[^"]*"/gi) || []).map(function (t) { return attr(t, "href"); });
    // Liens sponsorisés (sponsors.json) : chacun doit porter rel="sponsored", et le bloc la mention « Sponsored »
    page.badSponsor = (body.match(/<a\b[^>]*class="sponsor-link"[^>]*>/gi) || []).filter(function (t) {
        return !/\bsponsored\b/.test(attr(t, "rel") || "");
    }).length + (/class="sponsor-link"/.test(body) && !/class="sponsor-label"/.test(body) ? 1 : 0);
});

const all = Object.keys(pages).map(function (f) { return pages[f]; });
const indexable = all.filter(function (p) { return !p.noindex; });
const problems = [];
function report(title, list) {
    if (list.length) {
        problems.push({ title: title, list: list });
    }
}
function duplicates(key) {
    const seen = {};
    indexable.forEach(function (p) { (seen[p[key]] = seen[p[key]] || []).push(p.file); });
    return Object.keys(seen).filter(function (k) { return seen[k].length > 1; }).map(function (k) { return seen[k].slice(0, 3).join(" = ") + " : " + k; });
}

report("Titre absent", indexable.filter(function (p) { return !p.title; }).map(function (p) { return p.file; }));
report("Titre de plus de 60 caractères (coupé par Google)", indexable.filter(function (p) { return p.title.length > 60; }).map(function (p) { return p.file + " (" + p.title.length + ")"; }));
report("Titres en double", duplicates("title"));
report("Description absente", indexable.filter(function (p) { return !p.description; }).map(function (p) { return p.file; }));
report("Description de plus de 160 caractères", indexable.filter(function (p) { return (p.description || "").length > 160; }).map(function (p) { return p.file + " (" + p.description.length + ")"; }));
report("Descriptions en double", duplicates("description"));
report("Pas exactement un titre H1", all.filter(function (p) { return p.h1 !== 1; }).map(function (p) { return p.file + " (" + p.h1 + ")"; }));
report("Mauvaise langue dans <html lang>", all.filter(function (p) { return p.htmlLang !== p.lang; }).map(function (p) { return p.file; }));
report("Adresse officielle (canonical) inattendue", indexable.filter(function (p) { return p.canonical !== urlOf(p.file); }).map(function (p) { return p.file + " -> " + p.canonical; }));
report("og:url différent de l'adresse officielle", indexable.filter(function (p) { return p.ogUrl !== p.canonical; }).map(function (p) { return p.file; }));
report("Données structurées (JSON-LD) illisibles", all.filter(function (p) { return p.badJson; }).map(function (p) { return p.file; }));
report("Lien sponsorisé sans rel=\"sponsored\" ou sans la mention « Sponsored »", all.filter(function (p) { return p.badSponsor; }).map(function (p) { return p.file; }));
report("Images sans texte alternatif (alt)", all.filter(function (p) { return p.noAlt; }).map(function (p) { return p.file + " (" + p.noAlt + ")"; }));
report("Images sans dimensions (la page saute au chargement)", all.filter(function (p) { return p.noSize; }).map(function (p) { return p.file + " (" + p.noSize + ")"; }));

// hreflang : les 5 langues + x-default, chaque page se cite elle-même, et les autres langues la citent en retour
const wanted = LANGS.concat("x-default").sort().join(",");
function fileOf(url) {
    const rel = url.replace(SITE + "/", "");
    return [rel + ".html", rel + "index.html", rel === "" ? "index.html" : ""].find(function (f) { return f && pages[f]; });
}
const hreflang = [];
indexable.forEach(function (p) {
    if (Object.keys(p.hreflang).sort().join(",") !== wanted) {
        hreflang.push(p.file + " : langues " + Object.keys(p.hreflang).join(","));
        return;
    }
    if (p.hreflang[p.lang] !== urlOf(p.file)) {
        hreflang.push(p.file + " : ne se cite pas elle-même");
    }
    Object.keys(p.hreflang).forEach(function (l) {
        const target = fileOf(p.hreflang[l]);
        if (!target) {
            hreflang.push(p.file + " : " + l + " mène à une page absente");
        } else if (l !== "x-default" && pages[target].hreflang[p.lang] !== urlOf(p.file)) {
            hreflang.push(p.file + " : " + l + " ne renvoie pas vers cette page");
        }
    });
});
report("Liens entre les langues (hreflang)", hreflang);

// Liens internes : la page visée existe, sans passer par « .html »
const broken = [];
const withHtml = [];
all.forEach(function (p) {
    p.hrefs.forEach(function (href) {
        if (!href || href === "#" || /^(mailto:|tel:|#)/.test(href) || (/^https?:/.test(href) && !href.startsWith(SITE))) {
            return;
        }
        let rel = href.startsWith(SITE) ? href.slice(SITE.length + 1) : path.posix.normalize(path.posix.join(path.posix.dirname(p.file), href));
        rel = rel.split("#")[0].split("?")[0];
        if (/\.html$/.test(rel)) {
            withHtml.push(p.file + " -> " + href);
        }
        const candidates = rel === "" || rel === "." ? ["index.html"] : rel.endsWith("/") ? [rel + "index.html"] : [rel, rel + ".html", rel + "/index.html"];
        if (!candidates.some(function (f) { return fs.existsSync(f) && fs.statSync(f).isFile(); })) {
            broken.push(p.file + " -> " + href);
        }
    });
});
report("Liens internes cassés", broken);
report("Liens internes qui passent par « .html »", withHtml);

console.log(all.length + " pages vérifiées (" + indexable.length + " à indexer, " + LANGS.length + " langues)");
if (!problems.length) {
    console.log("Tout est bon : aucun problème trouvé.");
} else {
    problems.forEach(function (p) {
        console.log("\n" + p.title + " : " + p.list.length);
        p.list.slice(0, 8).forEach(function (line) { console.log("   " + line); });
        if (p.list.length > 8) {
            console.log("   … et " + (p.list.length - 8) + " de plus");
        }
    });
    process.exitCode = 1;
}
