# subset_fonts.py : fabrique les polices allégées du site à partir des originales (fonts/src/)
# Lancer avec : py fonts/subset_fonts.py   (il faut : py -m pip install fonttools brotli)
# - Garde seulement les caractères utilisés par le site : latin de base, accents (Latin-1, œ, ²), ponctuation (— … › « » ’ “ ”), € ™ ×,
#   et l'espace fine insécable (U+202F) des nombres en français (« 8 551 $US »)
#   (le cyrillique du menu des langues n'était déjà pas dans ces polices : le navigateur prend une police de secours)
# - Inter : seulement les graisses 400 à 600 (les seules utilisées : --fw-regular, --fw-medium, --fw-semibold)
# Licence : polices SIL Open Font License (fonts/LICENSE.txt), qui autorise ces versions allégées.
import os
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100))
    + [0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E,
       0x2022, 0x2026, 0x2032, 0x2033, 0x2039, 0x203A, 0x2044, 0x202F, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0xFEFF]
)

FONTS = [
    ("inter-latin.woff2", {"wght": (400, 600)}),
    ("barlow-condensed-700-latin.woff2", None),
    ("jetbrains-mono-400-latin.woff2", None),
]

for name, axes in FONTS:
    font = TTFont(os.path.join(HERE, "src", name), lazy=False)
    options = Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]      # garde le crénage, les ligatures et les chiffres alternatifs
    options.hinting = False              # les navigateurs récents n'en ont pas besoin
    options.desubroutinize = True
    options.name_IDs = ["*"]             # garde les noms et la mention de licence
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    if axes:
        font = instancer.instantiateVariableFont(font, axes)  # après le tri des caractères
    out = os.path.join(HERE, name)
    font.flavor = "woff2"
    font.save(out)
    before = os.path.getsize(os.path.join(HERE, "src", name))
    print(f"{name} : {before // 1024} Ko -> {os.path.getsize(out) // 1024} Ko")
