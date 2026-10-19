// ===== render.js : fabrique des morceaux de HTML =====
// Utilisé par build.js (dans Node, pas dans le navigateur) : cartes des joueurs, générateur de crosshair,
// cartes de skins. build.js les écrit directement dans les pages (lisibles par Google, rien à calculer dans le navigateur).
// Ce fichier ne touche pas à la page : il ne fait que renvoyer du texte HTML.

import { decodeCrosshairShareCode, crosshairToConVars } from "./lib/csgo-sharecode.js";
import { teams } from "./teams.js";

// Transforme un nom en adresse propre : "ZywOo" -> "zywoo", "huNter-" -> "hunter"
export function slug(name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Protège un texte avant de le mettre dans du HTML (& < > " ')
// Indispensable : les pseudos viennent des démos (noms Steam) et pourraient contenir du code piégé
export function esc(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Transforme un code de partage en commandes console sur une seule ligne
export function consoleCommands(code) {
    try {
        const crosshair = decodeCrosshairShareCode(code);
        return crosshairToConVars(crosshair).trim().split("\n").join("; ");
    } catch (error) {
        return "Invalid crosshair code";
    }
}

// Date "17/10/2026" -> "20261017" (pour trier du plus récent au plus ancien)
export function sortableDate(date) {
    const parts = String(date || "").split("/");
    return parts.length === 3 ? parts[2] + parts[1] + parts[0] : "";
}

// Infos d'une équipe (couleur, logo), ou undefined pour les créateurs
export function teamInfo(teamName) {
    return teams.find(function (t) {
        return t.name === teamName;
    });
}

// Couleur de l'équipe (violet par défaut pour les créateurs)
export function teamColor(teamName) {
    const team = teamInfo(teamName);
    return team ? team.color : "#A78BFA";
}

// Couleur du texte posé sur la couleur de l'équipe : noir sur les couleurs claires, blanc sur les foncées
export function textOnColor(hex) {
    const n = parseInt(String(hex).replace("#", ""), 16);
    const light = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
    return light > 0.55 ? "#111214" : "#FFFFFF";
}

// Petit logo de l'équipe (si le fichier manque, on garde la pastille de couleur)
// logo = chemin du logo optimisé (logos/sm/...) quand build.js l'a préparé ; size = taille affichée en pixels
export function teamBadge(teamName, logo, size) {
    const team = teamInfo(teamName);
    if (!team) {
        return "";
    }
    const px = size || 16;
    return `<span class="team-badge" style="--c: ${team.color}"><img src="${logo || team.logo}" alt="" width="${px}" height="${px}" decoding="async" onerror="this.remove()"></span>`;
}

// Photo du joueur dans une carte. "file" = la vignette préparée par build.js ("" = pas de photo -> initiales)
// eager = true pour les premières cartes (visibles sans défiler) : chargées tout de suite, c'est ce que Google mesure en premier
export function photoHTML(player, className, file, eager) {
    const initials = esc(player.name.slice(0, 2).toUpperCase());
    if (!file) {
        return `<div class="${className}">${initials}</div>`;
    }
    // loading="lazy" : la photo ne se télécharge que quand on arrive dessus en faisant défiler
    // width/height : la place est réservée avant le chargement, la page ne "saute" pas
    return `<img class="${className}" src="${esc(file)}" alt="${esc(player.name)}" width="76" height="86" loading="${eager ? "eager" : "lazy"}" decoding="async" data-initials="${initials}" onerror="photoFallback(this)">`;
}

// La carte complète d'un joueur, façon "fiche joueur" de retransmission :
// bandeau couleur d'équipe (nom + photo), ligne équipe/date, boîte "Crosshair" (aperçu taille réelle), code, console
// options : photo (vignette), photoMd (photo moyenne pour la fiche), eager (charger tout de suite), logo (logo optimisé)
export function cardHTML(player, options) {
    const o = options || {};
    const name = esc(player.name);
    const team = esc(player.team);
    const color = teamColor(player.team);
    const photoAttr = (o.photoMd ? ` data-photo="${esc(o.photoMd)}"` : "") + (player.faceit ? ` data-faceit="${esc(player.faceit)}"` : "");
    return `<article class="card" data-slug="${slug(player.name)}" data-team="${team}" data-name="${esc(player.name.toLowerCase())}" data-updated="${sortableDate(player.updated)}" data-date="${esc(player.updated)}"${photoAttr} style="--team: ${color}; --on-team: ${textOnColor(color)}">
            <div class="card-top">
                <h3><a href="players/${slug(player.name)}.html">${name}</a></h3>
                ${photoHTML(player, "card-photo", o.photo, o.eager)}
            </div>
            <div class="card-meta">
                <span class="team">${teamBadge(player.team, o.logo, 16)}${team}</span>
                <span class="date">Updated ${esc(player.updated)}</span>
            </div>
            <div class="stat">
                <span class="stat-label">Crosshair</span>
                <canvas class="preview" width="560" height="160" role="img" aria-label="${name} CS2 crosshair preview"></canvas>
            </div>
            <div class="field">
                <div class="field-label">Share code <span><i class="sep">· </i>Settings › Crosshair › Import</span></div>
                <div class="field-row">
                    <code class="code">${esc(player.code)}</code>
                    <button class="copy-code mini">Copy</button>
                </div>
            </div>
            <div class="field">
                <div class="field-label">Console <span><i class="sep">· </i>Paste in the CS2 console (~)</span></div>
                <div class="field-row">
                    <code class="console">${esc(consoleCommands(player.code))}</code>
                    <button class="copy-console mini btn-secondary">Copy</button>
                </div>
            </div>
        </article>`;
}

// ===== Le générateur de crosshair (generator.html + onglet Generator de l'accueil) =====
// defaultCode : le crosshair de départ ; groups : [{ title: "Team Spirit", players: [{ name, code }] }]
// Rendu vivant par generator.js. Les réglages en pixels suivent le format CS2 (sizes in pixels for a screen height).
const GEN_COLORS = [["Green", "#00FF00"], ["Yellow", "#FFFF00"], ["Cyan", "#00FFFF"], ["Red", "#FF0000"], ["Pink", "#FF00FF"], ["White", "#FFFFFF"]];
// Résolutions utilisées sur CS2, par format d'écran. Elles ne changent PAS le code : elles servent à l'aperçu,
// pour voir le crosshair comme en jeu dans cette résolution. Les formats "stretched" (4:3, 5:4) sont étirés
// en largeur sur un écran 16:9 : stretch = (16/9) / (largeur/hauteur)
const GEN_RESOLUTIONS = [
    ["16:9", false, ["1920x1080", "2560x1440", "1600x900", "1280x720", "3840x2160"]],
    ["4:3 stretched", true, ["1280x960", "1024x768", "1440x1080", "1152x864"]],
    ["16:10", false, ["1680x1050", "1440x900", "1280x800", "1920x1200"]],
    ["5:4 stretched", true, ["1280x1024"]]
];

function stretchOf(resolution, stretched) {
    const size = resolution.split("x").map(Number);
    return stretched ? Math.round((16 / 9) / (size[0] / size[1]) * 1000) / 1000 : 1;
}

function genSlider(field, label, min, max, value, help) {
    return `<div class="gen-slider">
                <label for="gen-${field}">${label}</label>
                <input type="range" id="gen-${field}" data-field="${field}" min="${min}" max="${max}" step="1" value="${value}" style="--fill: ${Math.round((value - min) / (max - min) * 100)}%">
                <input type="number" data-field="${field}" min="${min}" max="${max}" step="1" value="${value}" inputmode="numeric" aria-label="${label} (${help})">
            </div>`;
}

function genToggle(field, label, checked) {
    return `<label class="gen-toggle"><input type="checkbox" data-field="${field}"${checked ? " checked" : ""}><span>${label}</span></label>`;
}

export function generatorHTML(defaultCode, groups) {
    const c = decodeCrosshairShareCode(defaultCode);
    const hex = "#" + [c.red, c.green, c.blue].map(function (v) {
        return v.toString(16).padStart(2, "0");
    }).join("").toUpperCase();

    const proOptions = groups.map(function (g) {
        return `<optgroup label="${esc(g.title)}">${g.players.map(function (p) {
            return `<option value="${esc(p.code)}">${esc(p.name)}</option>`;
        }).join("")}</optgroup>`;
    }).join("");

    return `<div class="gen" id="gen">
        <div class="gen-view">
            <div class="gen-stage">
                <canvas class="preview gen-preview" data-gen="preview" data-bg="raw" data-res="1920x1080" data-stretch="1" width="760" height="320" role="img" aria-label="Live preview of your CS2 crosshair"></canvas>
                <div class="gen-zoom" role="group" aria-label="Preview size">
                    <button type="button" data-zoom="1" aria-pressed="true">Real size</button>
                    <button type="button" data-zoom="3" aria-pressed="false">Zoom ×3</button>
                </div>
            </div>
            <div class="gen-res">
                <label class="gen-label" for="gen-res">Preview in your CS2 resolution</label>
                <select id="gen-res" data-gen="res">
                    ${GEN_RESOLUTIONS.map(function (group) {
                        return `<optgroup label="${group[0]}">${group[2].map(function (res) {
                            return `<option value="${res}" data-stretch="${stretchOf(res, group[1])}"${res === "1920x1080" ? " selected" : ""}>${res.replace("x", " × ")}${group[1] ? " stretched" : ""}</option>`;
                        }).join("")}</optgroup>`;
                    }).join("")}
                </select>
                <p class="gen-hint">Preview only: your crosshair code stays the same.</p>
            </div>
            <div class="field">
                <div class="field-label">Your share code <span><i class="sep">· </i>Settings › Crosshair › Import</span></div>
                <div class="field-row">
                    <code class="code" data-gen="code">${esc(defaultCode)}</code>
                    <button type="button" class="mini" data-copy="code">Copy</button>
                </div>
            </div>
            <div class="field">
                <div class="field-label">Console <span><i class="sep">· </i>Paste in the CS2 console (~)</span></div>
                <div class="field-row">
                    <code class="console" data-gen="console">${esc(consoleCommands(defaultCode))}</code>
                    <button type="button" class="mini btn-secondary" data-copy="console">Copy</button>
                </div>
            </div>
            <noscript><p class="gen-status gen-status-error">Turn on JavaScript to use the crosshair generator.</p></noscript>
        </div>

        <div class="gen-controls">
            <fieldset class="gen-group">
                <legend>Start from</legend>
                <div class="gen-start">
                    <label class="gen-label" for="gen-pro">A pro crosshair</label>
                    <select id="gen-pro" data-gen="pro">
                        <option value="">Choose a pro player…</option>
                        ${proOptions}
                    </select>
                    <label class="gen-label" for="gen-import">Or paste a code</label>
                    <input type="text" id="gen-import" data-gen="import" placeholder="CS…" autocomplete="off" spellcheck="false">
                </div>
                <p class="gen-status" data-gen="status" aria-live="polite"></p>
            </fieldset>

            <fieldset class="gen-group">
                <legend>Color</legend>
                <div class="gen-swatches">
                    ${GEN_COLORS.map(function (color) {
                        return `<button type="button" class="gen-swatch" data-color="${color[1]}" style="--swatch: ${color[1]}" aria-pressed="${color[1] === hex}" aria-label="${color[0]}" title="${color[0]}"></button>`;
                    }).join("\n                    ")}
                    <label class="gen-custom">
                        <input type="color" data-gen="color" value="${hex.toLowerCase()}">
                        <span>Custom</span>
                    </label>
                </div>
                <div class="gen-slider">
                    <label for="gen-alpha">Opacity</label>
                    <input type="range" id="gen-alpha" data-field="alpha" min="50" max="255" step="1" value="${c.alpha}" style="--fill: ${Math.round((c.alpha - 50) / 205 * 100)}%">
                    <output class="gen-out" data-gen="alpha-out" for="gen-alpha">${Math.round((c.alpha / 255) * 100)}%</output>
                </div>
            </fieldset>

            <fieldset class="gen-group">
                <legend>Size <span>in pixels</span></legend>
                ${genSlider("length", "Length", 0, 20, c.length, "pixels")}
                ${genSlider("thickness", "Thickness", 1, 10, c.thickness, "pixels")}
                ${genSlider("gap", "Gap", -5, 10, c.gap, "pixels")}
            </fieldset>

            <fieldset class="gen-group">
                <legend>Style</legend>
                <div class="gen-toggles">
                    ${genToggle("outlineMode", "Outline", c.outlineMode > 0)}
                    ${genToggle("centerDotEnabled", "Center dot", c.centerDotEnabled)}
                    ${genToggle("tStyleEnabled", "T-style", c.tStyleEnabled)}
                </div>
                <button type="button" class="gen-reset" data-gen="reset">Reset</button>
            </fieldset>
        </div>
    </div>`;
}

// ===== Skins des pros (skins.json, rempli par update-skins.js) =====
export const SKIN_CATEGORIES = [
    ["knives", "Knives"],
    ["gloves", "Gloves"],
    ["rifles", "Rifles"],
    ["snipers", "Sniper rifles"],
    ["pistols", "Pistols"],
    ["smgs", "SMGs"],
    ["heavy", "Shotguns & machine guns"]
];
const RARITY_RANK = { "Contraband": 8, "Extraordinary": 7, "Covert": 6, "Classified": 5, "Restricted": 4, "Mil-Spec Grade": 3, "Industrial Grade": 2, "Consumer Grade": 1 };

// "★ StatTrak™ Karambit | Doppler" -> { weapon: "★ Karambit", finish: "Doppler" }
export function skinParts(name) {
    const parts = String(name).replace("StatTrak™ ", "").replace(/^Souvenir /, "").split(" | ");
    return { weapon: parts[0], finish: parts[1] || "Vanilla" };
}

// Regroupe les exemplaires d'un même skin (même nom + même état) : on montre le meilleur float et "×N"
// Tri : couteaux et gants d'abord, puis par rareté, puis par nom
export function groupSkins(items) {
    const groups = new Map();
    items.forEach(function (item) {
        const group = groups.get(item.marketName);
        if (!group) {
            groups.set(item.marketName, { item: item, count: 1 });
            return;
        }
        group.count++;
        if (item.float !== null && (group.item.float === null || item.float < group.item.float)) {
            group.item = item;
        }
    });
    const order = SKIN_CATEGORIES.map(function (c) { return c[0]; });
    return Array.from(groups.values()).sort(function (a, b) {
        return order.indexOf(a.item.category) - order.indexOf(b.item.category) || byValue(a, b);
    });
}

// Du plus cher au moins cher (quand les prix sont connus), sinon par rareté, puis par nom
function byValue(a, b) {
    return (b.item.price ?? -1) - (a.item.price ?? -1)
        || (RARITY_RANK[b.item.rarity] || 0) - (RARITY_RANK[a.item.rarity] || 0)
        || Number(b.item.statTrak) - Number(a.item.statTrak)
        || a.item.name.localeCompare(b.item.name);
}

// Tous les skins d'un joueur, du plus cher au moins cher (toutes catégories mélangées)
export function byPrice(groups) {
    return groups.slice().sort(byValue);
}

// 1234.5 -> "$1,234.50"
export function formatPrice(value, currency) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(value);
}

// Une carte de skin. prefix = chemin vers la racine du site ("" ou "../")
export function skinCardHTML(group, playerName, prefix, eager) {
    const item = group.item;
    const parts = skinParts(item.name);
    const label = `${item.name}${item.exterior !== "Vanilla" ? " (" + item.exterior + ")" : ""}`;
    const badges = (item.statTrak ? `<span class="skin-badge">StatTrak™</span>` : "") + (item.souvenir ? `<span class="skin-badge">Souvenir</span>` : "");
    const float = item.float !== null
        ? `<div class="skin-wear" title="Exact float: ${item.float}"><span class="wear-bar"><i style="left: ${Math.min(100, item.float * 100).toFixed(2)}%"></i></span></div>`
        : "";
    return `<article class="skin" style="--rarity: ${esc(item.rarityColor || "#9DA2AA")}">
            <div class="skin-img"><img src="${prefix}skins/img/${esc(item.image)}.webp" alt="${esc(playerName)}'s ${esc(label)} CS2 skin" width="256" height="192" loading="${eager ? "eager" : "lazy"}" decoding="async"></div>
            <div class="skin-body">
                <p class="skin-weapon">${esc(parts.weapon)}${badges}</p>
                <h3 class="skin-name">${esc(parts.finish)}${group.count > 1 ? ` <span class="skin-count" title="${group.count} copies">×${group.count}</span>` : ""}</h3>
                <p class="skin-ext"><span class="skin-rarity">${esc(item.rarity)}</span> · ${esc(item.exterior)}</p>
                ${float}
                <dl class="skin-meta">
                    <div><dt>Float</dt><dd class="skin-float">${item.float !== null ? esc(String(item.float)) : "—"}</dd></div>
                    <div><dt>Price</dt><dd class="skin-price" data-market="${esc(item.marketName)}"${item.price != null ? "" : ` title="No price available"`}>${item.price != null ? `${esc(formatPrice(item.price, "USD"))}${item.priceEur != null ? ` <span class="skin-eur">${esc(formatPrice(item.priceEur, "EUR"))}</span>` : ""}` : "—"}</dd></div>
                </dl>
            </div>
        </article>`;
}

// Ordre par défaut des cartes : par équipe (ordre de teams.js), puis par nom
export function byTeamThenName(a, b) {
    const ia = teams.findIndex(function (t) { return t.name === a.team; });
    const ib = teams.findIndex(function (t) { return t.name === b.team; });
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}
