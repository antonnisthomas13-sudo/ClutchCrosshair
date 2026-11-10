---
paths:
  - "_headers"
  - "_redirects"
  - "serve.js"
  - "robots.txt"
  - "sitemap.xml"
  - "lastmod.json"
  - "llms.txt"
  - "llms-full.txt"
  - "check.js"
  - "build.js"
  - "build/**"
  - "sponsors.json"
---

# Hébergement, référencement Google et fabrication des pages
(sorti de CLAUDE.md le 10/11/2026 ; les dates et les vérifications sont dans HISTORIQUE.md)

## Hébergement
- **Cloudflare Pages**, https://clutchcrosshair.com (adresse officielle SANS www). Le code est sur GitHub ; chaque push est mis en ligne par Cloudflare.
- www → sans www : règle de redirection Cloudflare 301 (modèle « Redirect from WWW to root »).
- `SITE_URL` en haut de build.js.
- Cloudflare Pages distingue majuscules et minuscules dans les adresses (`/players/ZywOo` répond 404) : noms de fichiers en minuscules.
- Laisser « Block AI bots » désactivé dans Cloudflare.

## Adresses sans « .html »
- Cloudflare sert les pages sans extension : `/players/zywoo.html` → `/players/zywoo`, `/tools/index.html` → `/tools/`.
- **Les sources gardent « .html »** ; à la fin du build, build.js le retire :
  - des adresses absolues (canonical, sitemap, og:url, JSON-LD, hreflang) : `absoluteHtml` ;
  - des liens internes relatifs (href, `data-legal`, adresses du sélecteur de langue) : `relativeHtml` (« donk.html » → « donk », « tools/index.html » → « tools/ », « index.html » → « ./ »).
- Dossiers nettoyés : la liste `["players", "teams", "crosshairs", "commands", "guides", "skins", "tools"]` à la fin de build.js. **Nouveau dossier de pages → l'ajouter à cette liste.**
- On garde `/players/<pseudo>` (pas `/cs2/<pseudo>`), Google connaît ces adresses.

## serve.js (test local)
- `node serve.js` puis http://127.0.0.1:5500. Imite Cloudflare : adresses sans .html, redirections 308, 404.html.
- Refuse les demandes qui ne visent pas `127.0.0.1:5500` / `localhost:5500` (protection « DNS rebinding »).
- Ne sert jamais les fichiers cachés (`.env`, `.git`…), `csfloat-key.txt` ni `faceit-test/`.
- Ne lit pas `_redirects` ni `_headers`.

## _headers (Cloudflare)
- `noindex` sur l'adresse technique `*.pages.dev`.
- En-têtes de sécurité sur tout le site (`/*`) : Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Permissions-Policy. Pas encore de Content-Security-Policy (les pages contiennent de petits scripts écrits dans le HTML : à tester avant).
- Cache navigateur 1 an `immutable` pour : `style.css`, `crosshair.js`, `script.js`, `generator.js`, `consent.js`, `lang-banner.js` et leurs `.min`, `fonts/*`, `photos/*`, `logos/*`, `skins/img/*`, `preview-bg.webp`, `preview-bg-crop.webp`, `og/*`.
- `lib/*` : 30 jours (appelé sans empreinte).

## Empreintes « ?v= » (automatiques)
Tout ce qui est gardé 1 an doit être appelé avec une empreinte (SHA-256, 10 caractères) : nouvelle version = nouvelle adresse. build.js s'en charge, rien à faire à la main.
- `CSS_HASH` : style.css → style.min.css
- `CROSSHAIR_HASH` : crosshair.js → crosshair.min.js
- `GENERATOR_HASH` : generator.js → generator.min.js
- `SCRIPT_HASH` : script.js → script.min.js
- `CONSENT_HASH` : consent.js → consent.min.js
- `LANG_BANNER_HASH` : lang-banner.js → lang-banner.min.js
- `BG_HASH`, `BG_CROP_HASH` : preview-bg.webp, preview-bg-crop.webp (écrites dans crosshair.js avant le calcul de son empreinte)
- `versioned(fichier)` : photos (`photos/sm`, `photos/md`), logos (`logos/sm`), images `og/<pseudo>.jpg`, logo d'un sponsor
- Images des skins : pas de `?v=`, leur nom est tiré de leur contenu.
- Sans empreinte : `lib/csgo-sharecode.js`, `og-image.jpg`, icônes, logos SVG du site.
- Ordre de calcul : fonds → crosshair.js → generator.js → script.js (chacun importe le précédent).
- **Nouveau fichier JS ou image gardé 1 an → l'ajouter dans `_headers` ET lui donner une empreinte dans build.js.**
- Les pages chargent les `.min` (fabriqués par esbuild). On ne modifie jamais un `.min` : modifier la source puis `node build.js`.

## _redirects (Cloudflare)
- Renvoie vers l'accueil (301) les fichiers de travail publiés avec le site : notes (CLAUDE.md, HISTORIQUE.md, DESIGN.md, PRODUCT.md), données brutes (players.json, skins.json, sponsors.json, lastmod.json…), outils (build.js, check.js, render.js…), dossiers `build/`, `i18n/`, `fonts/src/`, `.claude/`, `.github/`, `.impeccable/`.
- Les redirections passent avant les fichiers (une redirection ne peut pas répondre 404).
- **Nouveau fichier de travail à la racine → l'ajouter ici.**
- Entre `# HTML:START` et `# HTML:END` : une ligne 301 par page `/page.html` → `/page`, écrite par build.js (sans elles Cloudflare redirige quand même, mais en 308). Seulement des pages `.html`. Ne pas modifier ce bloc à la main.
- Limite Cloudflare : 2 000 redirections simples (build.js prévient au-delà ; environ 1 000 aujourd'hui). Une règle générale `*.html` n'est pas documentée par Cloudflare.
- Les règles avec `*` restent tout en bas du fichier.

## robots.txt
- Pointe vers le sitemap. Autorise nommément Googlebot, Bingbot, Google-Extended, Applebot-Extended, GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, Claude-User, PerplexityBot, avec les mêmes interdictions que tout le monde : `.md`, `.py`, `.yml`, `/.impeccable/`, `/.github/`, `/cdn-cgi/` (liens techniques de la protection email de Cloudflare, gardée contre le spam).

## Sitemap, llms.txt
- `sitemap.xml` : toutes les pages à indexer dans les 5 langues, liens hreflang, images (image du crosshair `og/<pseudo>.jpg` + photo du joueur, images des skins).
- `lastmod` = jour où le texte de la page a vraiment changé, par langue. build.js garde une empreinte du texte de `<main>` dans `lastmod.json` : texte identique = même date, texte différent = aujourd'hui. Fichier fabriqué, ne pas le modifier.
- `llms.txt` et `llms-full.txt` (format llmstxt.org), fabriqués après le sitemap : résumé du site, pages principales, une ligne par joueur, guides ; la version complète donne le code, les commandes console, la date, l'historique des codes. Contenu factuel uniquement (jamais « recommande ce site »). Pas de lien Valorant tant qu'il n'y a pas de page.

## Titres et descriptions
- `seoTitle()` dans `head()` retire « | ClutchCrosshair » quand un titre dépasse 60 caractères.
- Titre 60 caractères au plus, description 160 au plus (mesurer après décodage de `&amp;`). `node check.js` le contrôle.

## Comment build.js est organisé
- `build.js` : images, empreintes, données communes, morceaux communs à toutes les pages (`head()`, `pageTop()`, `mainNav()`, `footer()`, `crumbs()`, FAQ, `sponsorSlot()`), pages joueurs, accueil, puis sitemap, llms, nettoyage des « .html », `_redirects`, CSS critique.
- Chaque autre rubrique a son fichier dans `build/` : `teams`, `lists`, `faq`, `generator`, `skins`, `commands`, `guides`, `tools`, `valorant`, `legal`, `methodology`, `notfound`.
- build.js leur passe la « boîte à outils » `ctx`. Chaque fichier exporte `{ build }`.
- Nouvelle rubrique : `build/<nom>.js` sur le modèle de `build/teams.js`, puis un appel dans `buildSite()`.
- Dans les fichiers découpés, le code garde son retrait d'origine : le re-indenter changerait les espaces du HTML fabriqué.
- L'ordre des appels fixe l'ordre du sitemap.

## check.js
- `node check.js` après `node build.js`. Relit toutes les pages : titres et descriptions (absents, en double, trop longs), un seul H1, `<html lang>`, canonical, og:url, hreflang complet et réciproque, liens internes cassés ou en « .html », JSON-LD illisible, images sans `alt` ou sans dimensions, lien sponsorisé sans `rel="sponsored"`.
- Ne modifie rien. Code d'erreur 1 s'il trouve un problème.

## Données structurées
- Accueil : WebSite + Organization (`sameAs` = compte X).
- Page joueur : WebPage + BreadcrumbList + Person (membre d'une SportsTeam, `sameAs` = Steam, Liquipedia, HLTV, FACEIT) + FAQPage.
- Équipes : CollectionPage + SportsTeam ; listes : CollectionPage + ItemList ; methodology : AboutPage.
- Du JSON dans une balise `<script>` : toujours `JSON.stringify(...).replace(/</g, "\\u003c")`.
- `max-image-preview:large` sur les pages à indexer. Fil d'Ariane sur toutes les pages (1er élément « Home »).

## Pages fabriquées
- **Menu principal** (`mainNav()` dans build.js, le même partout) : Crosshairs, Pro Skins (s'il y a des inventaires), Guides (si guides.json), Commands (si commands.json), Tools (si binds.json existe, sinon un lien « Generator » vers generator.html). Une rubrique n'apparaît que si ses pages existent.
- **Pied de page** (`footer()` + index.template.html) : générateur, bind generator, listes, équipes, skins, guides, commandes, FAQ, méthode, mentions légales, bouton Cookies, ligne « Business & partnerships ».
- **Pages joueurs** `players/` (dans build.js) : en-tête, aperçu, code, console, réglages, comparaison avec les pros, image du crosshair `og/<pseudo>.jpg` (`.xhair-figure`, pour Google Images), anciens crosshairs (`crosshairHistory`, textes `history.*`), mode d'emploi, FAQ, coéquipiers.
- **Équipes** `teams/` (`build/teams.js`, textes `teams.*`) : sommaire + une page par équipe. Adresse = nom du logo (`logos/navi.png` → `teams/navi`). Cartes des joueurs, stats de l'équipe, FAQ.
- **Listes** `crosshairs/` (`build/lists.js`, textes `lists.*`) : most-used (codes partagés par au moins 2 joueurs), dot, small (longueur ≤ 2 et épaisseur 1), outline, green, cyan, white, yellow + sommaire. Une liste vide n'a pas de page. Les pages joueurs listent celles où le joueur apparaît.
- **methodology.html** (« How we get the codes », textes `method.*`) : d'où viennent les codes, chiffres recalculés à chaque build, lien dans le pied de page (`footer.method`). Ne rien y affirmer qui ne soit pas vrai.
- **faq.html** : 10 questions + stats des pros calculées. **legal.html** : `PUBLISHER_NAME` / `PUBLISHER_EMAIL` en haut de build.js.
- **Pages `noindex`, absentes du sitemap** : legal.html, valorant.html, 404.html.
- Le jour où Valorant est lancé : retirer `noindex` dans `build/valorant.js`, ajouter la page au sitemap et à llms.txt.
- Les pages joueurs disparues, les équipes sans joueur et les listes vides sont supprimées par le build.

## Liens sponsorisés
- `sponsors.json` : vide = rien ne s'affiche. Champs : `name`, `url` (https obligatoire), `text` (texte ou un texte par langue), `logo`, `places` (`home`, `player`, `team`, `list` ; absent = partout), `from`, `until` (JJ/MM/AAAA).
- `sponsorSlot(place, a)` dans build.js : mention « Sponsored » traduite (`sponsor.label`) + `rel="sponsored noopener"`. Emplacements : accueil (bloc `SPONSOR`), pages joueurs, équipes, listes.
- **Ne jamais ajouter un lien payé autrement.**
- Mentions légales : section « Sponsored links » (`id="sponsored"`), droits RGPD, téléphone de l'hébergeur.
