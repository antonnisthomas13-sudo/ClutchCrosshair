// ===== render.js : fabrique le HTML des cartes joueurs =====
// Utilisé par build.js, qui écrit les cartes directement dans index.html (lisibles par Google, rien à calculer dans le navigateur).
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
    const photoAttr = o.photoMd ? ` data-photo="${esc(o.photoMd)}"` : "";
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

// Ordre par défaut des cartes : par équipe (ordre de teams.js), puis par nom
export function byTeamThenName(a, b) {
    const ia = teams.findIndex(function (t) { return t.name === a.team; });
    const ib = teams.findIndex(function (t) { return t.name === b.team; });
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}
