// build.js : génère une page HTML par joueur + le sitemap pour Google
// Lancer avec : node build.js

const fs = require("fs");

const SITE_URL = "https://antonnisthomas13-sudo.github.io/ClutchCrosshair";

// Transforme un nom en adresse propre : "ZywOo" -> "zywoo"
function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

const players = JSON.parse(fs.readFileSync("players.json", "utf8"));

if (!fs.existsSync("players")) {
    fs.mkdirSync("players");
}

// Une page par joueur
players.forEach(function (player) {
    const page = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${player.name} CS2 Crosshair Code (2026) | ClutchCrosshair</title>
    <meta name="description" content="Copy ${player.name}'s latest CS2 crosshair code (${player.team}). Updated ${player.updated}. One click to copy and import in Counter-Strike 2.">
    <link rel="canonical" href="${SITE_URL}/players/${slug(player.name)}.html">
    <link rel="stylesheet" href="../style.css">
</head>
<body>
    <header>
        <a href="../index.html" class="back-link">← All CS2 crosshairs</a>
    </header>
    <main class="player-page">
        <h1>${player.name} CS2 Crosshair</h1>
        <p class="modal-team">${player.team}</p>
        <p class="modal-date">Last update: ${player.updated}</p>
        <p class="modal-code" id="code">${player.code}</p>
        <button id="copy">Copy crosshair</button>
        <h2>How to use ${player.name}'s crosshair in CS2</h2>
        <p>Click Copy, then in CS2 go to Settings › Game › Crosshair and import the code.</p>
    </main>
    <footer>
        <p>© 2026 ClutchCrosshair. All rights reserved.</p>
    </footer>
    <script>
        document.getElementById("copy").addEventListener("click", function () {
            navigator.clipboard.writeText(document.getElementById("code").textContent);
            this.textContent = "Copied!";
        });
    </script>
</body>
</html>`;

    fs.writeFileSync("players/" + slug(player.name) + ".html", page);
});

// Le sitemap : la liste de toutes les pages, pour Google
let urls = `    <url><loc>${SITE_URL}/</loc></url>\n`;
players.forEach(function (player) {
    urls += `    <url><loc>${SITE_URL}/players/${slug(player.name)}.html</loc></url>\n`;
});

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>
`;
fs.writeFileSync("sitemap.xml", sitemap);

console.log(players.length + " pages joueurs créées + sitemap.xml");