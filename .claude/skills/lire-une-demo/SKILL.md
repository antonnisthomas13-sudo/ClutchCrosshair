---
name: lire-une-demo
description: Lire une démo CS2 (.dem) avec read_demo.py pour ajouter des joueurs ou mettre à jour leurs crosshairs dans players.json. À utiliser quand Anto met une démo dans le dossier ou parle de démos HLTV / FACEIT.
---

# Le robot read_demo.py
- Lit une démo CS2 (.dem) avec `demoparser2` (`pip install demoparser2`, déjà installé).
- Récupère pour chaque joueur : pseudo, SteamID, équipe (dernier `team_clan_name` **non vide** — parfois vide en fin de match), crosshair (`crosshair_code`, constant pendant tout le match).
- Met à jour `players.json` : ajoute les nouveaux joueurs, met à jour les codes, suit les transferts par SteamID. Ignore les équipes qui ne sont pas sur le site (liste `SITE_TEAMS` + `TEAM_ALIASES`).
- **`updated` = date du match** (date du fichier .dem, conservée dans l'archive HLTV ; sinon `--date JJ/MM/AAAA`). Même code → la date avance (crosshair confirmé).
- Une démo **plus ancienne** que la date enregistrée ne change rien (plus besoin de lire dans l'ordre). Démos d'avant le 30/09/2026 et codes `CSGO-` refusés.
- Utilisation : `py read_demo.py "demos/fichier.dem"` (ou `--date 16/10/2026`) puis `node build.js`.
- Les démos viennent de HLTV (je les télécharge à la main, souvent en `.rar` dans Téléchargements ; une seule map suffit). Le `tar` de Windows (`C:\Windows\System32\tar.exe -xf archive.rar`) sait les ouvrir. **HLTV bloque les robots (Cloudflare) : ne pas essayer de contourner.**
- Si Anto pose la démo à la racine du projet : la ranger dans `demos/` (ignoré par Git) avant tout, sinon elle partirait sur GitHub.
- Démos déjà lues (+ BC.Game-JiJieHao le 24/10/2026 ; dates corrigées le 18/10/2026 ; Spirit/Vitality/MOUZ gardent 17/10, leurs démos ne sont plus là) : FURIA-Aurora, Falcons-BetBoom, BetBoom-Legacy, G2-PARIVISION, PARIVISION-NAVI, FaZe-NAVI Junior, Astralis-MIBR (+ Spirit, Vitality, MOUZ avant).
