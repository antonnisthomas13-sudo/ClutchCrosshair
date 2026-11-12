// ===== career.js : l'affichage du jeu « Zero to Major » (page /career) =====
// Les règles sont dans career-engine.js ; ici on affiche les écrans et on écoute les clics :
//   1. création du joueur (pseudo, nationalité, rôle, map préférée)
//   2. la partie : un bandeau (joueur, équipe, gains, entente), la fiche du joueur à gauche (3 onglets),
//      la situation et ses choix à droite ; le classement mondial à chaque fin d'année
//   3. la fin de carrière : note sur 100 et parcours
// Les données (équipes, events, textes dans la langue de la page) viennent d'un fichier fabriqué par build.js,
// dont l'adresse est dans <div id="zm" data-src="...">. La partie est sauvegardée dans le navigateur (localStorage).
import { VERSION, ATTRS, ROLES, SCORE_MAX, createCareer, current, choose, overall, score, styleOf, teamRank, keyAttrs } from "./career-engine.js";

const root = document.getElementById("zm");
const SAVE_KEY = "zm-save";
const lang = document.documentElement.lang || "en";
// Codes des pays (ISO 3166-1) : leurs noms sont donnés par le navigateur dans la langue de la page
const COUNTRIES = ("AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW").split(" ");

let data = null;   // données du jeu
let ui = null;     // textes de l'interface
let state = null;  // la partie en cours
let tab = "attrs"; // onglet ouvert dans la fiche du joueur

// ---------- Petits outils ----------
// h("div", "classe", enfant1, enfant2...) : fabrique une balise ; un enfant peut être un texte ou une autre balise
function h(tag, className) {
    const node = document.createElement(tag);
    if (className) { node.className = className; }
    for (let i = 2; i < arguments.length; i++) {
        const child = arguments[i];
        if (child !== null && child !== undefined && child !== false) { node.append(child); }
    }
    return node;
}
function fill(text, vars) {
    return String(text).replace(/\{(\w+)\}/g, function (all, key) { return vars[key] !== undefined ? vars[key] : all; });
}
function plural(entry, count) {
    return fill(count === 1 ? entry.one : entry.other, { count: count });
}
const number = new Intl.NumberFormat(lang);
const compact = new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 });
function dollars(value) {
    // « narrowSymbol » : « 33 200 $ » en français (et pas « 33 200 $US »)
    return new Intl.NumberFormat(lang, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(value);
}
function dollarsShort(value) {
    return new Intl.NumberFormat(lang, { style: "currency", currency: "USD", currencyDisplay: "narrowSymbol", notation: "compact", maximumFractionDigits: 1 }).format(value);
}
function countryName(code) {
    try {
        return new Intl.DisplayNames([lang], { type: "region" }).of(code) || code;
    } catch (error) {
        return code;
    }
}
function teamOf(id) {
    return data.teams.find(function (t) { return t.id === id; }) || null;
}
// Le drapeau d'un pays (images du dossier flags/, chargées seulement sur cette page)
function flag(code, className) {
    if (!code || !/^[A-Za-z]{2}$/.test(code)) {
        return h("span", (className || "zm-flag") + " zm-flag-none");
    }
    const img = h("img", className || "zm-flag");
    img.src = root.dataset.flags + code.toLowerCase() + ".svg";
    img.alt = countryName(code.toUpperCase());
    img.width = 32;
    img.height = 24;
    img.loading = "lazy";
    img.addEventListener("error", function () { img.style.visibility = "hidden"; }); // drapeau inconnu : case vide
    return img;
}
// L'écusson d'une équipe : son logo si le site l'a, sinon ses initiales
function badge(team, fallback) {
    const box = h("span", "zm-badge");
    if (team && team.logo) {
        box.style.setProperty("--tc", team.color);
        box.style.setProperty("--on", team.on);
        const img = h("img");
        img.src = root.dataset.base + team.logo;
        img.alt = "";
        img.width = 28;
        img.height = 28;
        box.append(img);
    } else if (team) {
        const words = team.name.replace(/[^\p{L}\p{N} ]/gu, "").split(" ").filter(Boolean);
        box.textContent = (words.length > 1 ? words.map(function (w) { return w[0]; }).join("") : team.name).slice(0, 3).toUpperCase();
    } else {
        box.textContent = fallback || "";
    }
    return box;
}
// Jauge à 10 segments
function seg(value) {
    const node = h("div", "zm-seg");
    node.style.setProperty("--v", Math.max(0, Math.min(100, value)) + "%");
    return node;
}
function row(label, value, key) {
    return h("div", "zm-row" + (key ? " zm-key" : ""), h("span", null, label), h("i", null, String(Math.round(value))), seg(value));
}
function trio(items) {
    const box = h("div", "zm-trio");
    items.forEach(function (it) { box.append(h("div", null, h("small", null, it[0]), h("strong", null, it[1]))); });
    return box;
}

// ---------- Sauvegarde ----------
function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
        return saved && saved.v === VERSION && saved.attrs ? saved : null; // une partie d'une ancienne version du jeu est ignorée
    } catch (error) {
        return null;
    }
}
function save() {
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (error) { /* stockage plein ou navigation privée : la partie continue sans sauvegarde */ }
}
function erase() {
    try {
        localStorage.removeItem(SAVE_KEY);
    } catch (error) { /* rien */ }
}

// ---------- Où en est le joueur (une ligne) ----------
function whereLine(s) {
    if (s.team) {
        return s.benched ? ui.benchLine : fill(ui.teamLine, { tier: s.tier, rank: teamRank(s) });
    }
    return fill(s.proSeasons ? ui.freeLine : ui.faceitLine, { elo: number.format(s.elo) });
}

// ---------- Écran 1 : création du joueur ----------
function showCreate() {
    document.body.classList.remove("zm-playing");
    root.textContent = "";
    const saved = load();
    const box = h("div", "zm-create");
    if (saved && !saved.over) {
        const team = teamOf(saved.team);
        const go = h("button", "zm-btn zm-btn-main", ui.resume);
        go.type = "button";
        go.addEventListener("click", function () { state = saved; showGame(); });
        box.append(h("div", "zm-resume", flag(saved.country), h("p", null, h("strong", null, saved.name), " · " + fill(ui.age, { age: saved.age }) + " · " + (team ? team.name : ui.noTeam)), go));
    }
    const form = h("form", "zm-form");
    form.append(h("h2", null, ui.createTitle));

    // Pseudo
    const name = h("input", "zm-input");
    name.id = "zm-name";
    name.maxLength = 16;
    name.required = true;
    name.autocomplete = "nickname";
    name.placeholder = ui.namePlaceholder;
    const nameLabel = h("label", "zm-label", ui.nameLabel);
    nameLabel.htmlFor = "zm-name";
    form.append(h("div", "zm-field", nameLabel, name));

    // Nationalité (avec le drapeau à côté)
    const country = h("select", "zm-input");
    country.id = "zm-country";
    const mine = ((navigator.language || "").split("-")[1] || "").toUpperCase();
    COUNTRIES.map(function (code) { return [code, countryName(code)]; })
        .sort(function (a, b) { return a[1].localeCompare(b[1], lang); })
        .forEach(function (c) {
            const option = h("option", null, c[1]);
            option.value = c[0];
            option.selected = c[0] === mine;
            country.append(option);
        });
    const countryLabel = h("label", "zm-label", ui.countryLabel);
    countryLabel.htmlFor = "zm-country";
    const flagBox = h("span", "zm-flagbox");
    const showFlag = function () { flagBox.textContent = ""; flagBox.append(flag(country.value)); };
    country.addEventListener("change", showFlag);
    showFlag();
    form.append(h("div", "zm-field", countryLabel, h("div", "zm-country", flagBox, country), h("small", "zm-help", ui.countryHelp)));

    // Rôle
    const roles = h("fieldset", "zm-roles", h("legend", "zm-label", ui.roleLabel));
    ROLES.forEach(function (role, i) {
        const input = h("input");
        input.type = "radio";
        input.name = "zm-role";
        input.value = role;
        input.checked = i === 1;
        roles.append(h("label", "zm-role", input, h("span", null, h("strong", null, ui.roles[role][0]), h("small", null, ui.roles[role][1]))));
    });
    form.append(roles);

    // Map préférée
    const maps = h("fieldset", "zm-maps", h("legend", "zm-label", ui.favMapLabel));
    data.maps.forEach(function (m, i) {
        const input = h("input");
        input.type = "radio";
        input.name = "zm-map";
        input.value = m.id;
        input.checked = i === 0;
        maps.append(h("label", "zm-map", input, h("span", null, m.name)));
    });
    maps.append(h("small", "zm-help", ui.favMapHelp));
    form.append(maps);

    const start = h("button", "zm-btn zm-btn-main", ui.start);
    start.type = "submit";
    form.append(start, h("p", "zm-note", ui.saved));
    form.addEventListener("submit", function (event) {
        event.preventDefault();
        const nick = name.value.trim();
        if (!nick) {
            name.focus();
            return;
        }
        if (saved && !saved.over && !window.confirm(ui.confirmNew)) {
            return;
        }
        state = createCareer({
            name: nick, country: country.value,
            role: form.querySelector("input[name=zm-role]:checked").value,
            favMap: form.querySelector("input[name=zm-map]:checked").value
        }, data);
        tab = "attrs";
        save();
        showGame();
    });
    box.append(form);
    root.append(box);
}

// ---------- Le bandeau du haut : qui je suis, où je joue, ce que je gagne ----------
function hud() {
    const team = teamOf(state.team);
    const bar = h("header", "zm-hud");
    bar.append(h("div", "zm-hud-id", flag(state.country),
        h("div", null, h("b", null, state.name), h("span", null, ui.roles[state.role][0] + " · " + fill(ui.age, { age: state.age })))));
    bar.append(h("div", "zm-hud-team", badge(team, state.proSeasons ? "–" : "10"),
        h("div", null, h("b", null, team ? team.name : (state.proSeasons ? ui.noTeam : "FACEIT")), h("span", "zm-rank", whereLine(state)))));
    const stats = h("div", "zm-hud-stats");
    stats.append(h("div", "zm-stat", h("small", null, ui.earnings), h("strong", null, dollars(state.money))));
    if (team) {
        stats.append(h("div", "zm-stat zm-chem", h("small", null, ui.chemistry), h("div", "zm-chem-row", seg(state.chemistry), h("strong", null, String(state.chemistry)))));
    } else {
        stats.append(h("div", "zm-stat", h("small", null, ui.elo), h("strong", null, number.format(state.elo))));
    }
    bar.append(stats);
    return bar;
}

// ---------- La fiche du joueur (3 onglets) ----------
function sheet() {
    const box = h("aside", "zm-sheet");
    box.append(h("div", "zm-ovr", h("b", null, String(overall(state))), h("small", null, ui.overall),
        h("em", null, ui.favMap + " : " + (data.maps.find(function (m) { return m.id === state.favMap; }) || {}).name)));

    const tabs = h("div", "zm-tabs");
    tabs.setAttribute("role", "tablist");
    const panes = {};
    ["attrs", "pop", "career"].forEach(function (id) {
        const button = h("button", null, ui.tabs[id]);
        button.type = "button";
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(tab === id));
        button.addEventListener("click", function () {
            tab = id;
            Object.keys(panes).forEach(function (k) { panes[k].hidden = k !== id; });
            tabs.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-selected", String(b === button)); });
        });
        tabs.append(button);
    });
    box.append(tabs);

    // Onglet 1 : les attributs (ceux du rôle sont mis en avant)
    const keys = keyAttrs(state.role);
    panes.attrs = h("div", "zm-pane");
    ATTRS.forEach(function (a) { panes.attrs.append(row(ui.attrs[a], state.attrs[a], keys.includes(a))); });
    panes.attrs.append(trio([[ui.energy, String(state.energy)], [ui.confidence, String(state.confidence)], [ui.tox, String(state.tox)]]));

    // Onglet 2 : popularité
    panes.pop = h("div", "zm-pane");
    panes.pop.append(row(ui.aura, state.aura, true), row(ui.pop, state.pop, true));
    const line = h("div", "zm-style-line", h("u"));
    line.style.setProperty("--v", (state.style + 100) / 2 + "%");
    panes.pop.append(h("div", "zm-style", h("div", "zm-style-head", h("span", null, ui.style), h("i", null, ui.styles[styleOf(state)])), line,
        h("div", "zm-style-ends", h("span", null, ui.styles.discreet), h("span", null, ui.styles.showman))));
    panes.pop.append(trio([[ui.fans, compact.format(state.fans)], [ui.sponsors, state.sponsors ? dollarsShort(state.sponsors) : "–"], [ui.yourRank, state.rank ? fill(ui.rankShort, { rank: state.rank }) : "–"]]));

    // Onglet 3 : la carrière, saison par saison (la plus récente en haut)
    panes.career = h("div", "zm-pane");
    if (!state.history.length) { panes.career.append(h("p", "zm-empty", ui.careerEmpty)); }
    state.history.slice().reverse().forEach(function (s) {
        const team = teamOf(s.team);
        const where = s.kind === "team" || s.kind === "bench"
            ? (team ? team.name : "") + " · " + fill(ui.tier, { tier: s.tier }) + (s.kind === "bench" ? " · " + ui.kinds.bench : "") + (s.rank ? " · " + fill(ui.rankShort, { rank: s.rank }) : "")
            : ui.kinds[s.kind] + (s.kind === "faceit" ? " · " + number.format(s.elo) : "");
        panes.career.append(h("div", "zm-row zm-season-row", h("span", null, s.year + " · " + where), h("i", null, String(s.overall))));
    });
    const majors = state.titles.filter(function (t) { return t.major; }).length;
    panes.career.append(trio([[ui.titles, String(state.titles.length)], [ui.majors, String(majors)], [ui.salary, state.salary ? dollarsShort(state.salary) : "–"]]));

    Object.keys(panes).forEach(function (k) { panes[k].hidden = k !== tab; box.append(panes[k]); });
    return box;
}

// ---------- Les petites étiquettes « +2 Aim », « −6 Énergie » ----------
function changeChips(changes) {
    const list = h("ul", "zm-gains");
    (changes || []).forEach(function (c) {
        const label = ui.attrs[c.k] || ui[c.k] || c.k;
        const value = c.k === "fans" ? number.format(Math.abs(c.d)) : c.k === "money" || c.k === "salary" ? dollars(Math.abs(c.d)) : String(Math.abs(c.d));
        // La toxicité qui monte est une mauvaise nouvelle : elle s'affiche comme une baisse
        const good = c.k === "tox" ? c.d < 0 : c.d > 0;
        list.append(h("li", good || c.k === "style" ? null : "zm-down", (c.d > 0 ? "+" : "−") + value + " " + label));
    });
    return list;
}
function verdict(kind, text) {
    return h("div", "zm-verdict" + (kind === "ok" ? " zm-ok" : kind === "ko" ? " zm-ko" : ""), text);
}
// L'avancée de la saison : un trait par étape, plus large pour un tournoi
function progressBar(view) {
    const p = view.progress;
    const box = h("div", "zm-season");
    box.setAttribute("aria-label", ui.seasonProgress);
    p.steps.forEach(function (kind, i) {
        box.append(h("i", (i < p.done ? "zm-done" : i === p.done ? "zm-now" : "") + (kind !== "e" ? " zm-big" : "")));
    });
    box.append(h("span", null, fill(ui.step, { i: Math.min(p.done + 1, p.steps.length), n: p.steps.length })));
    return box;
}

// ---------- Écran 2 : la partie ----------
function pick(index) {
    choose(state, data, index);
    save();
    showGame();
}
function nextButton(label, action) {
    const next = h("button", "zm-next", label);
    next.type = "button";
    next.dataset.key = "1";
    next.addEventListener("click", action);
    return next;
}
function showGame() {
    let view;
    try {
        view = current(state, data);
    } catch (error) {
        // Sauvegarde devenue illisible : on repart de zéro
        erase();
        state = null;
        showCreate();
        return;
    }
    if (view.kind === "end") {
        showEnd();
        return;
    }
    document.body.classList.add("zm-playing"); // sur téléphone, le texte de présentation laisse la place au jeu
    root.textContent = "";
    const game = h("div", "zm-game");
    game.append(hud());

    const top = h("div", "zm-scene-top");
    top.append(h("span", "zm-chip" + (view.major ? " zm-hot" : ""), data.s.tags[view.tag] || ""));
    view.chips.forEach(function (c) { if (c !== data.s.tags[view.tag]) { top.append(h("span", "zm-chip", c)); } });
    top.append(h("time", null, view.season));

    const scene = h("section", "zm-scene");
    scene.tabIndex = -1;
    scene.setAttribute("aria-live", "polite");
    const body = h("div", "zm-scene-body");

    if (state.last) {
        // Le résultat du dernier choix, puis « Continuer »
        const r = state.last;
        if (r.success !== null) { body.append(verdict(r.success ? "ok" : "ko", r.success ? ui.success : ui.failure)); }
        if (r.text) { body.append(h("p", "zm-txt", r.text)); }
        body.append(changeChips(r.changes));
        body.append(nextButton(data.s.next, function () { state.last = null; save(); showGame(); }));
        scene.append(top, body);
        game.append(h("div", "zm-board", sheet(), scene));
    } else if (view.kind === "ranking") {
        // Le classement mondial de fin d'année : plein écran sous le bandeau
        body.append(h("h2", null, view.title), h("p", "zm-txt", view.text));
        const list = function (title, rows, me) {
            const ol = h("ol");
            const line = function (r, i) {
                const li = h("li", r.me ? "zm-me" : null, h("b", null, String(r.rank)), flag(r.country, "zm-flag zm-flag-sm"),
                    h("span", null, r.name, h("small", null, r.team)), h("i", null, r.rating.toFixed(2)));
                li.style.setProperty("--i", i);
                return li;
            };
            rows.forEach(function (r, i) { ol.append(line(r, i)); });
            if (me && !rows.some(function (r) { return r.me; })) {
                ol.append(h("li", "zm-gap", "···"), line(me, rows.length));
            }
            return h("section", "zm-rankbox", h("h3", null, title), ol);
        };
        const r = view.ranking;
        const ranks = h("div", "zm-ranks", list(ui.top20, r.top, r.me), list(fill(ui.topRole, { role: ui.roles[r.role][0] }), r.roleTop, r.meRole));
        body.append(nextButton(view.choices[0].text, function () { pick(0); }));
        scene.append(top, body);
        game.append(scene, ranks);
    } else {
        if (view.verdict !== undefined && view.verdictText) { body.append(verdict(view.verdict, view.verdictText)); }
        if (view.title) { body.append(h("h2", null, view.title)); }
        body.append(h("p", "zm-txt", view.text));
        if (view.changes) { body.append(changeChips(view.changes)); }
        if (view.choices.length === 1) {
            body.append(nextButton(view.choices[0].text, function () { pick(0); }));
        } else {
            const choices = h("div", "zm-choices");
            view.choices.forEach(function (c, i) {
                const button = h("button", "zm-choice", h("kbd", null, String(i + 1)), h("span", null, c.country ? flag(c.country, "zm-flag zm-flag-sm") : null, c.text));
                button.type = "button";
                button.dataset.key = String(i + 1);
                if (c.tests && c.tests.length) { button.append(h("small", null, c.tests.map(function (a) { return ui.attrs[a]; }).join(" · "))); }
                if (c.risk) { button.append(h("em", c.risk === "risky" ? "zm-risky" : null, ui.risk[c.risk])); }
                button.addEventListener("click", function () { pick(i); });
                choices.append(button);
            });
            body.append(choices);
        }
        scene.append(top, body, progressBar(view));
        game.append(h("div", "zm-board", sheet(), scene));
    }
    root.append(game);
    const again = h("button", "zm-link", ui.newCareer);
    again.type = "button";
    again.addEventListener("click", function () {
        if (window.confirm(ui.confirmNew)) { erase(); state = null; showCreate(); }
    });
    root.append(h("p", "zm-foot", h("span", null, ui.keys), again));
    save(); // afficher une étape peut la préparer (tirage d'un event, résultat d'un tournoi) : on garde ça
    scene.focus({ preventScroll: true });
}

// Clavier : 1, 2, 3... pour choisir (ou continuer)
document.addEventListener("keydown", function (event) {
    if (event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) {
        return;
    }
    const button = root && root.querySelector('[data-key="' + event.key + '"]');
    if (button) {
        event.preventDefault();
        button.click();
    }
});

// ---------- Écran 3 : fin de carrière ----------
function showEnd() {
    document.body.classList.add("zm-playing");
    root.textContent = "";
    const over = state.over;
    const sc = score(state);
    const box = h("section", "zm-end");
    box.append(h("div", "zm-scene-top", h("span", "zm-chip zm-hot", ui.endTitle), h("time", null, String(over.year))));
    const body = h("div", "zm-scene-body");
    body.append(h("div", "zm-end-id", flag(state.country), h("h2", null, state.name)));
    body.append(h("p", "zm-txt", fill(ui.endReasons[over.reason] || ui.endReasons.retired, { age: over.age })));
    body.append(h("div", "zm-score", h("strong", null, String(over.score)), h("span", null, ui.outOf), h("em", null, ui.score)));

    const parts = h("div", "zm-parts");
    Object.keys(sc.parts).forEach(function (k) {
        const line = row(ui.parts[k], sc.parts[k] / SCORE_MAX[k] * 100, false);
        line.querySelector("i").textContent = sc.parts[k] + " / " + SCORE_MAX[k];
        parts.append(line);
    });
    body.append(parts);
    body.append(trio([[ui.bestRank, state.bestRank ? fill(ui.rankShort, { rank: state.bestRank }) : "–"], [ui.earnings, dollarsShort(state.money)], [ui.fans, compact.format(state.fans)]]));

    const titles = h("div", "zm-titles");
    titles.append(h("h3", null, state.titles.length ? plural(ui.titlesWon, state.titles.length) + (sc.majors ? " · " + plural(ui.majorsWon, sc.majors) : "") : ui.noTitles));
    if (state.titles.length) {
        const list = h("ul");
        state.titles.forEach(function (t) { list.append(h("li", t.major ? "zm-major" : null, t.year + " · " + t.name)); });
        titles.append(list);
    }
    body.append(titles);

    const path = h("div", "zm-path", h("h3", null, ui.careerPath));
    const list = h("ol");
    state.history.forEach(function (s) {
        const team = teamOf(s.team);
        const where = s.kind === "team" || s.kind === "bench"
            ? (team ? team.name : "") + " · " + fill(ui.tier, { tier: s.tier }) + (s.kind === "bench" ? " · " + ui.kinds.bench : "") + (s.rank ? " · " + fill(ui.rankShort, { rank: s.rank }) : "")
            : ui.kinds[s.kind] + (s.kind === "faceit" ? " · " + number.format(s.elo) : "");
        list.append(h("li", null, h("span", null, s.year + " · " + fill(ui.age, { age: s.age }) + " · " + where), h("i", null, String(s.overall))));
    });
    path.append(list);
    body.append(path);

    const again = h("button", "zm-next", ui.playAgain);
    again.type = "button";
    again.addEventListener("click", function () { erase(); state = null; showCreate(); });
    body.append(again);
    box.append(body);
    root.append(box);
}

// ---------- Démarrage ----------
if (root) {
    fetch(root.dataset.src).then(function (response) {
        if (!response.ok) { throw new Error(String(response.status)); }
        return response.json();
    }).then(function (json) {
        data = json;
        ui = json.ui;
        showCreate();
    }).catch(function () {
        root.textContent = "";
        root.append(h("p", "zm-note", root.dataset.error || "The game could not load. Reload the page."));
    });
}
