---
paths:
  - "career.js"
  - "career-engine.js"
  - "career-sim.js"
  - "career-src/**"
  - "build/career.js"
---

# Le jeu « Zero to Major » (page /career)
(commencé le 12/11/2026, à la demande d'Anto ; version 2 du moteur le même jour)

Jeu original de choix textuels : une carrière de joueur pro CS2, de FACEIT niveau 10 à 16 ans jusqu'à la retraite, avec une note sur 100. 100 % dans le navigateur, sans compte, partie sauvegardée dans `localStorage` (clé `zm-save`, ignorée si elle vient d'une ancienne version du moteur : `VERSION` dans career-engine.js).

## Règle sur les vrais joueurs (décidée avec Anto le 12/11/2026)
- Les vrais joueurs et les vraies équipes apparaissent seulement dans des situations **neutres ou positives** (« tu signes chez Vitality », « tu affrontes {rival} », « regarder comment {star} joue la position », le classement mondial).
- **Jamais de dispute, de polémique, de triche ou de défaut inventé sur une personne réelle.** Les conflits passent par des rôles sans nom (« ton IGL », « ton coach », « un coéquipier ») ou par les **personnages fictifs** de `career-src/cast.json`.
- **Jamais un vrai joueur dans une histoire d'alcool, de drogue, d'argent perdu, de santé ou de vie privée.** Pas d'histoire inventée attribuée à un vrai joueur. En cas de doute : personnage fictif.
- Clins d'œil à la culture CS : seulement des faits connus de tous (le spam « 1G », l'hymne « EZ4… », le graffiti de l'AWPer en plein saut sur Mirage), sans nommer personne. Deux anecdotes cherchées sur le web le 12/11/2026 n'ont pas pu être confirmées (le « kick surprise », la souris du sponsor) : elles sont racontées avec des personnages sans nom ou fictifs.
- Ne jamais attribuer un rôle à un vrai joueur dans un texte si on ne l'a pas vérifié ({star} est tiré au hasard).
- Le classement de fin d'année s'appelle « World Top 20 » / « Top 20 mondial », jamais « HLTV ».
- La page affiche les sources et précise que tout ce qui arrive dans une carrière est de la fiction.

## Langues
- Le jeu existe en **anglais et français seulement** : `CAREER_LANGS` en haut de build.js. Pages `/career` et `/fr/career`.
- Dans les autres langues (es, ru, tr), le menu, le pied de page et le bloc de l'accueil mènent à la page anglaise (`hreflang="en"`).
- Une page peut n'exister que dans certaines langues : option `langs` de `head()`, `pageTop()`, `langSelect()` et des entrées de `sitemapPages` ; `check.js` n'attend alors que ces langues.
- Les textes du jeu ne sont PAS dans `i18n/*.json` : ils sont dans `career-src/`. Seuls `nav.career`, `footer.career` et `home.career*` sont dans les 5 fichiers i18n.

## Les fichiers
- `career-engine.js` : les règles (aucun affichage). `createCareer`, `current`, `choose`, `score`, plus `overall`, `styleOf`, `teamRank`, `keyAttrs`, `zoneOf`, `SCORE_MAX`. Hasard à graine (`state.rng`).
- `career.js` : l'affichage. Bandeau du haut (drapeau, pseudo, équipe, gains toujours visibles, jauge d'entente), fiche à 3 onglets (Attributs, Popularité, Carrière), scène (étiquettes, choix avec touches 1/2/3, attributs testés, risque), bandeau de verdict, classement de fin d'année, fin de carrière. → `career.min.js`, `career-engine.min.js` (empreintes `CAREER_HASH`, `CAREER_ENGINE_HASH`, dans `_headers`).
- `career-sim.js` : `node career-sim.js [nombre] [stratégie]` joue des carrières tout seul : répartition des notes, des classements, part de pros / tier 1 / Major, passages par le banc, situations revues. Il s'arrête si un texte contient un `{mot}` non remplacé. **À relancer après chaque changement de règle ou d'event.**
- `build/career.js` : fabrique la page et `career.en.json` / `career.fr.json` (données du jeu, fabriquées : ne pas les modifier). Il ajoute le logo et la couleur des équipes que le site connaît (teams.js) ; les autres ont un écusson avec leurs initiales.
- `flags/` : 257 drapeaux SVG (flag-icons, licence MIT, `flags/LICENSE.txt`), nom = code du pays en minuscules. Chargés seulement par la page du jeu. Cache 30 jours (`_headers`).
- `career-src/` (dossier de travail, caché par `_redirects`) :
  - `update-data.js` : `node career-src/update-data.js` refait `teams.json` et `pros.json`. Équipes et effectifs : classement mondial officiel de Valve (GitHub), tier 1 = rangs 1 à 20, tier 2 = 21 à 50, tier 3 = 51 à 150. Rôles et pays (code ISO) : fiches Liquipedia par leur accès officiel (1 demande toutes les 2 s, 50 fiches par demande, User-Agent identifié, réponses gardées 7 jours dans `liquipedia-cache.json`, source citée sur la page : CC-BY-SA 3.0). Jamais HLTV.
  - `tournaments.json` : noms réels. `level` : s, a, b, c ; `region` (facultatif) : europe, nordic, cis, asia, northamerica, southamerica ; `major: true` pour le Major. `maps.json` : les 7 maps et leurs callouts. Les séries de niveau c et les callouts (surtout Cache) sont à faire relire par Anto.
  - `cast.json` : personnages fictifs qui suivent le joueur ({rv} le rival, {agent}, {journalist}, {coach}, {rookie}). assemble.js refuse un nom qui est le pseudo d'un joueur du classement.
  - `events/*.json` : les situations (207 au 12/11/2026). `texts.json` : phrases du moteur, interface et textes de la page, par langue.
  - `assemble.js` : rassemble le tout dans une langue (build et simulation). Refuse un identifiant en double ou un texte qui manque en anglais ou en français.

## Comment se déroule une carrière (moteur)
- **FACEIT** : départ à 16 ans, niveau 10, vers 2 000 d'Elo ; 3 situations par saison ; repéré selon l'Elo, le niveau ou un event (`flag: "scouted"`).
- **Nationalité** : les équipes du même pays (×14), de la même zone (×6) ou de la même grande région (×2) font plus souvent des offres ; les équipes internationales recrutent partout (`near()`).
- **Saison en équipe** : intersaison, vie d'équipe, un event de carrière ou de vie, 2 tournois (tier 1 : niveau s ; tier 2 : a et b ; tier 3 : b et c ; les tournois régionaux seulement pour les équipes de la région), un event au milieu, puis le Major si l'équipe est dans les 32 premières.
- **Veto** avant les gros matchs : map forte de l'équipe, map préférée du joueur (bannie 4 fois sur 10), ou choix du staff. Chaque équipe a 2 maps fortes et 1 faible. L'entente pèse dans le résultat.
- **Major** (comme en vrai : pas de qualification, invitations au classement) : rang 1 à 8 → Stage 3, 9 à 16 → Stage 2, 17 à 32 → Stage 1 ; puis quart, demie, finale.
- **Banc** : risque en fin de saison (mauvaise note, mauvaise entente, toxicité, mauvaises décisions `strike`). Une saison sur le banc à demi-salaire, retour possible (`flag: "benchBack"`), 2 saisons au maximum. Sans équipe 2 ans de suite : fin de carrière.
- **Leader à 30 ans** (`igl-offer`, une seule fois, pas pour un IGL) : accepter (`act: "igl"`) ouvre les events `leader` ; refuser fait baisser plus vite l'aim et les réflexes et ouvre les events `decline`.
- **Toxicité** : au-dessus de 45, elle coûte le plus souvent des rounds, parfois elle réveille l'équipe. **Aura, popularité, style** (discret / showman) : sponsors, salaire, offres, classement.
- **Classement mondial** chaque fin d'année (Top 20 + Top 10 du rôle). Note finale : niveau atteint 20, titres 30, meilleur rang 15, meilleur niveau 10, longévité 10, popularité 10, gains 5.

## Écrire un event
```json
{ "id": "identifiant-unique", "type": "focus | faceit | team | career | life | game | aura | culture | match | major | bench | leader | decline | special",
  "when": { "tier": [1, 2], "role": ["awper"], "map": "dust2", "minAge": 20, "maxAge": 30, "minSeasonsInTeam": 1,
            "minChemistry": 55, "maxChemistry": 45, "minElo": 3000, "minTox": 45, "maxTox": 20, "minAura": 30, "minPop": 25,
            "style": ["showman"], "free": true, "flag": "nom", "notFlag": "nom", "flagAge": ["nom", 1] },
  "once": true, "weight": 2,
  "text": { "en": "...", "fr": "..." },
  "choices": [
    { "text": { "en": "...", "fr": "..." }, "fx": { "aim": 2, "energy": -5 }, "result": { "en": "...", "fr": "..." } },
    { "text": { "en": "...", "fr": "..." }, "test": { "a": { "aim": 2, "reflexes": 1 }, "d": 3 },
      "win": { "text": { "en": "...", "fr": "..." }, "fx": { "bonus": 3 } },
      "lose": { "text": { "en": "...", "fr": "..." }, "fx": { "confidence": -3 } } }
  ] }
```
- Chaque texte en anglais ET en français.
- `test.a` = attributs testés (avec leur poids), `test.d` = difficulté par rapport au niveau du tier (négatif = plus facile).
- `free: true` = joueur sans équipe (FACEIT ou sans club), `free: false` = joueur sous contrat.
- Effets (`fx`) : les 8 attributs, `all`, `chemistry` (part de hasard), `energy`, `confidence`, `tox`, `aura`, `pop`, `style` (négatif = discret, positif = showman), `fans`, `fansPct`, `money`, `salaryPct`, `elo` (sans équipe seulement, ordre de grandeur 50 à 300), `potential`, `bonus` (prochain match), `strike` (mauvaise décision), `flag`, `unflag`.
- Mots remplacés : `{name}`, `{team}`, `{mate}`, `{rival}`, `{star}`, `{tournament}`, `{map}`, `{spot}`, `{spot2}` (callouts de la map), `{fav}`, `{age}`, `{year}`, `{elo}`, `{rv}`, `{agent}`, `{journalist}`, `{coach}`, `{rookie}`.
- Un event `match` avec `when.map` ne sort que sur cette map. Un texte qui commence par `{tournament}` perd ce début à l'affichage (le tournoi est déjà dans le titre).
- Un event ne revient pas avant 6 saisons (jamais s'il a `once`) ; ceux qu'on n'a jamais vus sortent 3 fois plus.

## Équilibrage (simulation du 12/11/2026, 300 carrières par stratégie)
- Note médiane : 48 en cliquant au hasard, 53 à 54 en jouant prudemment ; 7 % des carrières au hasard dépassent 80, 11 à 13 % en jouant bien.
- Tier 1 atteint : 39 % (hasard) à 52 % ; un Major gagné : 6 % (hasard), 9 à 10 % en jouant bien ; meilleur rang mondial dans le top 20 : 7 à 11 %, n°1 : environ 1 %.
- Passage par le banc : 16 à 30 % ; reconversion en leader : environ 45 %.
- Environ 185 à 225 écrans par carrière. Situations revues dans une même carrière : 7 à 10 %.

## Reste à faire
- Les choix pèsent encore peu face au hasard (écart de 5 points de note entre jouer au hasard et jouer prudemment).
- Bonus crosshair d'un pro du site (aperçu + lien, petit bonus de confiance : `state.crosshair` existe déjà dans le moteur) et carte de fin de carrière partageable (image).
- Relecture par Anto : callouts (surtout Cache), noms des tournois de niveau c, ton des textes.
