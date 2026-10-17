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
- `index.html` — la page. Lien CSS avec `style.css?v=N` et script avec `script.js?v=N`.
  **Quand tu modifies style.css ou script.js, augmente le N** (sinon mon navigateur garde l'ancienne version).
- `style.css` — tout le design (variables de couleurs dans `:root` et `body.light`, rouge `#E3262E`).
  **Le bloc `@media (max-width: 800px)` doit toujours rester tout en bas.**
- `script.js` — module JS. Importe `csgo-sharecode@7.0.1` depuis jsDelivr (`/+esm`).
  Contient : liste des 15 équipes (`teams`, avec logo), 20 pays créateurs (`countries`), aperçu canvas (`drawCrosshair`, `const zoom = 3` — j'ai choisi 3, ne le change pas sans me demander), cartes, recherche, menu équipes/pays, onglets Crosshairs/Trending, mode clair/sombre, fiche joueur (modal), photos.
  Clic sur une carte ou sur le nom = ouvre la fiche (le lien `players/<slug>.html` reste dans le HTML pour Google).
- `players.json` — les données. Champs : `name`, `steamid`, `team`, `category` ("pro" ou "creator"), `country` (créateurs, code 2 lettres), `code`, `updated` (JJ/MM/AAAA), `trending` (true/false), `photo` (optionnel).
- `build.js` — `node build.js` génère une page par joueur dans `players/` + `sitemap.xml` (SEO).
- `read_demo.py` — le robot (voir plus bas).
- `logos/` — logos des 15 équipes en PNG, noms en minuscules (spirit.png, vitality.png…). Les logos noirs (furia, spirit, mibr, g2) sont inversés en mode sombre et fut en mode clair (CSS).
- `photos/` — photos des joueurs (HLTV), nommées avec le pseudo en minuscules : `zywoo.png`, `donk.png`… Le site essaie .png puis .webp puis .jpg, sinon affiche les initiales.
- `favicon.svg`, `logo-horizontal-dark.svg`, `logo-horizontal-light.svg` — logo « Hex badge ».

Règle importante : **noms de fichiers en minuscules** (GitHub Pages est sensible à la casse). Windows cache parfois les extensions (piège `x.png.png`).

## Les codes de crosshair CS2 (important)
Depuis la mise à jour CS2 du 30/09/2026, les codes sont au nouveau format **`CS...`** (sans tirets, ex. `CSH2Rx7cGRU5apQ4VSnZwjsr9RyLEiOrCAaVYWYvW6dz7H`).
Les anciens `CSGO-xxxxx-...` ne s'importent plus dans le jeu.
`csgo-sharecode` 7.0.1 décode les deux (champ `format` : `cs2-v1`, `legacy-v1`…). Dans le nouveau format, les tailles sont en pixels pour `screenHeight`.

## Le robot read_demo.py
- Lit une démo CS2 (.dem) avec `demoparser2` (`pip install demoparser2`, déjà installé).
- Récupère pour chaque joueur : pseudo, SteamID, équipe (`team_clan_name`), crosshair (`crosshair_code`).
- Met à jour `players.json` : ajoute les nouveaux joueurs, met à jour les codes changés (+ date), suit les transferts par SteamID. Ignore les équipes qui ne sont pas sur le site (liste `SITE_TEAMS` + `TEAM_ALIASES`).
- Utilisation : `py read_demo.py "C:\chemin\vers\demo.dem"` puis `node build.js`.
- Les démos viennent de HLTV (je les télécharge à la main). **HLTV bloque les robots (Cloudflare) : ne pas essayer de contourner.**

## Fait
Structure du site, design rouge/noir, mode clair/sombre, recherche, menu 15 équipes avec logos + 20 pays avec drapeaux, onglet Trending, fiche joueur, copie code + console, aperçu du crosshair (fond sombre minimal avec grille), site compact (menu fixe), pages joueurs + sitemap, footer avec mention des marques, robot de démos (testé sur Vitality vs MOUZ : 10 joueurs ajoutés), photos automatiques.

## À faire (dans l'ordre)
1. Lire une démo Spirit et une Falcons (donk et m0NESY ont encore de faux codes ; Maj3r aussi).
2. **Mode semi-automatique** : un script `update.py` qui lit toutes les démos d'un dossier `demos/` (y compris archives), met à jour players.json, lance `node build.js`, et range les démos lues.
3. Refaire les pages joueurs (`build.js`) au même style que la fiche : photo, aperçu, commandes console.
4. Remplir les photos de toutes les équipes.
5. Créateurs de contenu : vrais créateurs et leurs codes (pas de démos officielles pour eux → formulaire d'envoi plus tard).
6. Nom de domaine clutchcrosshair.com + Google Search Console (envoyer le sitemap).
7. Plus tard : 100 % automatique (pistes : autorisation HLTV, GRID Open Access), onglet « skins des pros » (lisibles dans les démos avec `parse_skins` de demoparser2), sondage (Firebase), Valorant.
