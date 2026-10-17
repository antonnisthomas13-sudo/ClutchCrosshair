# ClutchCrosshair — notes pour Claude Code

## Qui je suis et comment travailler avec moi
- Je m'appelle Anto. Je débute complètement en code et j'apprends avec ce projet.
- Parle-moi **en français**, simplement, sans jargon (ou explique-le). Le **site** lui-même reste **en anglais**.
- Avant de modifier, dis-moi en 1-2 phrases ce que tu vas faire. Après, explique ce qui a changé et pourquoi.
- Fais des changements petits et sûrs, un sujet à la fois. Demande-moi avant les gros changements.
- Ne fais pas de commit / push sans que je le demande.
- Je suis sur Windows, avec VS Code et Live Server (http://127.0.0.1:5500). Python se lance avec `py` (pas `python`).

## Le projet
Site **ClutchCrosshair.com** : les codes de crosshair CS2 des joueurs pros et des créateurs de contenu.
Pour chaque joueur : photo, équipe, aperçu du crosshair, code de partage + commandes console, bouton Copy.
Objectifs : très fluide et ergonomique, design 2026, bon référencement Google (mot-clé « CS2 »), monétisation plus tard. Valorant plus tard.

Hébergement : GitHub Pages — https://antonnisthomas13-sudo.github.io/ClutchCrosshair
Je sauvegarde avec VS Code > Contrôle de code source > Valider puis Synchroniser.

## Les fichiers
- `index.html` — la page d'accueil. Lien CSS avec `style.css?v=N` et script avec `script.js?v=N`.
  **Quand tu modifies un fichier CSS/JS, augmente son N** (sinon mon navigateur garde l'ancienne version) :
  `style.css` → dans index.html ET `CSS_VERSION` dans build.js ; `script.js` → dans index.html ;
  `crosshair.js` / `teams.js` / `render.js` → le `?v=` des `import` en haut de script.js (+ `CROSSHAIR_JS_VERSION` dans build.js).
  Contient aussi : balises d'aperçu de lien (Open Graph, image = `preview-bg.jpg`), données structurées JSON-LD (WebSite + FAQ), un petit script au début du `<body>` qui applique le mode clair/sombre sans flash, sélecteur de langue (EN seul actif, FR/RU/ES/TR « soon »), FAQ courte (la complète est sur faq.html), **les cartes des joueurs** (entre `CARDS:pros:START/END` et `CARDS:creators:START/END`) et la liste de tous les joueurs (entre `PLAYERS:START/END`) — **écrites par build.js, ne pas modifier à la main**, liens du pied de page (FAQ, Legal notice), bloc réseaux sociaux + « Contact us » en bas du menu (liens `#` à remplacer).
- `crosshair.js` — module partagé (accueil + pages joueurs), dans le navigateur : `drawCrosshair`, `copyText`, fond de l'aperçu.
- `render.js` — module partagé (script.js + build.js) qui fabrique le HTML : `cardHTML`, `photoHTML`, `teamBadge`, `consoleCommands`, `slug`, **`esc` (protège les pseudos : toujours l'utiliser avant de mettre un texte dans du HTML)**.
- `teams.js` — module partagé : la liste des 15 équipes (`teams`, nom/couleur/logo). Utilisé par script.js et build.js.
- `style.css` — tout le design (variables de couleurs dans `:root` et `body.light`, rouge `#E3262E`).
  **Le bloc `@media (max-width: 800px)` doit toujours rester tout en bas.**
- `script.js` — module JS de l'accueil. Importe `crosshair.js` et `teams.js` (qui eux utilisent **`lib/csgo-sharecode.js`**, copie locale, plus de jsDelivr).
  Dans crosshair.js : aperçu canvas (`drawCrosshair`, `const zoom = 3` — j'ai choisi 3, ne le change pas sans me demander), fond de l'aperçu (`drawBackground` : capture `preview-bg.jpg` zoom 1.6, `focusX`/`focusY`, `brightness(0.8)`, halo sombre au centre — validé, ne pas changer sans demander).
  Dans script.js : cartes (`makeCard` : aperçu + code + console, chacun avec Copy — je veux voir la console sur les cartes), recherche (pros + créateurs), menu des équipes (pros seulement), tri (Team / Recently updated / Name), onglets, mode clair/sombre retenu (`localStorage`), fiche joueur (modal) avec adresse `#pseudo` (lien partageable, bouton Retour = fermer) + lien vers la page complète, photos.
  Clic sur une carte ou sur le nom = ouvre la fiche (le lien `players/<slug>.html` reste dans le HTML pour Google).
- `lib/csgo-sharecode.js` — librairie de décodage des codes (csgo-sharecode 7.0.1, licence MIT).
- `players.json` — les données. Champs : `name`, `steamid`, `team`, `category` ("pro" ou "creator"), `code`, `updated` (JJ/MM/AAAA), `trending` (true/false), `photo` (optionnel). (`country` existe encore sur Maj3r mais n'est plus utilisé.)
- `build.js` — `node build.js` génère (SEO) : les cartes + la liste des joueurs dans index.html, une page complète par joueur dans `players/` (supprime celles des joueurs disparus), `faq.html` (10 questions + stats des pros calculées), `legal.html` (mentions légales : `PUBLISHER_NAME` / `PUBLISHER_EMAIL` en haut de build.js), `sitemap.xml` (avec `lastmod`) et `404.html`. **À relancer après chaque changement de players.json.** Ne pas modifier faq.html / legal.html / players/ à la main : les changer dans build.js.
- `robots.txt` — pour Google (pointe vers le sitemap). Ne compte vraiment qu'une fois le nom de domaine en place.
- `read_demo.py` — le robot (voir plus bas).
- `demos/` — les démos à lire. **Ignoré par Git** (`.gitignore`), jamais envoyé sur GitHub.
- `logos/` — logos des 15 équipes en PNG, noms en minuscules (spirit.png, vitality.png…). Les logos noirs (furia, spirit, mibr, g2) sont inversés en mode sombre et fut en mode clair (CSS).
- `photos/` — photos des joueurs (HLTV), **au format WebP**, nommées avec le pseudo en minuscules : `zywoo.webp`, `donk.webp`… (le nom = `slug` du pseudo, ex. `huNter-` → `hunter.webp`). Le site essaie .webp puis .png puis .jpg, sinon affiche les initiales. Les photos se chargent au défilement (`loading="lazy"`).
  Quand je télécharge des photos en vrac, renomme-les pour moi.
- `preview-bg.jpg` — capture CS2 (Nuke) utilisée en fond des aperçus et comme image d'aperçu de lien.
- `favicon.svg`, `logo-horizontal-dark.svg`, `logo-horizontal-light.svg` — logo « Hex badge ».

Règle importante : **noms de fichiers en minuscules** (GitHub Pages est sensible à la casse). Windows cache parfois les extensions (piège `x.png.png`).

## Le site (onglets)
- **Pros** (onglet par défaut), **Creators**, **Trending** (joueurs avec `"trending": true`, mêmes cartes), **Generator** (« Coming soon », générateur de crosshair à faire), **Pro Skins** (« Coming soon » pour la V1).
- Barre d'onglets encadrée ; onglet actif = couleurs inversées (blanc en sombre) + petit trait rouge.
- Menu de gauche : seulement les 15 équipes (les drapeaux / pays ont été retirés).

## Les codes de crosshair CS2 (important)
Depuis la mise à jour CS2 du 30/09/2026, les codes sont au nouveau format **`CS...`** (sans tirets, ex. `CSH2Rx7cGRU5apQ4VSnZwjsr9RyLEiOrCAaVYWYvW6dz7H`).
Les anciens `CSGO-xxxxx-...` ne s'importent plus dans le jeu → **ne jamais mettre de code `CSGO-` sur le site**, et ne pas lire de démo d'avant le 30/09.
Les listes de codes trouvées sur Internet sont presque toutes encore en `CSGO-` : inutilisables.
`csgo-sharecode` 7.0.1 décode les deux (champ `format` : `cs2-v1`, `legacy-v1`…). Dans le nouveau format, les tailles sont en pixels pour `screenHeight`.
Plusieurs pros ont exactement le même code (ex. petit crosshair cyan ou vert) : c'est normal, vérifié en décodant (peu de réglages possibles en pixels).

## Le robot read_demo.py
- Lit une démo CS2 (.dem) avec `demoparser2` (`pip install demoparser2`, déjà installé).
- Récupère pour chaque joueur : pseudo, SteamID, équipe (dernier `team_clan_name` **non vide** — parfois vide en fin de match), crosshair (`crosshair_code`, constant pendant tout le match).
- Met à jour `players.json` : ajoute les nouveaux joueurs, met à jour les codes, suit les transferts par SteamID. Ignore les équipes qui ne sont pas sur le site (liste `SITE_TEAMS` + `TEAM_ALIASES`).
- **`updated` = date du match** (date du fichier .dem, conservée dans l'archive HLTV ; sinon `--date JJ/MM/AAAA`). Même code → la date avance (crosshair confirmé).
- Une démo **plus ancienne** que la date enregistrée ne change rien (plus besoin de lire dans l'ordre). Démos d'avant le 30/09/2026 et codes `CSGO-` refusés.
- Utilisation : `py read_demo.py "demos/fichier.dem"` (ou `--date 16/10/2026`) puis `node build.js`.
- Les démos viennent de HLTV (je les télécharge à la main, souvent en `.rar` dans Téléchargements ; une seule map suffit). Le `tar` de Windows (`C:\Windows\System32\tar.exe -xf archive.rar`) sait les ouvrir. **HLTV bloque les robots (Cloudflare) : ne pas essayer de contourner.**
- Démos déjà lues (dates corrigées le 18/10/2026 ; Spirit/Vitality/MOUZ gardent 17/10, leurs démos ne sont plus là) : FURIA-Aurora, Falcons-BetBoom, BetBoom-Legacy, G2-PARIVISION, PARIVISION-NAVI, FaZe-NAVI Junior, Astralis-MIBR (+ Spirit, Vitality, MOUZ avant). 71 joueurs, 14 équipes sur 15.

## Fait
Structure du site, design rouge/noir, mode clair/sombre (retenu), recherche, menu 15 équipes avec logos, onglets Pros / Creators / Trending / Pro Skins, tri, fiche joueur avec adresse `#pseudo`, copie code + console, aperçu du crosshair sur fond de capture CS2, pages joueurs complètes (style de la fiche) + sitemap avec dates + robots.txt + 404 + aperçus de lien + FAQ et JSON-LD, liste des joueurs en HTML sur l accueil, sélecteur de langue (préparé), réseaux sociaux + Contact us (liens à remplacer), librairie en local, code partagé (crosshair.js, teams.js), robot de démos, 71 joueurs de 14 équipes avec vrais codes CS2, photos de Spirit, Vitality, MOUZ (15 photos).

## À faire (dans l'ordre)
1. **Photos** des ~55 autres joueurs (je télécharge en vrac, tu renommes).
2. **Créateurs** (V1) : liste de ~20 créateurs à valider (proposée : ohnePixel, fl0m, Anomaly, Stewie2K, Trilluxe, Mauisnake, s1mple ?, Buster, Evelone, Recrent, StRoGo, ceh9, Gaules, Maj3r, Wtcn, Izak, Pasha Biceps, kennyS, shox, f0rest). Codes via **démos FACEIT téléchargées à la main** (matchs après le 30/09) ou commande `!crosshair` sur Twitch. Adapter le robot pour reconnaître les créateurs (par pseudo puis SteamID) et ignorer les autres joueurs. Maj3r a encore un faux code.
3. **Crosshair Generator** (onglet déjà prêt) : curseurs couleur/taille/écart/épaisseur/contour + aperçu + code (la librairie a `encodeCrosshair`).
4. Traductions FR/RU/ES/TR : pour le SEO, il faudra de vraies pages par langue (`/fr/`…) + balises `hreflang`, pas une traduction en JavaScript.
5. Menu de gauche sous les équipes : « Latest updates » (5 derniers crosshairs modifiés) + place pour une pub plus tard.
6. Mentions légales : remplir `PUBLISHER_NAME` / `PUBLISHER_EMAIL` dans build.js puis `node build.js`. Vraie image d'aperçu de lien 1200×630. Maj3r : faux code à retirer ou remplacer. Photos HLTV : risque droits d'auteur (décision à prendre). Liens réseaux sociaux `#` à remplacer ou cacher. Héberger les polices soi-même (RGPD).
7. Nom de domaine clutchcrosshair.com + Google Search Console (envoyer le sitemap) ; mettre à jour `SITE_URL` (build.js), les URL de `index.html` (canonical, og:, JSON-LD) et `robots.txt`, puis `node build.js`.
8. FUT : ajouter quand ils rejouent un match (aucun match depuis le 30/09).
9. Plus tard : `update.py` (lire tout le dossier `demos/`, archives comprises, de la plus ancienne à la plus récente, refuser les codes `CSGO-`), stats des pros, générateur de crosshair, 100 % automatique (pistes : API FACEIT, GRID Open Access), onglet « skins des pros » (`parse_skins` de demoparser2), sondage (Firebase), Valorant.
