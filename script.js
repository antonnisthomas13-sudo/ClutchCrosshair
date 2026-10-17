// ===== Librairie qui décode les codes de partage CS2 =====
import { decodeCrosshairShareCode, crosshairToConVars } from "https://cdn.jsdelivr.net/npm/csgo-sharecode@7.0.1/+esm";

// Transforme "CSGO-XXXXX-..." en commandes console sur une seule ligne
function consoleCommands(code) {
    try {
        const crosshair = decodeCrosshairShareCode(code);
        return crosshairToConVars(crosshair).trim().split("\n").join("; ");
    } catch (error) {
        return "Invalid crosshair code";
    }
}

// ===== Aperçu visuel du crosshair =====

// Couleurs de base de CS:GO (anciens codes) : 0 à 4. La 5 = couleur perso (R, G, B)
const CS_COLORS = [[250, 50, 50], [50, 250, 50], [250, 250, 50], [50, 50, 250], [50, 250, 250]];

// Image de fond : une vraie capture d'écran de CS2 (preview-bg.jpg)
// Elle est chargée une seule fois ; quand elle arrive, on redessine tous les aperçus
const bgImage = new Image();
bgImage.src = "preview-bg.jpg";
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
function drawCrosshair(canvas, code) {
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

// Copier un texte et afficher "Copied!" 1,5 seconde sur le bouton
function copyText(text, button) {
    navigator.clipboard.writeText(text);

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

// ===== Les données du site =====

// Les équipes (le nom doit être EXACTEMENT le même que dans players.json)
const teams = [
    { name: "Team Spirit", color: "#B7BEC8", logo: "logos/spirit.png" },
    { name: "Team Vitality", color: "#F5D547", logo: "logos/vitality.png" },
    { name: "MOUZ", color: "#E8505B", logo: "logos/mouz.png" },
    { name: "FURIA", color: "#E6E6E6", logo: "logos/furia.png" },
    { name: "Falcons", color: "#2ECC71", logo: "logos/falcons.png" },
    { name: "Aurora", color: "#8E7CF0", logo: "logos/aurora.png" },
    { name: "Natus Vincere", color: "#FFD400", logo: "logos/navi.png" },
    { name: "G2 Esports", color: "#D9DDE3", logo: "logos/g2.png" },
    { name: "FaZe Clan", color: "#E2394A", logo: "logos/faze.png" },
    { name: "Astralis", color: "#FF4655", logo: "logos/astralis.png" },
    { name: "Legacy", color: "#4FA3FF", logo: "logos/legacy.png" },
    { name: "MIBR", color: "#3D7BFF", logo: "logos/mibr.png" },
    { name: "FUT Esports", color: "#9AE66E", logo: "logos/fut.png" },
    { name: "PARIVISION", color: "#C084FC", logo: "logos/parivision.png" },
    { name: "BetBoom", color: "#FF8A3D", logo: "logos/betboom.png" }
];

// Les pays des créateurs (code à 2 lettres = celui de "country" dans players.json)
const countries = [
    { code: "br", name: "Brazil" },
    { code: "ru", name: "Russia" },
    { code: "tr", name: "Türkiye" },
    { code: "ua", name: "Ukraine" },
    { code: "pl", name: "Poland" },
    { code: "dk", name: "Denmark" },
    { code: "us", name: "United States" },
    { code: "fr", name: "France" },
    { code: "de", name: "Germany" },
    { code: "se", name: "Sweden" },
    { code: "kz", name: "Kazakhstan" },
    { code: "es", name: "Spain" },
    { code: "cz", name: "Czechia" },
    { code: "gb", name: "United Kingdom" },
    { code: "pt", name: "Portugal" },
    { code: "fi", name: "Finland" },
    { code: "mn", name: "Mongolia" },
    { code: "ar", name: "Argentina" },
    { code: "no", name: "Norway" },
    { code: "ca", name: "Canada" }
];

// Retrouver la couleur d'une équipe (violet par défaut pour les créateurs)
function teamColor(teamName) {
    const team = teams.find(function (t) {
        return t.name === teamName;
    });
    return team ? team.color : "#A78BFA";
}

// Petit logo de l'équipe (si le fichier manque, on garde la pastille de couleur)
function teamBadge(teamName) {
    const team = teams.find(function (t) {
        return t.name === teamName;
    });
    if (!team) {
        return "";
    }
    return `<span class="team-badge" style="--c: ${team.color}"><img src="${team.logo}" alt="" onerror="this.remove()"></span>`;
}

// 0. Charger les joueurs depuis players.json, puis construire le site
fetch("players.json")
    .then(function (response) {
        return response.json();
    })
    .then(function (players) {
        buildSite(players);
    })
    .catch(function (error) {
        console.error("Impossible de charger players.json :", error);
    });

function buildSite(players) {

    // 1. Fabriquer une carte complète pour un joueur (utilisée par Crosshairs ET Trending)
    function makeCard(player) {
        const card = document.createElement("article");
        card.className = "card";
        card.dataset.team = player.team;
        card.dataset.country = player.country || "";
        card.style.setProperty("--team", teamColor(player.team));
        card.innerHTML = `
            <div class="card-top">
                ${photoHTML(player, "card-photo")}
                <div>
                    <h3><a href="players/${slug(player.name)}.html">${player.name}</a></h3>
                    <span class="team">${teamBadge(player.team)}${player.team}</span>
                </div>
            </div>
            <canvas class="preview" width="560" height="160"></canvas>
            <div class="field">
                <div class="field-label">Share code <span>· Settings › Crosshair › Import</span></div>
                <div class="field-row">
                    <code class="code">${player.code}</code>
                    <button class="copy-code mini">Copy</button>
                </div>
            </div>
            <div class="field">
                <div class="field-label">Console <span>· Paste in the CS2 console (~)</span></div>
                <div class="field-row">
                    <code class="console">${consoleCommands(player.code)}</code>
                    <button class="copy-console mini btn-secondary">Copy</button>
                </div>
            </div>
            <span class="date">Updated ${player.updated}</span>
        `;

        // Dessiner l'aperçu du crosshair
        drawCrosshair(card.querySelector(".preview"), player.code);

        // Boutons Copy de la carte (code de partage OU commandes console)
        card.querySelector(".copy-code").addEventListener("click", function (event) {
            copyText(card.querySelector(".code").textContent, event.target);
        });

        card.querySelector(".copy-console").addEventListener("click", function (event) {
            copyText(card.querySelector(".console").textContent, event.target);
        });

        // Clic sur la carte (ou sur le nom) = fiche du joueur (sauf sur un bouton Copy)
        // Le lien du nom reste là pour Google, mais on ouvre la fiche à la place
        card.addEventListener("click", function (event) {
            if (event.target.tagName === "BUTTON") {
                return;
            }
            event.preventDefault();
            openPlayer(player);
        });

        return card;
    }

    players.forEach(function (player) {
        if (player.category === "pro") {
            document.getElementById("pros").appendChild(makeCard(player));
        } else {
            document.getElementById("creators").appendChild(makeCard(player));
        }
    });

    // 2. Onglet Trending : uniquement les joueurs avec "trending": true (même carte que Crosshairs)
    players.forEach(function (player) {
        if (player.trending) {
            document.getElementById("trending").appendChild(makeCard(player));
        }
    });

    // 3. Filtrer les cartes de l'onglet Crosshairs (utilisé par la recherche ET par le menu de gauche)
    const cards = document.querySelectorAll("#tab-home .card");

    function filterCards(test, clickedButton) {
        cards.forEach(function (card) {
            card.style.display = test(card) ? "" : "none";
        });

        // Cacher une section entière si elle n'a plus aucune carte visible
        let anyVisible = false;
        ["pros", "creators"].forEach(function (id) {
            const section = document.getElementById(id);
            const visible = Array.from(section.querySelectorAll(".card")).some(function (card) {
                return card.style.display !== "none";
            });
            section.style.display = visible ? "" : "none";
            if (visible) {
                anyVisible = true;
            }
        });
        document.getElementById("empty").classList.toggle("hidden", anyVisible);

        // Mettre le bouton cliqué en surbrillance
        if (clickedButton) {
            document.querySelectorAll(".side-btn").forEach(function (b) {
                b.classList.remove("active");
            });
            clickedButton.classList.add("active");
        }

        showTab("home");
    }

    // 4. Barre de recherche (nom OU équipe)
    const search = document.getElementById("search");

    search.addEventListener("input", function () {
        const text = search.value.toLowerCase().trim();
        filterCards(function (card) {
            const name = card.querySelector("h3").textContent.toLowerCase();
            const team = card.dataset.team.toLowerCase();
            return name.includes(text) || team.includes(text);
        }, null);
    });

    // 5. Menu de gauche : équipes puis pays
    function addSideButton(container, html, test, color) {
        const button = document.createElement("button");
        button.className = "side-btn";
        button.innerHTML = html;
        if (color) {
            button.style.borderLeft = "4px solid " + color;
        }
        button.addEventListener("click", function () {
            search.value = "";
            filterCards(test, button);
        });
        container.appendChild(button);
        return button;
    }

    const teamsMenu = document.getElementById("teams");

    const allButton = addSideButton(teamsMenu, "All crosshairs", function () {
        return true;
    });
    allButton.classList.add("active");

    teams.forEach(function (team) {
        addSideButton(teamsMenu, teamBadge(team.name) + team.name, function (card) {
            return card.dataset.team === team.name;
        });
    });

    const countriesMenu = document.getElementById("countries");

    countries.forEach(function (country) {
        addSideButton(
            countriesMenu,
            `<img class="flag" src="https://flagcdn.com/w40/${country.code}.png" alt=""> ${country.name}`,
            function (card) {
                return card.dataset.country === country.code;
            }
        );
    });
}

// 6. Onglets (Crosshairs / Trending)
function showTab(name) {
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
        panel.classList.toggle("hidden", panel.id !== "tab-" + name);
    });
    document.querySelectorAll(".tab").forEach(function (tab) {
        tab.classList.toggle("active", tab.dataset.tab === name);
    });
}

document.querySelectorAll(".tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
        showTab(tab.dataset.tab);
    });
});

// 7. Mode sombre / clair
const themeButton = document.getElementById("theme-toggle");

themeButton.addEventListener("click", function () {
    document.body.classList.toggle("light");

    if (document.body.classList.contains("light")) {
        themeButton.textContent = "Dark mode";
    } else {
        themeButton.textContent = "Light mode";
    }
});

// 8. Fiche joueur
const modal = document.getElementById("modal");
const modalCopy = document.getElementById("modal-copy");
const modalCopyConsole = document.getElementById("modal-copy-console");

function openPlayer(player) {
    document.getElementById("modal-name").textContent = player.name;
    document.getElementById("modal-photo").innerHTML = photoHTML(player, "modal-img");
    document.getElementById("modal-team").textContent = player.team;
    document.getElementById("modal-date").textContent = "Last update: " + player.updated;
    document.getElementById("modal-code").textContent = player.code;
    document.getElementById("modal-console").textContent = consoleCommands(player.code);
    drawCrosshair(document.getElementById("modal-preview"), player.code);
    modal.classList.remove("hidden");
}

function closePlayer() {
    modal.classList.add("hidden");
}

document.getElementById("modal-close").addEventListener("click", closePlayer);

modal.addEventListener("click", function (event) {
    if (event.target === modal) {
        closePlayer();
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        closePlayer();
    }
});

modalCopy.addEventListener("click", function () {
    copyText(document.getElementById("modal-code").textContent, modalCopy);
});

modalCopyConsole.addEventListener("click", function () {
    copyText(document.getElementById("modal-console").textContent, modalCopyConsole);
});

// 9. Photo du joueur : on cherche photos/pseudo.png (puis .webp, puis .jpg)
//    S'il n'y a aucune photo, on affiche ses initiales
window.photoFallback = function (img) {
    const formats = ["webp", "jpg"];
    const step = Number(img.dataset.step || 0);
    if (step < formats.length) {
        img.dataset.step = step + 1;
        img.src = img.src.replace(/\.\w+$/, "." + formats[step]);
    } else {
        const div = document.createElement("div");
        div.className = img.className;
        div.textContent = img.dataset.initials;
        img.replaceWith(div);
    }
};

function photoHTML(player, className) {
    const initials = player.name.slice(0, 2).toUpperCase();
    const src = player.photo || "photos/" + slug(player.name) + ".png";
    return `<img class="${className}" src="${src}" alt="${player.name}" data-initials="${initials}" onerror="photoFallback(this)">`;
}

// 10. Transforme un nom en adresse propre : "ZywOo" -> "zywoo"
function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}