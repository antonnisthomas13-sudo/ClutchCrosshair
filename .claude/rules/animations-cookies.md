---
paths:
  - "consent.js"
  - "script.js"
  - "crosshair.js"
  - "valorant.html"
---

# Animations fun + Google Analytics / cookies
(déplacé de CLAUDE.md le 24/10/2026 : chargé seulement quand on touche à ces fichiers)

- **Animations fun** (19/10/2026, tout en CSS/SVG, aucune image de Valve ou Riot, coupées ou adoucies si « moins d'animations ») :
  1. **`valorant.html`** (fabriquée par build.js, **noindex**, pas dans le sitemap) : tourelle façon Killjoy qui se construit, barre bloquée à 87 %, 5 phrases drôles qui changent (`VALORANT_JOKES` dans build.js). Le bouton « Valorant soon » de l'accueil (`.game-soon`) y mène. Pas d'inscription email (il faudrait un service externe).
  2. **« HEADSHOT »** façon killfeed au-dessus de chaque bouton Copy (`showHeadshot` dans crosshair.js, environ 1 s).
  3. **Easter egg « rush b »** dans la recherche de l'accueil : un bonhomme traverse l'écran (`rushB` dans script.js).
  4. **Easter egg « 7355608 »** : la C4 se pose, bips visuels qui accélèrent, petite explosion cartoon, « Terrorists win / You should've defused it. » (`plantBomb` dans script.js) ; pas de son, pas de flash, 4 s maximum, clic ou Échap pour fermer. Couleurs de la scène : variables `--c4-*` (toujours sombres).
- **Google Analytics 4 + bandeau cookies CNIL** (21/10/2026, ID **G-195B8EZ9BP**) : **`consent.js`** (→ `consent.min.js`, empreinte `CONSENT_HASH`, dans `_headers`) chargé en `defer` sur TOUTES les pages (`consentScript()` appelé par `head()` dans build.js ; accueil via `{{@consent}}` dans index.template.html). Bandeau affiché après le chargement de la page (ne ralentit rien), boutons « Refuse » / « Accept » avec **la même classe `.consent-btn`** (même taille, couleur, place : exigence CNIL, ne pas en mettre un en avant). Google Analytics n'est téléchargé **qu'après « Accept »**, et **seulement sur clutchcrosshair.com** (pas en local : les tests ne faussent pas les stats). Choix gardé 6 mois (`localStorage.consent` = `{choice, date}`), puis redemandé. Cookies `_ga` limités à **13 mois** (`cookie_expires`, au lieu de 2 ans par défaut). Lien/bouton **« Cookies »** (`data-consent-open`) dans le pied de page de toutes les pages et dans les mentions légales = rouvre le bandeau ; « Refuse » après un accord efface les cookies `_ga*`. Mentions légales : section « Cookies and Google Analytics » (`id="cookies"`, 3ᵉ élément optionnel des `legal.sections` = id du titre). Textes : `js.consent*`, `footer.cookies`. critical.js enregistre un refus pour que le bandeau ne gêne pas le calcul du CSS critique. Cloudflare Web Analytics (sans cookies) reste en place.
