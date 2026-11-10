---
paths:
  - "read_demo.py"
  - "players.json"
  - "demos/**"
---

# Le robot des démos, players.json et les codes
(sorti de CLAUDE.md le 10/11/2026 ; les dates et les vérifications sont dans HISTORIQUE.md)

Mode d'emploi pas à pas et liste des démos déjà lues : skill `lire-une-demo` (`.claude/skills/lire-une-demo/SKILL.md`).

## Les codes de crosshair CS2
- Format actuel : **`CS...`** sans tirets (ex. `CSH2Rx7cGRU5apQ4VSnZwjsr9RyLEiOrCAaVYWYvW6dz7H`), depuis la mise à jour CS2 du 30/09/2026.
- Les anciens `CSGO-xxxxx-...` ne s'importent plus dans le jeu. **Jamais de code `CSGO-` sur le site, jamais de démo d'avant le 30/09/2026.**
- Les listes de codes trouvées sur Internet sont presque toutes en `CSGO-` : inutilisables.
- `csgo-sharecode` 7.0.1 décode les deux formats (champ `format` : `cs2-v1`, `legacy-v1`…).

## read_demo.py
- `py read_demo.py "demos/fichier.dem"` (ou `--date JJ/MM/AAAA`), puis `node build.js` et `node check.js`.
- Démos téléchargées à la main par Anto sur HLTV. **HLTV bloque les robots (Cloudflare) : ne pas essayer de contourner.**
- Une démo posée à la racine du projet : la ranger dans `demos/` avant tout (dossier ignoré par Git, sinon elle partirait sur GitHub).
- Équipes reconnues : `SITE_TEAMS` + `TEAM_ALIASES`. Si un joueur déjà connu arrive avec un nom d'équipe inconnu, le robot affiche « ATTENTION » : ajouter le nom dans `TEAM_ALIASES` puis relire la démo.
- Quand un code change, l'ancien va dans `history` et `since` prend la date du match.

## players.json (les données)
Champs :
- `name`, `steamid`, `team`, `category` (`"pro"` ou `"creator"`), `code`
- `updated` (JJ/MM/AAAA) : date du dernier match où le code a été vu
- `matchTime` : heure du match, pour départager deux matchs du même jour
- `since` : premier match du code actuel
- `history` : `[{ code, from, to }]`, anciens codes du plus ancien au plus récent
- `trending` (true/false)
- `photo` (facultatif)
- `liquipedia` (facultatif : nom exact de sa page Liquipedia, seulement les « Active Players »), `hltv` (facultatif : adresse de sa page HLTV, quand la page Liquipedia est celle d'un homonyme, ex. art), `faceit` (facultatif, créateurs : `https://www.faceit.com/en/players/<pseudo>`). Ces trois champs et le SteamID servent au `sameAs` des données structurées ; `faceit` affiche aussi le bouton « FACEIT profile ».

Aujourd'hui : 89 joueurs, 75 pros dans 15 équipes (5 par équipe), 14 créateurs.

## Créateurs
- `creators.csv` + `import-creators.js` : voir `.claude/rules/createurs.md`.
- Un nom déjà pro est refusé par l'import (ex. s1mple, passé chez BC.Game) : le retirer du tableau.

## Pseudos
- Les pseudos viennent des démos (noms Steam) : ce sont des données extérieures, non filtrées. Toujours `esc()` avant de mettre un pseudo dans du HTML.
