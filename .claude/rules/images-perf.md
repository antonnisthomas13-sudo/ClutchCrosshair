---
paths:
  - "images.js"
  - "og.js"
  - "og/**"
  - "critical.js"
  - "critical.css"
  - "fonts/**"
  - "_headers"
  - "style.css"
  - "index.template.html"
---

# Performance (Lighthouse) et images d’aperçu
(déplacé de CLAUDE.md le 24/10/2026 : chargé seulement quand on touche à ces fichiers)

**Optimisations Lighthouse (20/10/2026)** — mesures locales, accueil mobile : performance 97 → **99**, LCP 2,4 s → **1,9 s**, poids 327 → **226 Ko** ; page joueur 100. (En ligne, le « Legacy JavaScript » vient du script Cloudflare Web Analytics : à ignorer.)
- **Minification** : `node build.js` fabrique avec **esbuild** (`npm ci` installe l'outil, dossier `node_modules/` ignoré par Git ; aussi dans la mise à jour automatique GitHub) `style.min.css`, `crosshair.min.js`, `generator.min.js`, `script.min.js`. **Les pages chargent les .min ; on ne modifie JAMAIS un .min à la main** : on modifie la source lisible puis `node build.js`. Dans les sources, les imports restent simples (`./crosshair.js`) ; build.js écrit `./crosshair.min.js?v=…` dans les .min. Fins de ligne uniformisées → mêmes empreintes sur le PC et sur GitHub.
- **CSS critique** (accueil seulement) : `critical.js` fait ouvrir l'accueil par Chrome (4 tailles d'écran × mode sombre/clair) et garde les règles utiles au haut de page (+ polices, variables, règles qui cachent un élément visible) ; build.js l'écrit dans `<style>` entre `CSS:START/END` dans index.html et charge `style.min.css` sans bloquer (preload + onload, `<noscript>` de secours). Résultat gardé dans **`critical.css`** avec l'empreinte de style.min.css : recalculé seulement si le CSS change. **Si on change la structure du haut de l'accueil sans toucher au CSS : `node build.js --critical`.** Sans Chrome : feuille de style normale (rien ne casse). Vérifié : rendu du haut de page identique au pixel (sauf la barre de défilement).
- **Polices allégées** : originales dans `fonts/src/`, versions du site fabriquées par `py fonts/subset_fonts.py` (`py -m pip install fonttools brotli`) : caractères latins + accents + ponctuation (€ ™ « » — … ›), Inter limitée aux graisses 400-600. 93 → 60 Ko. Si le site utilise un nouveau caractère spécial : l'ajouter dans `UNICODES` et relancer le script.
- **Fond des cartes** : `preview-bg-crop.webp` (33 Ko, avant `preview-bg-sm.webp` 95 Ko) = seulement la zone autour du viseur, en vraie résolution (`CARD_CROP` dans crosshair.js = `crop` dans images.js, les garder identiques) ; si une carte est plus grande que cette zone, l'aperçu prend automatiquement `preview-bg.webp` (`cropFits`).

- **`og.js` + dossier `og/`** (24/10/2026) : une image d’aperçu de lien **par joueur** (`og/<pseudo>.jpg`, 1200×630, ~75 Ko) : logo, photo, pseudo dans le bandeau couleur d’équipe, équipe, code ; à droite Dust2 + le vrai crosshair, **zoom ×5** (décor et crosshair agrandis ensemble, mêmes calculs que `drawBars`). Utilisée par `og:image` / `twitter:image` des pages joueurs (5 langues, `alt` = `player.ogImageAlt`) ; les autres pages gardent `og-image.jpg`. Refaite seulement si pseudo, équipe, code, photo ou og.js changent (clés dans `og/keys.json`, fins de ligne uniformisées → mêmes clés sur GitHub). Joueurs disparus → image supprimée. Cache 1 an dans `_headers` + empreinte `?v=`. Textes de l’image en anglais (une seule image pour toutes les langues).