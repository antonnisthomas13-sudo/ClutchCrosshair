// ===== career-engine.js : les règles du jeu « Zero to Major » (carrière de joueur pro CS2) =====
// Aucun affichage ici : seulement les règles. Le même fichier sert dans le navigateur (career.js) et dans la
// simulation automatique (node career-sim.js), pour équilibrer le jeu sans cliquer.
//
// Tout l'état d'une partie tient dans un objet « state » simple (sauvegardé tel quel dans localStorage).
// Le hasard vient d'un générateur à graine (state.rng) : même graine + mêmes choix = même carrière.
//
// « data » = les données du jeu dans une langue (fabriquées par career-src/assemble.js) :
//   { teams, pros, tournaments, maps, events, cast, s (phrases du moteur), startYear, lang }
//
// Les trois fonctions à connaître :
//   createCareer(setup, data)  -> state      nouvelle partie
//   current(state, data)       -> view       ce qu'il faut afficher (texte + choix), ou la fin de carrière
//   choose(state, data, index) -> result     applique un choix (réussite ou échec, effets), passe à la suite
//
// Une saison = une file d'étapes (state.queue). Types d'étapes :
//   event (une situation à choix, tirée au dernier moment), veto (choix de la map), result (tournoi),
//   minfo / mstage / mplay (le Major : entrée, phases, matchs à élimination), summary, ranking, offers.

export const VERSION = 2;
export const ATTRS = ["aim", "reflexes", "gameSense", "utility", "comms", "mental", "leadership", "clutch"];
export const ROLES = ["awper", "entry", "lurker", "support", "igl"];
export const SCORE_MAX = { level: 20, titles: 30, rank: 15, skill: 10, longevity: 10, popularity: 10, earnings: 5 };

// Poids de chaque attribut dans le niveau global, selon le rôle
const ROLE_WEIGHTS = {
    awper: { aim: 3, reflexes: 3, gameSense: 2, utility: 1, comms: 1, mental: 2, leadership: 0.5, clutch: 2 },
    entry: { aim: 3, reflexes: 3, gameSense: 1.5, utility: 1.5, comms: 1.5, mental: 2, leadership: 0.5, clutch: 1 },
    lurker: { aim: 2.5, reflexes: 2, gameSense: 3, utility: 1.5, comms: 1, mental: 2, leadership: 0.5, clutch: 3 },
    support: { aim: 1.5, reflexes: 1.5, gameSense: 2.5, utility: 3, comms: 2.5, mental: 2, leadership: 1, clutch: 1.5 },
    igl: { aim: 1, reflexes: 1, gameSense: 3, utility: 2, comms: 3, mental: 2.5, leadership: 3, clutch: 1 }
};
// Les attributs qui comptent le plus pour un rôle (mis en avant dans l'affichage)
export function keyAttrs(role) {
    const w = ROLE_WEIGHTS[role] || ROLE_WEIGHTS.entry;
    return ATTRS.filter(function (a) { return w[a] >= 2.5; });
}

// Niveau global attendu d'un joueur à chaque « marche » : 0 FACEIT, 1 tier 3, 2 tier 2, 3 tier 1
const TIER_BASE = [48, 57, 67, 78];
const step = function (tier) { return tier === 0 ? 0 : 4 - tier; }; // tier 3 -> 1, tier 2 -> 2, tier 1 -> 3
// Force d'une équipe d'après son rang mondial (1 = meilleure)
const strOf = function (rank) {
    return rank <= 20 ? 95 - (rank - 1) * 0.58 : rank <= 50 ? 83.5 - (rank - 21) * 0.4 : 71.5 - (rank - 51) * 0.17;
};
// Niveau des meilleurs du plateau, par niveau de tournoi
const LEVEL_FIELD = { s: 91, a: 81.5, b: 72.5, c: 63.5 };
const LEVEL_SCALE = { s: 2, a: 1.2, b: 0.7, c: 0.4 };
const MAJOR_STAGE = [82, 86.5, 90];       // niveau à battre pour sortir des phases 1, 2 et 3 du Major
const MAJOR_ROUND = { qf: [90, 4], sf: [91.5, 4], final: [93, 3.5] }; // adversaire : base + hasard

const PLACES = ["win", "final", "semis", "quarters", "groups"];
const PLACE_POINTS = { win: 100, final: 80, semis: 65, quarters: 48, groups: 28 };

// Pays (code ISO) -> zone. Deux joueurs de la même zone se comprennent : les équipes recrutent plus volontiers près de chez elles.
const ZONE_LIST = {
    cis: "RU UA BY KZ UZ KG TJ TM AZ AM GE MD", baltic: "LV LT EE", nordic: "SE DK NO FI IS", west: "FR BE NL LU MC",
    dach: "DE AT CH", iberia: "ES PT", uk: "GB IE", south: "IT MT GR CY", balkans: "RS BA HR SI MK ME AL XK BG RO",
    central: "PL CZ SK HU", turkey: "TR", mena: "IL SA AE EG MA TN DZ JO LB IQ IR QA KW", brazil: "BR",
    latam: "AR CL UY PE CO MX PY BO EC VE GT CR", na: "US CA", china: "CN HK TW MO", asia: "MN KR JP IN ID MY SG TH VN PH PK BD",
    oceania: "AU NZ", africa: "ZA"
};
const MACRO = {
    cis: "cis", baltic: "europe", nordic: "europe", west: "europe", dach: "europe", iberia: "europe", uk: "europe", south: "europe",
    balkans: "europe", central: "europe", turkey: "europe", mena: "asia", brazil: "southamerica", latam: "southamerica",
    na: "northamerica", china: "asia", asia: "asia", oceania: "asia", africa: "europe"
};
const ZONE = {};
Object.keys(ZONE_LIST).forEach(function (z) { ZONE_LIST[z].split(" ").forEach(function (c) { ZONE[c] = z; }); });
export function zoneOf(country) { return ZONE[String(country || "").toUpperCase()] || ""; }

const clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };
const logistic = function (x) { return 1 / (1 + Math.exp(-x)); };

// ---------- Hasard à graine (mulberry32) ----------
function rand(state) {
    state.rng = (state.rng + 0x6D2B79F5) | 0;
    let t = Math.imul(state.rng ^ (state.rng >>> 15), 1 | state.rng);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick(state, list) {
    return list[Math.floor(rand(state) * list.length)];
}
// Tirage pondéré : weights[i] = poids de list[i]
function pickWeighted(state, list, weights) {
    let total = 0;
    weights.forEach(function (w) { total += w; });
    let r = rand(state) * total, i = 0;
    while (i < list.length - 1 && r >= weights[i]) { r -= weights[i]; i++; }
    return list[i];
}
// Hasard « en cloche » autour de 0 (somme de 3 tirages), écart-type ~ sd
function noise(state, sd) {
    return (rand(state) + rand(state) + rand(state) - 1.5) * 2 * sd;
}
function fill(text, vars) {
    return String(text === undefined ? "" : text).replace(/\{(\w+)\}/g, function (all, key) { return vars[key] !== undefined ? vars[key] : all; });
}

// ---------- Lecture de l'état ----------
export function overall(state) {
    const w = ROLE_WEIGHTS[state.role];
    let sum = 0, total = 0;
    ATTRS.forEach(function (a) { sum += state.attrs[a] * w[a]; total += w[a]; });
    return Math.round(sum / total);
}
// Style du joueur : discret, entre les deux, ou showman (state.style va de -100 à 100)
export function styleOf(state) {
    return state.style <= -25 ? "discreet" : state.style >= 25 ? "showman" : "balanced";
}
// Rang mondial d'une équipe aujourd'hui dans la partie (1 = la plus forte)
export function teamRank(state, id) {
    const w = state.world[id || state.team];
    if (!w) { return 0; }
    let rank = 1;
    Object.keys(state.world).forEach(function (k) { if (state.world[k].str > w.str) { rank++; } });
    return rank;
}
function teamOf(state) {
    return state.team ? state.world[state.team] : null;
}
function teamData(data, id) {
    return data.teams.find(function (x) { return x.id === id; });
}
function teamName(data, id) {
    const t = teamData(data, id);
    return t ? t.name : id;
}
function mapName(data, id) {
    const m = data.maps.find(function (x) { return x.id === id; });
    return m ? m.name : id;
}
function tournamentOf(data, id) {
    return data.tournaments.find(function (x) { return x.id === id; });
}
function money(data, n) {
    return Math.round(n).toLocaleString(data.lang === "fr" ? "fr-FR" : "en-US");
}
// La marche qui sert de difficulté aux tests : celle de l'équipe, ou de la dernière équipe pour un joueur sans club
function diffStep(state) {
    return step(state.tier || state.lastTier || 0);
}

// ---------- Nouvelle partie ----------
export function createCareer(setup, data) {
    const state = {
        v: VERSION,
        rng: (setup.seed === undefined ? Math.floor(Math.random() * 2147483647) : setup.seed) | 0,
        name: String(setup.name || "Player").slice(0, 16),
        country: String(setup.country || "").toUpperCase(),
        role: ROLES.includes(setup.role) ? setup.role : "entry",
        favMap: "",
        age: 16,
        year: data.startYear,
        season: 0,
        tier: 0,                // 0 = pas d'équipe (FACEIT ou sans club), 3 = tier 3, 2 = tier 2, 1 = tier 1
        lastTier: 0,
        team: null,
        benched: 0,             // 0 = titulaire ; 1 = vient d'être mis sur le banc ; 2, 3 = saisons passées sur le banc
        freeSeasons: 0,         // saisons de suite sans équipe après avoir été pro
        seasonsInTeam: 0,
        elo: 0,
        attrs: {},
        potential: 0,           // plafond caché du niveau global
        chemistry: 50,          // entente dans l'équipe
        energy: 80,
        confidence: 50,
        tox: 10,                // toxicité : risque de banc et de tensions, mais parfois un coup de fouet pour l'équipe
        aura: 20,               // ce que les gens ressentent quand tu joues (clutchs, attitude, moments forts)
        pop: 5,                 // popularité
        peakPop: 5,
        style: 0,               // -100 discret ... 100 showman
        strikes: 0,             // mauvaises décisions récentes (augmentent le risque de banc)
        fans: 0,
        sponsors: 0,            // revenus de sponsors de la dernière saison
        salary: 0,              // $ par mois
        money: 0,               // gains de carrière
        titles: [],
        history: [],            // une ligne par saison
        peakOverall: 0,
        bestTier: 0,
        rank: 0,                // rang au dernier classement mondial de fin d'année
        roleRank: 0,
        bestRank: 0,
        proSeasons: 0,
        badSeasons: 0,
        crosshair: null,        // { name, slug, code } : crosshair d'un pro du site (bonus)
        flags: {},
        seen: {},               // id d'event -> dernière saison où on l'a vu
        cast: {},               // personnages fictifs qui reviennent : rival, agent, journaliste, coach, jeune
        mapCount: {},           // map -> nombre de matchs joués dessus (pour varier)
        tCount: {},             // tournoi -> nombre de participations (pour varier)
        world: {},              // id d'équipe -> { str, roster, strong: [2 maps], weak }
        pl: {},                 // pseudo d'un pro -> niveau
        queue: [],
        trail: "",              // étapes déjà passées cette saison (e = event, t = tournoi, m = Major)
        taken: [],              // events déjà sortis cette saison
        tBonus: 0,
        nextMap: null,
        perf: [],
        last: null,
        over: null
    };
    const maps = data.maps.map(function (m) { return m.id; });
    state.favMap = maps.includes(setup.favMap) ? setup.favMap : pick(state, maps);
    // Attributs de départ : un ado déjà niveau 10 FACEIT, plus fort dans ce que demande son rôle
    const w = ROLE_WEIGHTS[state.role];
    ATTRS.forEach(function (a) {
        state.attrs[a] = clamp(Math.round(35 + w[a] * 3 + rand(state) * 9), 25, 60);
    });
    state.potential = Math.round(58 + rand(state) * 18 + rand(state) * 12); // 58 à 88, le plus souvent vers 73
    state.elo = Math.round(2001 + rand(state) * 240);
    data.teams.forEach(function (t) {
        const str = Math.round(strOf(t.rank) * 10) / 10;
        const order = maps.slice();
        for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand(state) * (i + 1)); const x = order[i]; order[i] = order[j]; order[j] = x; }
        state.world[t.id] = { str: str, roster: t.roster.slice(), strong: order.slice(0, 2), weak: order[2] };
        t.roster.forEach(function (n) {
            state.pl[n] = Math.round((57 + (str - 62) * 0.95 + noise(state, 3) + (rand(state) < 0.12 ? 3 : 0)) * 10) / 10;
        });
    });
    Object.keys(data.cast || {}).forEach(function (k) { state.cast[k] = pick(state, data.cast[k]); });
    state.peakOverall = overall(state);
    startSeason(state, data);
    return state;
}

// ---------- Effets d'un choix ----------
// fx = { aim: 2, all: 1, chemistry: 5, energy: -10, confidence: 5, tox: 4, aura: 3, pop: 2, style: 10, fans: 500, fansPct: 10,
//        money: 1000, salaryPct: 10, elo: 150, potential: 1, bonus: 3, strike: 1, flag: "nom", unflag: "nom" }
// system = true : effet décidé par le moteur (résultat de tournoi...), sans la part de hasard de l'entente.
// Renvoie la liste de ce qui a changé, pour l'afficher : [{ k: "aim", d: 2 }, ...]
function apply(state, fx, system) {
    const out = [];
    if (!fx) {
        return out;
    }
    const bump = function (key, delta, lo, hi) {
        const before = state[key];
        state[key] = clamp(Math.round(before + delta), lo, hi);
        if (state[key] !== before) { out.push({ k: key, d: state[key] - before }); }
    };
    Object.keys(fx).forEach(function (key) {
        let d = fx[key];
        if (ATTRS.includes(key)) {
            const before = state.attrs[key];
            // Près de son plafond (potentiel), un gain ne rapporte plus que 1 point, et plus rien 3 points au-dessus
            const over = overall(state) - state.potential;
            const gain = d > 0 && over >= 3 ? 0 : d > 1 && over >= -2 ? 1 : d;
            state.attrs[key] = clamp(before + gain, 1, 99);
            if (state.attrs[key] !== before) { out.push({ k: key, d: state.attrs[key] - before }); }
        } else if (key === "all") {
            const room = d > 0 && overall(state) - state.potential >= 2 ? 0 : d;
            ATTRS.forEach(function (a) { state.attrs[a] = clamp(state.attrs[a] + room, 1, 99); });
            if (room) { out.push({ k: "all", d: room }); }
        } else if (key === "chemistry") {
            if (state.team) {
                // La vie d'équipe n'est pas une science exacte : l'effet varie, et parfois il se retourne
                if (!system) { d = rand(state) < 0.12 ? -d / 2 : d * (0.5 + rand(state)); }
                bump("chemistry", d, 0, 100);
            }
        } else if (key === "energy" || key === "confidence" || key === "tox" || key === "aura") {
            bump(key, d, 0, 100);
        } else if (key === "pop" || key === "reputation") {
            bump("pop", d, 0, 100);
            state.peakPop = Math.max(state.peakPop, state.pop);
        } else if (key === "style") {
            bump("style", d, -100, 100);
        } else if (key === "fans") {
            bump("fans", d, 0, 1e9);
        } else if (key === "fansPct") {
            bump("fans", Math.max(state.fans, 500) * d / 100, 0, 1e9);
        } else if (key === "money") {
            bump("money", d, 0, 1e12);
        } else if (key === "salaryPct") {
            if (state.salary) { bump("salary", state.salary * d / 100, 0, 1e9); }
        } else if (key === "elo") {
            if (!state.team) { bump("elo", d, 2001, 6000); }
        } else if (key === "potential") {
            state.potential = clamp(state.potential + d, 60, 99);
        } else if (key === "bonus") {
            state.tBonus += d;
        } else if (key === "strike") {
            state.strikes = clamp(state.strikes + d, 0, 9);
        } else if (key === "flag") {
            [].concat(d).forEach(function (f) { state.flags[f] = state.season; });
        } else if (key === "unflag") {
            [].concat(d).forEach(function (f) { delete state.flags[f]; });
        }
    });
    state.peakOverall = Math.max(state.peakOverall, overall(state));
    return out;
}

// ---------- Chance de réussir un test ----------
// test = { a: { aim: 2, reflexes: 1 }, d: 5 } : attributs (avec leur poids) et difficulté relative au niveau du tier
function chance(state, test) {
    let sum = 0, total = 0;
    Object.keys(test.a).forEach(function (a) { sum += state.attrs[a] * test.a[a]; total += test.a[a]; });
    const value = sum / total;
    const difficulty = TIER_BASE[diffStep(state)] + (test.d || 0);
    let p = 0.5 + (value - difficulty) / 50;
    p += (state.confidence - 50) / 400;
    if (state.energy < 30) { p -= 0.08; }
    if (state.crosshair) { p += 0.01; } // petit bonus de confiance du crosshair d'un pro
    if (state.nextMap && state.nextMap === state.favMap) { p += 0.05; } // sur sa map préférée
    return clamp(p, 0.07, 0.95);
}
function riskOf(p) {
    return p >= 0.7 ? "safe" : p >= 0.45 ? "even" : "risky";
}

// ---------- Tirage d'un event (au moment où il s'affiche, pour coller à la situation du joueur) ----------
function matches(state, ev, map) {
    const w = ev.when || {};
    if (w.tier && !w.tier.includes(state.tier)) { return false; }
    if (w.role && !w.role.includes(state.role)) { return false; }
    if (w.minAge && state.age < w.minAge) { return false; }
    if (w.maxAge && state.age > w.maxAge) { return false; }
    if (w.minSeasonsInTeam && state.seasonsInTeam < w.minSeasonsInTeam) { return false; }
    if (w.maxChemistry !== undefined && state.chemistry > w.maxChemistry) { return false; }
    if (w.minChemistry !== undefined && state.chemistry < w.minChemistry) { return false; }
    if (w.minElo && state.elo < w.minElo) { return false; }
    if (w.minTox !== undefined && state.tox < w.minTox) { return false; }
    if (w.maxTox !== undefined && state.tox > w.maxTox) { return false; }
    if (w.minAura && state.aura < w.minAura) { return false; }
    if ((w.minPop || w.minReputation) && state.pop < (w.minPop || w.minReputation)) { return false; }
    if (w.style && !w.style.includes(styleOf(state))) { return false; }
    if (w.free !== undefined && w.free !== !state.team) { return false; }
    if (w.flag && state.flags[w.flag] === undefined) { return false; }
    if (w.notFlag && state.flags[w.notFlag] !== undefined) { return false; }
    // flagAge: ["nom", 1] = le flag doit avoir été posé il y a au moins 1 saison
    if (w.flagAge && (state.flags[w.flagAge[0]] === undefined || state.season - state.flags[w.flagAge[0]] < w.flagAge[1])) { return false; }
    // flagAge: ["nom", 1] = le flag doit avoir été posé il y a au moins 1 saison
    if (w.flagAge && (state.flags[w.flagAge[0]] === undefined || state.season - state.flags[w.flagAge[0]] < w.flagAge[1])) { return false; }
    if (w.map && w.map !== map) { return false; }
    return true;
}
function drawEvent(state, data, types, map) {
    const base = data.events.filter(function (ev) {
        return types.includes(ev.type) && !state.taken.includes(ev.id) && matches(state, ev, map);
    });
    const fresh = function (ev, gap) {
        const seen = state.seen[ev.id];
        return seen === undefined || ev.repeat || (!ev.once && state.season - seen >= gap);
    };
    // D'abord ceux qu'on n'a pas vus depuis 6 saisons ; s'il n'y en a plus, on accepte une répétition plus proche
    let pool = base.filter(function (ev) { return fresh(ev, 6); });
    if (!pool.length) { pool = base.filter(function (ev) { return fresh(ev, 2); }); }
    if (!pool.length) {
        return null;
    }
    const weights = pool.map(function (ev) {
        return (ev.weight || 1) * (ev.when && ev.when.role ? 1.6 : 1) * (ev.when && ev.when.map ? 1.5 : 1) * (state.seen[ev.id] === undefined ? 3 : 1);
    });
    return pickWeighted(state, pool, weights);
}
// Une map pour un match : celles qu'on a le moins jouées sortent plus souvent
function pickMap(state, data) {
    const ids = data.maps.map(function (m) { return m.id; });
    // ... et celles où il reste des situations jamais vues aussi
    const unseen = {};
    data.events.forEach(function (ev) {
        if (ev.type === "match" && ev.when && ev.when.map && state.seen[ev.id] === undefined) { unseen[ev.when.map] = (unseen[ev.when.map] || 0) + 1; }
    });
    return pickWeighted(state, ids, ids.map(function (id) { return (1 + (unseen[id] || 0)) / (1 + (state.mapCount[id] || 0)); }));
}

// ---------- Début de saison : on prépare la file des étapes ----------
function startSeason(state, data) {
    state.season++;
    state.perf = [];
    state.queue = [];
    state.taken = [];
    state.trail = "";
    state.tBonus = 0;
    state.nextMap = null;
    const add = function (kind, more) { state.queue.push(Object.assign({ k: kind }, more || {})); };
    const event = function (types, more) { add("event", Object.assign({ types: types }, more || {})); };
    event(["focus"]);
    if (!state.team) {
        if (state.proSeasons === 0) { // FACEIT : court et rythmé
            event(["faceit"]); event(["faceit"]); event(rand(state) < 0.5 ? ["faceit"] : ["faceit", "culture"]);
        } else {                      // joueur sans équipe
            event(["bench"]); event(["bench", "life"]); event(["bench", "aura"]);
        }
        add("summary");
    } else if (state.benched) {
        event(["bench"]); event(["bench", "life"]); event(["bench", "aura"]);
        add("summary");
        add("ranking");
    } else {
        // À 30 ou 31 ans, l'équipe propose de devenir leader (IGL) : une seule fois
        if (state.age >= 30 && state.role !== "igl" && state.flags.iglAsked === undefined) {
            add("event", { types: ["special"], id: "igl-offer" });
        }
        event(["team"]);
        if (state.flags.iglRefused !== undefined) {
            event(["decline", "career"]);
        } else if ((state.role === "igl" && state.age >= 28) || state.flags.iglPhase !== undefined) {
            event(rand(state) < 0.6 ? ["leader"] : ["career", "life"]);
        } else {
            event(rand(state) < 0.5 ? ["career"] : ["life"]);
        }
        const list = seasonTournaments(state, data);
        list.forEach(function (t, i) {
            if (t.level === "s" || (t.level === "a" && i === 0)) { add("veto", { tid: t.id }); }
            event(["match"], { tid: t.id });
            add("result", { tid: t.id });
            if (i === 0) { event(pick(state, [["aura", "culture"], ["game", "culture"], ["aura", "life"], ["career", "team"]])); }
        });
        // Le Major : les 32 meilleures équipes du monde sont invitées (pas de qualification), les mieux classées entrent plus tard
        const rank = teamRank(state);
        const major = data.tournaments.find(function (t) { return t.major; });
        if (major && rank <= 32) {
            const entry = rank <= 8 ? 3 : rank <= 16 ? 2 : 1;
            const m = { tid: major.id, mj: true };
            add("minfo", Object.assign({ entry: entry, rank: rank }, m));
            for (let n = entry; n <= 3; n++) {
                if (n === entry) { event(["major"], Object.assign({ stage: "s" + n, alt: ["match"] }, m)); }
                add("mstage", Object.assign({ n: n }, m));
            }
            ["qf", "sf", "final"].forEach(function (round) {
                if (round === "final") { add("veto", Object.assign({ stage: round }, m)); }
                event(["match"], Object.assign({ stage: round, alt: ["major"] }, m));
                add("mplay", Object.assign({ round: round }, m));
            });
        }
        add("summary");
        add("ranking");
    }
    add("offers");
}

// Une équipe peut-elle jouer ce tournoi ? (les tournois régionaux sont réservés aux équipes de la région)
function fits(t, team) {
    if (!t.region) { return true; }
    const zone = zoneOf(team && team.country);
    if (!zone) { return t.region === "europe"; } // équipe internationale : basée en Europe
    return t.region === "nordic" ? zone === "nordic" : MACRO[zone] === t.region;
}
// Les tournois de la saison (hors Major), selon le niveau de l'équipe
function seasonTournaments(state, data) {
    const team = teamData(data, state.team);
    const levels = state.tier === 1 ? (teamRank(state) > 12 ? ["s", "a"] : ["s", "s"]) : state.tier === 2 ? ["a", "b"] : ["b", "c"];
    const out = [];
    levels.forEach(function (level) {
        const pool = data.tournaments.filter(function (t) { return t.level === level && !t.major && fits(t, team) && !out.includes(t); });
        if (!pool.length) { return; }
        // Les tournois de sa région sortent plus souvent, ceux déjà joués moins souvent
        const t = pickWeighted(state, pool, pool.map(function (x) { return (x.region ? 2.5 : 1) / (1 + (state.tCount[x.id] || 0)); }));
        state.tCount[t.id] = (state.tCount[t.id] || 0) + 1;
        out.push(t);
    });
    return out;
}

// ---------- Les mots à remplacer dans un texte ----------
function vars(state, data, s) {
    const team = teamOf(state);
    const v = { name: state.name, age: state.age, year: state.year, team: state.team ? teamName(data, state.team) : "", elo: money(data, state.elo) };
    if (team) {
        const mates = team.roster.filter(function (n) { return n !== state.name; });
        v.mate = mates.length ? pick(state, mates) : "";
    }
    // Un adversaire du même niveau (tier 3 depuis FACEIT), et un de ses joueurs
    const tier = state.tier || state.lastTier || 3;
    const rivals = data.teams.filter(function (t) { return t.tier === tier && t.id !== state.team; });
    if (rivals.length) {
        const rival = pick(state, rivals);
        v.rival = rival.name;
        const roster = state.world[rival.id].roster;
        v.star = roster.length ? pick(state, roster) : "";
    }
    if (s.tid) {
        const t = tournamentOf(data, s.tid);
        v.tournament = t ? t.name : "";
    }
    // La map du match, et deux positions (callouts) de cette map
    const mapId = s.map || state.nextMap || state.favMap;
    const map = data.maps.find(function (m) { return m.id === mapId; });
    if (map) {
        v.map = map.name;
        const spots = (map.callouts || []).slice();
        if (spots.length > 1) {
            v.spot = spots.splice(Math.floor(rand(state) * spots.length), 1)[0];
            v.spot2 = pick(state, spots);
        }
    }
    v.fav = mapName(data, state.favMap);
    // Les personnages fictifs qui suivent le joueur toute sa carrière
    v.rv = state.cast.rival || ""; v.agent = state.cast.agent || ""; v.journalist = state.cast.journalist || "";
    v.coach = state.cast.coach || ""; v.rookie = state.cast.rookie || "";
    return v;
}

// ---------- Préparer l'étape en cours (une seule fois) ----------
function prepare(state, data) {
    for (let guard = 0; guard < 60; guard++) {
        const s = state.queue[0];
        if (!s || s.ready) {
            return;
        }
        if (s.k === "event") {
            // La map d'un match : celle du veto, sinon une map tirée au sort
            if (s.tid && !state.nextMap) { state.nextMap = pickMap(state, data); }
            const map = s.tid ? state.nextMap : null;
            let ev = s.id ? data.events.find(function (x) { return x.id === s.id; }) : drawEvent(state, data, s.types, map);
            if (!ev && s.alt) { ev = drawEvent(state, data, s.alt, map); }
            if (!ev) { state.queue.shift(); continue; } // rien d'adapté : on saute l'étape
            s.id = ev.id;
            s.map = map;
            state.taken.push(ev.id);
        }
        s.ready = true;
        s.v = vars(state, data, s);
        if (s.k === "veto") {
            s.o = vetoOptions(state, data);
            s.banned = s.o.banned; // (une propriété posée sur un tableau ne survit pas à la sauvegarde)
        } else if (s.k === "result") {
            s.r = resolveTournament(state, data, s);
        } else if (s.k === "mstage") {
            s.r = resolveStage(state, data, s);
        } else if (s.k === "mplay") {
            s.r = resolvePlayoff(state, data, s);
        } else if (s.k === "summary") {
            s.r = endOfSeason(state, data);
        } else if (s.k === "ranking") {
            s.r = ranking(state, data);
        } else if (s.k === "offers") {
            s.o = makeOffers(state, data);
        }
        return;
    }
}

// ---------- Force de l'équipe sur un match ----------
function matchPower(state, map, noisy) {
    const team = teamOf(state);
    let p = team.str * 0.72 + overall(state) * 0.28;
    p += (state.chemistry - 50) * 0.09 + (state.confidence - 50) * 0.03 + (state.energy < 30 ? -1.5 : 0);
    if (map) {
        if (team.strong.includes(map)) { p += 1.5; }
        if (team.weak === map) { p -= 1.5; }
        if (map === state.favMap) { p += 1; }
        state.mapCount[map] = (state.mapCount[map] || 0) + 1;
    }
    // La toxicité est à double tranchant : le plus souvent elle coûte, parfois elle réveille tout le monde
    let tox = null;
    if (state.tox >= 45) {
        const size = (state.tox - 45) / 55;
        if (rand(state) < 0.38) { p += 1 + 2 * size; tox = "up"; } else { p -= 1 + 2 * size; tox = "down"; }
    }
    p += clamp(state.tBonus, -4, 4) * 0.7;
    if (noisy) { p += noise(state, 5); }
    state.tBonus = 0;       // le bonus des situations de match ne sert qu'une fois
    state.nextMap = null;
    return { p: p, tox: tox };
}

// ---------- Choix de la map avant un gros match ----------
function vetoOptions(state, data) {
    const team = teamOf(state);
    const strong = pick(state, team.strong.filter(function (m) { return m !== state.favMap; }));
    const others = data.maps.map(function (m) { return m.id; }).filter(function (id) { return id !== team.weak && id !== strong && id !== state.favMap; });
    const out = [{ key: "vetoStrong", map: strong, fx: { chemistry: 2 } }];
    // Quatre fois sur dix, l'adversaire bannit ta map préférée : il reste une map surprise
    const banned = rand(state) < 0.4;
    if (banned) {
        const surprise = others.splice(Math.floor(rand(state) * others.length), 1)[0];
        out.push({ key: "vetoSurprise", map: surprise, fx: { confidence: 2, chemistry: -1, bonus: 1 } });
    } else {
        const favKey = team.strong.includes(state.favMap) ? "vetoFavStrong" : team.weak === state.favMap ? "vetoFavWeak" : "vetoFav";
        out.push({ key: favKey, map: state.favMap, fx: favKey === "vetoFavStrong" ? { confidence: 3, chemistry: 2 } : favKey === "vetoFavWeak" ? { confidence: 3, chemistry: -3 } : { confidence: 3, chemistry: -1 } });
    }
    out.push({ key: "vetoStaff", map: pick(state, others), fx: { chemistry: 3, energy: 2, bonus: 1 } });
    out.banned = banned;
    return out;
}

// ---------- Résultat d'un tournoi ----------
function resolveTournament(state, data, s) {
    const t = tournamentOf(data, s.tid);
    const m = matchPower(state, s.map || null, true);
    const diff = m.p - LEVEL_FIELD[t.level];
    const place = diff > 7 ? "win" : diff > 3.5 ? "final" : diff > 0 ? "semis" : diff > -5 ? "quarters" : "groups";
    state.perf.push(PLACE_POINTS[place]);
    const i = PLACES.indexOf(place);
    const scale = LEVEL_SCALE[t.level];
    const prize = Math.round(t.prize * [1, 0.45, 0.2, 0.09, 0.02][i] / 5 / 100) * 100; // part du joueur
    const fx = {
        money: prize,
        fans: Math.round([9000, 4000, 1800, 700, 150][i] * scale * (0.7 + rand(state) * 0.6)),
        pop: Math.round([5, 3, 2, 0, -1][i] * scale / 1.4),
        aura: i === 0 ? Math.round(2 * scale) : 0,
        confidence: [10, 5, 2, -2, -6][i],
        chemistry: [6, 3, 1, -1, -4][i],
        energy: -8
    };
    if (place === "win") {
        state.titles.push({ name: t.name, year: state.year, major: false, level: t.level });
    }
    return { place: place, prize: prize, tox: m.tox, changes: apply(state, fx, true) };
}

// ---------- Le Major ----------
// Quand l'équipe est éliminée, on retire de la file tout ce qui restait du Major
function dropMajor(state) {
    state.queue = state.queue.filter(function (x, i) { return i === 0 || !x.mj; });
}
function majorPrize(state, data, share) {
    const t = data.tournaments.find(function (x) { return x.major; });
    return Math.round(t.prize * share / 5 / 100) * 100;
}
// Une phase (format suisse : il faut 3 victoires avant 3 défaites)
function resolveStage(state, data, s) {
    const m = matchPower(state, null, false);
    const ok = rand(state) < logistic((m.p - MAJOR_STAGE[s.n - 1]) / 3.5);
    const record = ok ? pick(state, ["3-0", "3-1", "3-1", "3-2", "3-2"]) : pick(state, ["2-3", "2-3", "1-3", "1-3", "0-3"]);
    let fx;
    if (ok) {
        fx = { confidence: 4, chemistry: 2, pop: s.n, fans: Math.round(2500 * s.n * (0.7 + rand(state) * 0.6)), energy: -4 };
    } else {
        state.perf.push(s.n === 3 ? 55 : s.n === 2 ? 42 : 30);
        fx = { confidence: -5, chemistry: -3, energy: -6, money: majorPrize(state, data, [0.004, 0.008, 0.016][s.n - 1]) };
        dropMajor(state);
    }
    return { ok: ok, record: record, tox: m.tox, changes: apply(state, fx, true) };
}
// Un match à élimination directe (quart, demie, finale)
function resolvePlayoff(state, data, s) {
    const map = s.map || state.nextMap || null;
    const m = matchPower(state, map, false);
    const round = MAJOR_ROUND[s.round];
    const opp = round[0] + rand(state) * round[1];
    const ok = rand(state) < logistic((m.p - opp) / 4);
    // L'adversaire affiché : une vraie équipe du top mondial (résultat de fiction)
    const tops = data.teams.filter(function (t) { return t.id !== state.team; })
        .sort(function (a, b) { return state.world[b.id].str - state.world[a.id].str; }).slice(0, 10);
    const oppName = pick(state, tops).name;
    const score = ok ? pick(state, ["2-0", "2-1", "2-1"]) : pick(state, ["0-2", "1-2", "1-2"]);
    let fx;
    if (ok && s.round === "final") {
        state.perf.push(100);
        state.titles.push({ name: tournamentOf(data, s.tid).name, year: state.year, major: true, level: "s" });
        state.flags.majorWon = state.season;
        fx = { money: majorPrize(state, data, 0.4), fans: Math.round(60000 * (0.8 + rand(state) * 0.5)), pop: 12, aura: 10, confidence: 15, chemistry: 10, energy: -10 };
    } else if (ok) {
        fx = { fans: Math.round((s.round === "sf" ? 14000 : 8000) * (0.7 + rand(state) * 0.6)), pop: s.round === "sf" ? 4 : 3, aura: 2, confidence: 6, chemistry: 3, energy: -5 };
    } else {
        state.perf.push(s.round === "final" ? 88 : s.round === "sf" ? 76 : 66);
        fx = { money: majorPrize(state, data, s.round === "final" ? 0.14 : s.round === "sf" ? 0.07 : 0.035), pop: s.round === "final" ? 4 : 1, confidence: -4, chemistry: -2, energy: -8 };
        dropMajor(state);
    }
    return { ok: ok, opp: oppName, score: score, tox: m.tox, changes: apply(state, fx, true) };
}

// ---------- Fin de saison : progression, âge, popularité, risque de banc, monde qui évolue ----------
function endOfSeason(state, data) {
    const before = overall(state);
    const age = state.age;
    // Progression naturelle vers le plafond (potentiel), forte jusqu'à 22 ans, nulle après 27
    const growth = age <= 19 ? 0.20 : age <= 22 ? 0.15 : age <= 25 ? 0.08 : age <= 27 ? 0.03 : 0;
    const gap = state.potential - before;
    const refused = state.flags.iglRefused !== undefined;
    const leading = state.role === "igl";
    ATTRS.forEach(function (a) {
        let d = gap > 0 ? gap * growth * (0.6 + rand(state) * 0.8) : 0;
        // L'âge : les réflexes et la visée baissent après 27 ans ; le sens du jeu et le leadership continuent de monter
        if (age >= 27 && (a === "aim" || a === "reflexes")) { d -= (age - 26) * (0.7 + rand(state) * 0.9); }
        if (age >= 29 && a !== "gameSense" && a !== "leadership" && a !== "comms") { d -= 0.5 + rand(state); }
        if (age >= 26 && (a === "gameSense" || a === "leadership")) { d += 0.6; }
        // Refuser de devenir leader à 30 ans : on s'accroche à un rôle de tireur, et le corps suit de moins en moins
        if (refused && (a === "aim" || a === "reflexes")) { d -= 2.5 + rand(state) * 1.5; }
        // Le leader mûrit : il lit mieux le jeu chaque année
        if (leading && age >= 28 && (a === "leadership" || a === "gameSense" || a === "comms")) { d += 1 + rand(state); }
        state.attrs[a] = clamp(Math.round(state.attrs[a] + d), 1, 99);
    });
    const after = overall(state);
    state.peakOverall = Math.max(state.peakOverall, after);
    let rating = clamp(50 + (after - TIER_BASE[diffStep(state)]) * 2.6, 0, 100);
    let kind = "faceit";
    let fame = 0;
    let benchedNow = false;
    if (state.team && !state.benched) {
        kind = "team";
        const results = state.perf.length ? state.perf.reduce(function (n, x) { return n + x; }, 0) / state.perf.length : 40;
        rating = clamp(Math.round(rating * 0.55 + results * 0.45 + (state.chemistry - 50) * 0.1), 0, 100);
        state.proSeasons++;
        state.money += state.salary * 12;
        state.badSeasons = rating < 38 ? state.badSeasons + 1 : 0;
        fame = [0, 62, 42, 22][state.tier] + (rating - 50) * 0.3;
        // Risque d'être mis sur le banc : mauvaise saison, mauvaise entente, toxicité, mauvaises décisions répétées
        let risk = Math.max(0, 36 - rating) * 0.01 + Math.max(0, 32 - state.chemistry) * 0.008 + Math.max(0, state.tox - 55) * 0.007
            + Math.max(0, state.strikes - 1) * 0.06 + (state.badSeasons >= 2 ? 0.2 : 0);
        if (state.seasonsInTeam === 0) { risk /= 2; }
        if (age < 36 && rand(state) < risk) { state.benched = 1; benchedNow = true; }
        state.seasonsInTeam++;
    } else if (state.team) {
        kind = "bench";
        rating = 30;
        state.proSeasons++;
        state.seasonsInTeam++;
        state.money += state.salary * 6; // sur le banc : la moitié du salaire
        state.benched++;
        fame = [0, 50, 32, 16][state.tier];
        apply(state, { pop: -4 }, true);
    } else if (state.proSeasons > 0) {
        kind = "free";
        state.freeSeasons++;
        fame = 12;
        apply(state, { pop: -5 }, true);
    } else {
        fame = 4 + (state.elo - 2000) / 160;
    }
    if (!state.team) {
        // FACEIT : l'Elo suit le niveau de jeu
        state.elo = clamp(Math.round(state.elo + (after - 40) * 60 + noise(state, 150)), 2001, 6000);
    }
    rating = Math.round(rating);
    // Popularité : elle suit les résultats (fame) et l'aura ; un showman en tire plus qu'un joueur discret
    const majors = state.titles.filter(function (t) { return t.major; }).length;
    fame += Math.min(20, majors * 8 + (state.titles.length - majors) * 2) + (state.rank && state.rank <= 20 ? 8 : 0);
    const target = clamp(Math.max(0.45 * state.aura + 0.55 * fame, fame * 0.85) * (1 + state.style / 500), 0, 100);
    state.pop = clamp(Math.round(state.pop + (target - state.pop) * 0.4), 0, 100);
    state.peakPop = Math.max(state.peakPop, state.pop);
    state.fans = Math.round(state.fans + state.pop * state.pop * 12 * (0.7 + rand(state) * 0.6));
    state.sponsors = state.pop >= 30 ? Math.round(Math.pow(state.pop - 25, 2) * (state.aura / 50) * 25 * (1 + state.style / 400) / 100) * 100 : 0;
    state.money += state.sponsors;
    // La toxicité retombe un peu avec le temps, mais elle use l'entente tant qu'elle est haute
    if (state.tox > 55 && state.team) { state.chemistry = clamp(state.chemistry - 4, 0, 100); }
    state.tox = clamp(state.tox - 4, 0, 100);
    state.strikes = Math.max(0, state.strikes - 1);
    state.history.push({ season: state.season, year: state.year, age: age, tier: state.tier, team: state.team, kind: kind, overall: after, rating: rating, elo: state.elo, rank: 0 });
    state.lastRating = rating;
    state.age++;
    state.year++;
    state.energy = clamp(state.energy + 30, 0, 100);
    evolveWorld(state, data);
    return { kind: kind, before: before, after: after, rating: rating, benched: benchedNow, sponsors: state.sponsors };
}

// Le monde bouge (fictif après la 1re saison) : les équipes et les joueurs montent ou descendent un peu, quelques transferts
function evolveWorld(state, data) {
    data.teams.forEach(function (t) {
        const w = state.world[t.id];
        w.str = clamp(Math.round((w.str + noise(state, 1.6)) * 10) / 10, 50, 97);
    });
    Object.keys(state.pl).forEach(function (n) {
        state.pl[n] = Math.round((state.pl[n] + noise(state, 1.2)) * 10) / 10;
    });
    for (let n = 0; n < 12; n++) {
        const a = pick(state, data.teams), b = pick(state, data.teams);
        if (a.id === b.id || Math.abs(a.tier - b.tier) > 1 || a.id === state.team || b.id === state.team) { continue; }
        const ra = state.world[a.id].roster, rb = state.world[b.id].roster;
        if (!ra.length || !rb.length) { continue; }
        const i = Math.floor(rand(state) * ra.length), j = Math.floor(rand(state) * rb.length);
        const x = ra[i]; ra[i] = rb[j]; rb[j] = x;
    }
}

// ---------- Classement mondial de fin d'année (fiction : il dépend de la partie) ----------
function ranking(state, data) {
    const info = {};
    data.pros.forEach(function (p) { info[p.name] = p; });
    const rows = [];
    data.teams.forEach(function (t) {
        const w = state.world[t.id];
        w.roster.forEach(function (n) {
            if (n === state.name) { return; }
            const level = state.pl[n] === undefined ? 57 + (w.str - 62) * 0.95 : state.pl[n];
            const p = info[n] || {};
            rows.push({ name: n, team: t.name, country: p.country || "", role: p.role || "", s: level + w.str * 0.08 + noise(state, 1.2) });
        });
    });
    // Un titre gagné dans l'année pèse dans le classement, un Major encore plus
    const won = state.titles.filter(function (t) { return t.year === state.year - 1; });
    const trophies = Math.min(4, won.length + (won.some(function (t) { return t.major; }) ? 2 : 0));
    const mine = overall(state) + (state.lastRating - 50) * 0.1 + (state.pop + state.aura) / 70 + teamOf(state).str * 0.08 + trophies - (state.benched ? 6 : 0);
    rows.push({ name: state.name, team: teamName(data, state.team), country: state.country, role: state.role, s: mine, me: true });
    rows.sort(function (a, b) { return b.s - a.s; });
    const show = function (r, i) {
        return { rank: i + 1, name: r.name, team: r.team, country: r.country, rating: Math.round((0.7 + (r.s - 60) / 70) * 100) / 100, me: Boolean(r.me) };
    };
    const all = rows.map(show);
    const role = rows.filter(function (r) { return r.role === state.role; }).map(show);
    const me = all.find(function (r) { return r.me; });
    const meRole = role.find(function (r) { return r.me; });
    state.rank = me.rank;
    state.roleRank = meRole.rank;
    state.bestRank = state.bestRank ? Math.min(state.bestRank, me.rank) : me.rank;
    const h = state.history[state.history.length - 1];
    if (h) { h.rank = me.rank; }
    return { year: state.year - 1, total: all.length, rank: me.rank, roleRank: meRole.rank, role: state.role, top: all.slice(0, 20), me: me, roleTop: role.slice(0, 10), meRole: meRole };
}

// ---------- Offres de fin de saison ----------
function salaryFor(state, tier) {
    const o = overall(state);
    const base = tier === 1 ? 14000 + (o - 70) * 1500 : tier === 2 ? 5000 + (o - 60) * 420 : 1500 + (o - 50) * 130;
    return Math.max(tier === 1 ? 9000 : tier === 2 ? 3500 : 1000, Math.round(base * (1 + state.pop / 200) / 100) * 100);
}
// Proximité entre le joueur et une équipe : même pays, même zone, même grande région
function near(state, t) {
    if (!t.country) { return 1.5; } // équipe internationale : ouverte à tous
    if (t.country === state.country) { return 14; }
    const a = zoneOf(state.country), b = zoneOf(t.country);
    if (a && a === b) { return 6; }
    if (a && b && MACRO[a] === MACRO[b]) { return 2; }
    return 0.4;
}
function makeOffers(state, data) {
    const o = overall(state);
    const offers = [];
    // where : "top" = les meilleures du tier peuvent venir, "low" = plutôt le bas du classement, "any" = tout le tier
    const from = function (tier, where) {
        const list = data.teams.filter(function (t) { return t.tier === tier && t.id !== state.team && !offers.some(function (x) { return x.team === t.id; }); })
            .sort(function (a, b) { return state.world[b.id].str - state.world[a.id].str; });
        const pool = where === "low" ? list.slice(Math.floor(list.length / 3)) : where === "top" ? list.slice(0, Math.ceil(list.length * 0.6)) : list;
        if (!pool.length) { return; }
        const t = pickWeighted(state, pool, pool.map(function (x) { return near(state, x); }));
        offers.push({ team: t.id, tier: tier, salary: salaryFor(state, tier), country: t.country || "" });
    };
    const res = { offers: offers, mode: "team", canReturn: false, canStay: true, canRetire: state.age >= 29, mustStop: state.age >= 36 };
    if (!state.team && state.proSeasons === 0) {
        // FACEIT : repéré grâce à l'Elo, au niveau de jeu ou à un event ; à 18 ans, presque tout le monde reçoit un appel
        res.mode = "faceit";
        const scouted = state.elo >= 3000 || o >= 55 || state.flags.scouted !== undefined || (state.age >= 18 && (state.elo >= 2600 || rand(state) < 0.6));
        if (scouted) {
            if (state.elo >= 4200 && o >= 63) { from(2, "low"); } // le prodige : une équipe tier 2 tente le coup
            from(3, state.elo >= 3600 ? "any" : "low");
            if (rand(state) < 0.55) { from(3, "low"); }
        }
    } else if (!state.team) {
        res.mode = "free";
        const tier = clamp(state.lastTier || 3, 1, 3);
        // Un essai réussi pendant l'année (event) garantit une offre
        if (state.flags.scouted === state.season) { from(o >= TIER_BASE[step(tier)] - 4 ? tier : Math.min(3, tier + 1), "low"); }
        // Un essai réussi pendant l'année (event) garantit une offre
        if (state.flags.scouted === state.season) { from(o >= TIER_BASE[step(tier)] - 4 ? tier : Math.min(3, tier + 1), "low"); }
        if (o >= TIER_BASE[step(tier)] - 4 && rand(state) < 0.45) { from(tier, "low"); }
        if (tier < 3 && o >= TIER_BASE[step(tier + 1)] - 5 && rand(state) < 0.7) { from(tier + 1, "any"); }
        if (tier === 3 && o >= TIER_BASE[1] - 6 && rand(state) < 0.6) { from(3, "low"); }
    } else if (state.benched) {
        res.mode = state.benched === 1 ? "benchedNow" : "bench";
        // Revenir titulaire : il faut l'avoir mérité pendant la saison sur le banc (event réussi), ou un peu de chance
        res.canReturn = state.benched >= 2 && (state.flags.benchBack !== undefined || rand(state) < clamp(0.25 + (o - TIER_BASE[step(state.tier)]) * 0.03, 0.08, 0.6));
        res.canStay = state.benched < 3; // deux saisons sur le banc au maximum
        if (o >= TIER_BASE[step(state.tier)] - 3 && rand(state) < 0.5) { from(state.tier, "low"); }
        if (state.tier < 3) { from(state.tier + 1, "top"); if (rand(state) < 0.4) { from(state.tier + 1, "any"); } }
        else if (rand(state) < 0.6) { from(3, "low"); }
    } else {
        const rating = state.lastRating;
        const next = state.tier - 1;
        if (next >= 1 && rating >= 66 && o >= TIER_BASE[step(next)] - 3) {
            from(next, rating >= 84 && o >= TIER_BASE[step(next)] + 5 ? "top" : "low");
            if (rating >= 78 && rand(state) < 0.5) { from(next, "low"); }
        }
        // Une meilleure équipe du même tier ; un joueur populaire attire plus d'offres
        if (rating >= 72 && rand(state) < 0.4 + state.pop / 300) { from(state.tier, "top"); }
    }
    return res;
}

function sign(state, data, offer) {
    const world = state.world[offer.team];
    // Le joueur prend la place d'un titulaire (de préférence celui qui a son rôle)
    const sameRole = data.pros.filter(function (p) { return p.role === state.role && world.roster.includes(p.name); }).map(function (p) { return p.name; });
    const out = sameRole.length ? pick(state, sameRole) : pick(state, world.roster);
    if (state.team) {
        const old = state.world[state.team];
        old.roster = old.roster.map(function (n) { return n === state.name ? out : n; }); // échange
    }
    world.roster = world.roster.map(function (n) { return n === out ? state.name : n; });
    world.str = Math.round((world.str + (overall(state) - world.str) * 0.12) * 10) / 10;
    state.team = offer.team;
    state.tier = offer.tier;
    state.lastTier = offer.tier;
    state.salary = offer.salary;
    state.seasonsInTeam = 0;
    state.chemistry = 50;
    state.badSeasons = 0;
    state.benched = 0;
    state.freeSeasons = 0;
    state.strikes = 0;
    delete state.flags.benchBack;
    state.bestTier = state.bestTier === 0 ? offer.tier : Math.min(state.bestTier, offer.tier);
}
function leaveTeam(state) {
    if (state.team) {
        const old = state.world[state.team];
        old.roster = old.roster.filter(function (n) { return n !== state.name; });
    }
    state.lastTier = state.tier || state.lastTier;
    state.team = null;
    state.tier = 0;
    state.salary = 0;
    state.seasonsInTeam = 0;
    state.benched = 0;
    delete state.flags.benchBack;
}

// ---------- Ce qu'il faut afficher ----------
// Renvoie { kind: "choice" | "info" | "ranking" | "end", tag, tagLabel, chips, title, text, verdict, verdictText, changes,
//           progress, ranking, choices: [{ text, risk, tests, country }] }
function progressOf(state) {
    const rest = state.queue.map(function (x) { return x.k === "result" ? "t" : x.k === "mstage" || x.k === "mplay" ? "m" : "e"; });
    return { done: state.trail.length, steps: state.trail.split("").concat(rest) };
}
function toxLine(S, tox) {
    return tox === "up" ? " " + S.toxUp : tox === "down" ? " " + S.toxDown : "";
}
export function current(state, data) {
    if (state.over) {
        return { kind: "end", over: state.over };
    }
    if (!state.queue.length) {
        startSeason(state, data);
    }
    prepare(state, data);
    if (!state.queue.length) { // ne devrait pas arriver : toute saison finit par les offres
        startSeason(state, data);
        prepare(state, data);
    }
    const s = state.queue[0];
    const S = data.s;
    const t = s.tid ? tournamentOf(data, s.tid) : null;
    const next = [{ text: S.next, risk: null }];
    const view = { kind: "info", tag: s.k, chips: [], title: "", text: "", choices: next, progress: progressOf(state), season: fill(S.seasonTitle, { n: state.season, year: state.year, age: state.age }), major: Boolean(s.mj) };
    if (t) { view.chips.push(t.major ? S.tags.major : t.name); }
    if (s.stage) { view.chips.push(S.stages[s.stage]); }

    if (s.k === "event") {
        const ev = data.events.find(function (x) { return x.id === s.id; });
        if (s.map) { view.chips.push(mapName(data, s.map)); }
        view.kind = "choice";
        view.tag = s.mj ? "major" : ev.type;
        view.title = t ? t.name : "";
        view.text = fill(ev.text, s.v);
        // Le nom du tournoi est déjà dans le titre : on l'enlève du début du texte (« IEM Rio, Nuke, côté CT. » -> « Nuke, côté CT. »)
        if (t && view.text.indexOf(t.name) === 0) {
            const rest = view.text.slice(t.name.length).replace(/^[,.]\s*/, "");
            view.text = rest.charAt(0).toUpperCase() + rest.slice(1);
        }
        view.choices = ev.choices.map(function (c) {
            return { text: fill(c.text, s.v), risk: c.test ? riskOf(chance(state, c.test)) : null, tests: c.test ? Object.keys(c.test.a) : [] };
        });
    } else if (s.k === "veto") {
        const team = teamOf(state);
        view.kind = "choice";
        view.tag = "veto";
        view.title = t.name;
        view.text = fill(S.veto + (s.banned ? " " + S.vetoBanned : ""), Object.assign({}, s.v, { strong: team.strong.map(function (m) { return mapName(data, m); }).join(", "), weak: mapName(data, team.weak) }));
        view.choices = s.o.map(function (o) { return { text: fill(S[o.key], { map: mapName(data, o.map) }), risk: null, tests: [] }; });
    } else if (s.k === "result") {
        view.tag = "tournament";
        view.title = t.name;
        view.text = fill(S.result[s.r.place], s.v) + (s.r.prize ? " " + fill(S.prize, { prize: money(data, s.r.prize) }) : "") + toxLine(S, s.r.tox);
        view.verdict = s.r.place === "win" || s.r.place === "final" ? "ok" : s.r.place === "groups" ? "ko" : null;
        view.verdictText = S.places[s.r.place];
        view.changes = s.r.changes;
    } else if (s.k === "minfo") {
        view.tag = "major";
        view.title = t.name;
        view.text = fill(S.majorIntro[s.entry], Object.assign({ rank: s.rank }, s.v));
        view.choices = [{ text: S.play, risk: null }];
    } else if (s.k === "mstage") {
        view.tag = "major";
        view.title = t.name;
        view.chips.push(S.stages["s" + s.n]);
        view.text = fill(s.r.ok ? (s.n === 3 ? S.stageToPlayoffs : S.stageThrough) : S.stageOut, Object.assign({ record: s.r.record, stage: S.stages["s" + s.n] }, s.v)) + toxLine(S, s.r.tox);
        view.verdict = s.r.ok ? "ok" : "ko";
        view.verdictText = s.r.ok ? S.qualified : S.eliminated;
        view.changes = s.r.changes;
    } else if (s.k === "mplay") {
        view.tag = "major";
        view.title = t.name;
        view.chips.push(S.stages[s.round]);
        const key = s.r.ok ? (s.round === "final" ? "majorWon" : "playoffWin") : (s.round === "final" ? "majorFinalLost" : "playoffLost");
        view.text = fill(S[key], Object.assign({ opp: s.r.opp, score: s.r.score, round: S.stages[s.round] }, s.v)) + toxLine(S, s.r.tox);
        view.verdict = s.r.ok ? "ok" : "ko";
        view.verdictText = s.r.ok ? (s.round === "final" ? S.champion : S.qualified) : S.eliminated;
        view.changes = s.r.changes;
    } else if (s.k === "summary") {
        const h = state.history[state.history.length - 1];
        const key = { faceit: "summaryFaceit", free: "summaryFree", bench: "summaryBench", team: "summaryTeam" }[s.r.kind];
        view.tag = "season";
        view.title = fill(S.seasonTitle, { n: h.season, year: h.year, age: h.age });
        view.season = view.title;
        view.text = fill(S[key], { age: h.age, year: h.year, team: h.team ? teamName(data, h.team) : "", elo: money(data, h.elo), before: s.r.before, after: s.r.after, rating: s.r.rating, salary: money(data, state.salary * (s.r.kind === "bench" ? 6 : 12)) })
            + (s.r.sponsors ? " " + fill(S.sponsorIncome, { sponsors: money(data, s.r.sponsors) }) : "");
    } else if (s.k === "ranking") {
        view.kind = "ranking";
        view.tag = "ranking";
        view.title = fill(S.rankingTitle, { year: s.r.year });
        view.text = fill(S.rankingText, { rank: s.r.rank, total: s.r.total, roleRank: s.r.roleRank });
        view.ranking = s.r;
    } else {
        offersView(state, data, s, view);
    }
    return view;
}
function offersView(state, data, s, view) {
    const S = data.s;
    const o = s.o;
    const v = s.v;
    if (o.mustStop) { o.offers = []; } // à 36 ans, plus de nouveau contrat : c'est la retraite
    const choices = o.offers.map(function (x, i) {
        return { text: fill(S.offerSign, { team: teamName(data, x.team), tier: x.tier, rank: teamRank(state, x.team), salary: money(data, x.salary) }), risk: null, tests: [], act: "sign", o: i, country: x.country, team: x.team };
    });
    const push = function (key, act) { choices.push({ text: fill(S[key], v), risk: null, tests: [], act: act }); };
    let text;
    if (o.mode === "faceit") {
        text = o.offers.length ? S.offersFaceit : S.offersNone;
        if (!o.mustStop) { push("stayFaceit", "stay"); }
    } else if (o.mode === "free") {
        text = o.offers.length ? S.offersFreeSome : S.offersFreeAgent;
        if (!o.mustStop) { push("stayFree", "stay"); }
    } else if (o.mode === "benchedNow") {
        text = fill(S.benchedNow, v) + " " + (o.offers.length ? S.benchOffers : S.benchNoOffers);
        view.verdict = "ko";
        view.verdictText = S.benchedTitle;
        if (!o.mustStop) { push("benchStay", "stay"); push("benchLeave", "leave"); }
    } else if (o.mode === "bench") {
        text = fill(o.canReturn ? S.benchReturnText : (o.canStay ? S.benchStillText : S.benchEndText), v) + (o.offers.length ? " " + S.benchOffers : "");
        if (!o.mustStop) {
            if (o.canReturn) { choices.unshift({ text: fill(S.benchReturn, v), risk: null, tests: [], act: "return" }); }
            else if (o.canStay) { push("benchStay", "stay"); }
            push("benchLeave", "leave");
        }
    } else {
        text = fill(o.offers.length ? S.offersTeam : S.offersQuiet, v);
        if (!o.mustStop) { push("stayTeam", "stay"); }
    }
    if (o.canRetire || o.mustStop) {
        text += " " + (o.mustStop ? S.mustRetire : S.canRetire);
        push("retire", "retire");
    }
    view.kind = "choice";
    view.tag = "offers";
    view.text = text;
    view.choices = choices;
}

// ---------- Appliquer un choix ----------
// Renvoie { text, success (true / false / null), changes: [{ k, d }] }
export function choose(state, data, index) {
    const view = current(state, data);
    const s = state.queue[0];
    if (view.kind === "end" || !view.choices[index]) {
        return null;
    }
    const S = data.s;
    let result = { text: "", success: null, changes: [] };
    if (s.k === "event") {
        const ev = data.events.find(function (x) { return x.id === s.id; });
        const c = ev.choices[index];
        state.seen[ev.id] = state.season;
        if (c.test) {
            const ok = rand(state) < chance(state, c.test);
            const branch = ok ? c.win : c.lose;
            result = { text: fill(branch.text || "", s.v), success: ok, changes: apply(state, branch.fx) };
        } else {
            result = { text: fill(c.result || "", s.v), success: null, changes: apply(state, c.fx) };
        }
        // Devenir leader (IGL) : le rôle change pour le reste de la carrière
        if (c.act === "igl") { state.role = "igl"; state.peakOverall = Math.max(state.peakOverall, overall(state)); }
    } else if (s.k === "veto") {
        const o = s.o[index];
        state.nextMap = o.map;
        result = { text: fill(S.vetoDone, { map: mapName(data, o.map) }), success: null, changes: apply(state, o.fx) };
    } else if (s.k === "offers") {
        const c = view.choices[index];
        if (c.act === "sign") {
            const offer = s.o.offers[c.o];
            sign(state, data, offer);
            result.text = fill(S.signed, { team: teamName(data, offer.team), salary: money(data, offer.salary) });
        } else if (c.act === "leave") {
            leaveTeam(state);
            result.text = S.left;
        } else if (c.act === "return") {
            state.benched = 0;
            state.badSeasons = 0;
            state.chemistry = 48;
            delete state.flags.benchBack;
            result = { text: fill(S.returned, s.v), success: true, changes: apply(state, { confidence: 8 }, true) };
        } else if (c.act === "retire") {
            finish(state, "retired");
        } else if (c.act === "stay" && state.team && !state.benched && state.lastRating >= 55) {
            result.changes = apply(state, { salaryPct: 8, chemistry: 3 }, true);
            result.text = S.stayed;
        } else if (c.act === "stay" && state.benched) {
            result.text = S.benchStayed;
        }
    }
    state.trail += s.k === "result" ? "t" : s.k === "mstage" || s.k === "mplay" ? "m" : "e";
    state.queue.shift();
    // Fins de parcours sans retraite choisie
    if (!state.over && !state.queue.length) {
        if (!state.team && state.proSeasons === 0 && state.age >= 21) {
            finish(state, "neverPro");
        } else if (!state.team && state.freeSeasons >= 2) {
            finish(state, "forgotten");
        } else if (state.age >= 38) {
            finish(state, "retired");
        }
    }
    state.last = result.text || result.changes.length ? result : null;
    return result;
}

// ---------- Fin de carrière et note sur 100 ----------
export function score(state) {
    const count = function (level) { return state.titles.filter(function (t) { return !t.major && t.level === level; }).length; };
    const majors = state.titles.filter(function (t) { return t.major; }).length;
    const r = state.bestRank;
    const parts = {
        level: state.bestTier === 1 ? 20 : state.bestTier === 2 ? 13 : state.bestTier === 3 ? 6 : 0,
        titles: Math.min(30, Math.round(majors * 10 + count("s") * 4 + count("a") * 2.5 + count("b") * 1.5 + count("c") * 0.75)),
        rank: !r ? 0 : r === 1 ? 15 : r <= 3 ? 13 : r <= 5 ? 12 : r <= 10 ? 10 : r <= 20 ? 8 : r <= 50 ? 5 : r <= 100 ? 3 : r <= 200 ? 1 : 0,
        skill: clamp(Math.round((state.peakOverall - 50) / 40 * 10), 0, 10),
        longevity: Math.min(10, Math.round(state.proSeasons * 0.7)),
        popularity: clamp(Math.round(state.peakPop / 10), 0, 10),
        earnings: clamp(Math.round((Math.log10(state.money + 1) - 4) * 2), 0, 5)
    };
    let total = 0;
    Object.keys(parts).forEach(function (k) { total += parts[k]; });
    return { total: clamp(total, 0, 100), parts: parts, majors: majors, titles: state.titles.length };
}
function finish(state, reason) {
    const sc = score(state);
    state.over = { reason: reason, score: sc.total, parts: sc.parts, majors: sc.majors, titles: sc.titles, age: state.age, year: state.year, bestRank: state.bestRank };
    state.queue = [];
}
