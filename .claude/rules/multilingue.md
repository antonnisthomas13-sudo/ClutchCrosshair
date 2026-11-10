---
paths:
  - "i18n.js"
  - "i18n/**"
  - "index.template.html"
  - "lang-banner.js"
  - "fr/**"
  - "es/**"
  - "ru/**"
  - "tr/**"
---

# Site multilingue (EN, FR, ES, RU, TR)
(sorti de CLAUDE.md le 10/11/2026 ; les dates et les vérifications sont dans HISTORIQUE.md)

Tout est fabriqué par build.js, aucune librairie dans le navigateur.

## Adresses
- Anglais à la racine. Autres langues dans `fr/`, `es/`, `ru/`, `tr/`, avec les mêmes noms de pages (`ru/players/zywoo.html`, `es/guides/…`).
- Ces 4 dossiers sont fabriqués : ne jamais les modifier à la main.
- SEO : `hreflang` pour les **5 langues + x-default** (x-default = anglais), canonical et `og:locale` par langue, sitemap avec les 5 langues (`xhtml:link`). Écrit par `langHead()` dans build.js. Les pages `noindex` (404, legal, valorant) n'ont pas de hreflang.

## Les textes
- `i18n.js` : liste des langues (`LANGS`), `SOON` (langues annoncées « soon » dans le sélecteur, vide aujourd'hui), `makeI18n(lang)` qui donne `t("cle", {var})`.
- `i18n/en.json`, `fr.json`, `es.json`, `ru.json`, `tr.json` : tous les textes de l'interface.
- **Tout nouveau texte : l'ajouter dans les 5 fichiers.** Une clé absente de en.json arrête le build ; absente d'une autre langue, c'est le texte anglais qui s'affiche.
- Pluriels : `{ "one": …, "other": … }` choisis selon `{count}`. Russe : `one / few / many / other` (1 скин, 2 скина, 5 скинов).
- `{year}` dans n'importe quel texte = année du build (`readJson` dans i18n.js). Ne jamais écrire l'année en dur dans un titre.
- Contenus traduits : `i18n/<langue>/commands.json`, `guides.json`, `binds.json`, même structure que les originaux. Changer un guide ou une commande = changer les 5.
- Ne pas écrire de texte en dur dans build.js ou build/ : ajouter une clé.

## Règles de traduction
- On ne traduit jamais les pseudos, les équipes, les codes, les commandes console.
- Russe : vouvoiement (« вы »), phrases tournées pour que les pseudos restent au nominatif.
- Turc : tutoiement ; jamais de suffixe collé à un pseudo (impossible à accorder automatiquement : ZywOo'nun / donk'un). Écrire « {name} adlı oyuncu », « {name} ile ».
- Espagnol : tutoiement.
- Mentions légales : vouvoiement (attention : le texte espagnol actuel tutoie, voir HISTORIQUE.md « Points flous »).
- Mots-clés : ES « crosshair » / « mira », RU « прицел », TR « crosshair kodu ».
- Guides : nom anglais des options de CS2 entre parenthèses.
- Ancres des titres de guides : russe translittéré (`anchor()`, « Настройки » devient `nastroyki`).
- Mentions légales : la section « Other languages » = liens automatiques vers les autres langues (`{languages}`).

## L'accueil
- `index.template.html` est la vraie source de l'accueil. `{{cle}}` = texte traduit, `{{@nom}}` = valeur calculée par build.js, blocs `<!-- NOM:START -->` … `<!-- NOM:END -->` remplis par build.js.
- `index.html` et `fr/`, `es/`, `ru/`, `tr/index.html` sont fabriqués : on modifie le modèle, jamais ces fichiers.

## Textes affichés par le JavaScript
- `tr(cle, "texte anglais")`, exporté par crosshair.js.
- Les pages non anglaises contiennent un petit dictionnaire `<script type="application/json" id="i18n">` (section `js` du fichier de la langue).
- Le mot « Copied » de la barre rouge = variable CSS `--copied`, posée sur `<html>`.

## Sélecteur et bandeau de langue
- Sélecteur `#lang` sur toutes les pages ; le choix est gardé dans `localStorage.lang`.
- **Aucune redirection automatique selon la langue du navigateur.**
- `lang-banner.js` (→ `lang-banner.min.js`, empreinte `LANG_BANNER_HASH`, chargé en `defer` avec consent.js par `consentScript()`, présent dans `_headers`) : petit bandeau fixe sous la barre du haut quand une langue du navigateur (`navigator.languages`, dans l'ordre) est une des nôtres et diffère de celle de la page.
  - Texte dans la langue du visiteur : clés `langBanner.*` des 5 fichiers, injectées par build.js dans le .min (ligne `var TEXTS = {};`).
  - Vrai lien `<a href hreflang>` vers la page traduite ; adresses dans `window.ccAlternates`, écrites dans chaque page par `langHead()`.
  - Bouton, croix ou sélecteur → `localStorage.lang` → plus de bandeau.
  - Jamais pour les robots, jamais dans le HTML servi, aucun décalage de page (CLS 0).
- `overflow-wrap: break-word` sur `body` (style.css) : sans lui, un code de 46 lettres élargit la page sur téléphone et les bandeaux suivent.

## Thème
- Toujours sombre à la première visite, même si l'ordinateur est en mode clair. Clair seulement si le visiteur clique sur le bouton (`localStorage.theme`).

## Polices par langue
- `fonts/*-latin-ext.woff2` (Ğ ğ İ Ş ş) et `fonts/*-cyrillic.woff2` (russe), déclarés avec `unicode-range` dans style.css : téléchargés seulement sur les pages qui ont ces lettres.
- Barlow Condensed n'existe pas en cyrillique : les titres russes utilisent Roboto Condensed 700 (licence Apache 2.0, `fonts/LICENSE.txt`), déclarée sous le même nom « Barlow Condensed ».
- Espace fine française (U+202F) incluse dans les polices.
- Originaux dans `fonts/src/`, versions du site fabriquées par `py fonts/subset_fonts.py`.
- `critical.js` ouvre Chrome en anglais.

## À faire vérifier en jeu (CS2 dans chaque langue)
Noms des menus écrits dans les textes, jamais vérifiés par un joueur de la langue :
- FR : « Paramètres › Jeu › Réticule », « Partager ou importer », « Activer la console développeur ».
- ES : « Ajustes › Juego › Punto de mira », « Compartir o importar », « Activar consola de desarrollador ». Touche de la console : tecla º.
- RU : « Настройки › Игра › Прицел », « Поделиться или импортировать », « Включить консоль разработчика ». Touche : клавиша Ё.
- TR : « Ayarlar › Oyun › Nişangâh », « Paylaş veya İçe aktar », « Geliştirici Konsolunu Etkinleştir ». Touche : « Esc'nin altındaki tuş ».
