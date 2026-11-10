// build/tools.js : 3 sexies. Les outils : tools/index.html + tools/bind-generator.html (données : binds.json)
// Un morceau de build.js (découpé le 10/11/2026) : build.js l'appelle une fois par langue.
// c = la « boîte à outils » commune préparée par build.js (textes traduits, en-tête, pied de page, données, outils…).
// Le code garde son retrait d'origine : les pages fabriquées sont identiques au caractère près.
module.exports = {
    build: function (c) {
        const {
            ap, bindData, breadcrumb, CROSSHAIR_HASH, crumbs, EN, esc, faqGraph, faqItems, footer, genUrl, head,
            HTML_OPEN, I, isoDate, lang, LD, pageTop, sectionBreadcrumb, SITE_URL, sitemapPages, t, THEME_SCRIPT,
            tList, toolsUrl, write
        } = c;

        // ===== 3 sexies. Les outils : tools/index.html + tools/bind-generator.html (données : binds.json) =====
        const bindUrl = toolsUrl + "bind-generator.html";
        if (bindData) {
            // Libellés traduits (i18n/<langue>/binds.json : même structure que binds.json, mêmes commandes)
            const binds = I.content("binds") || bindData;
            const bq = function (key, cmd) { return `bind "${key}" "${cmd}"`; };
            const bindFaq = tList("bind.faq");
            const bindDescription = t("bind.description");
            const allBuy = binds.buy.flatMap(function (g) { return g[1]; });
            if (EN) {
                sitemapPages.push({ path: "tools/", lastmod: isoDate(bindData.updated) });
                sitemapPages.push({ path: "tools/bind-generator.html", lastmod: isoDate(bindData.updated) });
            }
            const bindGraph = [
                {
                    "@type": "WebPage",
                    "@id": bindUrl,
                    "url": bindUrl,
                    "name": t("bind.name"),
                    "inLanguage": lang,
                    "isPartOf": { "@id": SITE_URL + "/#website" },
                    "breadcrumb": { "@id": bindUrl + "#breadcrumb" },
                    "mainEntity": { "@id": bindUrl + "#app" },
                    "dateModified": isoDate(bindData.updated)
                },
                {
                    "@type": "WebApplication",
                    "@id": bindUrl + "#app",
                    "name": t("bind.name"),
                    "url": bindUrl,
                    "description": bindDescription,
                    "applicationCategory": "GameApplication",
                    "operatingSystem": "Any",
                    "browserRequirements": "Requires JavaScript",
                    "isAccessibleForFree": true,
                    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
                    "publisher": { "@id": SITE_URL + "/#organization" }
                },
                sectionBreadcrumb(t("tools.breadcrumb"), toolsUrl, t("bind.breadcrumb"), bindUrl),
                faqGraph(bindUrl, bindFaq)
            ];
            const options = function (list) {
                return list.map(function (o) { return `<option value="${esc(o[o.length === 3 ? 2 : 0])}">${esc(o[1])}</option>`; }).join("");
            };
            const copyRowHtml = function (command) {
                return `<div class="field-row"><code>${esc(command)}</code><button type="button" class="mini" data-copy>${t("common.copy")}</button></div>`;
            };
            // Textes du petit programme de la page (traduits ici, directement dans le script)
            const BJ = JSON.stringify({
                tick: t("bind.js.tick"), type: t("bind.js.type"), careful: t("bind.js.careful"), keySet: t("bind.js.keySet"),
                press: t("bind.capture"), waiting: t("bind.js.waiting"), pressNow: t("bind.js.pressNow"), unsupported: t("bind.js.unsupported"),
                remove: t("bind.js.remove"), removeAria: t("bind.js.removeAria")
            }).replace(/</g, "\\u003c");

            write(LD + "tools/bind-generator.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({ title: t("bind.title"), ogTitle: t("bind.name"), description: bindDescription, url: bindUrl, path: "tools/bind-generator.html", prefix: "../", jsonLd: { "@context": "https://schema.org", "@graph": bindGraph } })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "tools")}

    <main class="player-page bind-page">
        ${crumbs("../", `<a href="./">${t("tools.crumb")}</a> › <span>${t("bind.crumb")}</span>`)}
        <h1>${t("bind.h1")}</h1>
        <p>${t("bind.intro")}</p>

        <div class="bind" id="bind-tool">
            <div class="bind-controls">
                <fieldset class="gen-group">
                    <legend>${t("bind.step1")}</legend>
                    <div class="bind-key">
                        <select id="bind-key" aria-label="${t("bind.keyAria")}">
                            ${binds.keys.map(function (g) {
                                return `<optgroup label="${esc(g[0])}">${g[1].map(function (k) { return `<option value="${esc(k[0])}">${esc(k[1])}</option>`; }).join("")}</optgroup>`;
                            }).join("")}
                        </select>
                        <button type="button" class="bind-capture" id="bind-capture">${t("bind.capture")}</button>
                    </div>
                    <p class="gen-status" id="bind-key-status" aria-live="polite"></p>
                </fieldset>

                <fieldset class="gen-group">
                    <legend>${t("bind.step2")}</legend>
                    <div class="bind-actions" role="group" aria-label="${t("bind.actionAria")}">
                        <button type="button" data-action="buy" aria-pressed="true">${t("bind.actions.buy")}</button>
                        <button type="button" data-action="jumpthrow" aria-pressed="false">${t("bind.actions.jumpthrow")}</button>
                        <button type="button" data-action="toggle" aria-pressed="false">${t("bind.actions.toggle")}</button>
                        <button type="button" data-action="volume" aria-pressed="false">${t("bind.actions.volume")}</button>
                        <button type="button" data-action="grenade" aria-pressed="false">${t("bind.actions.grenade")}</button>
                        <button type="button" data-action="other" aria-pressed="false">${t("bind.actions.other")}</button>
                        <button type="button" data-action="custom" aria-pressed="false">${t("bind.actions.custom")}</button>
                    </div>

                    <div class="bind-panel" data-panel="buy">
                        ${binds.buy.map(function (g) {
                            return `<div class="bind-buy-group"><p class="gen-label">${esc(g[0])}</p><div class="bind-checks">${g[1].map(function (it) {
                                return `<label class="gen-toggle"><input type="checkbox" value="${esc(it[0])}" data-buy><span>${esc(it[1])}</span></label>`;
                            }).join("")}</div></div>`;
                        }).join("\n                        ")}
                    </div>
                    <div class="bind-panel hidden" data-panel="jumpthrow">
                        <p class="gen-hint">${t("bind.jumpthrowHint")}</p>
                    </div>
                    <div class="bind-panel hidden" data-panel="toggle">
                        <label class="gen-label" for="bind-toggle">${t("bind.toggleLabel")}</label>
                        <select id="bind-toggle">${options(binds.toggles)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="volume">
                        <label class="gen-label" for="bind-volume">${t("bind.volumeLabel")}</label>
                        <select id="bind-volume">${options(binds.volume)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="grenade">
                        <label class="gen-label" for="bind-grenade">${t("bind.grenadeLabel")}</label>
                        <select id="bind-grenade">${options(binds.grenades)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="other">
                        <label class="gen-label" for="bind-other">${t("bind.otherLabel")}</label>
                        <select id="bind-other">${options(binds.other)}</select>
                    </div>
                    <div class="bind-panel hidden" data-panel="custom">
                        <label class="gen-label" for="bind-custom">${t("bind.customLabel")}</label>
                        <input type="text" id="bind-custom" placeholder="${t("bind.customPlaceholder")}" autocomplete="off" spellcheck="false">
                    </div>
                </fieldset>
            </div>

            <div class="bind-result">
                <div class="bind-now">
                    <div class="field-label">${t("bind.yourBind")} <span><i class="sep">· </i>${t("bind.consoleHelp")}</span></div>
                    <div class="code-block"><pre><code id="bind-output">${esc(bq("kp_end", "buy ak47"))}</code></pre><button type="button" class="mini" data-copy>${t("common.copy")}</button></div>
                    <button type="button" class="bind-add" id="bind-add">${t("bind.add")}</button>
                </div>

                <div class="bind-mine">
                    <div class="field-label">${t("bind.mine")} <span id="bind-count"></span></div>
                    <ul class="bind-list" id="bind-list"></ul>
                    <p class="gen-hint" id="bind-empty">${t("bind.empty")}</p>
                    <div class="bind-buttons">
                        <button type="button" class="mini" id="bind-copy-all">${t("bind.copyAll")}</button>
                        <button type="button" class="mini btn-secondary" id="bind-download">${t("bind.download")}</button>
                        <button type="button" class="mini btn-secondary" id="bind-clear">${t("bind.clear")}</button>
                    </div>
                </div>
            </div>
            <noscript><p class="gen-status gen-status-error">${t("bind.noscript")}</p></noscript>
        </div>

        <h2>${t("bind.howTitle")}</h2>
        <ol>
            <li>${t("bind.how1")}</li>
            <li>${t("bind.how2")}</li>
            <li>${t("bind.how3")}</li>
        </ol>

        <h2>${t("bind.popularTitle")}</h2>
        <p>${t("bind.popularIntro")}</p>
        ${binds.presets.map(function (p) {
            return `<h3>${esc(p[0])}</h3>
        ${copyRowHtml(bq(p[1], p[2]))}`;
        }).join("\n        ")}

        <h2>${t("bind.jumpTitle")}</h2>
        <p>${t("bind.jumpText")}</p>
        <div class="code-block"><pre><code>alias "+jumpthrow" "+jump;-attack;-attack2"
alias "-jumpthrow" "-jump"
bind "v" "+jumpthrow"</code></pre><button type="button" class="mini" data-copy>${t("common.copy")}</button></div>

        <h2>${t("bind.buyTitle")}</h2>
        <p>${t("bind.buyIntro")}</p>
        <div class="table-wrap"><table class="cmd-values">
            <thead><tr><th scope="col">${t("bind.buyItem")}</th><th scope="col">${t("bind.buyCommand")}</th></tr></thead>
            <tbody>${allBuy.map(function (it) { return `<tr><td>${esc(it[1])}</td><td><code>buy ${esc(it[0])}</code></td></tr>`; }).join("")}</tbody>
        </table></div>

        <h2>${t("bind.faqTitle")}</h2>
${faqItems(bindFaq, "h3")}

        <h2>${t("bind.relatedTitle")}</h2>
        <ul class="related">
            <li><a href="../commands/bind.html">${t("bind.relatedBind")}</a></li>
            <li><a href="../commands/alias.html">${t("bind.relatedAlias")}</a></li>
            <li><a href="../commands/exec.html">${t("bind.relatedExec")}</a></li>
            <li><a href="../generator.html">${t("links.generator")}</a></li>
            <li><a href="../guides/cs2-launch-options.html">${t("bind.relatedLaunch")}</a></li>
        </ul>
    </main>

    ${footer("../")}
    <script type="application/json" id="bind-data">${JSON.stringify({ toggles: binds.toggles, volume: binds.volume, grenades: binds.grenades, other: binds.other }).replace(/</g, "\\u003c")}</script>
    <script type="module">
        import { copyText } from "${ap("../")}crosshair.min.js?v=${CROSSHAIR_HASH}";
        const TX = ${BJ};

        // Boutons Copy (lignes simples et blocs de plusieurs lignes)
        document.addEventListener("click", function (event) {
            const button = event.target.closest("[data-copy]");
            if (button) {
                copyText(button.closest(".field-row, .code-block").querySelector("code").textContent, button);
            }
        });

        const $ = function (id) { return document.getElementById(id); };
        const keySelect = $("bind-key");
        const output = $("bind-output");
        let action = "buy";

        // Le texte du bind selon la touche et l'action choisies
        function lines() {
            const key = keySelect.value;
            const bind = function (cmd) { return ["bind \\"" + key + "\\" \\"" + cmd + "\\""]; };
            if (action === "buy") {
                const items = Array.from(document.querySelectorAll("[data-buy]:checked")).map(function (c) { return "buy " + c.value; });
                return items.length ? bind(items.join("; ")) : [];
            }
            if (action === "jumpthrow") {
                return ["alias \\"+jumpthrow\\" \\"+jump;-attack;-attack2\\"", "alias \\"-jumpthrow\\" \\"-jump\\"", "bind \\"" + key + "\\" \\"+jumpthrow\\""];
            }
            if (action === "custom") {
                const cmd = $("bind-custom").value.replace(/"/g, "").trim();
                return cmd ? bind(cmd) : [];
            }
            return bind($("bind-" + action).value);
        }

        function render() {
            const l = lines();
            output.textContent = l.length ? l.join("\\n") : (action === "buy" ? TX.tick : TX.type);
            $("bind-add").disabled = !l.length;
        }

        // Choix de l'action
        document.querySelectorAll("[data-action]").forEach(function (button) {
            button.addEventListener("click", function () {
                action = button.dataset.action;
                document.querySelectorAll("[data-action]").forEach(function (b) { b.setAttribute("aria-pressed", b === button ? "true" : "false"); });
                document.querySelectorAll("[data-panel]").forEach(function (p) { p.classList.toggle("hidden", p.dataset.panel !== action); });
                render();
            });
        });
        document.getElementById("bind-tool").addEventListener("input", render);
        document.getElementById("bind-tool").addEventListener("change", render);

        // "Press a key" : on lit la prochaine touche (ou bouton de souris) et on la traduit en nom CS2
        const CODES = { Space: "space", Tab: "tab", CapsLock: "capslock", ShiftLeft: "shift", ShiftRight: "rshift", ControlLeft: "ctrl", ControlRight: "rctrl", AltLeft: "alt", AltRight: "ralt",
            Insert: "ins", Delete: "del", Home: "home", End: "end", PageUp: "pgup", PageDown: "pgdn", ArrowUp: "uparrow", ArrowDown: "downarrow", ArrowLeft: "leftarrow", ArrowRight: "rightarrow",
            Numpad0: "kp_ins", Numpad1: "kp_end", Numpad2: "kp_downarrow", Numpad3: "kp_pgdn", Numpad4: "kp_leftarrow", Numpad5: "kp_5", Numpad6: "kp_rightarrow", Numpad7: "kp_home",
            Numpad8: "kp_uparrow", Numpad9: "kp_pgup", NumpadDecimal: "kp_del", NumpadDivide: "kp_slash", NumpadMultiply: "kp_multiply", NumpadSubtract: "kp_minus", NumpadAdd: "kp_plus", NumpadEnter: "kp_enter",
            Backquote: "\`", Minus: "-", Equal: "=", BracketLeft: "[", BracketRight: "]", Semicolon: "semicolon", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\\\", Enter: "enter", Backspace: "backspace" };
        const DEFAULT_KEYS = ["w", "a", "s", "d", "space", "ctrl", "shift", "e", "r", "q", "b", "tab", "mouse1", "mouse2", "1", "2", "3", "4", "5"];
        const status = $("bind-key-status");
        const capture = $("bind-capture");
        let listening = false;

        function setKey(name, label) {
            let option = Array.from(keySelect.options).find(function (o) { return o.value === name; });
            if (!option) {
                option = new Option(label || name.toUpperCase(), name);
                keySelect.add(option);
            }
            keySelect.value = name;
            status.textContent = DEFAULT_KEYS.includes(name) ? TX.careful.replace("{key}", name) : TX.keySet.replace("{key}", name);
            status.classList.toggle("gen-status-error", DEFAULT_KEYS.includes(name));
            render();
        }

        function stopListening() {
            listening = false;
            capture.textContent = TX.press;
            capture.setAttribute("aria-pressed", "false");
        }

        capture.addEventListener("click", function () {
            listening = true;
            capture.textContent = TX.waiting;
            capture.setAttribute("aria-pressed", "true");
            status.textContent = TX.pressNow;
            status.classList.remove("gen-status-error");
        });
        document.addEventListener("keydown", function (event) {
            if (!listening) {
                return;
            }
            event.preventDefault();
            stopListening();
            if (event.code === "Escape") {
                status.textContent = "";
                return;
            }
            let name = CODES[event.code];
            if (!name && /^Key[A-Z]$/.test(event.code)) {
                name = event.code.slice(3).toLowerCase();
            } else if (!name && /^Digit\\d$/.test(event.code)) {
                name = event.code.slice(5);
            } else if (!name && /^F\\d{1,2}$/.test(event.code)) {
                name = event.code.toLowerCase();
            }
            if (name) {
                setKey(name);
            } else {
                status.textContent = TX.unsupported;
            }
        });
        document.addEventListener("mousedown", function (event) {
            const mouse = { 1: "mouse3", 3: "mouse4", 4: "mouse5" }[event.button];
            if (listening && mouse && event.target !== capture) {
                event.preventDefault();
                stopListening();
                setKey(mouse);
            }
        });

        // Ma liste de binds (gardée dans ce navigateur)
        let mine = [];
        try { mine = JSON.parse(localStorage.getItem("cc-binds") || "[]"); } catch (error) { mine = []; }
        function save() {
            try { localStorage.setItem("cc-binds", JSON.stringify(mine)); } catch (error) {}
        }
        function allText() {
            const out = [];
            mine.forEach(function (b) { b.lines.forEach(function (l) { if (!out.includes(l)) { out.push(l); } }); });
            return out.join("\\n");
        }
        function renderList() {
            const list = $("bind-list");
            list.textContent = "";
            mine.forEach(function (b, i) {
                const li = document.createElement("li");
                const code = document.createElement("code");
                code.textContent = b.lines[b.lines.length - 1];
                const remove = document.createElement("button");
                remove.type = "button";
                remove.className = "bind-remove";
                remove.textContent = TX.remove;
                remove.setAttribute("aria-label", TX.removeAria.replace("{key}", b.key));
                remove.addEventListener("click", function () {
                    mine.splice(i, 1);
                    save();
                    renderList();
                });
                li.append(code, remove);
                list.appendChild(li);
            });
            $("bind-empty").classList.toggle("hidden", mine.length > 0);
            $("bind-count").textContent = mine.length ? "· " + mine.length : "";
            ["bind-copy-all", "bind-download", "bind-clear"].forEach(function (id) { $(id).disabled = !mine.length; });
        }
        $("bind-add").addEventListener("click", function () {
            const l = lines();
            if (!l.length) {
                return;
            }
            // Une seule action par touche : un nouveau bind sur la même touche remplace l'ancien
            mine = mine.filter(function (b) { return b.key !== keySelect.value; });
            mine.push({ key: keySelect.value, lines: l });
            save();
            renderList();
        });
        $("bind-copy-all").addEventListener("click", function (event) {
            copyText(allText(), event.currentTarget);
        });
        $("bind-download").addEventListener("click", function () {
            const text = "// CS2 binds made with ClutchCrosshair bind generator\\n" + allText() + "\\n";
            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
            link.download = "autoexec.cfg";
            document.body.appendChild(link);
            link.click();
            setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 1000);
        });
        $("bind-clear").addEventListener("click", function () {
            mine = [];
            save();
            renderList();
        });

        // Départ : AK-47 coché pour montrer un exemple
        const ak = document.querySelector("[data-buy][value=ak47]");
        if (ak && !document.querySelector("[data-buy]:checked")) {
            ak.checked = true;
        }
        render();
        renderList();
    </script>
</body>
</html>
`);

            // La page d'accueil des outils
            const toolsDescription = t("tools.description");
            write(LD + "tools/index.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({
        title: t("tools.title"),
        ogTitle: t("tools.ogTitle"),
        description: toolsDescription,
        url: toolsUrl,
        path: "tools/",
        prefix: "../",
        jsonLd: { "@context": "https://schema.org", "@graph": [
            {
                "@type": "CollectionPage",
                "@id": toolsUrl,
                "url": toolsUrl,
                "name": t("tools.ogTitle"),
                "description": toolsDescription,
                "inLanguage": lang,
                "isPartOf": { "@id": SITE_URL + "/#website" },
                "breadcrumb": { "@id": toolsUrl + "#breadcrumb" },
                "mainEntity": { "@type": "ItemList", "itemListElement": [
                    { "@type": "ListItem", "position": 1, "name": t("generator.name"), "url": genUrl },
                    { "@type": "ListItem", "position": 2, "name": t("bind.name"), "url": bindUrl }
                ] }
            },
            sectionBreadcrumb(t("tools.breadcrumb"), toolsUrl)
        ] }
    })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("../", "tools")}

    <main class="player-page guide-hub">
        ${crumbs("../", `<span>${t("tools.crumb")}</span>`)}
        <h1>${t("tools.h1")}</h1>
        <p>${t("tools.intro1")}</p>
        <p>${t("tools.intro2")}</p>
        <p>${t("tools.intro3")}</p>
        <div class="guide-cards">
            <a class="guide-card" href="../generator.html"><span class="guide-card-title">${t("generator.name")}</span><span class="guide-card-desc">${t("tools.cardGenerator")}</span></a>
            <a class="guide-card" href="bind-generator.html"><span class="guide-card-title">${t("bind.name")}</span><span class="guide-card-desc">${t("tools.cardBind")}</span></a>
        </div>
        <h2>${t("tools.moreTitle")}</h2>
        <ul class="related">
            <li><a href="../commands/">${t("links.commands")}</a></li>
            <li><a href="../guides/">${t("links.guides")}</a></li>
            <li><a href="../">${t("links.pros")}</a></li>
        </ul>
    </main>

    ${footer("../")}
</body>
</html>
`);
            if (EN) {
                console.log("tools/index.html + tools/bind-generator.html");
            }
        }
    }
};
