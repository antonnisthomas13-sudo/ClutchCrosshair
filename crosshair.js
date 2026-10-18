// ===== crosshair.js : l'aperçu du crosshair + le bouton Copy (dans le navigateur) =====
// Utilisé par la page d'accueil (script.js) ET par les pages joueurs (players/*.html)

// Librairie qui décode les codes de partage CS2 (copie locale dans lib/)
import { decodeCrosshairShareCode } from "./lib/csgo-sharecode.js";

// ===== Copier =====

// Annonce un message aux lecteurs d'écran (zone invisible "aria-live")
function announce(message) {
    let live = document.getElementById("sr-live");
    if (!live) {
        live = document.createElement("div");
        live.id = "sr-live";
        live.className = "sr-only";
        live.setAttribute("aria-live", "polite");
        document.body.appendChild(live);
    }
    live.textContent = "";
    requestAnimationFrame(function () {
        live.textContent = message;
    });
}

// Méthode de secours si le presse-papiers moderne n'est pas disponible (ancien navigateur, page non sécurisée)
function legacyCopy(text) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
}

// Copier un texte et afficher "Copied!" 1,5 seconde sur le bouton
export function copyText(text, button) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).catch(function () {
            legacyCopy(text);
        });
    } else {
        legacyCopy(text);
    }
    announce("Copied to clipboard");

    // On garde le texte d'origine du bouton (même si on clique plusieurs fois)
    if (!button.dataset.label) {
        button.dataset.label = button.textContent;
    }
    button.textContent = "Copied!";

    // Geste signature : une barre rouge "COPIED" balaie la ligne du code (voir .field-row.copied dans style.css)
    const row = button.closest(".field-row");
    if (row) {
        row.classList.remove("copied");
        void row.offsetWidth; // relance l'animation si on clique plusieurs fois
        row.classList.add("copied");
        clearTimeout(row.copyTimer);
        row.copyTimer = setTimeout(function () {
            row.classList.remove("copied");
        }, 1500);
    }

    clearTimeout(button.copyTimer);
    button.copyTimer = setTimeout(function () {
        button.textContent = button.dataset.label;
    }, 1500);
}

// ===== Aperçu visuel du crosshair =====

// Couleurs de base de CS:GO (anciens codes) : 0 à 4. La 5 = couleur perso (R, G, B)
const CS_COLORS = [[250, 50, 50], [50, 250, 50], [250, 250, 50], [50, 50, 250], [50, 250, 250]];

// L'aperçu est dessiné à TAILLE RÉELLE, comme le jeu sur l'écran du visiteur :
// on compte en VRAIS pixels de l'écran (pas en pixels de la page, qui sont agrandis
// par l'échelle Windows 125 % / 150 % ou le zoom du navigateur).
// Le décor et le crosshair sont agrandis exactement du même facteur : les proportions sont celles du jeu.
function screenPixelsHigh() {
    const ratio = window.devicePixelRatio || 1;
    const height = Math.round((window.screen && window.screen.height ? window.screen.height : 1080) * ratio);
    return height > 0 ? height : 1080; // ex. 1080 sur un écran Full HD, 1440 sur un écran 2K...
}

// Image de fond : une vraie capture d'écran de CS2 en plein écran (preview-bg.webp, à côté de ce fichier)
// Elle est chargée une seule fois ; quand elle arrive, on redessine les aperçus déjà affichés
const bgImage = new Image();
bgImage.decoding = "async";
bgImage.src = new URL("preview-bg.webp", import.meta.url).href;
bgImage.onload = function () {
    backgrounds.clear();
    document.querySelectorAll("canvas[data-painted]").forEach(paint);
};

// Le fond (photo recadrée + filtre + halo) est préparé UNE fois par taille, puis réutilisé :
// toutes les cartes ont la même taille, donc un seul calcul pour 70 aperçus.
const backgrounds = new Map();

function background(w, h, dim) {
    const ready = bgImage.complete && bgImage.naturalWidth > 0;
    const key = w + "x" + h + (dim ? ":dim" : "") + (ready ? ":img" : ":grid") + ":" + screenPixelsHigh();
    let layer = backgrounds.get(key);
    if (!layer) {
        layer = document.createElement("canvas");
        layer.width = w;
        layer.height = h;
        drawBackground(layer.getContext("2d"), w, h, dim, ready);
        backgrounds.set(key, layer);
    }
    return layer;
}

// Fond de l'aperçu : la capture CS2 à taille réelle (un peu assombrie), centrée sur un espace libre
// S'il n'y a pas encore de capture : fond sombre avec une grille discrète
// dim = true dans les petites cartes : la photo est plus sombre pour que le crosshair se repère au premier coup d'œil
function drawBackground(ctx, w, h, dim, ready) {
    if (ready) {
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
        ctx.filter = dim ? "brightness(0.5) saturate(0.7)" : "brightness(0.8)";
        ctx.drawImage(bgImage, x, y, iw, ih);
        ctx.filter = "none";

        // Halo sombre derrière le crosshair pour qu'il reste bien lisible
        const halo = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.55);
        halo.addColorStop(0, dim ? "rgba(0, 0, 0, 0.6)" : "rgba(0, 0, 0, 0.55)");
        halo.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);
        return;
    }

    const r = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.6);
    r.addColorStop(0, "#24272C");
    r.addColorStop(1, "#08090A");
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, w, h);

    const step = 40 * (window.devicePixelRatio || 1);
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

// Dessine les traits du crosshair, à taille réelle
function drawBars(ctx, code, w, h) {
    let c;
    try {
        c = decodeCrosshairShareCode(code);
    } catch (error) {
        ctx.fillStyle = "#9DA2AA";
        ctx.font = "600 " + Math.round(14 * (window.devicePixelRatio || 1)) + "px sans-serif";
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

// Taille du canvas en vrais pixels (= sa taille à l'écran × densité) : image nette, ni agrandie ni rétrécie
function deviceSize(cssWidth, cssHeight) {
    const ratio = window.devicePixelRatio || 1;
    return [Math.round(cssWidth * ratio), Math.round(cssHeight * ratio)];
}

// Quand la taille d'un aperçu change (onglet ouvert, fenêtre redimensionnée...), on le redessine net
const resizeWatcher = typeof ResizeObserver === "function"
    ? new ResizeObserver(function (entries) {
        entries.forEach(function (entry) {
            const size = deviceSize(entry.contentRect.width, entry.contentRect.height);
            if (size[0] > 0 && entry.target.dataset.painted !== size[0] + "x" + size[1]) {
                paint(entry.target);
            }
        });
    })
    : null;

// Dessine (ou redessine) un aperçu : fond mis en cache + traits du crosshair
function paint(canvas) {
    const code = canvas.dataset.code;
    if (!code) {
        return;
    }
    if (resizeWatcher && !canvas.dataset.watched) {
        canvas.dataset.watched = "1";
        resizeWatcher.observe(canvas);
    }
    const size = deviceSize(canvas.clientWidth, canvas.clientHeight);
    const w = size[0];
    const h = size[1];
    if (!w || !h) {
        return; // aperçu caché (onglet fermé) : il sera dessiné quand il apparaîtra
    }
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    ctx.drawImage(background(w, h, Boolean(canvas.closest(".card"))), 0, 0);
    drawBars(ctx, code, w, h);
    canvas.dataset.painted = w + "x" + h;
}

// Les aperçus des cartes ne sont dessinés que lorsqu'ils approchent de l'écran
const lazyWatcher = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                lazyWatcher.unobserve(entry.target);
                paint(entry.target);
            }
        });
    }, { rootMargin: "400px 0px" })
    : null;

// Point d'entrée : affiche le crosshair "code" dans le canvas
// (tout de suite pour la fiche et les pages joueurs, à l'approche de l'écran pour les cartes)
export function drawCrosshair(canvas, code) {
    canvas.dataset.code = code;
    if (lazyWatcher && !canvas.dataset.painted && canvas.closest(".card")) {
        lazyWatcher.observe(canvas);
        return;
    }
    paint(canvas);
}
