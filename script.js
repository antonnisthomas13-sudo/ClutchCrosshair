// ===== script.js : la page d'accueil (cartes, recherche, onglets, fiche joueur...) =====
// crosshair.js : l'aperçu du crosshair + le bouton Copy (partagé avec les pages joueurs)
// render.js    : le HTML des cartes (partagé avec build.js, qui écrit déjà les cartes dans index.html pour Google)
import { copyText, drawCrosshair } from "./crosshair.js?v=4";
import { teams } from "./teams.js?v=1";
import { slug, consoleCommands, teamBadge, photoHTML, cardHTML } from "./render.js?v=1";

// 0. Charger les joueurs depuis players.json, puis préparer le site
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

// Tous les joueurs (sert à ouvrir une fiche depuis l'adresse, ex. .../#zywoo)
let allPlayers = [];

// Transforme du HTML (texte) en élément de la page
function htmlToElement(html) {
    const box = document.createElement("div");
    box.innerHTML = html.trim();
    return box.firstElementChild;
}

function buildSite(players) {
    allPlayers = players;

    // 1. Rendre une carte "vivante" : aperçu dessiné, boutons Copy, clic = fiche du joueur
    function setupCard(card, player) {
        drawCrosshair(card.querySelector(".preview"), player.code);

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

    // Les cartes des pros et des créateurs sont déjà écrites dans index.html (par build.js) :
    // on les retrouve. S'il en manque une (build.js pas encore relancé), on la fabrique.
    players.forEach(function (player) {
        const section = document.getElementById(player.category === "pro" ? "pros" : "creators");
        let card = section.querySelector('.card[data-slug="' + slug(player.name) + '"]');
        if (!card) {
            card = htmlToElement(cardHTML(player));
            section.appendChild(card);
        }
        setupCard(card, player);
    });

    // 2. Onglet Trending : uniquement les joueurs avec "trending": true (même carte)
    players.forEach(function (player) {
        if (player.trending) {
            document.getElementById("trending").appendChild(setupCard(htmlToElement(cardHTML(player)), player));
        }
    });

    // 3. Filtrer les cartes (utilisé par la recherche ET par le menu de gauche)
    //    La recherche filtre les pros ET les créateurs ; le menu des équipes ne filtre que les pros
    const proCards = document.querySelectorAll("#pros .card");
    const creatorCards = document.querySelectorAll("#creators .card");

    function filterCards(test, clickedButton) {
        let prosVisible = false;
        proCards.forEach(function (card) {
            const show = test(card);
            card.style.display = show ? "" : "none";
            prosVisible = prosVisible || show;
        });

        let creatorsVisible = false;
        creatorCards.forEach(function (card) {
            const show = clickedButton ? true : test(card);
            card.style.display = show ? "" : "none";
            creatorsVisible = creatorsVisible || show;
        });

        // Cacher la section des pros si elle n'a plus aucune carte visible
        document.getElementById("pros").style.display = prosVisible ? "" : "none";
        document.getElementById("empty").classList.toggle("hidden", prosVisible);

        // Mettre le bouton cliqué en surbrillance
        if (clickedButton) {
            document.querySelectorAll(".side-btn").forEach(function (b) {
                b.classList.remove("active");
            });
            clickedButton.classList.add("active");
        }

        // Si la recherche ne trouve que des créateurs, on ouvre directement l'onglet Creators
        showTab(!prosVisible && creatorsVisible ? "creators" : "home");
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

    // 5. Menu de gauche : les équipes
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

    // 5b. Trier les cartes : par équipe, par date de mise à jour, ou par nom
    const sortSelect = document.getElementById("sort");

    function teamIndex(card) {
        const index = teams.findIndex(function (t) {
            return t.name === card.dataset.team;
        });
        return index === -1 ? 999 : index;
    }

    function sortCards(mode) {
        ["pros", "creators"].forEach(function (id) {
            const section = document.getElementById(id);
            const list = Array.from(section.querySelectorAll(".card"));
            list.sort(function (a, b) {
                const byName = a.dataset.name.localeCompare(b.dataset.name);
                if (mode === "recent") {
                    return b.dataset.updated.localeCompare(a.dataset.updated) || byName;
                }
                if (mode === "name") {
                    return byName;
                }
                return teamIndex(a) - teamIndex(b) || byName;
            });
            // On remet les cartes dans le nouvel ordre (le titre h2 reste en premier)
            list.forEach(function (card) {
                section.appendChild(card);
            });
        });
    }

    sortSelect.addEventListener("change", function () {
        sortCards(sortSelect.value);
    });
    sortCards(sortSelect.value);

    // Si l'adresse contient déjà un joueur (lien partagé, ex. .../#zywoo), on ouvre sa fiche
    showPlayerFromAddress();
}

// 6. Onglets (Pros / Creators / Trending / Generator / Pro Skins)
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
//    Le choix est retenu (localStorage). Le mode est appliqué dès le début de la page (petit script dans index.html)
const themeButton = document.getElementById("theme-toggle");

function updateThemeButton() {
    themeButton.textContent = document.body.classList.contains("light") ? "Dark mode" : "Light mode";
}

themeButton.addEventListener("click", function () {
    document.body.classList.toggle("light");
    updateThemeButton();
    try {
        localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
    } catch (error) {
        // Navigation privée : on ne peut pas retenir le choix, ce n'est pas grave
    }
});

updateThemeButton();

// 8. Fiche joueur
//    Quand une fiche est ouverte, l'adresse devient .../#pseudo : on peut partager le lien,
//    et le bouton Retour du navigateur ferme la fiche
const modal = document.getElementById("modal");
const modalCopy = document.getElementById("modal-copy");
const modalCopyConsole = document.getElementById("modal-copy-console");
let openedFromSite = false; // true si la fiche a été ouverte par un clic sur le site

function openPlayer(player) {
    openedFromSite = true;
    location.hash = slug(player.name); // déclenche showPlayerFromAddress()
}

function showPlayerFromAddress() {
    const wanted = decodeURIComponent(location.hash.slice(1));
    const player = allPlayers.find(function (p) {
        return slug(p.name) === wanted;
    });
    if (player) {
        showPlayer(player);
    } else {
        openedFromSite = false;
        modal.classList.add("hidden");
    }
}

window.addEventListener("hashchange", showPlayerFromAddress);

function showPlayer(player) {
    document.getElementById("modal-name").textContent = player.name;
    document.getElementById("modal-photo").innerHTML = photoHTML(player, "modal-img");
    document.getElementById("modal-team").textContent = player.team;
    document.getElementById("modal-date").textContent = "Last update: " + player.updated;
    document.getElementById("modal-code").textContent = player.code;
    document.getElementById("modal-console").textContent = consoleCommands(player.code);
    document.getElementById("modal-page").href = "players/" + slug(player.name) + ".html";
    const preview = document.getElementById("modal-preview");
    preview.setAttribute("aria-label", player.name + " CS2 crosshair preview");
    drawCrosshair(preview, player.code);
    modal.classList.remove("hidden");
}

function closePlayer() {
    if (modal.classList.contains("hidden")) {
        return;
    }
    if (openedFromSite) {
        history.back(); // retire le #pseudo de l'adresse (et ferme la fiche)
    } else {
        // Arrivé par un lien partagé : on enlève le #pseudo sans quitter le site
        history.replaceState(null, "", location.pathname + location.search);
        modal.classList.add("hidden");
    }
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

// 9. Photo du joueur : on cherche photos/pseudo.webp (puis .png, puis .jpg)
//    S'il n'y a aucune photo, on affiche ses initiales
window.photoFallback = function (img) {
    const formats = ["png", "jpg"];
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
