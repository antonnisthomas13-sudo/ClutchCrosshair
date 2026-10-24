---
paths:
  - "creators.csv"
  - "import-creators.js"
---

# Créateurs (import mensuel)
(déplacé de CLAUDE.md le 24/10/2026 : chargé seulement quand on touche à ces fichiers)

- `creators.csv` + `import-creators.js` — **les créateurs** (à refaire chaque mois) : Anto remplit son tableau (Pseudo, Profil FACEIT, Code crosshair, Date de mise à jour, Notes), l'exporte en `creators.csv` dans le dossier, puis `node import-creators.js` : vérifie chaque code avec csgo-sharecode (refuse `CSGO-`, vides, indécodables), ajoute / met à jour les créateurs (`team` « Creator », pas de pays, date du tableau sinon date du jour si le code change), affiche la liste des codes à corriger, ne supprime personne, puis lance `node build.js`. Les codes viennent du bouton « Copier » des pages de match FACEIT (l'API officielle FACEIT ne donne pas les crosshairs, testé le 19/10/2026 avec `faceit-test.js` ; clé dans `.env`, ignoré par Git).
