// ===== Les données du site =====

// Les équipes (le nom doit être EXACTEMENT le même que dans players.json)
const teams = [
    { name: "Team Spirit", color: "#B7BEC8" },
    { name: "Team Vitality", color: "#F5D547" },
    { name: "Falcons", color: "#2ECC71" }
];

// Les pays des créateurs (code à 2 lettres = celui de "country" dans players.json)
const countries = [
    { code: "fr", name: "France" },
    { code: "ua", name: "Ukraine" },
    { code: "tr", name: "Türkiye" },
    { code: "br", name: "Brazil" },
    { code: "pl", name: "Poland" },
    { code: "dk", name: "Denmark" }
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
            <p>${player.code}</p>
            <span class="date">Updated ${player.updated}</span>
            <button>Copy crosshair</button>
        `;

        // Clic sur la carte = fiche (sauf sur le bouton Copy ou le lien du nom)
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

    // Onglet Trending : uniquement les joueurs avec "trending": true
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
            navigator.clipboard.writeText(player.code);
            event.target.textContent = "Copied!";
        });

        trend.addEventListener("click", function (event) {
            if (event.target.tagName === "BUTTON") {
                return;
            }
            openPlayer(player);
        });

        document.getElementById("trending").appendChild(trend);
    });

    // 2. Bouton Copy des cartes
    document.querySelectorAll(".card button").forEach(function (button) {
        button.addEventListener("click", function () {
            const code = button.parentElement.querySelector("p").textContent;
            navigator.clipboard.writeText(code);
            button.textContent = "Copied!";
        });
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
        const text = search.value.toLowerCase();
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

function openPlayer(player) {
    document.getElementById("modal-name").textContent = player.name;
    document.getElementById("modal-photo").innerHTML = photoHTML(player, "modal-img");
    document.getElementById("modal-team").textContent = player.team;
    document.getElementById("modal-date").textContent = "Last update: " + player.updated;
    document.getElementById("modal-code").textContent = player.code;
    modalCopy.textContent = "Copy crosshair";
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
    const code = document.getElementById("modal-code").textContent;
    navigator.clipboard.writeText(code);
    modalCopy.textContent = "Copied!";
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