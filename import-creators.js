// import-creators.js : met à jour les CRÉATEURS de contenu à partir de creators.csv (à relancer chaque mois)
// Lancer avec : node import-creators.js            (puis il lance node build.js tout seul)
//               node import-creators.js --no-build (seulement players.json)
//
// creators.csv : colonnes Pseudo, Profil FACEIT, Code crosshair, Date de mise à jour, Notes
// (séparateur virgule ou point-virgule : les deux marchent, comme l'export d'Excel ou de Google Sheets)
// - Code vérifié avec la librairie du site : il doit être au format CS2 (commence par CS, sans tirets).
//   Les anciens codes CSGO-xxxxx ne s'importent plus dans CS2 depuis le 30/09/2026 : refusés.
// - Date : celle du tableau si elle est remplie (JJ/MM/AAAA), sinon la date du jour quand le code change.
// - Personne n'est supprimé automatiquement : les créateurs absents du tableau sont seulement signalés.

const fs = require("fs");
const { execSync } = require("child_process");

const CSV_FILE = "creators.csv";
const PLAYERS_FILE = "players.json";

function today() {
    const d = new Date();
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}

// Lit un fichier CSV simple (gère les guillemets, le BOM d'Excel, virgule ou point-virgule)
function parseCsv(text) {
    text = text.replace(/^﻿/, "");
    const firstLine = text.split(/\r?\n/)[0];
    const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
    const rows = [];
    let row = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') { quoted = false; }
            else { cell += ch; }
        } else if (ch === '"') {
            quoted = true;
        } else if (ch === sep) {
            row.push(cell); cell = "";
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") { i++; }
            row.push(cell); rows.push(row); row = []; cell = "";
        } else {
            cell += ch;
        }
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.map(function (r) { return r.map(function (c) { return c.trim(); }); });
}

// Lien FACEIT propre : https://www.faceit.com/en/players/<pseudo> (sans /fr, sans /cs2 à la fin)
function faceitUrl(value) {
    const m = String(value || "").match(/faceit\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?players\/([^/?#\s]+)/i);
    return m ? "https://www.faceit.com/en/players/" + m[1] : "";
}

function validDate(value) {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(value || "") ? value : "";
}

async function main() {
    if (!fs.existsSync(CSV_FILE)) {
        console.log("Fichier " + CSV_FILE + " introuvable : exporte ton tableau en CSV dans le dossier du site.");
        process.exit(1);
    }
    const { decodeCrosshairShareCode } = await import("./lib/csgo-sharecode.js");
    const rows = parseCsv(fs.readFileSync(CSV_FILE, "utf8"));
    const header = rows.shift().map(function (h) { return h.toLowerCase(); });
    const col = function (word) { return header.findIndex(function (h) { return h.includes(word); }); };
    const iName = col("pseudo"), iFaceit = col("faceit"), iCode = col("code"), iDate = col("date");
    if (iName < 0 || iCode < 0) {
        console.log("Colonnes « Pseudo » et « Code crosshair » introuvables dans la première ligne du CSV.");
        process.exit(1);
    }

    const raw = fs.readFileSync(PLAYERS_FILE, "utf8");
    const players = JSON.parse(raw);
    const report = { added: [], updated: [], same: [], rejected: [], noFaceit: [] };
    const seen = new Set();

    rows.forEach(function (r) {
        const name = r[iName] || "";
        if (!name) {
            return; // ligne vide
        }
        const code = (r[iCode] || "").replace(/\s+/g, "");
        const url = iFaceit >= 0 ? faceitUrl(r[iFaceit]) : "";
        const date = iDate >= 0 ? validDate(r[iDate]) : "";
        seen.add(name.toLowerCase());

        // Vérification du code
        let problem = "";
        if (!code) {
            problem = "code vide";
        } else if (/^CSGO-/i.test(code)) {
            problem = "ancien code CSGO- (ne marche plus dans CS2 depuis le 30/09/2026) : copie un code récent";
        } else if (!/^CS[A-Za-z0-9]+$/.test(code)) {
            problem = "le code doit commencer par CS, sans espace ni tiret";
        } else {
            try {
                if (decodeCrosshairShareCode(code).format === "legacy-v1") {
                    problem = "ancien format de code";
                }
            } catch (error) {
                problem = "code invalide (impossible à décoder) : recopie-le";
            }
        }
        if (problem) {
            report.rejected.push(name + " : " + problem);
            return;
        }
        if (!url) {
            report.noFaceit.push(name);
        }

        const existing = players.find(function (p) { return p.name.toLowerCase() === name.toLowerCase(); });
        if (existing && existing.category === "pro") {
            report.rejected.push(name + " : ce nom est déjà celui d'un joueur pro du site (change le pseudo dans le tableau)");
            return;
        }
        if (!existing) {
            const player = { name: name, team: "Creator", category: "creator", code: code, updated: date || today(), trending: false };
            if (url) {
                player.faceit = url;
            }
            players.push(player);
            report.added.push(name);
            return;
        }
        const changed = existing.code !== code;
        existing.name = name;
        existing.team = "Creator";
        existing.category = "creator";
        existing.code = code;
        delete existing.country; // les créateurs n'ont pas de pays
        if (url) {
            existing.faceit = url;
        } else {
            delete existing.faceit;
        }
        if (changed || (date && date !== existing.updated)) {
            existing.updated = date || today();
        }
        (changed ? report.updated : report.same).push(name);
    });

    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, raw.includes("\n    ") ? 4 : 2) + "\n");

    const missing = players.filter(function (p) { return p.category === "creator" && !seen.has(p.name.toLowerCase()); }).map(function (p) { return p.name; });
    console.log("Créateurs ajoutés (" + report.added.length + ") : " + (report.added.join(", ") || "-"));
    console.log("Codes mis à jour (" + report.updated.length + ") : " + (report.updated.join(", ") || "-"));
    console.log("Inchangés (" + report.same.length + ") : " + (report.same.join(", ") || "-"));
    console.log("Sans profil FACEIT (pas de bouton) : " + (report.noFaceit.join(", ") || "-"));
    if (missing.length) {
        console.log("Sur le site mais absents du tableau (gardés, à supprimer à la main si besoin) : " + missing.join(", "));
    }
    console.log(report.rejected.length ? "\nCODES À CORRIGER (" + report.rejected.length + ", pas ajoutés) :\n  - " + report.rejected.join("\n  - ") : "\nTous les codes sont valides.");

    if (!process.argv.includes("--no-build")) {
        console.log("\nFabrication des pages (node build.js)...");
        execSync("node build.js", { stdio: "inherit" });
    }
}

main();
