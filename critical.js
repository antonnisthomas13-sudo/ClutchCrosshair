// critical.js : calcule le « CSS critique » de la page d'accueil (utilisé par node build.js)
// = les règles de style.min.css qui servent à ce qui est visible SANS défiler. build.js l'écrit directement
// dans index.html : le haut de page s'affiche tout de suite, et style.min.css se charge ensuite sans bloquer.
//
// Comment : Chrome (sans fenêtre) ouvre l'accueil sur un petit serveur local, en 4 tailles d'écran (2 téléphones,
// 2 ordinateurs) et en mode sombre ET clair ; on garde chaque règle qui touche un élément visible en haut de page,
// plus toujours : les polices (@font-face) et les variables de couleurs (:root, html.light...).
// Le résultat est gardé dans critical.css avec l'empreinte de style.min.css : on ne recalcule que si le CSS change
// (ou avec « node build.js --critical » si la structure du haut de l'accueil change).
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const VIEWPORTS = [
    { width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true },   // téléphone (celui de Lighthouse)
    { width: 360, height: 740, deviceScaleFactor: 3, mobile: true },      // petit téléphone
    { width: 1350, height: 940, deviceScaleFactor: 1, mobile: false },    // ordinateur portable
    { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }    // grand écran
];

// Dans la page : liste des règles utiles en haut de page (numéros des règles, dans l'ordre de la feuille)
function collectInPage() {
    const sheet = [...document.styleSheets].find(function (s) { return s.href && s.href.includes("style.min.css"); });
    const limit = innerHeight + 120; // un peu sous le bas de l'écran, pour le premier défilement
    function visibleOnTop(selector) {
        // On retire ce qui dépend d'une action (survol, focus...) et les pseudo-éléments (::before...)
        const plain = selector
            .replace(/::?(before|after|placeholder|selection|backdrop|marker|-webkit-[\w-]+|-moz-[\w-]+)(\([^)]*\))?/g, "")
            .replace(/:(hover|focus-visible|focus-within|focus|active|visited|link)\b/g, "")
            .trim();
        if (!plain || /(^|,)\s*(,|$)/.test(plain)) {
            return true; // sélecteur vide après nettoyage (ex. « ::selection ») : on le garde
        }
        let els;
        try {
            els = document.querySelectorAll(plain);
        } catch (error) {
            return true; // sélecteur que le navigateur ne sait pas tester : on le garde (prudence)
        }
        const inBand = function (r) { return (r.width || r.height) && r.top < limit && r.bottom > -1; };
        for (const el of els) {
            if (el === document.documentElement || el === document.body) {
                return true;
            }
            if (inBand(el.getBoundingClientRect())) {
                return true;
            }
            // Élément posé par-dessus la page (lien « Skip », fiche joueur...) : souvent caché hors de l'écran par cette règle
            const position = getComputedStyle(el).position;
            if (position === "fixed" || position === "absolute") {
                return true;
            }
            // Élément caché (display: none...) dans une zone visible : la règle qui le cache est indispensable
            const r = el.getBoundingClientRect();
            if (!r.width && !r.height && el.parentElement && inBand(el.parentElement.getBoundingClientRect())) {
                return true;
            }
        }
        return false;
    }
    const keep = [];
    function walk(rules, prefix) {
        [...rules].forEach(function (rule, i) {
            const id = prefix + i;
            if (rule instanceof CSSFontFaceRule) {
                keep.push(id);
            } else if (rule instanceof CSSStyleRule) {
                if (/:root|^html|^body|,\s*(html|body)/.test(rule.selectorText) || visibleOnTop(rule.selectorText)) {
                    keep.push(id);
                }
            } else if (rule.cssRules && !(rule instanceof CSSKeyframesRule)) {
                walk(rule.cssRules, id + ".");
            }
        });
    }
    walk(sheet.cssRules, "");
    return keep;
}

// Recompose le CSS critique à partir des numéros gardés (dans l'ordre d'origine, @media compris)
function buildInPage(keepList) {
    const keep = new Set(keepList);
    const sheet = [...document.styleSheets].find(function (s) { return s.href && s.href.includes("style.min.css"); });
    function walk(rules, prefix) {
        let out = "";
        [...rules].forEach(function (rule, i) {
            const id = prefix + i;
            if (rule instanceof CSSKeyframesRule) {
                return;
            }
            if (rule.cssRules && !(rule instanceof CSSStyleRule)) {
                const inner = walk(rule.cssRules, id + ".");
                if (inner) {
                    const head = rule.cssText.slice(0, rule.cssText.indexOf("{"));
                    out += head + "{" + inner + "}";
                }
            } else if (keep.has(id)) {
                out += rule.cssText;
            }
        });
        return out;
    }
    return walk(sheet.cssRules, "");
}

function serve(root, indexHtml) {
    const types = { ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".webmanifest": "application/manifest+json" };
    return new Promise(function (resolve) {
        const server = http.createServer(function (req, res) {
            const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
            if (p === "/" || p === "/index.html") {
                res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
                return res.end(indexHtml);
            }
            const file = path.join(root, p);
            if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                return res.end();
            }
            res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
            res.end(fs.readFileSync(file));
        });
        server.listen(0, "127.0.0.1", function () { resolve(server); });
    });
}

// chrome : chemin de Chrome ; indexHtml : l'accueil avec un simple <link rel="stylesheet" href="style.min.css?v=...">
async function extractCritical(chrome, indexHtml) {
    const root = path.resolve(".");
    const server = await serve(root, indexHtml);
    const base = "http://127.0.0.1:" + server.address().port + "/";
    const profile = fs.mkdtempSync(path.join(require("os").tmpdir(), "cc-critical-"));
    const port = 9400 + Math.floor(Math.random() * 400);
    const browser = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=" + port, "--user-data-dir=" + profile, "about:blank"], { stdio: "ignore" });
    const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    try {
        let target = null;
        for (let i = 0; i < 60 && !target; i++) {
            await sleep(250);
            try {
                const list = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
                target = list.find(function (t) { return t.type === "page"; });
            } catch (error) { /* Chrome démarre encore */ }
        }
        if (!target) {
            throw new Error("Chrome ne répond pas");
        }
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        await new Promise(function (r) { ws.addEventListener("open", r); });
        let id = 0;
        const pending = new Map();
        ws.addEventListener("message", function (e) {
            const msg = JSON.parse(e.data);
            if (msg.id && pending.has(msg.id)) {
                pending.get(msg.id)(msg);
                pending.delete(msg.id);
            }
        });
        const send = function (method, params) {
            return new Promise(function (r) { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: method, params: params || {} })); });
        };
        const evaluate = async function (fn, arg) {
            const r = await send("Runtime.evaluate", { expression: "(" + fn.toString() + ")(" + JSON.stringify(arg === undefined ? null : arg) + ")", returnByValue: true, awaitPromise: true });
            if (r.result.exceptionDetails) {
                throw new Error(r.result.exceptionDetails.exception ? r.result.exceptionDetails.exception.description : "erreur");
            }
            return r.result.result.value;
        };
        await send("Page.enable");
        const keep = new Set();
        for (const theme of ["dark", "light"]) {
            for (const vp of VIEWPORTS) {
                await send("Emulation.setDeviceMetricsOverride", vp);
                await send("Page.navigate", { url: base });
                await sleep(300);
                await evaluate(function (t) { try { localStorage.setItem("theme", t); } catch (e) { /* rien */ } return 1; }, theme);
                await send("Page.navigate", { url: base + "?" + theme + vp.width });
                await sleep(1500);
                await evaluate(function () { return document.fonts.ready.then(function () { return 1; }); });
                (await evaluate(collectInPage)).forEach(function (k) { keep.add(k); });
            }
        }
        const css = await evaluate(buildInPage, [...keep]);
        ws.close();
        return css;
    } finally {
        browser.kill();
        server.close();
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (error) { /* rien */ }
    }
}

module.exports = { extractCritical };
