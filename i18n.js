// i18n.js : les langues du site (utilisé par build.js, dans Node)
// Les textes sont dans i18n/<langue>.json (interface) et i18n/<langue>/*.json (guides, commandes, binds).
// L'anglais est la langue par défaut : il est à la racine du site (/players/zywoo) ; les autres langues sont dans
// un dossier (/fr/players/zywoo). S'il manque une traduction, le texte anglais est utilisé.
//
// Dans les textes : {nom} est remplacé par une valeur ; une entrée { "one": "...", "other": "..." } choisit
// le singulier ou le pluriel selon {count} (règles de chaque langue, ex. en français 0 et 1 sont au singulier).
const fs = require("fs");
const path = require("path");

// Langues publiées (dans l'ordre du sélecteur). Pour en ajouter une : créer i18n/<code>.json puis l'ajouter ici.
const LANGS = ["en", "fr", "es", "ru", "tr"];
// Langues annoncées « soon » dans le sélecteur (pas encore de pages)
const SOON = [];
const NAMES = { en: "English", fr: "Français", ru: "Русский", es: "Español", tr: "Türkçe" };
const LOCALES = { en: "en-US", fr: "fr-FR", ru: "ru-RU", es: "es-ES", tr: "tr-TR" };
const OG_LOCALES = { en: "en_US", fr: "fr_FR", ru: "ru_RU", es: "es_ES", tr: "tr_TR" };

const DIR = path.join(__dirname, "i18n");

function readJson(file) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

// Cherche "player.faq.code" dans { player: { faq: { code: ... } } }
function lookup(dict, key) {
    return key.split(".").reduce(function (node, part) {
        return node && typeof node === "object" ? node[part] : undefined;
    }, dict);
}

function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (all, name) {
        return vars && vars[name] !== undefined ? String(vars[name]) : all;
    });
}

function makeI18n(lang) {
    const base = readJson(path.join(DIR, "en.json")) || {};
    const dict = lang === "en" ? base : (readJson(path.join(DIR, lang + ".json")) || {});
    const plural = new Intl.PluralRules(LOCALES[lang] || lang);

    function raw(key) {
        const value = lookup(dict, key);
        if (value !== undefined) {
            return value;
        }
        const fallback = lookup(base, key);
        if (fallback === undefined) {
            throw new Error("Texte manquant dans i18n/en.json : " + key);
        }
        return fallback;
    }

    // t("clé", { name: "ZywOo", count: 3 }) -> texte de la langue (ou de l'anglais)
    function t(key, vars) {
        let value = raw(key);
        if (value && typeof value === "object" && !Array.isArray(value) && ("other" in value)) {
            const count = vars && vars.count !== undefined ? vars.count : 0;
            value = value[plural.select(count)] !== undefined ? value[plural.select(count)] : value.other;
        }
        if (typeof value !== "string") {
            throw new Error("La clé " + key + " n'est pas un texte (utiliser tList)");
        }
        return fill(value, vars);
    }

    // Une liste de textes (FAQ, phrases...) : chaque texte reçoit les mêmes valeurs
    function tList(key, vars) {
        const value = raw(key);
        const walk = function (v) {
            return Array.isArray(v) ? v.map(walk) : (typeof v === "string" ? fill(v, vars) : v);
        };
        return walk(value);
    }

    // Contenu traduit (guides, commandes, binds) : i18n/<langue>/<nom>.json, ou null
    function content(name) {
        return lang === "en" ? null : readJson(path.join(DIR, lang, name + ".json"));
    }

    return {
        lang: lang,
        t: t,
        tList: tList,
        has: function (key) { return lookup(dict, key) !== undefined || lookup(base, key) !== undefined; },
        content: content,
        locale: LOCALES[lang] || lang,
        ogLocale: OG_LOCALES[lang] || lang,
        dir: lang === "en" ? "" : lang + "/" // dossier de la langue sur le site
    };
}

module.exports = { LANGS, SOON, NAMES, makeI18n };
