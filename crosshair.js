// ===== crosshair.js : l'aperçu du crosshair + le bouton Copy (dans le navigateur) =====
// Utilisé par la page d'accueil (script.js) ET par les pages joueurs (players/*.html)
// (Les commandes console sont fabriquées dans render.js)

// Librairie qui décode les codes de partage CS2 (copie locale dans lib/)
import { decodeCrosshairShareCode } from "./lib/csgo-sharecode.js";

// Copier un texte et afficher "Copied!" 1,5 seconde sur le bouton
export function copyText(text, button) {
    navigator.clipboard.writeText(text).catch(function () {
        // Si le navigateur refuse (ancienne version, page non sécurisée...) : méthode de secours
        const area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
    });

    // On garde le texte d'origine du bouton (même si on clique plusieurs fois)
    if (!button.dataset.label) {
        button.dataset.label = button.textContent;
    }
    button.textContent = "Copied!";

    clearTimeout(button.copyTimer);
    button.copyTimer = setTimeout(function () {
        button.textContent = button.dataset.label;
    }, 1500);
}

// ===== Aperçu visuel du crosshair =====

// Couleurs de base de CS:GO (anciens codes) : 0 à 4. La 5 = couleur perso (R, G, B)
const CS_COLORS = [[250, 50, 50], [50, 250, 50], [250, 250, 50], [50, 50, 250], [50, 250, 250]];

// Image de fond : une vraie capture d'écran de CS2 en plein écran (preview-bg.jpg, à côté de ce fichier)
// Elle est chargée une seule fois ; quand elle arrive, on redessine tous les aperçus
const bgImage = new Image();
bgImage.src = new URL("preview-bg.jpg", import.meta.url).href;
bgImage.onload = function () {
    document.querySelectorAll("canvas[data-code]").forEach(function (canvas) {
        drawCrosshair(canvas, canvas.dataset.code);
    });
};

// L'aperçu est dessiné à TAILLE RÉELLE, comme le jeu sur l'écran du visiteur :
// on compte en VRAIS pixels de l'écran (pas en pixels de la page, qui sont agrandis
// par l'échelle Windows 125 % / 150 % ou le zoom du navigateur).
// Le décor et le crosshair sont agrandis exactement du même facteur : les proportions sont celles du jeu.
function screenPixelsHigh() {
    const ratio = window.devicePixelRatio || 1;
    const height = Math.round((window.screen && window.screen.height ? window.screen.height : 1080) * ratio);
    return height > 0 ? height : 1080; // ex. 1080 sur un écran Full HD, 1440 sur un écran 2K...
}

// Quand la taille d'un aperçu change (onglet ouvert, fenêtre redimensionnée...), on le redessine net
const resizeWatcher = typeof ResizeObserver === "function"
    ? new ResizeObserver(function (entries) {
        entries.forEach(function (entry) {
            const canvas = entry.target;
            if (canvas.dataset.code && entry.contentRect.width > 0) {
                drawCrosshair(canvas, canvas.dataset.code);
            }
        });
    })
    : null;

// Donne au canvas autant de pixels que l'écran en affiche (pas d'agrandissement/rétrécissement = image nette)
// Renvoie le nombre de pixels du canvas pour 1 pixel de la page (2 sur un écran "Retina", par exemple)
function fitToScreen(canvas) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        return 1; // aperçu caché (onglet fermé) : il sera redessiné quand il apparaîtra
    }
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * ratio);
    const h = Math.round(rect.height * ratio);
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    return ratio;
}

// Fond de l'aperçu : la capture CS2 à taille réelle (un peu assombrie), centrée sur un espace libre
// S'il n'y a pas encore de capture : fond sombre avec une grille discrète
function drawBackground(ctx, w, h, ratio) {
    if (bgImage.complete && bgImage.naturalWidth > 0) {
        // La capture représente tout l'écran : on l'affiche à la hauteur de l'écran du visiteur (en vrais pixels)
        const scale = screenPixelsHigh() / bgImage.naturalHeight;
        const iw = bgImage.naturalWidth * scale;
        const ih = bgImage.naturalHeight * scale;
        // Point de la photo placé derrière le crosshair (0 = bord gauche/haut, 1 = bord droit/bas)
        const focusX = 0.38;
        const focusY = 0.47;
        // On décale la photo, sans jamais laisser de bord vide
        const x = Math.min(0, Math.max(w - iw, w / 2 - focusX * iw));
        const y = Math.min(0, Math.max(h - ih, h / 2 - focusY * ih));
        ctx.filter = "brightness(0.8)";
        ctx.drawImage(bgImage, x, y, iw, ih);
        ctx.filter = "none";

        // Halo sombre derrière le crosshair pour qu'il reste bien lisible
        const halo = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.55);
        halo.addColorStop(0, "rgba(0, 0, 0, 0.55)");
        halo.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);
        return;
    }

    const r = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6);
    r.addColorStop(0, "#232A33");
    r.addColorStop(1, "#0C0F13");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);

    const step = 40 * ratio;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = (w / 2) % step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = (h / 2) % step; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
}

// Dessine le crosshair dans un <canvas>, à taille réelle
export function drawCrosshair(canvas, code) {
    if (resizeWatcher && !canvas.dataset.code) {
        resizeWatcher.observe(canvas);
    }
    canvas.dataset.code = code; // pour pouvoir le redessiner (capture de fond arrivée, taille changée)

    const ratio = fitToScreen(canvas);
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    drawBackground(ctx, w, h, ratio);

    let c;
    try {
        c = decodeCrosshairShareCode(code);
    } catch (error) {
        ctx.fillStyle = "#97A1AD";
        ctx.font = "600 " + Math.round(14 * ratio) + "px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("No preview", w / 2, h / 2);
        return;
    }

    // "unit" = nombre de pixels du canvas pour 1 pixel de crosshair
    let unit, rgb, alpha, length, thick, gap, outline, outlineColor;

    if (c.format === "legacy-v1") {
        // Ancien code CS:GO (CSGO-xxxxx-...) : anciennes unités, approximation
        unit = screenPixelsHigh() / 480;
        rgb = c.color === 5 || !CS_COLORS[c.color] ? [c.red, c.green, c.blue] : CS_COLORS[c.color];
        alpha = c.alphaEnabled ? c.alpha / 255 : 1;
        length = (c.length ?? 5) * unit;
        thick = Math.max(0.5, c.thickness) * unit;
        gap = (c.gap + 4) * unit / 2;
        outline = c.outlineEnabled ? c.outline * unit / 2 : 0;
        outlineColor = "rgba(0, 0, 0, " + alpha + ")";
    } else {
        // Nouveau code CS2 (CS...) : tailles en pixels pour la hauteur d'écran du joueur (screenHeight)
        unit = screenPixelsHigh() / (c.screenHeight || 1080);
        rgb = [c.red, c.green, c.blue];
        alpha = c.alpha / 255;
        length = c.length * unit;
        thick = c.thickness * unit;
        gap = c.gap * unit;
        outline = c.outlineMode > 0 ? unit : 0; // contour de 1 pixel
        outlineColor = "rgba(" + (c.outlineRed ?? 0) + ", " + (c.outlineGreen ?? 0) + ", " + (c.outlineBlue ?? 0) + ", " + ((c.outlineAlpha ?? 255) / 255) + ")";
    }

    // On arrondit au pixel près pour des traits nets (au moins 1 pixel)
    length = Math.max(1, Math.round(length));
    thick = Math.max(1, Math.round(thick));
    gap = Math.round(gap);
    outline = outline > 0 ? Math.max(1, Math.round(outline)) : 0;

    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    const half = Math.floor(thick / 2);
    const start = Math.ceil(thick / 2) + gap; // distance entre le centre et le début de chaque trait

    const bars = [
        [cx + start, cy - half, length, thick],          // droite
        [cx - start - length, cy - half, length, thick], // gauche
        [cx - half, cy + start, thick, length]           // bas
    ];
    if (!c.tStyleEnabled) {
        bars.push([cx - half, cy - start - length, thick, length]); // haut (absent en style "T")
    }
    if (c.centerDotEnabled) {
        bars.push([cx - half, cy - half, thick, thick]);
    }

    if (outline > 0) {
        ctx.fillStyle = outlineColor;
        bars.forEach(function (b) {
            ctx.fillRect(b[0] - outline, b[1] - outline, b[2] + outline * 2, b[3] + outline * 2);
        });
    }
    ctx.fillStyle = "rgba(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ", " + alpha + ")";
    bars.forEach(function (b) {
        ctx.fillRect(b[0], b[1], b[2], b[3]);
    });
}
