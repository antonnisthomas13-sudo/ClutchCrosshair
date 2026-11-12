# ClutchCrosshair — notes pour Claude Code

## Qui je suis et comment travailler avec moi
- Je m'appelle Anto. Je débute complètement en code et j'apprends avec ce projet.
- Parle-moi **en français**, simplement, sans jargon (ou explique-le). Le **site** lui-même reste **en anglais** (traduit en FR, ES, RU, TR par le build).
- Avant de modifier, dis-moi en 1-2 phrases ce que tu vas faire. Après, explique ce qui a changé et pourquoi.
- Fais des changements petits et sûrs, un sujet à la fois. Demande-moi avant les gros changements.
- Je suis sur Windows, avec VS Code. Je sauvegarde avec Contrôle de code source > Valider puis Synchroniser.
- Quand je télécharge des photos en vrac, renomme-les pour moi. Quand je pose une démo à la racine, range-la dans `demos/`.

## Commandes
- Toujours d'abord : `git pull` (GitHub ajoute des commits tout seul chaque jour pour les skins)
- Après chaque changement (players.json, photo, CSS, JS, textes) : `node build.js` puis `node check.js`
- Tester : `node serve.js` puis http://127.0.0.1:5500 (Live Server ne marche pas)
- Python : `py` (pas `python`)
- Lire une démo : `py read_demo.py "demos/fichier.dem"` (skill `lire-une-demo`)
- Créateurs : `node import-creators.js` ; skins : `node update-skins.js` puis `node build.js`
- Jeu Zero to Major : `node career-sim.js 200` (joue 200 carrières tout seul) ; données réelles : `node career-src/update-data.js`
- Haut de l'accueil changé sans toucher au CSS : `node build.js --critical`
- Refaire l'image de partage : supprimer `og-image.jpg` puis `node build.js`

## Interdits
- Ne jamais modifier à la main : les `.min`, `players/`, `fr/` `es/` `ru/` `tr/`, `index.html`, `sitemap.xml`, `lastmod.json`, `llms.txt`, `llms-full.txt`, `faq.html`, `legal.html`, `photos/sm`, `photos/md`, `logos/sm`
- Ni les autres fichiers fabriqués : `teams/`, `crosshairs/`, `commands/`, `guides/`, `tools/`, les pages de `skins/`, `generator.html`, `methodology.html`, `valorant.html`, `404.html`, `og/`, `critical.css`, le bloc `HTML:START/END` de `_redirects`. On change la source (build.js, `build/`, les .json, index.template.html) puis on relance le build.
- Ne pas lire `players/` ni `sitemap.xml` (trop gros, générés)
- Jamais de code `CSGO-` sur le site, jamais de démo d'avant le 30/09/2026
- Ne jamais afficher ni publier `csfloat-key.txt` ou `.env`
- Jamais de commit/push sans mon accord (sauf le robot GitHub des skins)
- Jamais de lien payé sans `sponsorSlot()` et `rel="sponsored"`
- Ne jamais marquer une commande « removed » sans être sûr (en cas de doute : `check`, et me demander de la taper dans la console)
- Ne pas contourner la protection de HLTV
- Pas de couleur en dur dans style.css, le bloc `@media (max-width: 800px)` reste tout en bas
- Toujours `esc()` pour les pseudos, et `.replace(/</g, "\\u003c")` pour du JSON dans un `<script>`
- Tout nouveau texte : dans les 5 fichiers `i18n/*.json`, jamais en dur dans build.js. Jamais d'année en dur dans un titre : `{year}`
- Ne jamais traduire les pseudos, les équipes, les codes. En turc, jamais de suffixe collé à un pseudo
- Noms de fichiers en minuscules (Cloudflare Pages distingue majuscules et minuscules). Piège Windows : extensions cachées (`x.png.png`)
- Nouveau fichier de travail à la racine → l'ajouter dans `_redirects`. Nouveau JS ou image gardé 1 an → `_headers` + empreinte dans build.js. Nouveau dossier de pages → la liste de nettoyage à la fin de build.js
- Aperçu du crosshair : toujours à taille réelle. Ne jamais remettre l'ancien `zoom = 3` (le bouton « Zoom ×3 » du générateur, lui, est normal). Ne pas changer le point visé, les filtres ni le halo sans me demander
- Pseudos en vraie casse (« ZywOo »), jamais en majuscules. Pas de jaune ni d'ambre dans l'interface. La console reste visible sur les cartes
- Thème sombre à la première visite. Aucune redirection automatique selon la langue
- Garder les adresses `/players/<pseudo>`
- Jeu Zero to Major : jamais de dispute, de polémique ou de défaut inventé sur un vrai joueur ou une vraie équipe (rôles sans nom : « ton IGL », « ton coach », ou personnages fictifs de `career-src/cast.json`). Jamais un vrai joueur dans une histoire d'alcool, de drogue, de santé ou de vie privée
- Ne rien affirmer de faux sur le site (methodology, llms.txt, FAQ) : pas de chiffres ni de témoignages inventés
- Laisser « Block AI bots » désactivé dans Cloudflare
- Ne pas ajouter de nouvelles séries de pages tant que Google n'a pas remonté le site (voir « À faire »)

## Le projet
Site **ClutchCrosshair.com** : les codes de crosshair CS2 des joueurs pros et des créateurs de contenu.
Pour chaque joueur : photo, équipe, aperçu du crosshair, code de partage + commandes console, bouton Copy.
Aujourd'hui : 75 pros dans 15 équipes, 14 créateurs, 5 langues, environ 1 000 pages.
Objectifs : très fluide et ergonomique, bon référencement Google (mot-clé « CS2 »), monétisation par liens sponsorisés à prix fixe, Valorant plus tard.
Hébergement : **Cloudflare Pages**, https://clutchcrosshair.com (sans www). Le code est sur GitHub, chaque push est mis en ligne.

## Où trouver le détail
- Langues, textes, bandeau de langue : `.claude/rules/multilingue.md`
- Cloudflare, adresses, cache et empreintes `?v=`, sitemap, menu, pages équipes et listes, sponsors, check.js : `.claude/rules/hebergement-seo.md`
- Dessin du crosshair, taille réelle, fond Dust2, script.js : `.claude/rules/dessin-crosshair.md`
- Couleurs, polices, en-tête, cartes, photos : `.claude/rules/design.md` (référence complète : `DESIGN.md`)
- Robot des démos, players.json, format des codes : `.claude/rules/robot-demos.md`
- Vitesse, images, CSS critique, polices allégées : `.claude/rules/images-perf.md`
- Générateur : `.claude/rules/generateur.md` ; skins : `.claude/rules/skins.md` ; créateurs : `.claude/rules/createurs.md`
- Commandes, guides, outils : `.claude/rules/commandes-guides-outils.md`
- Animations, Google Analytics, cookies : `.claude/rules/animations-cookies.md`
- Le jeu « Zero to Major » (page /career, anglais et français) : `.claude/rules/career.md`
- Pourquoi c'est comme ça (dates, décisions, bugs corrigés, constat Search Console) : `HISTORIQUE.md`
- Fiche produit : `PRODUCT.md`

## Les fichiers (une ligne chacun)
**Sources à modifier**
- `index.template.html` — la vraie source de l'accueil. **`index.html` est fabriqué à partir de lui : on ne modifie jamais index.html.**
- `build.js` — fabrique tout le site : images, empreintes, morceaux communs (en-tête, menu, pied de page), pages joueurs, accueil, sitemap, llms.txt, `_redirects`. Les autres rubriques sont dans `build/`.
- `build/` — une rubrique par fichier : teams, lists, faq, generator, skins, commands, guides, tools, valorant, legal, methodology, notfound.
- `check.js` — vérifie le site fabriqué (titres, liens cassés, langues). Ne modifie rien.
- `render.js` — morceaux de HTML pour build.js : `cardHTML`, `photoHTML`, `teamBadge`, `consoleCommands`, `generatorHTML`, `skinCardHTML`, `textOnColor`, `esc`, `slug`.
- `i18n.js` + `i18n/` — les langues et tous les textes (5 fichiers + contenus traduits).
- `style.css` — tout le design (couleurs = variables en haut).
- `crosshair.js` — dessin du crosshair, Copy (accueil, pages, générateur).
- `script.js` — interactions de l'accueil (recherche, onglets, fiche joueur).
- `generator.js` — le générateur de crosshair.
- `consent.js` — bandeau cookies + Google Analytics après accord.
- `lang-banner.js` — bandeau « ce site existe dans ta langue ».
- `teams.js` — les 15 équipes (nom, couleur, logo).
- `career.js`, `career-engine.js` — le jeu « Zero to Major » (affichage, règles). `career-src/` — ses données et ses textes. `career-sim.js` — simulation pour l'équilibrage.
- `lib/csgo-sharecode.js` — librairie de décodage des codes (copie locale).

**Données**
- `players.json` — les joueurs, leurs codes et leur historique.
- `creators.csv` — mon tableau des créateurs.
- `skins.json` — inventaires et prix (écrit par update-skins.js).
- `commands.json`, `guides.json`, `binds.json` — commandes, guides, binds (en anglais ; traductions dans `i18n/<langue>/`).
- `sponsors.json` — liens sponsorisés (vide = rien ne s'affiche).

**Outils**
- `read_demo.py` — le robot qui lit une démo et met à jour players.json.
- `import-creators.js` — importe creators.csv.
- `update-skins.js` — inventaires Steam + prix CSFloat.
- `images.js`, `og.js`, `critical.js` — images légères, image de partage par joueur, CSS critique (appelés par build.js).
- `serve.js` — serveur de test local.
- `faceit-test.js` — essai de l'API FACEIT.
- `.github/workflows/update-skins.yml` — le robot GitHub des skins (chaque jour à 5 h UTC).

**Réglages Cloudflare**
- `_headers` — sécurité et cache. `_redirects` — fichiers de travail cachés + adresses sans .html. `robots.txt` — pour Google et les assistants IA.

**Images**
- `photos/` — photos d'origine, nom = pseudo en minuscules (`hunter.webp`). `logos/` — logos des équipes.
- `preview-bg.jpg` — capture Dust2, fond de tous les aperçus.
- `flags/` — drapeaux des pays (flag-icons, licence MIT), utilisés seulement par le jeu « Zero to Major ».
- `og-image.jpg` — image de partage du site. `og/` — image de partage par joueur.
- `favicon.svg`, `logo-horizontal-*.svg`, `apple-touch-icon.png`, `icon-512.png`, `site.webmanifest` — logo et icônes.
- `fonts/` — les polices du site.

**Fabriqués (ne pas toucher)**
- `index.html`, `career.html`, `career.en.json`, `career.fr.json`, `players/`, `teams/`, `crosshairs/`, `skins/`, `commands/`, `guides/`, `tools/`, `faq.html`, `generator.html`, `methodology.html`, `legal.html`, `valorant.html`, `404.html`, les mêmes dans `fr/` `es/` `ru/` `tr/`, `sitemap.xml`, `lastmod.json`, `llms.txt`, `llms-full.txt`, les `.min`, `critical.css`.

**Jamais sur GitHub** : `demos/`, `captures/`, `skins/src/`, `csfloat-key.txt`, `.env`, `faceit-test/`, `node_modules/`.

## À faire (dans l'ordre)
1. **Faire remonter le site dans Google.** Il a perdu son classement le 1er novembre (détail dans HISTORIQUE.md). Obtenir des liens : posts X à chaque tournoi, messages aux créateurs listés, post Reddit utile, guide Steam. Regarder les impressions dans Search Console chaque semaine. Pas de nouvelles séries de pages en attendant.
2. **Search Console** : exporter le détail des 9 pages introuvables (404), de l'erreur serveur et des 14 pages « explorées, non indexées », pour les corriger.
3. **Mentions légales avant la première vente d'un lien** : mon statut (micro-entreprise), nom, adresse et SIRET dans la section « Publisher ».
4. **Lien TikTok** du menu de gauche : encore `#`, à remplacer ou cacher.
5. **Créateurs** : valider la liste d'une vingtaine (proposée : ohnePixel, fl0m, Anomaly, Stewie2K, Trilluxe, Mauisnake, Buster, Evelone, Recrent, StRoGo, ceh9, Gaules, Maj3r, Wtcn, Izak, pashaBiceps, kennyS, shox, f0rest ; 14 sont déjà en ligne). Codes via démos FACEIT téléchargées à la main ou commande `!crosshair` sur Twitch. Il manque le code CS2 récent de Recrent (le sien est en `CSGO-`).
6. **Traductions** : faire vérifier les noms des menus du jeu par un joueur de chaque langue (liste dans multilingue.md).
7. **Menu de gauche** : bloc « Latest updates » (les 5 derniers crosshairs modifiés).
8. **Image de partage** `og-image.jpg` : elle montre encore Nuke, à refaire avec Dust2.
9. **Sécurité** : tester puis activer une Content-Security-Policy.
10. **Viewmodel** : en pause, travail gardé dans `git stash` (skill `reprendre-viewmodel`).
11. **Valorant** : me faire valider les adresses `/valorant/players/<pseudo>`, puis données (`valorant-players.json`) et dessin propres à Valorant. Le jour du lancement : retirer le `noindex` de `build/valorant.js`, ajouter la page au sitemap et à llms.txt.
12. **Plus tard** : `update.py` (lire tout `demos/` de la plus ancienne à la plus récente), stats des pros, démos sans téléchargement (pistes : API FACEIT, GRID Open Access), sondage (Firebase).
