# ClutchCrosshair : historique du projet

Ce fichier garde la mémoire du projet : les dates, les décisions d'Anto, les vérifications faites, les bugs corrigés et pourquoi. Il a été sorti de CLAUDE.md le 10/11/2026 pour l'alléger. Les règles à suivre aujourd'hui sont dans CLAUDE.md et dans `.claude/rules/`. Ici, on vient chercher « pourquoi c'est comme ça ».

Classé par sujet. Dans chaque sujet, du plus ancien au plus récent.

## Hébergement et nom de domaine
- 19/10/2026 : mise en ligne sur Cloudflare Pages, https://clutchcrosshair.com. Adresses changées partout dans le site. Ancienne adresse GitHub Pages désactivée le même jour (répond 404).
- 19/10/2026 : redirection www → sans www (règle Cloudflare 301, modèle « Redirect from WWW to root »), vérifiée.
- 19/10/2026 (audit) : ajout de `.nojekyll` pour que CLAUDE.html et DESIGN.html ne soient plus publiques sur GitHub Pages ; robots.txt interdit .md, .py, .yml. Le fichier `.nojekyll` existe toujours, il ne sert plus depuis le passage à Cloudflare.
- 24/10/2026 : Live Server (VS Code) ne marche plus pour tester, car il ne sait pas ouvrir les adresses sans « .html ». Remplacé par `serve.js`. Vérifié ce jour-là : 856 adresses internes répondent en 200 sans redirection.
- 24/10/2026 (audit sécurité) : serve.js refuse les demandes qui ne visent pas 127.0.0.1:5500 / localhost:5500 et ne sert jamais les fichiers cachés, `csfloat-key.txt` ni `faceit-test/`.
- 24/10/2026 (audit sécurité) : un pseudo de démo comme `</script><svg onload=…>` fermait la balise du JSON-LD et exécutait du code chez les visiteurs. Corrigé dans `head()` : tout JSON écrit dans un `<script>` passe par `.replace(/</g, "\u003c")`.
- 24/10/2026 : création de `_redirects` pour cacher les fichiers de travail publiés par erreur avec le site (CLAUDE.md, players.json, build.js, i18n/…).
- 10/11/2026 : en-têtes de sécurité ajoutés dans `_headers`, dossiers `.claude/`, `.github/`, `.impeccable/` et `.gitignore` cachés. Vérifié en ligne : les 4 en-têtes sont envoyés. Cloudflare envoie HSTS avec une durée de 6 mois (15552000) alors que `_headers` demande 1 an.
- 10/11/2026 : `mahisk.webp` supprimé (copie exacte de `photos/magisk.webp`, mal nommée).
- La règle « noms de fichiers en minuscules » venait de GitHub Pages, sensible à la casse. Vérifié le 10/11/2026 sur Cloudflare Pages : `/players/ZywOo` répond 404, la règle reste donc vraie.

## Adresses sans « .html » et redirections
- Cloudflare redirige seul `/page.html` vers `/page`, mais en 308.
- 24/10/2026 : build.js retire « .html » des adresses absolues (canonical, sitemap, og:url, JSON-LD), puis aussi des liens internes relatifs, pour que Google ne suive plus de redirections.
- 26/10/2026 : une ligne 301 par page dans `_redirects` (environ 850 lignes à l'époque). Ce jour-là, une ligne `/sitemap.xml /sitemap.xml` avait créé une boucle qui cassait le sitemap : c'est pourquoi le bloc ne contient que des pages `.html`.
- 26/10/2026, testé en ligne : 850 pages = une seule redirection 301 puis 200, aucune boucle ; accueils /, /fr/, /es/, /ru/, /tr/ = 200 direct.
- 26/10/2026 : hreflang, og:locale:alternate et `xhtml:link` du sitemap vérifiés complets, absolus et réciproques sur les 840 pages indexables de l'époque.
- 20/10/2026 : Anto a demandé des adresses `/cs2/<pseudo>`. Déconseillé, car Google connaît déjà `/players/<pseudo>`. À rediscuter seulement si Anto insiste, avec des redirections 301.

## Référencement Google
- 19/10/2026 : l'ancienne liste de tous les joueurs en bas de l'accueil est retirée à la demande d'Anto (les cartes contiennent déjà un lien vers chaque page joueur).
- 19/10/2026 : pages Liquipedia des joueurs vérifiées via l'API officielle (seulement les « Active Players »).
- 20/10/2026 : robots.txt autorise nommément les robots des moteurs et des assistants IA. Vérifié : Cloudflare ne bloque pas ces robots.
- 20/10/2026 : `llms.txt` et `llms-full.txt`.
- 24/10/2026 : `Disallow: /cdn-cgi/` dans robots.txt.
- 24/10/2026 : `methodology.html` (confiance, E-E-A-T).
- 24/10/2026 : `seoTitle()` ; titres des commandes choisis pour tenir en 60 caractères. Audit du jour : 0 titre de plus de 60, 0 description de plus de 160.
- 26/10/2026 : Anto demande de retirer le `noindex` de valorant.html le jour du lancement de Valorant.
- 10/11/2026, audit complet (865 pages indexables) : 0 titre ou description en double, 0 lien cassé, hreflang complet. Lighthouse mobile en ligne : accueil 97, page joueur 95, skins 98, page russe 91 ; accessibilité 100 ; SEO 92 à cause du lien « Learn more » du bandeau cookies (corrigé : 100 en local).
- 10/11/2026 : ajouts de l'audit, étapes 2 à 10 (année automatique, `lastmod.json`, pages équipes, pages de listes, historique des crosshairs, image du crosshair pour Google Images, fond léger sur téléphone, build.js découpé, check.js, liens sponsorisés). Le site passe de 880 à 1 005 pages. Découpage de build.js vérifié : site fabriqué identique au caractère près (1 986 fichiers comparés).
- **Search Console** : faite (propriété en place avant le 10/11/2026). Constat du 10/11/2026 à partir des exports d'Anto :
  - 846 pages indexées, 317 non indexées dont 260 « page avec redirection » (anciennes adresses .html), 14 noindex voulues, 19 détectées, 14 explorées non indexées, 9 introuvables (404), 1 erreur serveur.
  - Sur 28 jours : 79 clics. Vrais clics : pages joueurs (30, surtout shox, pashaBiceps, ScreaM, kennyS), commandes (25, surtout `m_yaw` en russe et en turc), accueil (12).
  - **Chute le 1er novembre 2026** : de 560-820 affichages et 5-14 clics par jour (20 au 31/10) à environ 10 affichages et 0 clic par jour.
  - Causes écartées : sanction manuelle et problème de sécurité (« Aucun problème détecté »), retrait de l'index (`site:` affiche toujours les pages), blocage technique (Google continue de lire le site chaque jour, hôte « Aucun problème », réponse en 120 ms), changement de code (aucun le 31/10 ni le 01/11).
  - Explication retenue, non prouvée : Google a réévalué un site neuf, sans liens venant d'autres sites, qui a publié beaucoup de pages d'un coup (340 → 846 pages indexées le 24/10 avec les trois nouvelles langues).
  - Décision : ne rien supprimer, ne plus ajouter de nouvelles séries de pages tant que les chiffres ne remontent pas, chercher des liens (X, créateurs, Reddit, guide Steam), surveiller les impressions chaque semaine.
  - Le détail des 9 pages 404, de l'erreur serveur et des 14 pages « explorées non indexées » n'a pas été exporté.

## Site multilingue
- 20/10/2026 : français en ligne. hreflang en / fr / x-default à l'époque.
- 20/10/2026 : décision d'Anto, thème toujours sombre à la première visite, même si l'ordinateur est en mode clair.
- 24/10/2026 : espagnol, russe et turc en ligne. Polices RU/TR en petits fichiers à part ; vérifié que les pages EN/FR ne les chargent pas.
- 26/10/2026 : à la demande d'Anto, plus aucune redirection automatique selon la langue du navigateur ; remplacée par le bandeau `lang-banner.js`. Testé : 15 scénarios sur 15 dans Chrome.
- 27/10/2026, bug corrigé : sur téléphone, les pages joueurs s'élargissaient à 458-473 px (écran de 390) à cause du code CS… de la FAQ, un mot de 46 lettres impossible à couper ; les bandeaux suivaient cette largeur. Correction : `overflow-wrap: break-word` sur `body`. Vérifié : 248 pages à 390 px pile (joueurs EN + RU, pages principales des 5 langues).
- `critical.js` ouvre Chrome en anglais : à l'époque de la redirection automatique, il aurait été redirigé.
- 10/11/2026 : 515 textes présents dans les 5 langues, 159 commandes et 7 guides traduits partout, aucune phrase restée en anglais.

## Design
- 18/10/2026 : refonte « Retransmission Major », choisie par Anto avec le skill Impeccable (direction « Major Broadcast Package »).
- 18/10/2026 : typographie validée par Anto.
- 18/10/2026 : palette « Charbon & Rouge signature » validée par Anto ; elle remplace « C4 Ambre ».
- 18/10/2026 : image d'aperçu de lien 1200×630, polices hébergées sur le site (plus rapide + RGPD).
- 19/10/2026 : `--text-body` #C4C8CE ajouté, car Anto trouvait l'ancien gris peu lisible.
- 19/10/2026 : style n°1 du bandeau joueur choisi par Anto (pseudo en vraie casse + photo découpée).
- 19/10/2026 : menu principal `.main-nav` choisi par Anto. À l'époque : Crosshairs / Generator / Pro Skins. Liste actuelle dans `.claude/rules/hebergement-seo.md`.
- 19/10/2026 : Anto trouve le fond des cartes à 0.5 « beaucoup trop sombre » ; passé à 0.85 + halo léger 0.3.
- 19/10/2026 (audit) : boutons de la barre du haut regroupés dans `.top-actions`, ils passent à la ligne ensemble sur tablette.
- 19/10/2026 : mention Valve dans le pied de page et les mentions légales.
- 20/10/2026 : Discord retiré des réseaux sociaux, remplacé par l'email.
- Les drapeaux et les pays ont été retirés du menu de gauche.
- En-tête identique partout : vérifié par un robot (position du menu + contraste WCAG AA de tous les textes, modes sombre et clair).
- À l'origine il y avait 3 polices et 3 accès rapides ; il y a aujourd'hui 4 familles de polices (Roboto Condensed pour le russe, 24/10/2026) et 4 accès rapides (Pro Skins, 19/10/2026).

## Dessin du crosshair et fond de l'aperçu
- L'ancien réglage `zoom = 3` rendait les crosshairs environ 5 fois trop gros : vérifié en jeu par Anto, retiré.
- Les codes et la console sont justes : testé en jeu sur NiKo.
- 19/10/2026 : `cl_crosshairstyle 9` (crosshair en X) vu en jeu par Anto sur shox ; réglé au pixel sur sa capture en 1280×960.
- 19/10/2026 : nouveau fond, capture Dust2 d'Anto (avant : Nuke). L'image `og-image.jpg` montre encore Nuke.
- 19/10/2026 : aperçu du générateur validé par Anto (photo non assombrie).
- 24/10/2026 : placement des traits mesuré sur 6 captures d'Anto en 1280×960, dont ZywOo. L'ancien calcul (écart compté depuis le bord du trait, soit + la moitié de l'épaisseur) laissait un trou en trop au centre.
- 24/10/2026, piège : `cl_crosshair_screen_height` tapé en console n'a pas pris effet chez Anto (les captures restaient en 1080). Une fausse règle « longueur − 1 » en était sortie ; corrigée grâce à ZywOo.
- Le script de test `xhair-test.mjs` cité à l'époque n'est plus dans le projet (vérifié le 10/11/2026).
- Fond des cartes : d'abord `preview-bg-sm.webp` (95 Ko), remplacé par `preview-bg-crop.webp` (33 Ko). `preview-bg-sm.webp` n'existe plus.
- 10/11/2026 : sur téléphone, la page joueur prend aussi le fond léger. Mesure Lighthouse locale : 32 Ko au lieu de 406 Ko.

## Performance
- 20/10/2026 : optimisations Lighthouse (détails dans `.claude/rules/images-perf.md`).
- 24/10/2026 : image d'aperçu de lien par joueur (`og/`).

## Codes, joueurs et démos
- 30/09/2026 : mise à jour CS2, nouveau format de code `CS...`.
- 18/10/2026 : dates des premières démos corrigées. Spirit, Vitality et MOUZ gardent le 17/10 : leurs démos n'étaient plus là, cette date est approximative.
- 19/10/2026 : codes identiques entre pros revérifiés en relisant les 8 démos. Chaque joueur garde un seul code par match, le site a bien le plus récent. À l'époque : 60 codes différents pour 70 pros, 50 pros avec une longueur 2.
- 19/10/2026 : 14 créateurs importés depuis creators.csv (StRoGo, Dima, fl0m, f0rest, GeT_RiGhT, s1mple, Chopper, Freakazoid, ScreaM, kennyS, shox, Izak, pashaBiceps + Maj3r avec son vrai code).
- 19/10/2026 : API officielle FACEIT testée avec `faceit-test.js`, elle ne donne pas les crosshairs.
- 24/10/2026 : MIBR remplacée par BC.Game (`logos/bcgame.png`). Les 5 joueurs MIBR (insani, LNZ, venomzera, nqz, tomaszin) retirés à la demande d'Anto. s1mple passé de créateur à pro BC.Game (SteamID 76561198034202275). Démo BC.Game-JiJieHao (22/10/2026, Ancient) : Magisk, asap, mzinho, Senzu ajoutés + nouveau code de s1mple.
- 26/10/2026 : FUT ajoutée (démo FUT-Liquid du 25/10 : xfl0ud, SunPayus, dem0n, Krabeni, dziugss). Les 15 équipes ont des joueurs.
- 27/10/2026 : photos de BC.Game et de FUT ajoutées. Les 89 joueurs ont leur photo (revérifié le 10/11/2026 : aucune photo manquante, créateurs compris).
- 19/10/2026 : décision d'Anto, on garde les photos HLTV. Le risque de droits d'auteur reste noté.
- 03/11/2026 : dans la démo 9z-BetBoom, BetBoom s'appelle « BB TEAM ». Le robot avait ignoré ses 5 joueurs sans prévenir ; alias ajouté. Depuis le 10/11/2026, le robot affiche une alerte dans ce cas.
- 10/11/2026 : historique des crosshairs reconstruit depuis les 27 versions de players.json dans Git : 49 joueurs, 97 anciens codes. Quand deux codes différents portaient la même date sans heure, l'ancien n'a pas été gardé (ordre impossible à connaître).
- La liste complète des démos lues est dans `.claude/skills/lire-une-demo/SKILL.md`.

## Skins des pros
- 19/10/2026 : onglet et pages Pro Skins, 4 inventaires au départ. Aujourd'hui 5 (ZywOo, donk, m0NESY, NiKo, molodoy).
- 19/10/2026 : mise à jour automatique sur GitHub (`.github/workflows/update-skins.yml`, chaque jour à 5 h UTC). Seule exception validée à la règle « pas de commit sans accord ».
- Protections du robot GitHub : en mode CI, images.js ne refait que les images manquantes ; un inventaire public refusé par Steam garde les données de la veille. Conséquence du robot : toujours faire `git pull` avant de modifier ou de sauvegarder.
- Le secret GitHub `CSFLOAT_KEY` était noté « à créer par Anto ». Vérifié le 10/11/2026 : les prix de skins.json sont datés du 10/11/2026 et arrivent par le robot, la clé est donc en place.

## Générateur, commandes, guides, outils, animations, cookies
- 19/10/2026 : générateur de crosshair (page + onglet) et animations fun.
- 21/10/2026 : Google Analytics 4 + bandeau cookies.
- 24/10/2026 : ces sujets ont leurs fiches dans `.claude/rules/`.

## Mentions légales et monétisation
- `PUBLISHER_NAME` = « Anto ».
- 19/10/2026 : email de contact clutchcrosshair@gmail.com (mentions légales, bouton « Contact us », FAQ, fiche Organization de l'accueil).
- 10/11/2026 : `sponsors.json` et emplacements sponsorisés ; mentions légales complétées (section « Sponsored links », droits RGPD, téléphone de Cloudflare +1 888 993 5273 vérifié sur le site de Cloudflare et un dépôt SEC, « No ads » retiré de la description).

## Viewmodel
- 22/10/2026 : mis de côté à la demande d'Anto. Le travail est dans `git stash` (« viewmodel (à reprendre) - 22/10/2026, contient aussi le nouveau code de donk »). Pour reprendre : skill `reprendre-viewmodel`.

## Audit du 19/10/2026 (numéros d'origine)
- Faits : #1 barre du haut, #4 `.nojekyll` et robots.txt, #12 partie Valve, #3 e-mail des mentions légales, #5 domaine et Search Console, #15 photos.
- Encore ouverts : #11 lien TikTok `#`, #17 cache Cloudflare (voir « Points flous »).

## Nettoyage de CLAUDE.md du 10/11/2026 : contradictions corrigées
- index.html était décrit comme « la page d'accueil » à modifier ; il est fabriqué depuis index.template.html.
- build.js était dit « génère les cartes + la liste des joueurs dans index.html » ; la liste des joueurs a été retirée le 19/10/2026 et les rubriques sont dans `build/`.
- Menu principal : l'ancienne liste « Crosshairs / Generator / Pro Skins » retirée ; la vraie liste vient de `mainNav()`.
- Langues : « hreflang en/fr/x-default » et « sitemap avec les deux langues » remplacés par 5 langues.
- « Zoom ×3 » : c'est le bouton du générateur, à ne pas confondre avec l'ancien `zoom = 3` interdit.
- « GitHub Pages sensible à la casse » remplacé par Cloudflare Pages.
- « 3 polices », « 3 accès rapides », « inventaires de 4 pros », « FAQ courte sur l'accueil », « ~850 lignes » de redirections : chiffres et mentions dépassés, corrigés.
- « Photos des créateurs » et « Search Console » étaient encore dans la liste À faire alors que c'est fait.
- « Photos HLTV : décision à prendre » alors que la décision du 19/10/2026 était notée ailleurs.

## Jeu « Zero to Major » (page /career)
- 12/11/2026 : première version jouable (FACEIT à 16 ans, trois tiers, tournois, note sur 100), en anglais et en français seulement. Nom choisi par Claude à la demande d'Anto (« un nom de jeu CS »).
- 12/11/2026 : version 2, d'après une liste de 15 demandes d'Anto : départ directement niveau 10 FACEIT, nationalité avec drapeau, 150 équipes et 63 séries de tournois, Major en trois stages puis quarts, demies, finale, banc, reconversion en leader à 30 ans, toxicité, aura et popularité, personnages fictifs qui reviennent, veto des maps, classement mondial de fin d'année, nouvel écran validé sur maquette (`.impeccable/mocks/career/`).
- Décisions d'Anto : « suis la réalité » pour le Major (pas de qualification, les 32 premières équipes du classement sont invitées) ; drapeaux = jeu d'images libre (flag-icons, MIT) chargé seulement sur la page du jeu ; logos seulement pour les 15 équipes du site, initiales pour les autres ; une carrière de 20 à 25 minutes est acceptable ; le classement s'appelle « Top 20 mondial », pas « HLTV ».
- Anecdotes vérifiées sur le web le 12/11/2026 : le « kick surprise » et la « souris du sponsor » n'ont pas pu être confirmés, donc personnages sans nom ou fictifs ; « 1G », « EZ4… » et le graffiti de Mirage sont des faits connus, cités sans nommer personne.
- Équilibrage par simulation (`node career-sim.js 300`) : chiffres dans `.claude/rules/career.md`.

## Points flous au 10/11/2026
- #17 « cache Cloudflare » de l'audit du 19/10 : `_headers` met déjà le cache à 1 an ; ce que ce point voulait dire d'autre n'est pas noté.
- Mentions légales en espagnol : la règle dit « vouvoiement partout », le texte tutoie.
- Dates du 17/10/2026 dans l'historique de Spirit, Vitality et MOUZ : approximatives.
- Adresses Valorant `/valorant/players/<pseudo>` : proposition, pas encore validée par Anto.
- Cause exacte de la chute Google du 1er novembre : non prouvée.
