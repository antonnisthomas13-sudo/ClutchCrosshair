// ===== Librairie qui décode les codes de partage CS2 =====
import { decodeCrosshairShareCode, crosshairToConVars } from "https://cdn.jsdelivr.net/npm/csgo-sharecode@5.0.0/+esm";

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

// Couleurs de base de CS2 (cl_crosshaircolor 0 à 4). La 5 = couleur perso (R, G, B)
const CS_COLORS = [[250, 50, 50], [50, 250, 50], [250, 250, 50], [50, 50, 250], [50, 250, 250]];

// Dessine le crosshair dans un <canvas>, sur un fond moitié clair / moitié sombre
function drawCrosshair(canvas, code) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    // Fond : sable à gauche, mur sombre à droite (pour voir s'il reste lisible partout)
    ctx.fillStyle = "#C8B38A";
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = "#2A3036";
    ctx.fillRect(w / 2, 0, w / 2, h);

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

    const zoom = 4; // on agrandit pour bien voir
    const rgb = c.color === 5 || !CS_COLORS[c.color] ? [c.red, c.green, c.blue] : CS_COLORS[c.color];
    const alpha = c.alphaEnabled ? c.alpha / 255 : 1;
    const length = Math.round((c.length ?? c.size ?? 5) * 2 * zoom);
    const thick = Math.max(zoom, Math.round(c.thickness * 2 * zoom));
    const gap = Math.max(-Math.floor(thick / 2), Math.round((c.gap + 4) * zoom));
    const half = Math.floor(thick / 2);
    const cx = Math.round(w / 2);
    const cy = Math.round(h / 2);

    // Les 4 traits (x, y, largeur, hauteur)
    const bars = [
        [cx + gap, cy - half, length, thick],          // droite
        [cx - gap - length, cy - half, length, thick], // gauche
        [cx - half, cy + gap, thick, length]           // bas
    ];
    if (!c.tStyleEnabled) {
        bars.push([cx - half, cy - gap - length, thick, length]); // haut (absent en style T)
    }
    if (c.centerDotEnabled) {
        bars.push([cx - half, cy - half, thick, thick]); // point central
    }

    // Contour noir
    if (c.outlineEnabled) {
        const o = Math.max(1, Math.round(c.outline * zoom));
        ctx.fillStyle = "rgba(0, 0, 0, " + alpha + ")";
        bars.forEach(function (b) {
            ctx.fillRect(b[0] - o, b[1] - o, b[2] + o * 2, b[3] + o * 2);
        });
    }

    // Le crosshair
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
    { name: "Team Spirit", color: "#B7BEC8" },
    { name: "Team Vitality", color: "#F5D547" },
    { name: "Falcons", color: "#2ECC71" }
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

    // 1. Fabriquer une carte pour chaque joueur
    players.forEach(function (player) {
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
                    <span class="team">${player.team}</span>
                </div>
            </div>
            <canvas class="preview" width="560" height="220"></canvas>
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

        // Clic sur la carte = fiche (sauf sur un bouton ou le lien du nom)
        card.addEventListener("click", function (event) {
            if (event.target.tagName === "BUTTON" || event.target.tagName === "A") {
                return;
            }
            openPlayer(player);
        });

        if (player.category === "pro") {
            document.getElementById("pros").appendChild(card);
        } else {
            document.getElementById("creators").appendChild(card);
        }
    });

    // 2. Onglet Trending : uniquement les joueurs avec "trending": true
    players.forEach(function (player) {
        if (!player.trending) {
            return;
        }

        const trend = document.createElement("article");
        trend.className = "trend-card";
        trend.style.setProperty("--team", teamColor(player.team));
        trend.innerHTML = `
            ${photoHTML(player, "card-photo")}
            <div class="trend-info">
                <h3>${player.name}</h3>
                <span class="team">${player.team}</span>
            </div>
            <button>Copy</button>
        `;

        trend.querySelector("button").addEventListener("click", function (event) {
            copyText(player.code, event.target);
        });

        trend.addEventListener("click", function (event) {
            if (event.target.tagName === "BUTTON") {
                return;
            }
            openPlayer(player);
        });

        document.getElementById("trending").appendChild(trend);
    });

    // 3. Filtrer les cartes (utilisé par la recherche ET par le menu de gauche)
    const cards = document.querySelectorAll(".card");

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
        addSideButton(teamsMenu, team.name, function (card) {
            return card.dataset.team === team.name;
        }, team.color);
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

// 9. Photo du joueur (ou ses initiales s'il n'a pas encore de photo)
function photoHTML(player, className) {
    if (player.photo) {
        return `<img class="${className}" src="${player.photo}" alt="${player.name}">`;
    }
    const initials = player.name.slice(0, 2).toUpperCase();
    return `<div class="${className}">${initials}</div>`;
}

// 10. Transforme un nom en adresse propre : "ZywOo" -> "zywoo"
function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}