// La liste des équipes (le nom doit être EXACTEMENT le même que dans players.json)
const teams = [
    { name: "Team Spirit", color: "#B7BEC8" },
    { name: "Team Vitality", color: "#F5D547" },
    { name: "Falcons", color: "#2ECC71" }
];

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
        card.innerHTML = `
            ${photoHTML(player, "card-photo")}
            <h3>${player.name}</h3>
            <span class="team">${player.team}</span>
            <p>${player.code}</p>
            <button>Copy</button>
        `;

        card.addEventListener("click", function (event) {
            if (event.target.tagName === "BUTTON") {
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

    // Section Trending : uniquement les joueurs avec "trending": true
    players.forEach(function (player) {
        if (!player.trending) {
            return;
        }

        const trend = document.createElement("article");
        trend.className = "trend-card";
        trend.innerHTML = `
            <h3>${player.name}</h3>
            <span>${player.team}</span>
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

    // 2. Bouton Copy
    const buttons = document.querySelectorAll(".card button");

    buttons.forEach(function (button) {
        button.addEventListener("click", function () {
            const code = button.parentElement.querySelector("p").textContent;
            navigator.clipboard.writeText(code);
            button.textContent = "Copied!";
        });
    });

    // 3. Barre de recherche (nom OU équipe)
    const search = document.getElementById("search");
    const cards = document.querySelectorAll(".card");

    search.addEventListener("input", function () {
        const text = search.value.toLowerCase();

        cards.forEach(function (card) {
            const name = card.querySelector("h3").textContent.toLowerCase();
            const team = card.querySelector(".team").textContent.toLowerCase();

            if (name.includes(text) || team.includes(text)) {
                card.style.display = "";
            } else {
                card.style.display = "none";
            }
        });
    });

    // 4. Menu des équipes
    const teamsMenu = document.getElementById("teams");

    function showTeam(teamName, clickedButton) {
        cards.forEach(function (card) {
            const team = card.querySelector(".team").textContent;
            if (teamName === "All" || team === teamName) {
                card.style.display = "";
            } else {
                card.style.display = "none";
            }
        });

        document.querySelectorAll(".team-btn").forEach(function (b) {
            b.classList.remove("active");
        });
        clickedButton.classList.add("active");
    }

    const allButton = document.createElement("button");
    allButton.className = "team-btn active";
    allButton.textContent = "All";
    allButton.addEventListener("click", function () {
        showTeam("All", allButton);
    });
    teamsMenu.appendChild(allButton);

    teams.forEach(function (team) {
        const button = document.createElement("button");
        button.className = "team-btn";
        button.textContent = team.name;
        button.style.borderLeft = "5px solid " + team.color;
        button.addEventListener("click", function () {
            showTeam(team.name, button);
        });
        teamsMenu.appendChild(button);
    });
}

// 5. Mode sombre / clair
const themeButton = document.getElementById("theme-toggle");

themeButton.addEventListener("click", function () {
    document.body.classList.toggle("light");

    if (document.body.classList.contains("light")) {
        themeButton.textContent = "Dark mode";
    } else {
        themeButton.textContent = "Light mode";
    }
});

// 6. Fiche joueur
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

// 7. Photo du joueur (ou ses initiales s'il n'a pas encore de photo)
function photoHTML(player, className) {
    if (player.photo) {
        return `<img class="${className}" src="${player.photo}" alt="${player.name}">`;
    }
    const initials = player.name.slice(0, 2).toUpperCase();
    return `<div class="${className}">${initials}</div>`;
}