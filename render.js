// ===== render.js : fabrique le HTML des cartes joueurs =====
// Partagé par script.js (dans le navigateur) ET build.js (qui écrit les cartes directement dans index.html pour Google)
// Ce fichier ne touche pas à la page : il ne fait que renvoyer du texte HTML.

import { decodeCrosshairShareCode, crosshairToConVars } from "./lib/csgo-sharecode.js";
import { teams } from "./teams.js?v=1";

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

// Petit logo de l'équipe (si le fichier manque, on garde la pastille de couleur)
export function teamBadge(teamName, prefix = "") {
    const team = teamInfo(teamName);
    if (!team) {
        return "";
    }
    return `<span class="team-badge" style="--c: ${team.color}"><img src="${prefix}${team.logo}" alt="" onerror="this.remove()"></span>`;
}

// Photo du joueur. "file" = le vrai fichier quand on le connaît (build.js) ;
// sinon on essaie photos/pseudo.webp, puis .png, puis .jpg (voir photoFallback dans script.js), puis les initiales
export function photoHTML(player, className, file) {
    const initials = esc(player.name.slice(0, 2).toUpperCase());
    if (file === "") {
        return `<div class="${className}">${initials}</div>`;
    }
    const src = esc(file || player.photo || "photos/" + slug(player.name) + ".webp");
    // loading="lazy" : la photo ne se télécharge que quand on arrive dessus en faisant défiler
    return `<img class="${className}" src="${src}" alt="${esc(player.name)}" loading="lazy" decoding="async" data-initials="${initials}" onerror="photoFallback(this)">`;
}

// La carte complète d'un joueur (photo, aperçu, code, console)
export function cardHTML(player, photoFile) {
    const name = esc(player.name);
    const team = esc(player.team);
    return `<article class="card" data-slug="${slug(player.name)}" data-team="${team}" data-name="${esc(player.name.toLowerCase())}" data-updated="${sortableDate(player.updated)}" style="--team: ${teamColor(player.team)}">
            <div class="card-top">
                ${photoHTML(player, "card-photo", photoFile)}
                <div>
                    <h3><a href="players/${slug(player.name)}.html">${name}</a></h3>
                    <span class="team">${teamBadge(player.team)}${team}</span>
                </div>
            </div>
            <canvas class="preview" width="560" height="160" role="img" aria-label="${name} CS2 crosshair preview"></canvas>
            <div class="field">
                <div class="field-label">Share code <span>· Settings › Crosshair › Import</span></div>
                <div class="field-row">
                    <code class="code">${esc(player.code)}</code>
                    <button class="copy-code mini">Copy</button>
                </div>
            </div>
            <div class="field">
                <div class="field-label">Console <span>· Paste in the CS2 console (~)</span></div>
                <div class="field-row">
                    <code class="console">${esc(consoleCommands(player.code))}</code>
                    <button class="copy-console mini btn-secondary">Copy</button>
                </div>
            </div>
            <span class="date">Updated ${esc(player.updated)}</span>
        </article>`;
}

// Ordre par défaut des cartes : par équipe (ordre de teams.js), puis par nom
export function byTeamThenName(a, b) {
    const ia = teams.findIndex(function (t) { return t.name === a.team; });
    const ib = teams.findIndex(function (t) { return t.name === b.team; });
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.name.toLowerCase().localeCompare(b.name.toLowerCase());
}
