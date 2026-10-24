---
name: reprendre-viewmodel
description: Reprendre le travail sur le viewmodel (position de l'arme, viewmodel_fov / offset) mis de côté le 22/10/2026 dans git stash. À utiliser quand Anto parle de viewmodel.
---

**Viewmodel : mis de côté le 22/10/2026 à la demande d'Anto** (« je m'en occuperai un autre jour »). Tout le travail est dans la réserve Git locale : `git stash list` → « viewmodel (à reprendre) - 22/10/2026 » (read_demo.py qui lit le viewmodel des démos — vérifié : `CCSPlayerPawn.m_flViewmodelFOV` / `OffsetX/Y/Z`, 59 pros —, viewmodel.html + viewmodel.js, onglet de l'accueil, menu « Viewmodel », champ sur les pages joueurs, textes EN/FR, notes CLAUDE.md). Pour reprendre : `git stash apply` puis `node build.js` (conflit possible sur players.json / build.js si le site a changé entre-temps : le régler à la main). Point en suspens : Anto trouvait l'illustration SVG de l'arme « sans aucun sens » et voulait un vrai modèle CS en première personne → plan proposé : ses propres captures en 1920×1080 (1 sans arme avec `r_drawviewmodel 0` + 10 avec l'AK à différents réglages, même endroit, ciel derrière) pour découper l'arme et mesurer les vrais déplacements. Valeurs du préréglage Couch à relever en jeu.

Attention depuis le 24/10/2026 : le site a maintenant 5 langues (textes à ajouter aussi en ES, RU, TR) et MIBR a été remplacée par BC.Game (conflits probables sur players.json et build.js).
