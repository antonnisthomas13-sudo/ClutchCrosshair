// faceit-test.js : TEST — peut-on récupérer le code crosshair d'un créateur avec l'API officielle FACEIT ?
// Lancer avec : node faceit-test.js PSEUDO_FACEIT
// La clé est lue dans le fichier .env (FACEIT_API_KEY=...), jamais affichée, jamais envoyée sur GitHub.
// Seulement l'API officielle documentée : https://open.faceit.com/data/v4 (+ l'API officielle de téléchargement des démos).

const fs = require("fs");

function readKey() {
    if (!fs.existsSync(".env")) {
        return "";
    }
    const line = fs.readFileSync(".env", "utf8").split(/\r?\n/).find(function (l) { return /^FACEIT_API_KEY=/.test(l.trim()); });
    return line ? line.trim().slice("FACEIT_API_KEY=".length).trim() : "";
}

const KEY = readKey();
const NICKNAME = process.argv[2];
const API = "https://open.faceit.com/data/v4";
const OUT = "faceit-test";

if (!KEY) {
    console.log("Pas de clé : ouvre le fichier .env, colle ta clé après FACEIT_API_KEY= et enregistre.");
    process.exit(1);
}
if (!NICKNAME) {
    console.log("Utilisation : node faceit-test.js PSEUDO_FACEIT");
    process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

async function get(path, file) {
    const response = await fetch(API + path, { headers: { Authorization: "Bearer " + KEY, Accept: "application/json" } });
    const text = await response.text();
    if (file) {
        fs.writeFileSync(OUT + "/" + file, text);
    }
    if (!response.ok) {
        throw new Error("FACEIT a répondu " + response.status + " pour " + path.split("?")[0] + (response.status === 401 ? " (clé refusée : vérifie le fichier .env)" : ""));
    }
    return JSON.parse(text);
}

// Cherche un code crosshair ou un champ "crosshair" n'importe où dans une réponse
function findCrosshair(label, data) {
    const text = JSON.stringify(data);
    const codes = (text.match(/\bCSGO(-[A-Za-z0-9]{5}){5}\b|\bCS[A-Za-z0-9]{40,50}\b/g) || []);
    const keys = [];
    (function walk(value, path) {
        if (value && typeof value === "object") {
            Object.keys(value).forEach(function (k) {
                if (/crosshair/i.test(k)) {
                    keys.push(path + k);
                }
                walk(value[k], path + k + ".");
            });
        }
    })(data, "");
    console.log("  " + label.padEnd(34) + (codes.length ? "CODE TROUVÉ : " + codes.slice(0, 3).join(", ") : "aucun code crosshair") + (keys.length ? " | champs « crosshair » : " + keys.slice(0, 5).join(", ") : ""));
    return codes.length > 0 || keys.length > 0;
}

(async function () {
    console.log("Test FACEIT pour « " + NICKNAME + " » (API officielle Data v4)\n");
    let found = false;

    const player = await get("/players?nickname=" + encodeURIComponent(NICKNAME) + "&game=cs2", "1-joueur.json");
    console.log("Joueur trouvé : " + player.nickname + " (niveau CS2 : " + ((player.games && player.games.cs2 && player.games.cs2.skill_level) || "?") + ")");
    found = findCrosshair("Profil du joueur", player) || found;

    const history = await get("/players/" + player.player_id + "/history?game=cs2&offset=0&limit=5", "2-derniers-matchs.json");
    const matches = history.items || [];
    console.log(matches.length + " derniers matchs CS2 récupérés");
    found = findCrosshair("Historique des matchs", history) || found;
    if (!matches.length) {
        console.log("\nAucun match CS2 récent : essaie avec un autre créateur.");
        return;
    }

    const id = matches[0].match_id;
    const details = await get("/matches/" + id, "3-details-match.json");
    found = findCrosshair("Détails du dernier match", details) || found;
    const stats = await get("/matches/" + id + "/stats", "4-stats-match.json");
    found = findCrosshair("Statistiques détaillées", stats) || found;

    // Champs de statistiques disponibles pour un joueur (pour voir ce que l'API donne vraiment)
    const me = (stats.rounds || []).flatMap(function (r) { return r.teams || []; }).flatMap(function (t) { return t.players || []; })
        .find(function (p) { return p.player_id === player.player_id; });
    if (me) {
        console.log("\nStatistiques fournies pour " + player.nickname + " : " + Object.keys(me.player_stats || {}).join(", "));
    }

    // Piste 2 : la démo du match (lisible par notre robot read_demo.py, comme pour les pros)
    const demo = (details.demo_url || [])[0];
    console.log("\nLien de démo dans les détails du match : " + (demo ? "OUI" : "non"));
    if (demo) {
        const response = await fetch("https://open.faceit.com/download/v2/demos/download-url", {
            method: "POST",
            headers: { Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ resource_url: demo })
        });
        fs.writeFileSync(OUT + "/5-telechargement-demo.json", await response.text());
        console.log("API officielle de téléchargement des démos : " + (response.ok ? "ACCÈS OK (la démo peut être téléchargée)" : "refusée (" + response.status + ") : il faut demander l'accès à FACEIT"));
    }

    console.log("\nRÉSULTAT : " + (found ? "un code crosshair (ou un champ crosshair) apparaît dans l'API officielle." : "aucun code crosshair dans les réponses de l'API officielle Data."));
    console.log("Réponses brutes enregistrées dans le dossier " + OUT + "/ (pas envoyé sur GitHub).");
})().catch(function (error) {
    console.log("\nErreur : " + error.message);
});
