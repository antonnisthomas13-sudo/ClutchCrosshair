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

// Image de fond : une vraie capture d'écran de CS2 (preview-bg.jpg, à côté de ce fichier)
// Elle est chargée une seule fois ; quand elle arrive, on redessine tous les aperçus
const bgImage = new Image();
bgImage.src = new URL("preview-bg.jpg", import.meta.url).href;
bgImage.onload = function () {
    document.querySelectorAll("canvas[data-code]").forEach(function (canvas) {
        drawCrosshair(canvas, canvas.dataset.code);
    });
};

// Fond de l'aperçu : la capture CS2 (recadrée, un peu assombrie)
// S'il n'y a pas encore de capture : fond sombre avec une grille discrète
function drawBackground(ctx, w, h) {
    if (bgImage.complete && bgImage.naturalWidth > 0) {
        // On remplit tout l'aperçu en coupant ce qui dépasse (comme "cover" en CSS)
        const scale = Math.max(w / bgImage.naturalWidth, h / bgImage.naturalHeight) * 1.6; // zoom de la photo
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

    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    for (let x = (w / 2) % 40; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
    }
    for (let y = (h / 2) % 40; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
    }
}

// Dessine le crosshair dans un <canvas>
export function drawCrosshair(canvas, code) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    canvas.dataset.code = code; // pour pouvoir le redessiner quand la capture de fond arrive
    drawBackground(ctx, w, h);

    let c;
    try {
        c = decodeCrosshairShareCode(code);
    } catch (error) {
        ctx.fillStyle = "#97A1AD";
        ctx.font = "600 26px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("No preview", w / 2, h / 2);
        return;
    }

    let rgb, alpha, length, thick, gap, outline, outlineColor;
    const zoom = 3; // agrandissement de l'aperçu

    if (c.format === "legacy-v1") {
        // Ancien code CS:GO (CSGO-xxxxx-...)
        rgb = c.color === 5 || !CS_COLORS[c.color] ? [c.red, c.green, c.blue] : CS_COLORS[c.color];
        alpha = c.alphaEnabled ? c.alpha / 255 : 1;
        length = Math.round((c.length ?? 5) * 2 * zoom);
        thick = Math.max(zoom, Math.round(c.thickness * 2 * zoom));
        gap = Math.round((c.gap + 4) * zoom);
        outline = c.outlineEnabled ? Math.max(1, Math.round(c.outline * zoom)) : 0;
        outlineColor = "rgba(0, 0, 0, " + alpha + ")";
    } else {
        // Nouveau code CS2 (CS...) : tailles en pixels pour la hauteur d'écran du joueur
        const scale = zoom * 1080 / (c.screenHeight || 1080);
        rgb = [c.red, c.green, c.blue];
        alpha = c.alpha / 255;
        length = Math.max(1, Math.round(c.length * scale));
        thick = Math.max(2, Math.round(c.thickness * scale));
        gap = Math.round(c.gap * scale);
        outline = c.outlineMode > 0 ? 2 : 0;
        outlineColor = "rgba(" + (c.outlineRed ?? 0) + ", " + (c.outlineGreen ?? 0) + ", " + (c.outlineBlue ?? 0) + ", " + ((c.outlineAlpha ?? 255) / 255) + ")";
    }

    const half = Math.floor(thick / 2);
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);
    const start = half + gap; // distance entre le centre et le début de chaque trait

    const bars = [
        [cx + start, cy - half, length, thick],
        [cx - start - length, cy - half, length, thick],
        [cx - half, cy + start, thick, length]
    ];
    if (!c.tStyleEnabled) {
        bars.push([cx - half, cy - start - length, thick, length]);
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
