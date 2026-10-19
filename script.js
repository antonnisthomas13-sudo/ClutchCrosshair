// ===== script.js : l'interactivité de la page d'accueil =====
// Tout le contenu (cartes, menu des équipes, onglet Trending, compteurs) est déjà écrit dans index.html par build.js :
// ce fichier ajoute seulement les interactions. Rien de plus à télécharger (pas de players.json).
// crosshair.js : l'aperçu du crosshair + le bouton Copy (partagé avec les pages joueurs)
import { copyText, drawCrosshair } from "./crosshair.js?v=bfe149dd28";

const layout = document.querySelector(".layout");
const main = document.getElementById("main");
const prosSection = document.getElementById("pros");
const emptyMessage = document.getElementById("empty");
const proCards = Array.from(document.querySelectorAll("#pros .card"));
const creatorCards = Array.from(document.querySelectorAll("#creators .card"));

// 1. Aperçus des crosshairs : dessinés quand ils approchent de l'écran
document.querySelectorAll(".card").forEach(function (card) {
    drawCrosshair(card.querySelector(".preview"), card.querySelector(".code").textContent);
});

// 2. Clics dans la liste : un seul "écouteur" pour toutes les cartes
//    - bouton Copy : copie le code (ou les commandes console)
//    - ailleurs sur la carte (ou sur le nom) : ouvre la fiche du joueur
main.addEventListener("click", function (event) {
    const button = event.target.closest(".copy-code, .copy-console");
    if (button) {
        copyText(button.closest(".field-row").querySelector("code").textContent, button);
        return;
    }
    const card = event.target.closest(".card");
    if (!card) {
        return;
    }
    // Ctrl/Cmd/Maj + clic sur le nom : ouvrir la page du joueur (nouvel onglet), comme un lien normal
    if (event.target.closest("a") && (event.ctrlKey || event.metaKey || event.shiftKey)) {
        return;
    }
    event.preventDefault();
    openPlayer(card);
});

// 3. Filtrer les cartes (recherche ET menu des équipes)
//    La recherche filtre les pros ET les créateurs ; le menu des équipes ne filtre que les pros
function filterCards(test, fromTeamMenu) {
    let prosVisible = false;
    proCards.forEach(function (card) {
        const show = test(card);
        card.classList.toggle("hidden", !show);
        prosVisible = prosVisible || show;
    });

    let creatorsVisible = false;
    creatorCards.forEach(function (card) {
        const show = fromTeamMenu || test(card);
        card.classList.toggle("hidden", !show);
        creatorsVisible = creatorsVisible || show;
    });

    // Plus aucun pro visible : on cache la section et on affiche le message
    prosSection.classList.toggle("hidden", !prosVisible);
    emptyMessage.classList.toggle("hidden", prosVisible);

    // Si la recherche ne trouve que des créateurs, on ouvre directement l'onglet Creators
    showTab(!prosVisible && creatorsVisible ? "creators" : "home");
}

// 4. Barre de recherche (nom OU équipe) — calcul au plus une fois par image affichée
const search = document.getElementById("search");
let searchFrame = 0;

search.addEventListener("input", function () {
    cancelAnimationFrame(searchFrame);
    searchFrame = requestAnimationFrame(function () {
        const text = search.value.toLowerCase().trim();
        filterCards(function (card) {
            return card.dataset.name.includes(text) || card.dataset.team.toLowerCase().includes(text);
        }, false);
        easterEggs(text);
    });
});

// Easter eggs cachés dans la recherche (une seule fois par saisie, pas à chaque lettre)
const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let lastEgg = "";

function easterEggs(text) {
    const egg = /^rush\s*b!*$/.test(text) ? "rushb" : (text === "7355608" ? "bomb" : "");
    if (egg && egg !== lastEgg) {
        if (egg === "rushb") {
            rushB();
        } else {
            plantBomb();
        }
    }
    lastEgg = egg;
}

// "7355608" (le code de la bombe) : la C4 est posée, bips visuels qui accélèrent, petite explosion cartoon,
// "Terrorists win". Pas de son, pas de flash, 4 secondes maximum, un clic n'importe où (ou Échap) ferme tout.
function plantBomb() {
    if (document.querySelector(".c4")) {
        return;
    }
    const overlay = document.createElement("div");
    overlay.className = "c4";
    overlay.setAttribute("role", "status");
    overlay.innerHTML = '<div class="c4-scene" aria-hidden="true">'
        + '<svg class="c4-bomb" viewBox="0 0 240 150">'
        + '<rect class="c4-block" x="20" y="44" width="200" height="28" rx="6"/>'
        + '<rect class="c4-block" x="20" y="76" width="200" height="28" rx="6"/>'
        + '<rect class="c4-block" x="20" y="108" width="200" height="28" rx="6"/>'
        + '<rect class="c4-tape" x="44" y="40" width="16" height="100" rx="2"/>'
        + '<rect class="c4-tape" x="182" y="40" width="16" height="100" rx="2"/>'
        + '<path class="c4-wire" d="M86 96 C 60 100, 58 120, 40 122"/>'
        + '<path class="c4-wire c4-wire-b" d="M156 96 C 180 104, 186 122, 204 124"/>'
        + '<rect class="c4-box" x="80" y="18" width="80" height="86" rx="4"/>'
        + '<rect class="c4-screen" x="88" y="26" width="64" height="18" rx="2"/>'
        + '<text class="c4-digits" x="120" y="40" text-anchor="middle"></text>'
        + [0, 1, 2, 3].map(function (row) {
            return [0, 1, 2].map(function (col) {
                return '<rect class="c4-key" x="' + (91 + col * 20) + '" y="' + (51 + row * 12) + '" width="16" height="8" rx="1.5"/>';
            }).join("");
        }).join("")
        + '<circle class="c4-led" cx="152" cy="14" r="5"/>'
        + '</svg>'
        + '<div class="c4-boom"><i></i><i></i><i></i><b>BOOM!</b></div>'
        + '</div>'
        + '<p class="c4-title">Bomb has been planted</p>'
        + '<p class="c4-sub">Click anywhere to close</p>';
    document.body.appendChild(overlay);

    const digits = overlay.querySelector(".c4-digits");
    const led = overlay.querySelector(".c4-led");
    const title = overlay.querySelector(".c4-title");
    const sub = overlay.querySelector(".c4-sub");
    const timers = [];
    const later = function (ms, fn) {
        timers.push(setTimeout(fn, ms));
    };
    function close() {
        timers.forEach(clearTimeout);
        overlay.remove();
        document.removeEventListener("keydown", onKey);
    }
    function onKey(event) {
        if (event.key === "Escape") {
            close();
        }
    }
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", onKey);

    function ending() {
        title.textContent = "Terrorists win";
        sub.textContent = "You should've defused it.";
        overlay.classList.add("c4-ended");
    }

    if (calm) {
        // Moins d'animations : pas d'explosion, juste le texte qui change
        digits.textContent = "7355608";
        later(1500, ending);
        later(3200, close);
        return;
    }

    // Le code se tape chiffre par chiffre sur l'écran
    "7355608".split("").forEach(function (d, i) {
        later(80 + i * 85, function () {
            digits.textContent += d;
        });
    });
    // Bips visuels de plus en plus rapides (la LED et une onde), de 0,7 s à 2,7 s
    let t = 700;
    let gap = 380;
    while (t < 2650) {
        later(t, function () {
            led.classList.remove("c4-beep");
            void led.getBoundingClientRect();
            led.classList.add("c4-beep");
            overlay.classList.remove("c4-pulse");
            void overlay.offsetWidth;
            overlay.classList.add("c4-pulse");
        });
        t += gap;
        gap = Math.max(70, gap * 0.78);
    }
    later(2700, function () {
        overlay.classList.remove("c4-pulse");
        overlay.classList.add("c4-exploded");
    });
    later(3150, ending);
    later(4000, close);
}

// "rush b" : un petit bonhomme traverse l'écran en courant ("Rush B, don't stop!"), puis disparaît
function rushB() {
    if (document.querySelector(".rushb")) {
        return;
    }
    const runner = document.createElement("div");
    runner.className = "rushb";
    runner.setAttribute("aria-hidden", "true");
    runner.innerHTML = '<span class="rushb-bubble">Rush B, don\'t stop!</span>'
        + '<svg class="rushb-guy" viewBox="0 0 64 80">'
        + '<g class="rushb-lean">'
        + '<line class="rushb-limb rushb-leg-a" x1="30" y1="48" x2="22" y2="74"/>'
        + '<line class="rushb-limb rushb-leg-b" x1="30" y1="48" x2="38" y2="74"/>'
        + '<line class="rushb-limb rushb-torso" x1="33" y1="26" x2="30" y2="48"/>'
        + '<line class="rushb-limb rushb-arm-a" x1="33" y1="30" x2="22" y2="42"/>'
        + '<line class="rushb-limb rushb-arm-b" x1="33" y1="30" x2="45" y2="40"/>'
        + '<circle class="rushb-head" cx="35" cy="15" r="9"/>'
        + '<path class="rushb-band" d="M26 12 h18 v4 h-18 Z M26 13 l-8 -4 l2 7 Z"/>'
        + '</g></svg>';
    document.body.appendChild(runner);
    const remove = function () {
        runner.remove();
    };
    if (calm) {
        setTimeout(remove, 1600);
    } else {
        runner.addEventListener("animationend", function (event) {
            if (event.target === runner) {
                remove();
            }
        });
        setTimeout(remove, 5000); // sécurité
    }
}

// 5. Menu de gauche : les équipes (boutons déjà écrits par build.js)
const teamsMenu = document.getElementById("teams");

teamsMenu.addEventListener("click", function (event) {
    const button = event.target.closest(".side-btn");
    if (!button) {
        return;
    }
    search.value = "";
    teamsMenu.querySelectorAll(".side-btn").forEach(function (b) {
        const active = b === button;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const team = button.dataset.team;
    filterCards(function (card) {
        return !team || card.dataset.team === team;
    }, true);
});

// 6. Trier les cartes : par équipe (ordre d'origine), par date de mise à jour, ou par nom
const sortSelect = document.getElementById("sort");
proCards.concat(creatorCards).forEach(function (card, i) {
    card.dataset.order = i;
});

function sortCards(mode) {
    [[prosSection, proCards], [document.getElementById("creators"), creatorCards]].forEach(function (pair) {
        pair[1].slice().sort(function (a, b) {
            const byName = a.dataset.name.localeCompare(b.dataset.name);
            if (mode === "recent") {
                return b.dataset.updated.localeCompare(a.dataset.updated) || byName;
            }
            if (mode === "name") {
                return byName;
            }
            return a.dataset.order - b.dataset.order;
        }).forEach(function (card) {
            pair[0].appendChild(card); // le titre h2 reste en premier
        });
    });
}

sortSelect.addEventListener("change", function () {
    sortCards(sortSelect.value);
});
// Les cartes arrivent déjà triées par équipe : on ne trie que si le navigateur a gardé un autre choix
if (sortSelect.value !== "team") {
    sortCards(sortSelect.value);
}

// 7. Onglets (Pros / Creators / Trending / Generator / Pro Skins) — souris et clavier (flèches)
const tabs = Array.from(document.querySelectorAll(".tab"));

function showTab(name) {
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
        panel.classList.toggle("hidden", panel.id !== "tab-" + name);
    });
    tabs.forEach(function (tab) {
        const active = tab.dataset.tab === name;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", active ? "true" : "false");
        tab.tabIndex = active ? 0 : -1;
    });
    // Le tri ne sert qu'aux listes de joueurs (Pros, Creators) : caché ailleurs
    sortSelect.closest(".sort").classList.toggle("hidden", name !== "home" && name !== "creators");
    if (name === "generator") {
        loadGenerator();
    }
}

// Le générateur n'est téléchargé qu'à la première ouverture de son onglet : l'accueil reste léger
let generatorLoading = null;

function loadGenerator() {
    if (!generatorLoading) {
        generatorLoading = import("./generator.js?v=5a6a9b0c15").then(function (module) {
            module.initGenerator(document.getElementById("gen"));
        }).catch(function () {
            generatorLoading = null; // connexion coupée : on réessaiera au prochain clic
        });
    }
}

tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () {
        showTab(tab.dataset.tab);
    });
    tab.addEventListener("keydown", function (event) {
        const moves = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
        if (!(event.key in moves)) {
            return;
        }
        event.preventDefault();
        const next = tabs[(moves[event.key] + tabs.length) % tabs.length];
        showTab(next.dataset.tab);
        next.focus();
    });
});

// Onglet Pro Skins : un clic sur un joueur affiche ses skins (tout est déjà dans la page, écrit par build.js)
const proSkins = document.querySelector(".ps");
if (proSkins) {
    proSkins.addEventListener("click", function (event) {
        const button = event.target.closest(".ps-player");
        if (!button) {
            return;
        }
        proSkins.querySelectorAll(".ps-player").forEach(function (b) {
            b.setAttribute("aria-pressed", b === button ? "true" : "false");
        });
        proSkins.querySelectorAll(".ps-panel").forEach(function (panel) {
            panel.classList.toggle("hidden", panel.dataset.psPanel !== button.dataset.ps);
        });
    });
}

// Accès rapides de l'en-tête : ouvrent l'onglet et descendent jusqu'aux cartes
document.querySelectorAll("[data-goto]").forEach(function (button) {
    button.addEventListener("click", function () {
        showTab(button.dataset.goto);
        document.querySelector(".tabs").scrollIntoView({ block: "start" });
    });
});

// 8. Mode sombre / clair
//    Le choix est retenu (localStorage). Le mode est appliqué dès le début de la page (petit script dans index.html)
const themeButton = document.getElementById("theme-toggle");

function updateThemeButton() {
    themeButton.textContent = document.body.classList.contains("light") ? "Dark mode" : "Light mode";
}

themeButton.addEventListener("click", function () {
    const light = !document.body.classList.contains("light");
    document.documentElement.classList.toggle("light", light);
    document.body.classList.toggle("light", light);
    updateThemeButton();
    try {
        localStorage.setItem("theme", light ? "light" : "dark");
    } catch (error) {
        // Navigation privée : on ne peut pas retenir le choix, ce n'est pas grave
    }
});

updateThemeButton();

// 9. Fiche joueur (fenêtre), remplie à partir de la carte
//    Quand une fiche est ouverte, l'adresse devient .../#pseudo : on peut partager le lien,
//    et le bouton Retour du navigateur ferme la fiche
const modal = document.getElementById("modal");
const modalBox = modal.querySelector(".modal-box");
const modalClose = document.getElementById("modal-close");
let openedFromSite = false; // true si la fiche a été ouverte par un clic sur le site
let lastFocus = null;       // l'élément à qui rendre le focus à la fermeture (navigation au clavier)

function cardFor(slugValue) {
    const s = CSS.escape(slugValue);
    return document.querySelector('#pros .card[data-slug="' + s + '"], #creators .card[data-slug="' + s + '"]');
}

function openPlayer(card) {
    openedFromSite = true;
    lastFocus = document.activeElement;
    location.hash = card.dataset.slug; // déclenche showPlayerFromAddress()
}

function showPlayerFromAddress() {
    const card = location.hash.length > 1 ? cardFor(decodeURIComponent(location.hash.slice(1))) : null;
    if (card) {
        showPlayer(card);
    } else {
        hidePlayer();
    }
}

function showPlayer(card) {
    const name = card.querySelector("h3").textContent;
    const code = card.querySelector(".code").textContent;

    // Couleur de l'équipe pour le bandeau de la fiche (texte noir ou blanc selon la couleur)
    modalBox.style.setProperty("--team", card.style.getPropertyValue("--team"));
    modalBox.style.setProperty("--on-team", card.style.getPropertyValue("--on-team"));

    // Photo (version moyenne, préparée par build.js) ou initiales
    const photo = document.getElementById("modal-photo");
    const initials = document.createElement("div");
    initials.className = "modal-img";
    initials.textContent = name.slice(0, 2).toUpperCase();
    photo.textContent = "";
    if (card.dataset.photo) {
        const img = document.createElement("img");
        img.className = "modal-img";
        img.src = card.dataset.photo;
        img.alt = name;
        img.width = 128;
        img.height = 128;
        img.decoding = "async";
        img.onerror = function () {
            img.replaceWith(initials);
        };
        photo.appendChild(img);
    } else {
        photo.appendChild(initials);
    }

    document.getElementById("modal-name").textContent = name;
    document.getElementById("modal-team").textContent = card.dataset.team;
    document.getElementById("modal-date").textContent = "Last update: " + card.dataset.date;
    document.getElementById("modal-code").textContent = code;
    document.getElementById("modal-console").textContent = card.querySelector(".console").textContent;
    document.getElementById("modal-page").href = card.querySelector("h3 a").getAttribute("href");
    const faceit = document.getElementById("modal-faceit");
    faceit.hidden = !card.dataset.faceit; // bouton seulement pour les créateurs qui ont un profil FACEIT
    faceit.href = card.dataset.faceit || "#";
    faceit.setAttribute("aria-label", name + " FACEIT profile (opens in a new tab)");

    const wasHidden = modal.classList.contains("hidden");
    modal.classList.remove("hidden");
    layout.inert = true; // le reste de la page n'est plus atteignable au clavier tant que la fiche est ouverte

    const preview = document.getElementById("modal-preview");
    preview.setAttribute("aria-label", name + " CS2 crosshair preview");
    drawCrosshair(preview, code);

    if (wasHidden) {
        modalClose.focus();
    }
}

function hidePlayer() {
    openedFromSite = false;
    if (modal.classList.contains("hidden")) {
        return;
    }
    modal.classList.add("hidden");
    layout.inert = false;
    if (lastFocus && document.contains(lastFocus)) {
        lastFocus.focus();
    }
    lastFocus = null;
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
        hidePlayer();
    }
}

window.addEventListener("hashchange", showPlayerFromAddress);
modalClose.addEventListener("click", closePlayer);

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

document.getElementById("modal-copy").addEventListener("click", function (event) {
    copyText(document.getElementById("modal-code").textContent, event.currentTarget);
});

document.getElementById("modal-copy-console").addEventListener("click", function (event) {
    copyText(document.getElementById("modal-console").textContent, event.currentTarget);
});

// Si l'adresse contient déjà un joueur (lien partagé, ex. .../#zywoo), on ouvre sa fiche
showPlayerFromAddress();
