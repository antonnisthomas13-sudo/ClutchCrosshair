# ===== ClutchCrosshair : lecteur de démos CS2 =====
# Lit une démo (.dem), récupère l'équipe et le crosshair des 10 joueurs,
# puis met à jour players.json tout seul.
#
# Utilisation (dans le dossier ClutchCrosshair) :
#   py read_demo.py "C:\chemin\vers\la\demo.dem"

import json
import sys
from datetime import date
from pathlib import Path

from demoparser2 import DemoParser

PLAYERS_FILE = Path(__file__).parent / "players.json"

# Les 15 équipes du site (même nom que dans script.js)
SITE_TEAMS = [
    "Team Spirit", "Team Vitality", "MOUZ", "FURIA", "Falcons", "Aurora",
    "Natus Vincere", "G2 Esports", "FaZe Clan", "Astralis", "Legacy",
    "MIBR", "FUT Esports", "PARIVISION", "BetBoom"
]

# Noms qu'on peut trouver dans les démos -> nom utilisé sur le site
TEAM_ALIASES = {
    "spirit": "Team Spirit",
    "vitality": "Team Vitality",
    "mousesports": "MOUZ",
    "navi": "Natus Vincere",
    "na'vi": "Natus Vincere",
    "g2": "G2 Esports",
    "faze": "FaZe Clan",
    "fut": "FUT Esports",
    "betboom team": "BetBoom",
    "team falcons": "Falcons",
    "aurora gaming": "Aurora",
}


def site_team(demo_team):
    """Transforme le nom d'équipe de la démo en nom du site (ou None)."""
    if not demo_team:
        return None
    clean = demo_team.strip().lower()
    for team in SITE_TEAMS:
        if team.lower() == clean:
            return team
    return TEAM_ALIASES.get(clean)


def read_demo(path):
    """Renvoie la liste des joueurs : nom, steamid, équipe, crosshair."""
    parser = DemoParser(str(path))
    df = parser.parse_ticks(["crosshair_code", "team_clan_name"])

    players = []
    for steamid, rows in df.groupby("steamid"):
        # On garde la dernière valeur non vide (le crosshair en fin de match)
        codes = rows["crosshair_code"].dropna()
        # Codes CS2 actuels : "CS..." (les anciens "CSGO-..." sont aussi acceptés)
        codes = codes[codes.astype(str).str.startswith("CS")]
        if codes.empty:
            continue
        # Dernier nom d'équipe non vide (dans certaines démos il est vide à la fin du match)
        teams = rows["team_clan_name"].dropna()
        teams = teams[teams.astype(str).str.strip() != ""]
        players.append({
            "name": str(rows["name"].iloc[-1]),
            "steamid": str(steamid),
            "demo_team": str(teams.iloc[-1]) if not teams.empty else "",
            "code": str(codes.iloc[-1]),
        })
    return players


def main():
    if len(sys.argv) < 2:
        print('Utilisation : py read_demo.py "C:\\chemin\\vers\\la\\demo.dem"')
        return

    demo = Path(sys.argv[1].strip().strip('"'))
    if not demo.exists():
        print("Fichier introuvable :", demo)
        return

    print("Lecture de la démo (ça peut prendre 10-30 secondes)...")
    found = read_demo(demo)

    data = json.loads(PLAYERS_FILE.read_text(encoding="utf-8"))
    today = date.today().strftime("%d/%m/%Y")
    added, updated, same, ignored = [], [], [], []

    for p in found:
        team = site_team(p["demo_team"])
        if not team:
            ignored.append(f'{p["name"]} ({p["demo_team"] or "équipe inconnue"})')
            continue

        # On retrouve le joueur par son SteamID (ou par son pseudo la 1re fois)
        existing = next((x for x in data if x.get("steamid") == p["steamid"]), None)
        if existing is None:
            existing = next((x for x in data if x["name"].lower() == p["name"].lower()), None)

        if existing is None:
            data.append({
                "name": p["name"],
                "steamid": p["steamid"],
                "team": team,
                "category": "pro",
                "code": p["code"],
                "updated": today,
                "trending": False,
            })
            added.append(p["name"])
            continue

        existing["steamid"] = p["steamid"]
        existing["team"] = team
        if existing.get("code") != p["code"]:
            existing["code"] = p["code"]
            existing["updated"] = today
            updated.append(existing["name"])
        else:
            same.append(existing["name"])

    PLAYERS_FILE.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")

    print()
    print("Joueurs trouvés dans la démo :")
    for p in found:
        print(f'  {p["name"]:<16} {p["demo_team"]:<20} {p["code"]}')
    print()
    print("Ajoutés      :", ", ".join(added) or "-")
    print("Mis à jour   :", ", ".join(updated) or "-")
    print("Inchangés    :", ", ".join(same) or "-")
    print("Ignorés      :", ", ".join(ignored) or "-", "(équipe pas sur le site)")
    print()
    print("players.json est à jour. Lance ensuite : node build.js")


main()
