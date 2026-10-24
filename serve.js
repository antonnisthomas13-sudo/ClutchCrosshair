// serve.js : petit serveur pour tester le site sur le PC, qui se comporte comme Cloudflare Pages
// (remplace Live Server, qui ne sait pas ouvrir les adresses sans « .html » écrites par build.js) :
//   /players/donk        → players/donk.html
//   /tools/              → tools/index.html
//   /players/donk.html   → redirection vers /players/donk (comme en ligne)
//   /tools               → redirection vers /tools/
//   adresse inconnue     → 404.html
// Lancer avec : node serve.js   puis ouvrir http://127.0.0.1:5500   (Ctrl+C pour arrêter)
// Pas de rechargement automatique : après une modification, relancer node build.js puis actualiser la page (F5).

const fs = require("fs");
const path = require("path");
const http = require("http");

const PORT = 5500;
const ROOT = __dirname;
// Sécurité : le dossier du projet contient des secrets (clé CSFloat, .env, .git) qui ne doivent jamais sortir.
// Seules les demandes adressées à cette adresse sont servies : une page web malveillante qui se ferait passer
// pour 127.0.0.1 (« DNS rebinding ») envoie son propre nom de site et reçoit un refus.
const HOSTS = ["127.0.0.1:" + PORT, "localhost:" + PORT];
// Jamais servis : fichiers et dossiers cachés (.env, .git, .claude…) et fichiers secrets ignorés par Git
const SECRET = /(^|\/)\.|(^|\/)(csfloat-key\.txt|faceit-test)(\/|$)/i;
const TYPES = {
    ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
    ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
    ".woff2": "font/woff2", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
    ".webmanifest": "application/manifest+json"
};

function isFile(file) {
    return fs.existsSync(file) && fs.statSync(file).isFile();
}

function send(res, status, file) {
    res.writeHead(status, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(fs.readFileSync(file));
}

function redirect(res, location) {
    res.writeHead(308, { "Location": location });
    res.end();
}

const server = http.createServer(function (req, res) {
    if (!HOSTS.includes(String(req.headers.host || "").toLowerCase())) {
        res.writeHead(403);
        return res.end();
    }
    const url = new URL(req.url, "http://localhost");
    let p;
    try {
        p = decodeURIComponent(url.pathname);
    } catch (error) {
        res.writeHead(400);
        return res.end();
    }
    const file = path.join(ROOT, p);
    const inside = path.relative(ROOT, file).split(path.sep).join("/");
    if (inside.startsWith("..") || path.isAbsolute(inside) || SECRET.test(inside)) {
        res.writeHead(403);
        return res.end();
    }
    // Adresse avec « .html » : redirection vers l'adresse propre (index.html → dossier)
    if (p.endsWith(".html") && isFile(file)) {
        return redirect(res, p.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "") + url.search + url.hash);
    }
    if (p.endsWith("/")) {
        if (isFile(path.join(file, "index.html"))) {
            return send(res, 200, path.join(file, "index.html"));
        }
    } else if (isFile(file)) {
        return send(res, 200, file);
    } else if (isFile(file + ".html")) {
        return send(res, 200, file + ".html");
    } else if (isFile(path.join(file, "index.html"))) {
        return redirect(res, p + "/" + url.search);
    }
    send(res, 404, path.join(ROOT, "404.html"));
});

server.on("error", function (error) {
    if (error.code === "EADDRINUSE") {
        console.log("Le port " + PORT + " est déjà utilisé (Live Server est peut-être encore lancé : clique sur « Port : 5500 » en bas de VS Code pour l'arrêter).");
    } else {
        console.log(error.message);
    }
    process.exit(1);
});

server.listen(PORT, "127.0.0.1", function () {
    console.log("Site lancé : http://127.0.0.1:" + PORT + "   (Ctrl+C pour arrêter)");
});
