import sys
from demoparser2 import DemoParser

parser = DemoParser(sys.argv[1])

print("=== Joueurs ===")
print(parser.parse_player_info())

print()
print("=== Crosshair + équipe ===")
df = parser.parse_ticks(["crosshair_code", "team_clan_name"])
print("Colonnes :", list(df.columns))
print("Nombre de lignes :", len(df))
print(df.drop_duplicates(subset=["steamid"], keep="last").to_string())

print()
print("=== Valeurs de crosshair différentes ===")
print(df["crosshair_code"].astype(str).unique()[:20])