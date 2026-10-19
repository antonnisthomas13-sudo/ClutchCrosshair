// images.js : optimise les images du site avec Chrome (déjà installé sur le PC) — rien à installer
// Appelé automatiquement par build.js. Ne refait une image que si elle manque ou si l'original a changé.
//
//   photos/<pseudo>.webp  ->  photos/sm/<pseudo>.webp  (152×172, cartes)      ~ 8 Ko au lieu de ~90 Ko
//                         ->  photos/md/<pseudo>.webp  (256×288, fiche + page joueur)
//   logos/<équipe>.png    ->  logos/sm/<équipe>.webp   (48×48, menu et cartes)
//   preview-bg.jpg        ->  preview-bg.webp          (fond des aperçus, ~3× plus léger)
//   skins/src/<id>.png    ->  skins/img/<id>.webp      (256×192, images des skins des pros)
//   favicon.svg           ->  apple-touch-icon.png (180) + icon-512.png (512)
//   og-image.png          ->  image d'aperçu de lien 1200×630 (Discord, X, WhatsApp...) — supprimer le fichier pour la refaire
//
// Comment : on écrit une petite page HTML qui redimensionne les images dans un <canvas>,
// Chrome l'exécute sans fenêtre (mode "headless") et nous renvoie les images converties.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

// Où trouver Chrome (ou Edge) sur l'ordinateur
function findChrome() {
    const candidates = [
        process.env.CHROME_PATH,
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
        "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
        "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium"
    ];
    return candidates.find(function (c) {
        return c && fs.existsSync(c);
    }) || null;
}

// true si "out" n'existe pas ou est plus ancien que "src"
function isStale(src, out) {
    return !fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs;
}

function mimeOf(file) {
    const ext = path.extname(file).toLowerCase();
    return { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" }[ext] || "application/octet-stream";
}

function dataUrl(file) {
    return "data:" + mimeOf(file) + ";base64," + fs.readFileSync(file).toString("base64");
}

function fileUrl(file) {
    return "file:///" + path.resolve(file).replace(/\\/g, "/");
}

// Redimensionne / convertit une liste d'images en une seule exécution de Chrome
// job = { src, out, w, h, fit: "cover"|"contain", position: "top"|"center", type: "image/webp"|"image/png", quality, background, scale }
function runCanvasJobs(chrome, jobs) {
    const settings = jobs.map(function (j) {
        return { w: j.w, h: j.h, fit: j.fit, position: j.position, type: j.type, quality: j.quality, background: j.background || null, scale: j.scale || 1, svg: j.src.endsWith(".svg") };
    });
    // Les images sont dans la page ; la conversion se fait à l'événement "load" (toutes les images sont alors chargées),
    // de façon synchrone : Chrome écrit le résultat (--dump-dom) juste après.
    const imgs = jobs.map(function (j, i) {
        return `<img id="i${i}" src="${dataUrl(j.src)}" alt="">`;
    }).join("");
    const html = `<!doctype html><meta charset="utf-8"><body>${imgs}<script>
const jobs = ${JSON.stringify(settings)};
window.addEventListener("load", function () {
    for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i];
        const pre = document.createElement("pre");
        pre.id = "r" + i;
        try {
            const img = document.getElementById("i" + i);
            const canvas = document.createElement("canvas");
            canvas.width = j.w;
            canvas.height = j.h;
            const ctx = canvas.getContext("2d");
            ctx.imageSmoothingQuality = "high";
            if (j.background) { ctx.fillStyle = j.background; ctx.fillRect(0, 0, j.w, j.h); }
            if (j.svg) {
                // SVG : on le dessine dans un carré centré (il n'a pas de taille "naturelle" fiable)
                const s = Math.min(j.w, j.h) * j.scale;
                ctx.drawImage(img, (j.w - s) / 2, (j.h - s) / 2, s, s);
            } else {
                const iw = img.naturalWidth, ih = img.naturalHeight;
                const k = (j.fit === "cover" ? Math.max(j.w / iw, j.h / ih) : Math.min(j.w / iw, j.h / ih)) * j.scale;
                const dw = iw * k, dh = ih * k;
                ctx.drawImage(img, (j.w - dw) / 2, j.position === "top" ? 0 : (j.h - dh) / 2, dw, dh);
            }
            pre.textContent = canvas.toDataURL(j.type, j.quality);
        } catch (error) {
            pre.textContent = "ERROR " + error;
        }
        document.body.appendChild(pre);
    }
    // On retire les images d'origine pour que le résultat renvoyé par Chrome reste léger
    document.querySelectorAll("img").forEach(function (img) { img.remove(); });
});
</script>`;
    const tmp = path.join(os.tmpdir(), "clutchcrosshair-images-" + process.pid + ".html");
    fs.writeFileSync(tmp, html);
    let out = "";
    try {
        out = execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--dump-dom", fileUrl(tmp)], {
            encoding: "utf8",
            maxBuffer: 512 * 1024 * 1024,
            stdio: ["ignore", "pipe", "ignore"]
        });
    } finally {
        fs.unlinkSync(tmp);
    }
    let done = 0;
    jobs.forEach(function (j, i) {
        const m = out.match(new RegExp('<pre id="r' + i + '">data:[^;]+;base64,([^<]+)</pre>'));
        if (!m) {
            console.log("  Image non générée : " + j.out);
            return;
        }
        fs.mkdirSync(path.dirname(j.out), { recursive: true });
        fs.writeFileSync(j.out, Buffer.from(m[1], "base64"));
        done++;
    });
    return done;
}

// Image d'aperçu de lien (1200×630) : une capture d'écran d'une petite page aux couleurs du site
function makeOgImage(chrome, out) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Barlow Condensed"; font-weight: 700; src: url(${dataUrl("fonts/barlow-condensed-700-latin.woff2")}) format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 400 600; src: url(${dataUrl("fonts/inter-latin.woff2")}) format("woff2"); }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #111214; color: #ECEDEF; font-family: Inter, sans-serif; }
.left { position: absolute; left: 72px; top: 0; bottom: 0; width: 560px; display: flex; flex-direction: column; justify-content: center; }
.logo { width: 250px; height: auto; }
h1 { margin: 40px 0 20px; font: 700 96px/0.95 "Barlow Condensed", sans-serif; letter-spacing: 0.005em; }
p { margin: 0; font-size: 27px; line-height: 1.4; color: #9DA2AA; }
.shot { position: absolute; right: 0; top: 0; width: 520px; height: 630px; overflow: hidden; background: #08090A; }
.shot img { position: absolute; height: 820px; left: -300px; top: -120px; filter: brightness(0.55) saturate(0.8); }
.halo { position: absolute; inset: 0; background: radial-gradient(circle at 50% 50%, rgba(0,0,0,0.65), rgba(0,0,0,0) 55%); }
.chip { position: absolute; top: 28px; left: 28px; padding: 6px 12px; background: rgba(8,9,10,0.8); color: #C9CCD1; font-size: 17px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }
.x { position: absolute; left: 50%; top: 50%; }
.x i { position: absolute; background: #00FF91; }
.bar { position: absolute; left: 0; right: 0; bottom: 0; height: 8px; background: #D7262F; }
</style></head><body>
<div class="left">
    <img class="logo" src="${dataUrl("logo-horizontal-dark.svg")}" alt="">
    <h1>Find your perfect CS2 crosshair</h1>
    <p>Pro player crosshair codes, read from official match demos. One click to copy.</p>
</div>
<div class="shot">
    <img src="${dataUrl("preview-bg.jpg")}" alt="">
    <div class="halo"></div>
    <span class="chip">Crosshair</span>
    <div class="x"><i style="left:12px;top:-4px;width:36px;height:8px"></i><i style="left:-48px;top:-4px;width:36px;height:8px"></i><i style="left:-4px;top:12px;width:8px;height:36px"></i><i style="left:-4px;top:-48px;width:8px;height:36px"></i></div>
</div>
<div class="bar"></div>
</body></html>`;
    const tmp = path.join(os.tmpdir(), "clutchcrosshair-og-" + process.pid + ".html");
    fs.writeFileSync(tmp, html);
    try {
        execFileSync(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--hide-scrollbars", "--window-size=1200,630", "--virtual-time-budget=10000", "--screenshot=" + path.resolve(out), fileUrl(tmp)], { stdio: "ignore" });
    } finally {
        fs.unlinkSync(tmp);
    }
    return fs.existsSync(out);
}

// Point d'entrée : prépare toutes les images optimisées qui manquent ou sont périmées
function optimizeImages() {
    const chrome = findChrome();
    const jobs = [];
    function add(job) {
        if (fs.existsSync(job.src) && isStale(job.src, job.out)) {
            jobs.push(job);
        }
    }

    fs.readdirSync("photos").forEach(function (f) {
        if (!/\.(webp|png|jpe?g)$/i.test(f)) {
            return;
        }
        const base = f.replace(/\.\w+$/, "");
        add({ src: "photos/" + f, out: "photos/sm/" + base + ".webp", w: 152, h: 172, fit: "cover", position: "top", type: "image/webp", quality: 0.8 });
        add({ src: "photos/" + f, out: "photos/md/" + base + ".webp", w: 256, h: 288, fit: "cover", position: "top", type: "image/webp", quality: 0.82 });
    });
    fs.readdirSync("logos").forEach(function (f) {
        if (/\.(png|webp|jpe?g|svg)$/i.test(f)) {
            add({ src: "logos/" + f, out: "logos/sm/" + f.replace(/\.\w+$/, "") + ".webp", w: 48, h: 48, fit: "contain", position: "center", type: "image/webp", quality: 0.9 });
        }
    });
    add({ src: "preview-bg.jpg", out: "preview-bg.webp", w: 1920, h: 1080, fit: "cover", position: "center", type: "image/webp", quality: 0.9 });
    // Images des skins (téléchargées par update-skins.js dans skins/src/) -> skins/img/<id>.webp, fond transparent
    if (fs.existsSync("skins/src")) {
        fs.readdirSync("skins/src").forEach(function (f) {
            if (f.endsWith(".png")) {
                add({ src: "skins/src/" + f, out: "skins/img/" + f.replace(/\.png$/, ".webp"), w: 256, h: 192, fit: "contain", position: "center", type: "image/webp", quality: 0.82 });
            }
        });
    }
    add({ src: "favicon.svg", out: "apple-touch-icon.png", w: 180, h: 180, fit: "contain", position: "center", type: "image/png", background: "#111214", scale: 0.84 });
    add({ src: "favicon.svg", out: "icon-512.png", w: 512, h: 512, fit: "contain", position: "center", type: "image/png", background: "#111214", scale: 0.84 });

    const needOg = !fs.existsSync("og-image.jpg");
    if ((jobs.length || needOg) && !chrome) {
        console.log("Attention : Chrome introuvable, images non optimisées (le site utilise les originaux).");
        return;
    }
    // Aperçu de lien : capture d'écran (PNG) puis conversion en JPEG, bien plus léger
    let ogTmp = null;
    if (needOg) {
        ogTmp = path.join(os.tmpdir(), "clutchcrosshair-og-" + process.pid + ".png");
        if (makeOgImage(chrome, ogTmp)) {
            jobs.push({ src: ogTmp, out: "og-image.jpg", w: 1200, h: 630, fit: "cover", position: "center", type: "image/jpeg", quality: 0.86 });
        }
    }
    if (jobs.length) {
        // Par paquets de 80 : Chrome reste léger même avec des centaines d'images de skins
        let done = 0;
        for (let i = 0; i < jobs.length; i += 80) {
            done += runCanvasJobs(chrome, jobs.slice(i, i + 80));
        }
        console.log(done + " image(s) optimisée(s)");
    }
    if (ogTmp && fs.existsSync(ogTmp)) {
        fs.unlinkSync(ogTmp);
    }
}

module.exports = { optimizeImages };
