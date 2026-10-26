// ===== lang-banner.js : bandeau « Ce site existe en français. Voir la version française ? » =====
// Remplace l'ancienne redirection automatique selon la langue du navigateur (26/10/2026) : on ne redirige plus
// jamais personne, on PROPOSE la page traduite. Chargé en defer sur toutes les pages (head() dans build.js +
// index.template.html). Le bandeau est ajouté par le navigateur seulement : il n'est pas dans le HTML lu par Google.
//   - affiché seulement si une langue du navigateur (navigator.languages, dans l'ordre de préférence) fait partie
//     des langues du site et n'est pas celle de la page ; jamais pour les robots ;
//   - écrit dans la langue du VISITEUR (textes « langBanner » des fichiers i18n, ajoutés ici par build.js) ;
//   - posé par-dessus la page (position fixe) : il ne décale rien (pas de CLS) ;
//   - le bouton est un vrai lien <a href> vers la même page traduite (adresses de window.ccAlternates, écrites
//     dans chaque page par build.js) ;
//   - un clic sur le lien, sur la croix, ou un changement de langue dans le sélecteur enregistre le choix
//     (localStorage.lang) : le bandeau ne revient plus.
(function () {
    var TEXTS = {}; // remplacé par build.js dans lang-banner.min.js : { fr: { text, button, close }, ... }
    var KEY = "lang";

    // Robots, aperçus de liens et navigateurs pilotés : pas de bandeau
    var agent = navigator.userAgent || "";
    if (navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|pinterest|vkshare|quora/i.test(agent)) {
        return;
    }

    var alternates = window.ccAlternates || {};
    var pageLang = (document.documentElement.lang || "en").toLowerCase();

    function saved() {
        try {
            return localStorage.getItem(KEY);
        } catch (error) {
            return "unknown"; // stockage bloqué : on ne peut pas retenir le choix, donc on ne dérange pas
        }
    }
    function save(lang) {
        try {
            localStorage.setItem(KEY, lang);
        } catch (error) { /* rien */ }
    }

    // La première langue du navigateur que le site propose (ex. ["de-DE", "fr-FR", "en"] -> "fr")
    function visitorLang() {
        var list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""];
        for (var i = 0; i < list.length; i++) {
            var code = String(list[i]).slice(0, 2).toLowerCase();
            if (TEXTS[code] && alternates[code]) {
                return code;
            }
        }
        return null;
    }

    function show(lang) {
        var t = TEXTS[lang];
        var banner = document.createElement("aside");
        banner.className = "lang-banner";
        banner.lang = lang;
        banner.setAttribute("aria-label", t.text);

        var text = document.createElement("p");
        text.className = "lang-banner-text";
        text.textContent = t.text;

        var link = document.createElement("a");
        link.className = "lang-banner-go";
        link.href = alternates[lang];
        link.hreflang = lang;
        link.textContent = t.button;
        link.addEventListener("click", function () {
            save(lang);
        });

        var close = document.createElement("button");
        close.type = "button";
        close.className = "lang-banner-close";
        close.setAttribute("aria-label", t.close);
        close.textContent = "×";
        close.addEventListener("click", function () {
            save(pageLang); // le visiteur reste dans la langue de la page
            banner.remove();
        });

        banner.append(text, link, close);
        // Juste sous la barre du haut (plus haute sur téléphone) : mesurée maintenant, rien ne bouge dans la page
        var header = document.querySelector(".topbar, .page-top");
        if (header) {
            banner.style.top = Math.max(12, Math.round(header.getBoundingClientRect().bottom) + 12) + "px";
        }
        document.body.append(banner);
    }

    if (saved()) {
        return;
    }
    var lang = visitorLang();
    if (lang && lang !== pageLang) {
        show(lang);
    }
})();
