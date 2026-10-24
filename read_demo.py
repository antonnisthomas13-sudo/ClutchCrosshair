# ===== ClutchCrosshair : lecteur de démos CS2 =====
# Lit une démo (.dem), récupère l'équipe et le crosshair des 10 joueurs,
# puis met à jour players.json tout seul.
#
# Utilisation (dans le dossier ClutchCrosshair) :
#   py read_demo.py "demos/fichier.dem"
#   py read_demo.py "demos/fichier.dem" --date 16/10/2026   (si la date du fichier n'est pas celle du match)
#
# La date du match = date du fichier .dem (conservée dans l'archive HLTV).
# Une démo plus ancienne que les données déjà enregistrées ne change rien,
# et les démos d'avant la mise à jour CS2 du 30/09/2026 (codes CSGO-) sont refusées.

import json
import sys
from datetime import date, datetime
from pathlib import Path

from demoparser2 import DemoParser

PLAYERS_FILE = Path(__file__).parent / "players.json"

# Mise à jour CS2 du 30/09/2026 : nouveaux codes "CS..." (les démos d'avant ne servent plus)
CS2_NEW_CODES = date(2026, 9, 30)

# Les 15 équipes du site (même nom que dans script.js)
SITE_TEAMS = [
    "Team Spirit", "Team Vitality", "MOUZ", "FURIA", "Falcons", "Aurora",
    "Natus Vincere", "G2 Esports", "FaZe Clan", "Astralis", "Legacy",
    "BC.Game", "FUT Esports", "PARIVISION", "BetBoom"
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
    "bc.game esports": "BC.Game",
    "bc game": "BC.Game",
    "bcgame": "BC.Game",
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


def match_date(demo, forced=None):
    """Date du match : celle donnée avec --date, sinon la date du fichier .dem
    (conservée dans l'archive HLTV = fin du match)."""
    if forced:
        return datetime.strptime(forced, "%d/%m/%Y").date()
    return datetime.fromtimestamp(demo.stat().st_mtime).date()


def parse_date(text):
    """ "17/10/2026" -> date (ou None si la date est absente/illisible)."""
    try:
        return datetime.strptime(text, "%d/%m/%Y").date()
    except (TypeError, ValueError):
        return None


def update_players(found, day, data):
    """Met à jour la liste des joueurs (data) avec les joueurs d'une démo jouée le jour "day"."""
    day_text = day.strftime("%d/%m/%Y")
    report = {"added": [], "updated": [], "confirmed": [], "older": [], "old_format": [], "ignored": []}

    for p in found:
        team = site_team(p["demo_team"])
        if not team:
            report["ignored"].append(f'{p["name"]} ({p["demo_team"] or "équipe inconnue"})')
            continue

        # Les anciens codes CSGO-... ne s'importent plus dans CS2 : on les refuse
        if p["code"].startswith("CSGO-"):
            report["old_format"].append(p["name"])
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
                "updated": day_text,
                "trending": False,
            })
            report["added"].append(p["name"])
            continue

        # Démo plus ancienne que ce qu'on a déjà : on ne touche à rien (ni code, ni équipe)
        known = parse_date(existing.get("updated"))
        if known and day < known:
            report["older"].append(existing["name"])
            continue

        existing["steamid"] = p["steamid"]
        existing["team"] = team
        existing["updated"] = day_text  # le crosshair est confirmé à la date de ce match
        if existing.get("code") != p["code"]:
            existing["code"] = p["code"]
            report["updated"].append(existing["name"])
        else:
            report["confirmed"].append(existing["name"])

    return report


def main():
    args = [a for a in sys.argv[1:]]
    forced = None
    if "--date" in args:
        i = args.index("--date")
        forced = args[i + 1] if i + 1 < len(args) else None
        del args[i:i + 2]

    if not args:
        print('Utilisation : py read_demo.py "demos/fichier.dem"  [--date JJ/MM/AAAA]')
        return

    demo = Path(args[0].strip().strip('"'))
    if not demo.exists():
        print("Fichier introuvable :", demo)
        return

    day = match_date(demo, forced)
    print(f"Date du match : {day.strftime('%d/%m/%Y')}" + ("" if forced else " (date du fichier ; sinon ajoute --date JJ/MM/AAAA)"))
    if day < CS2_NEW_CODES:
        print("Démo jouée avant la mise à jour CS2 du 30/09/2026 : codes à l'ancien format, démo ignorée.")
        return

    print("Lecture de la démo (ça peut prendre 10-30 secondes)...")
    found = read_demo(demo)

    data = json.loads(PLAYERS_FILE.read_text(encoding="utf-8"))
    report = update_players(found, day, data)
    PLAYERS_FILE.write_text(json.dumps(data, indent=4, ensure_ascii=False) + "\n", encoding="utf-8")

    print()
    print("Joueurs trouvés dans la démo :")
    for p in found:
        print(f'  {p["name"]:<16} {p["demo_team"]:<20} {p["code"]}')
    print()
    print("Ajoutés         :", ", ".join(report["added"]) or "-")
    print("Code changé     :", ", ".join(report["updated"]) or "-")
    print("Code confirmé   :", ", ".join(report["confirmed"]) or "-", "(même code, date avancée)")
    print("Pas touchés     :", ", ".join(report["older"]) or "-", "(on a déjà un match plus récent)")
    print("Refusés         :", ", ".join(report["old_format"]) or "-", "(ancien format CSGO-)")
    print("Ignorés         :", ", ".join(report["ignored"]) or "-", "(équipe pas sur le site)")
    print()
    print("players.json est à jour. Lance ensuite : node build.js")


if __name__ == "__main__":
    main()
