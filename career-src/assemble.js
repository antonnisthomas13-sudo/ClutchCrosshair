// career-src/assemble.js : rassemble les données du jeu « Zero to Major » dans UNE langue
// Utilisé par build/career.js (fabrique career.en.json et career.fr.json, chargés par la page) et par career-sim.js.
// Entrée : les fichiers de ce dossier. Sortie : un seul objet, celui que lit career-engine.js :
//   { lang, startYear, updated, teams, pros, tournaments, maps, events, cast, s (phrases du moteur), ui (interface) }
const fs = require("fs");
const path = require("path");

const read = function (file) { return JSON.parse(fs.readFileSync(path.join(__dirname, file), "utf8")); };

// { "en": "...", "fr": "..." } -> le texte de la langue (anglais si la traduction manque)
function one(value, lang) {
    return value && typeof value === "object" && !Array.isArray(value) && ("en" in value) ? (value[lang] !== undefined ? value[lang] : value.en) : value;
}

function assemble(lang) {
    const teams = read("teams.json");
    const pros = read("pros.json");
    const texts = read("texts.json");
    const text = texts[lang] || texts.en;
    const events = [];
    fs.readdirSync(path.join(__dirname, "events")).filter(function (f) { return f.endsWith(".json"); }).sort().forEach(function (f) {
        read("events/" + f).forEach(function (ev) {
            if (events.some(function (x) { return x.id === ev.id; })) {
                throw new Error("career-src/events : l'identifiant « " + ev.id + " » est utilisé deux fois (" + f + ")");
            }
            // Chaque texte doit exister en anglais ET en français
            const both = function (text, where) {
                if (!text || !text.en || !text.fr) { throw new Error("career-src/events/" + f + " : texte manquant dans « " + ev.id + " » (" + where + ")"); }
            };
            both(ev.text, "text");
            ev.choices.forEach(function (c, i) {
                both(c.text, "choix " + (i + 1));
                if (c.test) { both(c.win.text, "réussite du choix " + (i + 1)); both(c.lose.text, "échec du choix " + (i + 1)); } else { both(c.result, "résultat du choix " + (i + 1)); }
            });
            events.push({
                id: ev.id, type: ev.type, when: ev.when, weight: ev.weight, once: ev.once, repeat: ev.repeat,
                text: one(ev.text, lang),
                choices: ev.choices.map(function (c) {
                    const out = { text: one(c.text, lang) };
                    if (c.act) { out.act = c.act; }
                    if (c.test) {
                        out.test = c.test;
                        out.win = { text: one(c.win.text, lang), fx: c.win.fx };
                        out.lose = { text: one(c.lose.text, lang), fx: c.lose.fx };
                    } else {
                        out.result = one(c.result, lang);
                        out.fx = c.fx;
                    }
                    return out;
                })
            });
        });
    });
    // Les personnages fictifs ne doivent jamais porter le pseudo d'un vrai joueur
    const cast = read("cast.json").cast;
    const real = {};
    pros.pros.forEach(function (p) { real[p.name.toLowerCase()] = true; });
    Object.keys(cast).forEach(function (k) {
        cast[k].forEach(function (n) {
            if (real[n.toLowerCase()]) { throw new Error("career-src/cast.json : « " + n + " » est le pseudo d'un vrai joueur, choisis-en un autre"); }
        });
    });
    const parts = teams.updated.split("/"); // "02/11/2026"
    return {
        lang: lang,
        startYear: Number(parts[2]) || new Date().getFullYear(),
        updated: teams.updated,
        teams: teams.teams.map(function (t) {
            const out = { id: t.id, name: t.name, tier: t.tier, rank: t.rank, roster: t.roster };
            if (t.country) { out.country = t.country; }
            return out;
        }),
        // Seulement les joueurs dont on connaît le rôle ou le pays (les autres n'ont que leur pseudo, dans l'effectif)
        pros: pros.pros.filter(function (p) { return p.role || p.country; }).map(function (p) {
            const out = { name: p.name };
            if (p.role) { out.role = p.role; }
            if (p.country) { out.country = p.country; }
            return out;
        }),
        tournaments: read("tournaments.json").tournaments,
        maps: read("maps.json").maps.map(function (m) { return { id: m.id, name: m.name, callouts: m.callouts }; }),
        events: events,
        cast: cast,
        s: text.engine,
        ui: text.ui
    };
}

module.exports = { assemble, texts: function (lang) { const t = read("texts.json"); return t[lang] || t.en; } };
