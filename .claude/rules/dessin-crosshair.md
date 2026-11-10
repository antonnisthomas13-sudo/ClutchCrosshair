---
paths:
  - "crosshair.js"
  - "og.js"
  - "script.js"
  - "preview-bg.jpg"
---

# Dessin du crosshair (aperçus et images)
(sorti de CLAUDE.md le 10/11/2026 ; les dates et les vérifications sont dans HISTORIQUE.md)

## crosshair.js
Module partagé par l'accueil, les pages joueurs, équipes, listes et le générateur. Exporte `drawCrosshair`, `copyText`, `tr`. Utilise `lib/csgo-sharecode.js` (copie locale de csgo-sharecode 7.0.1, licence MIT).

## Taille réelle (règle validée, ne pas changer)
- L'aperçu (`drawCrosshair`) est dessiné **à taille réelle, comme en jeu sur l'écran du visiteur** : le décor et le crosshair sont agrandis du même facteur.
- Facteur de taille : vraie hauteur de l'écran × densité de pixels (`screen.height × devicePixelRatio`).
- Le canvas est dessiné à la taille exacte de l'écran (`devicePixelContentBoxSize`), net, sans `image-rendering: pixelated`, redessiné par un ResizeObserver.
- **Deux « zoom » à ne pas confondre :**
  - **Interdit** : l'ancien réglage `zoom = 3` appliqué à tous les aperçus. Il faussait les proportions (crosshairs environ 5 fois trop gros). Ne jamais le remettre.
  - **Autorisé** : le bouton « Zoom ×3 » du générateur (`data-zoom="3"` dans `generatorHTML`, render.js ; lu par generator.js puis crosshair.js via `canvas.dataset.zoom`). Le visiteur le choisit lui-même, le décor ET le crosshair sont agrandis ensemble, et les pixels sont agrandis sans lissage. Par défaut le générateur est en taille réelle.
  - L'image `og/<pseudo>.jpg` a son propre zoom ×5 (décor et crosshair ensemble), indiqué sur l'image.

## Placement des traits (mesuré en jeu)
Reproduit au pixel près par `drawBars` (crosshair.js) et `crosshairRects` (og.js). Garder les deux identiques.
- Chaque trait commence à **« écart » pixels du centre de l'écran**. L'épaisseur ne change PAS sa place.
- Épaisseur impaire : 1 px de plus à gauche et en haut.
- Longueur, épaisseur et écart = `round(valeur × hauteur d'écran / screenHeight)` en pixels du jeu, puis agrandis.
- **`cl_crosshairstyle 9` = crosshair en X** (4 traits en diagonale + point droit), dessiné à part : 4 petits carrés de côté = épaisseur arrondie vers le bas. Les styles 3, 4 et 5 sont dessinés en « + » classique.
- Dans le format CS2, les tailles sont en pixels pour `screenHeight`.

## Fond de l'aperçu (Dust2)
- Source : `preview-bg.jpg`, capture CS2 d'Anto sur Dust2, portes de Long A, avec un terroriste (skin par défaut) dans les portes, 1920×1080, compteur FPS et texte effacés, sans recadrage. Originaux dans `captures/` (ignoré par Git).
- Le viseur est posé sur la tête du terroriste, pixel (943, 517) : `focus` par défaut `0.4911,0.4787`.
- Deux versions fabriquées par `images.js` :
  - `preview-bg.webp` (406 Ko) : l'écran entier, net, copié pixel pour pixel sur un écran 1080p. Fiche, pages joueurs et générateur sur ordinateur.
  - `preview-bg-crop.webp` (33 Ko) : seulement la zone autour du viseur (`CARD_CROP` dans crosshair.js = `crop` dans images.js, à garder identiques). Petites cartes ; et, sur un écran de 800 px de large au plus, page joueur et fiche (`cropFits`).
- Chaque version n'est téléchargée que si un aperçu en a besoin. Si la zone recadrée ne suffit pas, l'aperçu prend l'image entière.
- Dessiné par `drawBackground`.
- Assombrissement : cartes `brightness(0.85)` + halo léger 0.3 ; fiche et pages joueurs `brightness(0.8)` + halo 0.55 ; générateur : photo telle quelle (`data-bg="raw"`).
- **Point visé `focus`, filtres et halo sont validés : ne pas les changer sans demander.**
- Position arrondie au pixel.

## Fluidité
- Les aperçus des cartes ne sont dessinés qu'à l'approche de l'écran (IntersectionObserver).
- Le fond préparé est gardé en mémoire par taille : un seul calcul pour toutes les cartes.

## Copier
- `copyText` : copie, annonce « Copied » aux lecteurs d'écran, solution de secours si le presse-papier moderne n'est pas disponible.
- Geste signature : barre rouge « COPIED » qui balaie la ligne du code (`.field-row.copied` dans style.css), coupée si le visiteur demande moins d'animations.
- « HEADSHOT » au-dessus du bouton : voir `.claude/rules/animations-cookies.md`.

## Codes identiques
- Plusieurs pros ont exactement le même code : c'est normal (peu de réglages possibles en pixels).
- Petite ligne grise « Same crosshair as … » sous l'aperçu (`.same-xhair`) : pages joueurs (vrais liens, `twins()` dans build.js) et fiche (`data-twins` sur la carte, liens `#pseudo`, `#modal-same` dans script.js). Absente si le code est unique.

## script.js (accueil)
- Seulement les interactions : le contenu est déjà dans le HTML.
- Un seul « écouteur » de clics pour toutes les cartes : bouton Copy, sinon ouverture de la fiche.
- Recherche (pros + créateurs), menu des équipes (pros seulement), tri (Team / Recently updated / Name), onglets, mode clair/sombre retenu.
- Fiche joueur (modal) : adresse `#pseudo` partageable, bouton Retour = fermer, lien vers la page complète, bouton FACEIT pour les créateurs.
- Clic sur une carte ou sur le nom = ouvre la fiche ; le lien `players/<slug>.html` reste dans le HTML pour Google.
- Les pages équipes et listes n'utilisent pas script.js : petit script commun `cardsScript()` dans build.js (aperçus, Copy, clic sur la carte = page du joueur).
