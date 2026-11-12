// career-sim.js : joue des carrières de « Zero to Major » automatiquement, pour équilibrer le jeu
// Lancer avec : node career-sim.js [nombre] [stratégie]     (ex. node career-sim.js 300 prudent)
// Stratégies : hasard (clique au hasard), prudent (prend le choix le plus sûr), audacieux (prend le plus risqué),
//              malin (le plus sûr, signe la meilleure offre, se repose quand il est fatigué). Sans stratégie : les quatre.
// N'écrit rien : affiche la répartition des notes finales et des classements. Outil de travail, pas publié sur le site.
const { assemble } = require("./career-src/assemble.js");

const COUNT = Number(process.argv[2]) || 100;
const ONLY = process.argv[3] || "";
const RISK = { safe: 0, even: 1, risky: 2 };
const COUNTRIES = ["FR", "BR", "RU", "US", "SE", "DE", "TR", "CN", "PL", "DK"];
const BROKEN = /\{\w+\}|undefined|NaN/;

function choice(view, policy, state, rnd) {
    const n = view.choices.length;
    const find = function (act) { return view.choices.findIndex(function (c) { return c.act === act; }); };
    if (policy === "hasard") {
        // Ne jamais prendre sa retraite par hasard avant 31 ans (sinon les carrières s'arrêtent trop tôt)
        const ok = view.choices.map(function (c, i) { return i; }).filter(function (i) { return view.choices[i].act !== "retire" || state.age >= 31; });
        return ok[Math.floor(rnd() * ok.length)];
    }
    if (view.tag === "offers") {
        if (find("retire") !== -1 && (state.age >= 34 || n === 1)) { return find("retire"); }
        const order = ["return", "sign", "stay", "leave"];
        for (let i = 0; i < order.length; i++) {
            if (find(order[i]) !== -1) { return find(order[i]); }
        }
        return 0;
    }
    if (view.tag === "focus") {
        return policy === "malin" ? (state.energy < 40 ? n - 1 : Math.floor(rnd() * (n - 1))) : Math.floor(rnd() * n);
    }
    let best = 0, bestScore = -1;
    view.choices.forEach(function (c, i) {
        const r = c.risk === null ? 1 : RISK[c.risk];
        const s = (policy === "audacieux" ? r : 2 - r) + rnd() * 0.5;
        if (s > bestScore) { bestScore = s; best = i; }
    });
    return best;
}

async function main() {
    const engine = await import("./career-engine.js");
    const data = assemble("en");
    const policies = ONLY ? [ONLY] : ["hasard", "prudent", "audacieux", "malin"];
    const types = {};
    data.events.forEach(function (ev) { types[ev.type] = (types[ev.type] || 0) + 1; });
    console.log(data.events.length + " events " + JSON.stringify(types) + ", " + data.teams.length + " équipes, " + COUNT + " carrières par stratégie\n");
    policies.forEach(function (policy) {
        const scores = [], ranks = [];
        const stats = { pro: 0, t2: 0, t1: 0, title: 0, major: 0, steps: 0, seasons: 0, ages: 0, bench: 0, igl: 0, same: 0, repeats: 0, events: 0 };
        const reasons = {};
        const repTypes = {};
        for (let n = 0; n < COUNT; n++) {
            let seed = 1000 + n * 7919;
            const rnd = function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
            const country = COUNTRIES[n % COUNTRIES.length];
            const state = engine.createCareer({ name: "Sim" + n, country: country, role: engine.ROLES[n % 5], seed: n * 104729 + 17 }, data);
            const startRole = state.role;
            let steps = 0, benched = false, sameCountry = 0, signs = 0;
            const seenIds = {};
            while (!state.over && steps < 4000) {
                const view = engine.current(state, data);
                if (view.kind === "end") { break; }
                const all = view.text + " " + view.choices.map(function (c) { return c.text; }).join(" / ");
                if (!view.text || BROKEN.test(all)) {
                    throw new Error("Texte incomplet (graine " + n + ", étape " + state.queue[0].k + " " + (state.queue[0].id || "") + ") : " + all);
                }
                if (view.kind === "choice" && !["offers", "focus", "veto"].includes(view.tag)) {
                    stats.events++;
                    const id = state.queue[0].id;
                    if (seenIds[id]) { stats.repeats++; repTypes[view.tag] = (repTypes[view.tag] || 0) + 1; }
                    seenIds[id] = true;
                }
                if (state.benched) { benched = true; }
                const index = choice(view, policy, state, rnd);
                const c = view.choices[index];
                if (c.act === "sign") { signs++; if (c.country === country) { sameCountry++; } }
                const res = engine.choose(state, data, index);
                if (res && BROKEN.test(res.text)) { throw new Error("Résultat incomplet (graine " + n + ") : " + res.text); }
                steps++;
            }
            if (!state.over) { throw new Error("Carrière sans fin (graine " + n + ", stratégie " + policy + ")"); }
            JSON.parse(JSON.stringify(state)); // la sauvegarde doit rester un simple objet
            scores.push(state.over.score);
            if (state.bestRank) { ranks.push(state.bestRank); }
            reasons[state.over.reason] = (reasons[state.over.reason] || 0) + 1;
            if (state.proSeasons) { stats.pro++; }
            if (state.bestTier && state.bestTier <= 2) { stats.t2++; }
            if (state.bestTier === 1) { stats.t1++; }
            if (state.titles.length) { stats.title++; }
            if (state.over.majors) { stats.major++; }
            if (benched) { stats.bench++; }
            if (state.role === "igl" && startRole !== "igl") { stats.igl++; }
            if (signs) { stats.same += sameCountry / signs; }
            stats.steps += steps; stats.seasons += state.season; stats.ages += state.over.age;
        }
        scores.sort(function (a, b) { return a - b; });
        const pct = function (x) { return Math.round(x / COUNT * 100) + " %"; };
        const q = function (p) { return scores[Math.min(scores.length - 1, Math.floor(p * scores.length))]; };
        const mean = Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / COUNT);
        console.log("== " + policy);
        console.log("   note : moyenne " + mean + " | médiane " + q(0.5) + " | min " + scores[0] + " | 10 % " + q(0.1) + " | 90 % " + q(0.9) + " | max " + scores[scores.length - 1]);
        const bands = [0, 20, 40, 60, 80].map(function (lo, i) { const hi = [20, 40, 60, 80, 101][i]; return lo + "-" + Math.min(100, hi - 1) + " : " + pct(scores.filter(function (s) { return s >= lo && s < hi; }).length); });
        console.log("   tranches : " + bands.join(" | "));
        const under = function (r) { return pct(ranks.filter(function (x) { return x <= r; }).length); };
        console.log("   meilleur rang mondial : n°1 " + under(1) + " | top 5 " + under(5) + " | top 20 " + under(20) + " | top 100 " + under(100) + " | top 300 " + under(300));
        console.log("   devient pro " + pct(stats.pro) + " | atteint le tier 2 " + pct(stats.t2) + " | le tier 1 " + pct(stats.t1) + " | au moins un titre " + pct(stats.title) + " | un Major " + pct(stats.major));
        console.log("   passe par le banc " + pct(stats.bench) + " | devient IGL vers 30 ans " + pct(stats.igl) + " | signatures dans une équipe de son pays " + Math.round(stats.same / Math.max(1, stats.pro) * 100) + " %");
        console.log("   en moyenne : " + Math.round(stats.steps / COUNT) + " écrans, " + Math.round(stats.seasons / COUNT) + " saisons, fin à " + Math.round(stats.ages / COUNT) + " ans | situations revues dans la même carrière : " + Math.round(stats.repeats / Math.max(1, stats.events) * 100) + " % | fins : " + JSON.stringify(reasons));
        console.log("   répétitions par type (pour 100 carrières) : " + Object.keys(repTypes).map(function (k) { return k + " " + Math.round(repTypes[k] / COUNT * 100); }).join(", ") + "\n");
    });
}

main().catch(function (error) { console.error(error); process.exit(1); });
