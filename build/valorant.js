// build/valorant.js : 3 septies. valorant.html : page "Coming soon" façon Killjoy (noindex, pas dans le sitemap)
// Un morceau de build.js (découpé le 10/11/2026) : build.js l'appelle une fois par langue.
// c = la « boîte à outils » commune préparée par build.js (textes traduits, en-tête, pied de page, données, outils…).
// Le code garde son retrait d'origine : les pages fabriquées sont identiques au caractère près.
module.exports = {
    build: function (c) {
        const {
            crumbs, esc, footer, head, HTML_OPEN, langUrl, LD, pageTop, t, THEME_SCRIPT, tList, write
        } = c;

        // ===== 3 septies. valorant.html : page "Coming soon" façon Killjoy (noindex, pas dans le sitemap) =====
        // Tourelle 100 % SVG/CSS (aucune image de Riot), barre bloquée à 87 %, phrases drôles qui changent
        const VALORANT_JOKES = tList("valorant.jokes");
        write(LD + "valorant.html", `<!DOCTYPE html>
${HTML_OPEN}
<head>
    ${head({ title: t("valorant.title"), description: t("valorant.description"), url: langUrl("valorant.html"), path: "valorant.html", prefix: "", noindex: true })}
</head>
<body class="page">
    ${THEME_SCRIPT}
    ${pageTop("./")}

    <main class="player-page vk-page">
        ${crumbs("./", "<span>Valorant</span>")}

        <div class="vk-stage" aria-hidden="true">
            <svg class="vk-turret" viewBox="0 0 240 220">
                <ellipse class="vk-shadow" cx="120" cy="204" rx="70" ry="7"/>
                <g class="vk-legs">
                    <path d="M120 150 L62 200"/>
                    <path d="M120 150 L178 200"/>
                    <path d="M120 150 L120 204"/>
                </g>
                <g class="vk-body">
                    <rect x="78" y="96" width="84" height="58" rx="6"/>
                    <rect class="vk-panel" x="90" y="108" width="28" height="8" rx="2"/>
                    <rect class="vk-panel" x="90" y="122" width="18" height="8" rx="2"/>
                </g>
                <g class="vk-barrel">
                    <rect x="160" y="114" width="54" height="12" rx="3"/>
                    <rect class="vk-panel" x="206" y="111" width="10" height="18" rx="2"/>
                </g>
                <g class="vk-head">
                    <rect x="92" y="58" width="56" height="42" rx="8"/>
                    <circle class="vk-eye-socket" cx="120" cy="79" r="13"/>
                    <circle class="vk-eye" cx="120" cy="79" r="6"/>
                    <path class="vk-antenna" d="M136 58 L144 38"/>
                    <circle class="vk-antenna-tip" cx="144" cy="36" r="3.5"/>
                </g>
                <g class="vk-sparks">
                    <circle cx="160" cy="120" r="2.5"/>
                    <circle cx="167" cy="110" r="1.8"/>
                    <circle cx="154" cy="108" r="1.6"/>
                </g>
            </svg>
        </div>

        <h1 class="vk-title">${t("valorant.h1")}</h1>
        <p class="vk-lead">${t("valorant.lead")}</p>

        <div class="vk-progress" role="progressbar" aria-label="${t("valorant.progressAria")}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="87">
            <div class="vk-bar"><i></i></div>
            <span class="vk-percent" id="vk-percent">87%</span>
        </div>
        <p class="vk-eta">${t("valorant.eta")}</p>

        <p class="vk-joke" id="vk-joke" aria-live="polite">${esc(VALORANT_JOKES[0])}</p>

        <p class="vk-actions">
            <a class="vk-back" href="./">${t("valorant.back")}</a>
            <a class="vk-alt" href="generator.html">${t("valorant.alt")}</a>
        </p>
    </main>

    ${footer("")}
    <script type="module">
        // Compteur qui monte jusqu'à 87 % en même temps que la barre (directement 87 % si moins d'animations)
        const percent = document.getElementById("vk-percent");
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const start = performance.now();
        function count(now) {
            const t = Math.min(1, (now - start) / 3200);
            percent.textContent = Math.round(87 * (1 - Math.pow(1 - t, 3))) + "%";
            if (t < 1) {
                requestAnimationFrame(count);
            }
        }
        if (!calm) {
            percent.textContent = "0%";
            requestAnimationFrame(count);
        }

        // Une phrase drôle toutes les 3,5 secondes, avec un petit fondu
        const jokes = ${JSON.stringify(VALORANT_JOKES)};
        const joke = document.getElementById("vk-joke");
        let i = 0;
        setInterval(function () {
            joke.classList.add("vk-fade");
            setTimeout(function () {
                i = (i + 1) % jokes.length;
                joke.textContent = jokes[i];
                joke.classList.remove("vk-fade");
            }, calm ? 0 : 250);
        }, 3500);
    </script>
</body>
</html>
`);
    }
};
