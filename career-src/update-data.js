// career-src/update-data.js : met à jour les vraies équipes et les vrais joueurs du jeu « Zero to Major »
// Lancer avec : node career-src/update-data.js   (puis node build.js)
//               node career-src/update-data.js --refresh   (redemande toutes les fiches à Liquipedia)
//
// 1. ÉQUIPES ET EFFECTIFS : le classement mondial officiel de Valve (dépôt public GitHub
//    ValveSoftware/counter-strike_regional_standings), dernière version publiée.
//    Tier 1 = rangs 1 à 20, tier 2 = 21 à 50, tier 3 = 51 à 150.
// 2. RÔLE ET PAYS DES JOUEURS : les fiches Liquipedia, par leur accès officiel (api.php), en respectant leurs conditions :
//    une demande toutes les 2 secondes au plus, un « User-Agent » qui nous identifie, réponses compressées,
//    50 fiches par demande, et on ne redemande pas ce qu'on a déjà (liquipedia-cache.json, gardé 7 jours).
//    Contenu sous licence CC-BY-SA 3.0 : la page du jeu cite Liquipedia comme source. HLTV n'est jamais interrogé.
// 3. PAYS DE L'ÉQUIPE : celui de la majorité de ses joueurs (sinon équipe internationale).
// Un joueur dont la fiche est introuvable, ou dont la fiche parle d'une autre équipe (homonyme), garde seulement son
// pseudo : on n'invente ni rôle ni pays.
const fs = require("fs");
const path = require("path");

const UA = "ClutchCrosshairBot/1.0 (https://clutchcrosshair.com; clutchcrosshair@gmail.com)";
const VALVE_LIST = "https://api.github.com/repos/ValveSoftware/counter-strike_regional_standings/contents/live/";
const VALVE_RAW = "https://raw.githubusercontent.com/ValveSoftware/counter-strike_regional_standings/main/live/";
const LIQUIPEDIA = "https://liquipedia.net/counterstrike/api.php";
const CACHE = path.join(__dirname, "liquipedia-cache.json");
const TIERS = [[1, 20, 1], [21, 50, 2], [51, 150, 3]];
// Rôles de Liquipedia -> rôles du jeu (« rifle » seul ne dit pas lequel : on garde « rifler »)
const ROLES = { awp: "awper", igl: "igl", entry: "entry", lurk: "lurker", support: "support", rifle: "rifler" };

const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
const slug = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };
// « Team Vitality » et « Vitality » désignent la même équipe : on compare sans les mots passe-partout
const core = function (s) { return String(s).toLowerCase().replace(/\b(team|esports?|gaming|clan|e-sports)\b/g, "").replace(/[^a-z0-9]/g, ""); };

// Nom de pays en anglais (Liquipedia) -> code ISO à 2 lettres (pour les drapeaux et les régions du jeu)
const countryKey = function (n) { return String(n).toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, ""); };
const ISO = {};
(function () {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    for (let a = 65; a <= 90; a++) {
        for (let b = 65; b <= 90; b++) {
            const code = String.fromCharCode(a, b);
            let name = code;
            try { name = names.of(code); } catch (error) { /* code inconnu */ }
            // Le premier code gagne : « FR » avant l'ancien « FX », « GB » avant « UK »
            if (name && name !== code && !ISO[countryKey(name)]) { ISO[countryKey(name)] = code; }
        }
    }
    const more = { russia: "RU", turkey: "TR", czechrepublic: "CZ", macedonia: "MK", northmacedonia: "MK", kosovo: "XK", southkorea: "KR",
        korea: "KR", hongkong: "HK", macau: "MO", taiwan: "TW", palestine: "PS", ivorycoast: "CI", myanmar: "MM", vietnam: "VN", moldova: "MD",
        iran: "IR", syria: "SY", laos: "LA", brunei: "BN", capeverde: "CV", england: "GB", scotland: "GB", wales: "GB", usa: "US",
        unitedstates: "US", unitedkingdom: "GB", uk: "GB", bosniaandherzegovina: "BA", serbia: "RS", france: "FR", germany: "DE" };
    Object.keys(more).forEach(function (k) { ISO[k] = more[k]; });
})();
const iso = function (name) { return ISO[countryKey(name)] || ""; };

function field(text, name) {
    const m = String(text).match(new RegExp("\\|\\s*" + name + "\\s*=\\s*([^\\n|]*)"));
    return m ? m[1].trim() : "";
}

async function get(url, json) {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip" } });
    if (!res.ok) {
        throw new Error(res.status + " pour " + url);
    }
    return json ? res.json() : res.text();
}

async function main() {
    // --- 1. Le dernier classement de Valve ---
    const year = String(new Date().getFullYear());
    let dir = year;
    let files = await get(VALVE_LIST + dir, true);
    let globals = files.map(function (f) { return f.name; }).filter(function (n) { return /^standings_global_/.test(n); }).sort();
    if (!globals.length) { // tout début d'année : pas encore de classement, on prend l'année d'avant
        dir = String(Number(year) - 1);
        files = await get(VALVE_LIST + dir, true);
        globals = files.map(function (f) { return f.name; }).filter(function (n) { return /^standings_global_/.test(n); }).sort();
    }
    const file = globals[globals.length - 1];
    const date = file.replace("standings_global_", "").replace(".md", "").split("_").reverse().join("/"); // JJ/MM/AAAA
    const rows = (await get(VALVE_RAW + dir + "/" + file)).split("\n").filter(function (l) { return /^\|\s*\d+/.test(l); })
        .map(function (l) { return l.split("|").map(function (s) { return s.trim(); }); });
    const teams = [];
    rows.forEach(function (r) {
        const rank = Number(r[1]);
        const tier = TIERS.find(function (t) { return rank >= t[0] && rank <= t[1]; });
        if (tier && !teams.some(function (t) { return t.id === slug(r[3]); })) {
            teams.push({ id: slug(r[3]), name: r[3], rank: rank, points: Number(r[2]), tier: tier[2], roster: r[4].split(",").map(function (s) { return s.trim(); }).filter(Boolean) });
        }
    });
    console.log("Classement Valve du " + date + " : " + teams.length + " équipes (" + file + ")");

    // --- 2. Les fiches Liquipedia : seulement celles qu'on n'a pas déjà (ou vieilles de plus de 7 jours) ---
    const players = [];
    teams.forEach(function (t) { t.roster.forEach(function (name) { players.push({ name: name, team: t.id, teamName: t.name }); }); });
    const cache = fs.existsSync(CACHE) && !process.argv.includes("--refresh") ? JSON.parse(fs.readFileSync(CACHE, "utf8")) : { pages: {}, alias: {} };
    const known = function (name) {
        const c = cache.pages[cache.alias[name] || name];
        return c && Date.now() - c.at < 7 * 86400000;
    };
    const todo = players.filter(function (p) { return !known(p.name); });
    console.log("Fiches à demander à Liquipedia : " + todo.length + " (les autres sont déjà en mémoire)");
    for (let i = 0; i < todo.length; i += 50) {
        const batch = todo.slice(i, i + 50);
        const url = LIQUIPEDIA + "?action=query&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1&titles="
            + encodeURIComponent(batch.map(function (p) { return p.name; }).join("|"));
        const data = await get(url, true);
        const alias = {}; // titre demandé -> titre final (majuscule initiale, redirections)
        (data.query.normalized || []).concat(data.query.redirects || []).forEach(function (n) { alias[n.from] = n.to; });
        (data.query.pages || []).forEach(function (p) {
            const text = p.revisions ? p.revisions[0].slots.main.content : "";
            // On ne garde que les 3 champs utiles de la fiche
            cache.pages[p.title] = { at: Date.now(), team: field(text, "team"), roles: field(text, "roles"), country: field(text, "nationality") || field(text, "country") };
        });
        batch.forEach(function (p) {
            let title = p.name;
            for (let k = 0; k < 3 && alias[title]; k++) { title = alias[title]; }
            cache.alias[p.name] = title;
        });
        console.log("  Liquipedia : " + Math.min(i + 50, todo.length) + " / " + todo.length);
        await sleep(2500);
    }
    fs.writeFileSync(CACHE, JSON.stringify(cache));

    let withRole = 0, unknown = 0;
    const pros = players.map(function (p) {
        const page = cache.pages[cache.alias[p.name] || p.name];
        const out = { name: p.name, team: p.team };
        // La fiche doit être celle du bon joueur : même équipe que dans le classement de Valve
        if (page && page.team && (core(page.team).includes(core(p.teamName)) || core(p.teamName).includes(core(page.team)))) {
            const roles = String(page.roles).split(",").map(function (r) { return ROLES[r.trim().toLowerCase()]; }).filter(Boolean);
            const main = roles.find(function (r) { return r !== "rifler"; }) || roles[0];
            if (main) { out.role = main; withRole++; }
            if (iso(page.country)) { out.country = iso(page.country); } // code ISO (ex. "FR")
        } else {
            unknown++;
        }
        return out;
    });

    // --- 3. Pays de l'équipe : 3 joueurs du même pays, ou tous les joueurs connus (au moins 2) du même pays ---
    teams.forEach(function (t) {
        const count = {};
        pros.filter(function (p) { return p.team === t.id && p.country; }).forEach(function (p) { count[p.country] = (count[p.country] || 0) + 1; });
        const best = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; })[0];
        const total = Object.keys(count).reduce(function (n, k) { return n + count[k]; }, 0);
        if (best && (count[best] >= 3 || (count[best] >= 2 && count[best] === total))) { t.country = best; }
    });

    fs.writeFileSync(path.join(__dirname, "teams.json"), JSON.stringify({
        about: "Équipes du jeu Zero to Major. Source : classement mondial officiel de Valve (github.com/ValveSoftware/counter-strike_regional_standings). country = pays de la majorité des joueurs (code ISO). Fabriqué par career-src/update-data.js : ne pas modifier à la main.",
        updated: date, teams: teams
    }, null, 1) + "\n");
    fs.writeFileSync(path.join(__dirname, "pros.json"), JSON.stringify({
        about: "Joueurs des équipes du jeu. Effectifs : classement de Valve. Rôle et pays : Liquipedia (CC-BY-SA 3.0). Fabriqué par career-src/update-data.js : ne pas modifier à la main.",
        updated: date, pros: pros
    }, null, 1) + "\n");
    console.log(pros.length + " joueurs ; rôle trouvé pour " + withRole + " ; fiche introuvable ou autre équipe pour " + unknown);
}

main().catch(function (error) {
    console.error("Erreur : " + error.message);
    process.exit(1);
});
