// og.js : une image d'aperçu de lien (1200×630, Discord, X, WhatsApp...) PAR JOUEUR -> og/<pseudo>.jpg
// Appelé par build.js. À gauche : logo du site, photo, pseudo, équipe, code ; à droite : la capture Dust2 agrandie
// avec le VRAI crosshair du joueur (mêmes calculs que drawBars dans crosshair.js, agrandi ZOOM fois avec le décor).
// Ne refait une image que si le joueur a changé (pseudo, équipe, code, photo) ou si ce fichier a changé :
// les « clés » des images déjà faites sont gardées dans og/keys.json.
// Comment : une petite page HTML par joueur, Chrome (sans fenêtre) en fait une capture d'écran (PNG),
// puis runCanvasJobs (images.js) les convertit en JPEG.

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { findChrome, runCanvasJobs, dataUrl, fileUrl } = require("./images.js");

const W = 1200;
const H = 630;
const PANEL = 520;          // largeur du panneau de droite (capture + crosshair)
const ZOOM = 5;             // décor ET crosshair agrandis 5 fois (taille réelle = illisible en petit sur X / Discord)
const FOCUS = [943, 517];   // tête du terroriste dans la capture 1920×1080 (même point que partout sur le site)
const PER_SHOT = 12;        // captures converties en JPEG par passage de Chrome
const DARK_LOGOS = ["furia", "spirit", "g2"]; // logos noirs : passés en blanc sur le fond sombre (comme dans style.css)

// Rectangles du crosshair autour du centre (0, 0), en pixels de l'image : [x, y, largeur, hauteur]
// Même logique que drawBars dans crosshair.js (codes CS2)
function crosshairRects(c) {
    if (c.style === 9) {
        // Crosshair en X (réglé sur une capture de shox) : 4 petits carrés tournés de 45°, le point reste droit
        const unit = ZOOM * 1080 / (c.screenHeight || 1080);
        const thick = Math.max(1, Math.round(c.thickness * unit));
        const half = Math.floor(thick / 2);
        const dot = c.centerDotEnabled ? [[-half, -half, thick, thick]] : [];
        const sq = Math.max(1, Math.floor(c.thickness * unit));
        const from = Math.ceil(sq / 2) + Math.round(c.gap * unit);
        const h = Math.floor(sq / 2);
        return { rotated: [[from, -h, sq, sq], [-from - sq, -h, sq, sq], [-h, from, sq, sq], [-h, -from - sq, sq, sq]], straight: dot };
    }
    // Placement mesuré en jeu (24/10/2026, même règle que drawBars) : chaque trait commence à « écart » pixels
    // du centre de l'écran ; tailles proportionnelles à l'écran, calculées en pixels du jeu (écran 1080) puis agrandies ZOOM fois
    const k = 1080 / (c.screenHeight || 1080);
    const t = Math.max(1, Math.round(c.thickness * k));
    const len = Math.max(0, Math.round(c.length * k));
    const g = Math.round(c.gap * k);
    const low = -Math.ceil(t / 2);
    const mid = low + t / 2;
    const near = Math.floor(mid + g);
    const far = Math.ceil(mid - g);
    const z = function (x0, x1, y0, y1) {
        return [x0 * ZOOM, y0 * ZOOM, (x1 - x0) * ZOOM, (y1 - y0) * ZOOM];
    };
    const bars = len > 0 ? [z(near, near + len, low, low + t), z(far - len, far, low, low + t), z(low, low + t, near, near + len)] : [];
    if (len > 0 && !c.tStyleEnabled) {
        bars.push(z(low, low + t, far - len, far));
    }
    return { rotated: [], straight: bars.concat(c.centerDotEnabled ? [z(low, low + t, low, low + t)] : []) };
}

function crosshairHTML(c) {
    const rects = crosshairRects(c);
    const outline = c.outlineMode > 0 ? ZOOM : 0; // 1 pixel du jeu, agrandi ZOOM fois
    const color = "rgba(" + c.red + "," + c.green + "," + c.blue + "," + (c.alpha / 255) + ")";
    const outlineColor = "rgba(" + (c.outlineRed ?? 0) + "," + (c.outlineGreen ?? 0) + "," + (c.outlineBlue ?? 0) + "," + ((c.outlineAlpha ?? 255) / 255) + ")";
    function boxes(list) {
        // D'abord le contour (plus grand, derrière), puis la couleur
        const back = outline ? list.map(function (r) {
            return `<i style="left:${r[0] - outline}px;top:${r[1] - outline}px;width:${r[2] + outline * 2}px;height:${r[3] + outline * 2}px;background:${outlineColor}"></i>`;
        }).join("") : "";
        return back + list.map(function (r) {
            return `<i style="left:${r[0]}px;top:${r[1]}px;width:${r[2]}px;height:${r[3]}px;background:${color}"></i>`;
        }).join("");
    }
    return `<div class="x" style="transform:rotate(45deg)">${boxes(rects.rotated)}</div><div class="x">${boxes(rects.straight)}</div>`;
}

function esc(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Un aperçu : o = { name, teamLine, color, textColor, logo, photo, code, decoded }
function cardHTML(o) {
    const logo = o.logo ? `<img class="team-logo${DARK_LOGOS.some(function (d) { return o.logo.includes(d); }) ? " invert" : ""}" src="${dataUrl(o.logo)}" alt="">` : "";
    return `<section class="og">
    <div class="left">
        <img class="site" src="${SITE_LOGO}" alt="">
        <div class="who">
            ${o.photo ? `<img class="photo" src="${dataUrl(o.photo)}" alt="">` : ""}
            <div>
                <div class="band" style="background:${o.color};color:${o.textColor}"><span class="name">${esc(o.name)}</span></div>
                <div class="team">${logo}<span>${esc(o.teamLine)}</span></div>
            </div>
        </div>
        <div class="label">CS2 crosshair code</div>
        <div class="code">${esc(o.code)}</div>
    </div>
    <div class="shot"><div class="halo"></div>${crosshairHTML(o.decoded)}<span class="chip">Crosshair · Zoom ×${ZOOM}</span></div>
    <div class="bar"></div>
</section>`;
}

let SITE_LOGO = "";

function pageHTML(cards) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Barlow Condensed"; font-weight: 700; src: url(${dataUrl("fonts/barlow-condensed-700-latin.woff2")}) format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 400 600; src: url(${dataUrl("fonts/inter-latin.woff2")}) format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 400; src: url(${dataUrl("fonts/jetbrains-mono-400-latin.woff2")}) format("woff2"); }
html, body { margin: 0; width: ${W}px; background: #111214; color: #ECEDEF; font-family: Inter, sans-serif; }
.og { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; background: #111214; }
.left { position: absolute; left: 64px; top: 56px; bottom: 56px; width: ${W - PANEL - 112}px; display: flex; flex-direction: column; }
.site { width: 200px; height: auto; }
.who { display: flex; align-items: flex-end; gap: 24px; margin-top: auto; }
.photo { width: 150px; height: 169px; object-fit: cover; object-position: top; background: #1B1D21; }
.band { display: inline-block; padding: 4px 28px 4px 16px; clip-path: polygon(0 0, 100% 0, calc(100% - 16px) 100%, 0 100%); }
.name { font: 700 92px/1.02 "Barlow Condensed", sans-serif; white-space: nowrap; }
.team { display: flex; align-items: center; gap: 12px; margin-top: 16px; font-size: 26px; font-weight: 600; color: #C4C8CE; }
.team-logo { width: 40px; height: 40px; object-fit: contain; }
.team-logo.invert { filter: invert(1); }
.label { margin-top: 40px; font-size: 18px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #A8ADB5; }
.code { margin-top: 10px; padding: 14px 16px; background: #1B1D21; border: 1px solid #30343A; border-radius: 2px; font: 400 18px/1.2 "JetBrains Mono", monospace; color: #ECEDEF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shot { position: absolute; right: 0; top: 0; width: ${PANEL}px; height: ${H}px; overflow: hidden;
    background: #08090A url(${dataUrl("preview-bg.jpg")}) no-repeat;
    background-size: ${1920 * ZOOM}px ${1080 * ZOOM}px;
    background-position: ${Math.floor(PANEL / 2) - FOCUS[0] * ZOOM}px ${Math.floor(H / 2) - FOCUS[1] * ZOOM}px;
    image-rendering: pixelated; filter: brightness(0.85); }
.halo { position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, rgba(0,0,0,0.3), rgba(0,0,0,0) 55%); }
.x { position: absolute; left: ${Math.floor(PANEL / 2)}px; top: ${Math.floor(H / 2)}px; width: 0; height: 0; }
.x i { position: absolute; display: block; }
.chip { position: absolute; top: 28px; left: 28px; padding: 6px 12px; background: rgba(8,9,10,0.8); color: #C9CCD1; font-size: 17px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.bar { position: absolute; left: 0; right: 0; bottom: 0; height: 8px; background: #D7262F; }
</style></head><body>
${cards.join("\n")}
<script>
// Pseudos longs : la taille du texte diminue jusqu'à ce que le bandeau tienne dans la colonne de gauche
document.fonts.ready.then(function () {
    document.querySelectorAll(".og").forEach(function (og) {
        const name = og.querySelector(".name");
        const room = og.querySelector(".left").clientWidth - (og.querySelector(".photo") ? 174 : 0) - 44;
        let size = 92;
        while (name.offsetWidth > room && size > 40) {
            size -= 2;
            name.style.fontSize = size + "px";
        }
    });
});
</script></body></html>`;
}

// Fabrique les images qui manquent ou ont changé ; renvoie { "<slug>": "og/<slug>.jpg" } pour les images qui existent
// players = players.json ; helpers = { decode, slug, teamInfo, teamColor, textOnColor, photoOf(player) -> fichier ou "" }
function makePlayerOgImages(players, helpers) {
    // Fins de ligne uniformisées : le PC (Windows) et GitHub calculent la même clé (sinon tout serait refait sur GitHub)
    const own = crypto.createHash("sha256").update(fs.readFileSync(__filename, "utf8").replace(/\r\n/g, "\n")).digest("hex").slice(0, 10);
    const keysFile = "og/keys.json";
    const keys = fs.existsSync(keysFile) ? JSON.parse(fs.readFileSync(keysFile, "utf8")) : {};
    const todo = [];
    const result = {};
    const wanted = new Set();

    players.forEach(function (p) {
        let decoded;
        try {
            decoded = helpers.decode(p.code);
        } catch (error) {
            return;
        }
        if (decoded.format === "legacy-v1") {
            return;
        }
        const s = helpers.slug(p.name);
        const out = "og/" + s + ".jpg";
        const team = helpers.teamInfo(p.team);
        const photo = helpers.photoOf(p);
        const logo = team && team.logo && fs.existsSync(team.logo) ? team.logo : "";
        const color = helpers.teamColor(p.team);
        const o = {
            name: p.name, teamLine: p.category === "creator" ? "Content creator" : p.team, color: color, textColor: helpers.textOnColor(color),
            logo: logo, photo: photo, code: p.code, decoded: decoded, out: out
        };
        const key = crypto.createHash("sha256").update(JSON.stringify([own, o.name, o.teamLine, o.color, o.code,
            photo ? crypto.createHash("sha256").update(fs.readFileSync(photo)).digest("hex") : "",
            logo ? fs.statSync(logo).size : 0])).digest("hex").slice(0, 16);
        wanted.add(s + ".jpg");
        if (keys[s] !== key || !fs.existsSync(out)) {
            o.key = key;
            o.slug = s;
            todo.push(o);
        }
        result[s] = out;
    });

    if (todo.length) {
        const chrome = findChrome();
        if (!chrome) {
            console.log("Attention : Chrome introuvable, pas d'images d'aperçu par joueur (og-image.jpg est utilisée)");
        } else {
            SITE_LOGO = dataUrl("logo-horizontal-dark.svg");
            fs.mkdirSync("og", { recursive: true });
            // 1. Une capture d'écran (PNG) par joueur
            const tmpHtml = path.join(os.tmpdir(), "clutchcrosshair-og-player-" + process.pid + ".html");
            const shots = [];
            try {
                todo.forEach(function (o) {
                    const png = path.join(os.tmpdir(), "clutchcrosshair-og-" + process.pid + "-" + o.slug + ".png");
                    fs.writeFileSync(tmpHtml, pageHTML([cardHTML(o)]));
                    execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--window-size=" + W + "," + H, "--virtual-time-budget=10000", "--screenshot=" + png, fileUrl(tmpHtml)], { stdio: "ignore" });
                    if (fs.existsSync(png)) {
                        shots.push({ o: o, png: png });
                    }
                });
                // 2. Conversion en JPEG (bien plus léger), par paquets
                let made = 0;
                for (let i = 0; i < shots.length; i += PER_SHOT) {
                    made += runCanvasJobs(chrome, shots.slice(i, i + PER_SHOT).map(function (s) {
                        return { src: s.png, out: s.o.out, w: W, h: H, fit: "cover", position: "center", type: "image/jpeg", quality: 0.85 };
                    }));
                }
                shots.forEach(function (s) {
                    if (fs.existsSync(s.o.out)) {
                        keys[s.o.slug] = s.o.key;
                    }
                });
                console.log(made + " image(s) d'aperçu de joueur fabriquée(s) (og/)");
            } finally {
                [tmpHtml].concat(shots.map(function (s) { return s.png; })).forEach(function (f) { if (fs.existsSync(f)) { fs.unlinkSync(f); } });
            }
        }
    }

    // Images des joueurs qui ne sont plus sur le site : supprimées
    if (fs.existsSync("og")) {
        fs.readdirSync("og").filter(function (f) { return f.endsWith(".jpg") && !wanted.has(f); }).forEach(function (f) {
            fs.unlinkSync("og/" + f);
            delete keys[f.replace(/\.jpg$/, "")];
        });
        fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2) + "\n");
    }
    Object.keys(result).forEach(function (s) {
        if (!fs.existsSync(result[s])) {
            delete result[s];
        }
    });
    return result;
}

module.exports = { makePlayerOgImages };
