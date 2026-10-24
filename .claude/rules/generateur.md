---
paths:
  - "generator.js"
  - "generator.html"
  - "render.js"
---

# Générateur de crosshair
(déplacé de CLAUDE.md le 24/10/2026 : chargé seulement quand on touche à ces fichiers)

- `generator.js` — le **générateur de crosshair CS2** (dans le navigateur) : curseurs longueur/épaisseur/écart, couleurs + couleur perso, opacité, contour/point/style T, « Start from » un pro ou un code collé, Reset, aperçu taille réelle ou Zoom ×3, code + console + Copy.
  Aperçu du générateur (validé par Anto le 19/10/2026) : photo **non assombrie** (`data-bg="raw"`), viseur sur la tête du terroriste (même point que partout). **La résolution sous l'aperçu ne change PAS le code** : elle montre le crosshair comme en jeu dans cette résolution (`data-res`, `data-stretch` lus par crosshair.js : tailles converties en pixels de la résolution, image étirée en largeur en 4:3 / 5:4 « stretched » sur un écran 16:9). Résolutions par format : 16:9, 4:3 stretched, 16:10, 5:4 stretched (`GEN_RESOLUTIONS` dans render.js). Fabrique de vrais codes CS2 avec `encodeCrosshair` (vérifié : les 70 codes des pros se ré-encodent à l'identique). Refuse les codes `CSGO-`. Son HTML est écrit par build.js (`generatorHTML` dans render.js, crosshair de départ `GENERATOR_DEFAULT` dans build.js).
  Utilisé à 2 endroits : **`generator.html`** (page dédiée pour Google, cible « CS2 crosshair generator » : texte, stats des pros, FAQ, JSON-LD WebApplication + FAQPage ; l'adresse devient `generator.html#CS...` = lien partageable) et l'**onglet Generator** de l'accueil (entre `GENERATOR:START/END`, JavaScript chargé seulement au premier clic sur l'onglet). Chaque page joueur a un lien « Edit X's crosshair in the generator » (`generator.html#code`).
