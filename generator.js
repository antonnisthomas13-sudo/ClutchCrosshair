// ===== generator.js : le générateur de crosshair CS2 =====
// Utilisé par generator.html ET par l'onglet Generator de l'accueil (chargé seulement au clic sur l'onglet).
// Le HTML du générateur (curseurs, boutons...) est écrit par build.js (generatorHTML dans render.js) :
// ce fichier ne fait que le rendre vivant. Chaque réglage fabrique un VRAI code CS2 (format CS...).
import { encodeCrosshair, decodeCrosshairShareCode, crosshairToConVars } from "./lib/csgo-sharecode.js";
import { copyText, drawCrosshair } from "./crosshair.js?v=ae8050a5cd";

// Couleur (r, g, b) -> "#00FF00"
function toHex(c) {
    return "#" + [c.red, c.green, c.blue].map(function (v) {
        return Number(v).toString(16).padStart(2, "0");
    }).join("").toUpperCase();
}

// Lit un code CS2 ; renvoie null s'il est invalide ou au vieux format CSGO- (qui ne marche plus en jeu)
function readCode(text) {
    const code = String(text || "").trim();
    if (!/^CS[A-Za-z0-9]+$/.test(code)) {
        return null;
    }
    try {
        const c = decodeCrosshairShareCode(code);
        return c.format === "legacy-v1" ? null : c;
    } catch (error) {
        return null;
    }
}

// Point d'entrée : root = le bloc #gen ; options.syncHash = true sur generator.html
// (l'adresse devient generator.html#CS... : on peut partager son crosshair avec un simple lien)
export function initGenerator(root, options) {
    if (!root || root.dataset.ready) {
        return;
    }
    root.dataset.ready = "1";
    const syncHash = Boolean(options && options.syncHash);

    const $ = function (name) {
        return root.querySelector('[data-gen="' + name + '"]');
    };
    const preview = $("preview");
    const codeOut = $("code");
    const consoleOut = $("console");
    const status = $("status");
    const importInput = $("import");
    const proSelect = $("pro");
    const colorInput = $("color");
    const alphaOut = $("alpha-out");
    const fields = Array.from(root.querySelectorAll("[data-field]"));
    const swatches = Array.from(root.querySelectorAll("[data-color]"));

    // Le crosshair de départ = celui écrit dans la page par build.js (sert aussi au bouton Reset)
    const defaults = readCode(codeOut.textContent);
    let state = Object.assign({}, defaults);

    // ----- Afficher : code + console + aperçu (au plus une fois par image affichée) -----
    let frame = 0;
    let hashTimer = 0;
    let started = false; // l'adresse ne change qu'après un premier réglage du visiteur

    function render() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(function () {
            const code = encodeCrosshair(state);
            codeOut.textContent = code;
            consoleOut.textContent = crosshairToConVars(state).trim().split("\n").join("; ");
            drawCrosshair(preview, code);
            if (syncHash && started) {
                clearTimeout(hashTimer);
                hashTimer = setTimeout(function () {
                    history.replaceState(null, "", "#" + code);
                }, 250);
            }
            started = true;
        });
    }

    // Partie remplie du curseur (en rouge, à gauche du bouton)
    function paintRange(input) {
        if (input.type === "range") {
            const percent = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
            input.style.setProperty("--fill", percent + "%");
        }
    }

    // Met les curseurs, cases et couleurs en accord avec le crosshair actuel
    function syncControls() {
        fields.forEach(function (input) {
            const key = input.dataset.field;
            if (input.type === "checkbox") {
                input.checked = key === "outlineMode" ? state.outlineMode > 0 : Boolean(state[key]);
                return;
            }
            input.value = state[key];
            paintRange(input);
        });
        const hex = toHex(state);
        colorInput.value = hex.toLowerCase();
        swatches.forEach(function (button) {
            button.setAttribute("aria-pressed", button.dataset.color === hex ? "true" : "false");
        });
        alphaOut.textContent = Math.round((state.alpha / 255) * 100) + "%";
    }

    function load(crosshair) {
        state = Object.assign({}, defaults, crosshair, { format: "cs2-v1" });
        syncControls();
        render();
    }

    function setColor(hex) {
        const value = parseInt(hex.slice(1), 16);
        state.red = (value >> 16) & 255;
        state.green = (value >> 8) & 255;
        state.blue = value & 255;
        syncControls();
        render();
    }

    function showStatus(text, ok) {
        status.textContent = text;
        status.classList.toggle("gen-status-error", !ok);
    }

    // ----- Les réglages -----
    // Curseurs, champs chiffrés et cases à cocher : un seul "écouteur" pour tous
    root.addEventListener("input", function (event) {
        const input = event.target;
        const key = input.dataset.field;
        if (!key) {
            return;
        }
        if (input.type === "checkbox") {
            state[key] = key === "outlineMode" ? (input.checked ? 1 : 0) : input.checked;
        } else {
            const value = Math.round(Number(input.value));
            if (input.value === "" || Number.isNaN(value)) {
                return; // champ en cours de saisie (vide ou "-") : on attend
            }
            const min = Number(input.min);
            const max = Number(input.max);
            state[key] = Math.min(max, Math.max(min, value));
        }
        // Le curseur et le champ chiffré d'un même réglage bougent ensemble
        fields.forEach(function (other) {
            if (other.dataset.field === key && other.type !== "checkbox") {
                if (other !== input) {
                    other.value = state[key];
                }
                paintRange(other);
            }
        });
        if (key === "alpha") {
            alphaOut.textContent = Math.round((state.alpha / 255) * 100) + "%";
        }
        render();
    });

    // Champ chiffré quitté avec une valeur hors limites : on affiche la valeur vraiment utilisée
    root.addEventListener("change", function (event) {
        const input = event.target;
        if (input.dataset.field && input.type === "number") {
            input.value = state[input.dataset.field];
        }
    });

    swatches.forEach(function (button) {
        button.addEventListener("click", function () {
            setColor(button.dataset.color);
        });
    });

    colorInput.addEventListener("input", function () {
        setColor(colorInput.value.toUpperCase());
    });

    // Partir du crosshair d'un pro
    proSelect.addEventListener("change", function () {
        const crosshair = readCode(proSelect.value);
        if (crosshair) {
            load(crosshair);
            showStatus(proSelect.options[proSelect.selectedIndex].text + "'s crosshair loaded. Adjust it as you like.", true);
        }
    });

    // Importer un code collé
    importInput.addEventListener("input", function () {
        const text = importInput.value.trim();
        if (!text) {
            showStatus("", true);
            return;
        }
        if (/^CSGO-/i.test(text)) {
            showStatus("Old CSGO- codes no longer work in CS2. Paste a code starting with CS.", false);
            return;
        }
        const crosshair = readCode(text);
        if (crosshair) {
            load(crosshair);
            proSelect.value = "";
            showStatus("Code imported. Adjust it as you like.", true);
        } else {
            showStatus("This is not a valid CS2 crosshair code.", false);
        }
    });

    $("reset").addEventListener("click", function () {
        proSelect.value = "";
        importInput.value = "";
        showStatus("", true);
        load(defaults);
    });

    // Résolution de l'aperçu : montre le crosshair comme en jeu dans cette résolution (le code ne change pas)
    const resSelect = $("res");
    function applyResolution() {
        preview.dataset.res = resSelect.value;
        preview.dataset.stretch = resSelect.options[resSelect.selectedIndex].dataset.stretch;
    }
    applyResolution(); // le navigateur peut avoir gardé un autre choix en rechargeant la page
    resSelect.addEventListener("change", function () {
        applyResolution();
        drawCrosshair(preview, codeOut.textContent);
    });

    // Taille de l'aperçu : réelle ou agrandie
    root.querySelectorAll("[data-zoom]").forEach(function (button, i, all) {
        button.addEventListener("click", function () {
            all.forEach(function (b) {
                b.setAttribute("aria-pressed", b === button ? "true" : "false");
            });
            preview.dataset.zoom = button.dataset.zoom;
            drawCrosshair(preview, codeOut.textContent);
        });
    });

    // Copier le code ou les commandes console
    root.querySelectorAll("[data-copy]").forEach(function (button) {
        button.addEventListener("click", function () {
            copyText((button.dataset.copy === "code" ? codeOut : consoleOut).textContent, button);
        });
    });

    // Démarrage : un code dans l'adresse (generator.html#CS...) est chargé, sinon le crosshair par défaut
    const fromAddress = syncHash ? readCode(decodeURIComponent(location.hash.slice(1))) : null;
    load(fromAddress || defaults);
    if (fromAddress) {
        showStatus("Crosshair loaded from the link. Adjust it as you like.", true);
    }
}
