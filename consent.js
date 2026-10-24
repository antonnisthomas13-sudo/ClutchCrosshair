// ===== consent.js : bandeau cookies (CNIL) + Google Analytics 4 seulement après accord =====
// Chargé sur toutes les pages (head() dans build.js + index.template.html). Rien n'est envoyé à Google tant que le
// visiteur n'a pas cliqué sur « Accepter ». « Accepter » et « Refuser » ont exactement le même style (même taille,
// même couleur, même place). Le choix est gardé 6 mois dans le navigateur (localStorage), puis le bandeau revient.
// Le lien « Cookies » du pied de page (data-consent-open) rouvre le bandeau pour changer d'avis.
(function () {
    var GA_ID = "G-195B8EZ9BP";
    var KEY = "consent";
    var MAX_AGE = 182 * 24 * 3600 * 1000; // 6 mois : durée de validité du choix recommandée par la CNIL
    var COOKIE_DAYS = 390; // cookies Google Analytics : 13 mois maximum (CNIL), au lieu de 2 ans par défaut

    var script = document.currentScript;
    var legal = (script && script.dataset.legal) || "legal";

    // Textes : anglais par défaut, traduits par le dictionnaire de la page (<script id="i18n">, pages non anglaises)
    var texts = {};
    try {
        var dictionary = document.getElementById("i18n");
        texts = dictionary ? JSON.parse(dictionary.textContent) : {};
    } catch (error) { /* textes anglais */ }
    function tr(key, english) {
        return texts[key] || english;
    }

    function readChoice() {
        try {
            var saved = JSON.parse(localStorage.getItem(KEY) || "null");
            if (saved && (saved.choice === "accepted" || saved.choice === "refused") && Date.now() - saved.date < MAX_AGE) {
                return saved.choice;
            }
        } catch (error) { /* navigation privée stricte : on redemandera */ }
        return null;
    }

    function saveChoice(choice) {
        try {
            localStorage.setItem(KEY, JSON.stringify({ choice: choice, date: Date.now() }));
        } catch (error) { /* rien */ }
    }

    // Google Analytics : téléchargé seulement après « Accepter »
    // Seulement sur le vrai site : les tests en local (Live Server, 127.0.0.1) ne faussent pas les statistiques
    var LIVE = location.hostname === "clutchcrosshair.com";
    var loaded = false;
    function loadAnalytics() {
        if (loaded || !LIVE) {
            return;
        }
        loaded = true;
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
            window.dataLayer.push(arguments);
        };
        window.gtag("js", new Date());
        window.gtag("config", GA_ID, { cookie_expires: COOKIE_DAYS * 24 * 3600 });
        var tag = document.createElement("script");
        tag.async = true;
        tag.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
        document.head.appendChild(tag);
    }

    // Retrait du consentement : on efface les cookies de Google Analytics (_ga, _ga_XXXX)
    function removeAnalyticsCookies() {
        var host = location.hostname;
        var domains = ["", host, "." + host, "." + host.split(".").slice(-2).join(".")];
        document.cookie.split(";").forEach(function (cookie) {
            var name = cookie.split("=")[0].trim();
            if (/^_ga/.test(name)) {
                domains.forEach(function (domain) {
                    document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + (domain ? "; domain=" + domain : "");
                });
            }
        });
    }

    var banner = null;
    function hideBanner() {
        if (banner) {
            banner.remove();
            banner = null;
        }
    }

    function choose(choice) {
        var wasLoaded = loaded;
        saveChoice(choice);
        hideBanner();
        if (choice === "accepted") {
            loadAnalytics();
        } else {
            removeAnalyticsCookies();
            if (wasLoaded) {
                location.reload(); // Analytics déjà lancé sur cette page : on recharge sans lui
            }
        }
    }

    function showBanner() {
        if (banner) {
            return;
        }
        banner = document.createElement("section");
        banner.className = "consent";
        banner.setAttribute("aria-label", tr("consentAria", "Cookie consent"));

        var text = document.createElement("p");
        text.className = "consent-text";
        text.append(tr("consentText", "We would like to measure our audience with Google Analytics. It sets cookies only if you accept. Refusing has no effect on the site.") + " ");
        var more = document.createElement("a");
        more.href = legal + "#cookies";
        more.textContent = tr("consentMore", "Learn more");
        text.append(more);

        var actions = document.createElement("div");
        actions.className = "consent-actions";
        [["refused", tr("consentRefuse", "Refuse")], ["accepted", tr("consentAccept", "Accept")]].forEach(function (b) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = "consent-btn"; // même classe pour les deux : aussi visibles l'un que l'autre
            button.textContent = b[1];
            button.addEventListener("click", function () {
                choose(b[0]);
            });
            actions.append(button);
        });

        banner.append(text, actions);
        document.body.append(banner);
    }

    // Lien « Cookies » du pied de page : rouvre le bandeau
    document.addEventListener("click", function (event) {
        var opener = event.target.closest && event.target.closest("[data-consent-open]");
        if (opener) {
            event.preventDefault();
            showBanner();
            var first = banner.querySelector("button");
            if (first) {
                first.focus();
            }
        }
    });

    var choice = readChoice();
    if (choice === "accepted") {
        loadAnalytics();
    } else if (choice === null) {
        // Affiché une fois la page chargée : la page s'affiche d'abord, le bandeau ne ralentit rien
        if (document.readyState === "complete") {
            showBanner();
        } else {
            window.addEventListener("load", showBanner);
        }
    }
})();
