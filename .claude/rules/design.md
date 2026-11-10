---
paths:
  - "style.css"
  - "DESIGN.md"
  - "index.template.html"
  - "render.js"
  - "teams.js"
  - "photos/**"
  - "logos/**"
  - "images.js"
---

# Design (univers « Retransmission Major »)
(sorti de CLAUDE.md le 10/11/2026 ; les dates et les décisions sont dans HISTORIQUE.md)

Référence complète : `DESIGN.md` (couleurs, polices, composants, règles). Fiche produit : `PRODUCT.md`. Contrat de direction : `.impeccable/surfaces/index-html.md`.

## style.css
- Toutes les couleurs sont des variables en haut du fichier : `:root` (mode sombre, prioritaire) et `html.light, body.light` (mode clair). **Jamais de couleur en dur dans une règle** : ajouter ou modifier une variable.
- Polices déclarées en haut (`@font-face`, fichiers dans `fonts/`). Familles, tailles (`--fs-*`), graisses (`--fw-*`), interlignages (`--lh-*`) : des variables.
- **Le bloc `@media (max-width: 800px)` reste tout en bas du fichier.**
- Coins 2 px au plus, séparations 1 px, pas de lueurs, pas de texte en dégradé, pas de petit titre au-dessus d'un titre.

## Palette « Charbon & Rouge signature »
- Sombre : fond #111214, rail et en-têtes #0C0D0F (noir charbon, environ 70 %) ; cartes #1B1D21, champs #24272C, séparations #30343A (gris profond, environ 25 %) ; rouge signature environ 5 % : #D7262F (texte blanc), survol #B51C25, appuyé #9C1820, liens #FF5C63.
- Texte : titres #ECEDEF ; **`--text-body` #C4C8CE pour tous les textes à lire** (paragraphes, FAQ, pied de page, fil d'Ariane) ; secondaire `--muted` #A8ADB5 (petits libellés).
- Clair : fond #F3F4F6, cartes #FFFFFF / #EDEFF2, texte #15171A, `--text-body` #33373D, secondaire #4F545C, rouge #C8202A, liens #B51C25.
- Contrastes au moins WCAG AA.
- Rouge = boutons, sélection, interactions uniquement, jamais en grande surface.
- **Pas de jaune ni d'ambre dans l'interface** : le jaune n'existe que dans les couleurs d'équipes (Vitality, NAVI). Pas d'accent vert ou cyan (réservés aux crosshairs).

## Typographie
- Barlow Condensed **uniquement** pour les titres et les noms des joueurs.
- Inter pour tout le reste (texte, onglets, boutons, menus, libellés).
- JetBrains Mono pour les codes et les commandes.
- Polices hébergées sur le site (woff2, pas de Google Fonts). Le dossier `fonts/` contient 4 familles : Barlow Condensed, Inter, JetBrains Mono, et Roboto Condensed pour les titres russes. Licences dans `fonts/LICENSE.txt`.

## La fiche joueur (cartes, fiche, pages)
- Chaque joueur = « fiche joueur » de retransmission : bandeau couleur d'équipe biseauté avec le pseudo et la photo découpée, ligne équipe/date, boîte « Crosshair » (aperçu taille réelle), code + Copy, console + Copy.
- **Pseudo en vraie casse** (« ZywOo », « kennyS »), jamais en majuscules. 28 px sur les cartes et la fiche (`--fs-name`), 40 px dans le H1 des pages joueurs (`--fs-name-lg`).
- **La console reste visible sur les cartes** (demande d'Anto).
- Cartes fabriquées par `cardHTML` (render.js). Option `base` = chemin vers la racine de la langue, pour le lien vers la page du joueur.
- Couleur du texte sur un bandeau d'équipe : calculée (`textOnColor`, render.js).
- Couleurs d'équipe dans `teams.js`. Spirit #8E98A8, FURIA #222329, G2 #ECEEF2 sont séparées volontairement. BC.Game #23EE88 (vert du logo).
- Logos noirs (furia, spirit, g2) inversés en mode sombre, fut inversé en mode clair (CSS sur `.team-badge`). Sur un bandeau d'équipe, le logo FURIA est toujours inversé.

## En-tête de l'accueil (dans cet ordre)
1. Barre du haut : à gauche le menu principal (`.main-nav`, rubrique actuelle soulignée en rouge ; liste des rubriques dans `.claude/rules/hebergement-seo.md`) ; à droite la navigation compacte regroupée dans `.top-actions` : jeu CS2 / Valorant (soon), FAQ, langue, mode clair/sombre.
2. Titre H1 « Find your perfect CS2 crosshair » (garde le mot-clé CS2).
3. Grande barre de recherche (`#search`).
4. **4** accès rapides : Pros, Creators, Trending, Pro Skins (`[data-goto]`, nombres dans `[data-count]`, ouvrent l'onglet puis descendent à la grille).
5. La grille.
Pas de bannière, pas d'animation, pas de slogan.

## En-tête des autres pages
- Le menu commence à 280 px du bord gauche, comme sur l'accueil (logo dans une zone de 216 px = largeur du rail des équipes).
- Fil d'Ariane « Home › … » avec la petite maison (`HOME_ICON` dans build.js).

## Onglets de l'accueil
- **Pros** (par défaut), **Creators**, **Trending** (joueurs avec `"trending": true`), **Generator**, **Pro Skins** (5 inventaires : ZywOo, donk, m0NESY, NiKo, molodoy).
- Barre d'onglets encadrée ; onglet actif = couleurs inversées + petit trait rouge. Onglets utilisables au clavier (flèches).
- Menu de gauche : les 15 équipes (pas de drapeaux ni de pays), puis les inventaires des pros, puis réseaux sociaux et contact.
- Sur téléphone : le rail des équipes passe en haut, les réseaux sociaux tout en bas.

## Ce que contient l'accueil (index.template.html)
- Balises d'aperçu de lien (Open Graph + Twitter, image `og-image.jpg` 1200×630), icônes, préchargement des polices et des modules JS, JSON-LD WebSite + Organization.
- Un petit script au début du `<body>` : mode clair/sombre sans flash (classe `light` sur `html` ET `body`) + `photoFallback` (initiales si une photo manque).
- Lien « Skip to content », sélecteur de langue, lien vers faq.html (il n'y a pas de FAQ sur l'accueil).
- Blocs écrits par build.js : `CSS`, `TEAMS`, `SKINSIDE`, `MAINNAV`, `CARDS:pros`, `CARDS:creators`, `CARDS:trending`, `GENERATOR`, `PROSKINS`, `SPONSOR`, `TEAMLINKS`, et les compteurs `data-count`.
- L'accueil ne télécharge pas players.json : tout est déjà dans le HTML.

## Réseaux sociaux et contact
- Bas du menu de gauche : TikTok (lien `#`, à remplacer ou cacher), X → https://x.com/ClutchCrosshair, email (icône enveloppe couleur Gmail `--brand-gmail` #EA4335).
- Sous « Contact us » : « Business, partnerships, sponsorships: we're open to everything. » + l'adresse cliquable (`.side-mail`).
- Pied de page de toutes les pages : « Business & partnerships: clutchcrosshair@gmail.com » (`.footer-contact`).
- Logos dans leurs couleurs officielles (TikTok blanc avec décalage cyan/rose, X blanc ou noir selon le mode).

## Photos et logos
- `photos/` : photos d'origine (HLTV), nom = `slug` du pseudo en minuscules (`huNter-` → `hunter.webp`). build.js cherche .webp, puis .png, puis .jpg. Sans photo : les initiales.
- `images.js` (appelé par build.js, utilise Chrome) fabrique `photos/sm/` (miniatures des cartes), `photos/md/` (fiche, pages joueurs), `logos/sm/` (48 px), les deux fonds des aperçus, `apple-touch-icon.png`, `icon-512.png`, et `og-image.jpg` seulement si elle n'existe pas (la supprimer pour la refaire). Ne refait que ce qui est nouveau ou modifié. Sans Chrome, le site utilise les originaux.
- **Ne jamais modifier `photos/sm`, `photos/md`, `logos/sm` à la main.**
- Photos chargées au défilement (`loading="lazy"`), sauf les 4 premières cartes (`EAGER_CARDS`). Dimensions dans le HTML.
- Quand Anto télécharge des photos en vrac : les renommer pour lui.
- `logos/` : PNG, noms en minuscules.

## Accessibilité
- Onglets au clavier, fiche = vraie boîte de dialogue (Échap, focus rendu à la fermeture), « Copied » annoncé aux lecteurs d'écran, lien « Skip to content ».
