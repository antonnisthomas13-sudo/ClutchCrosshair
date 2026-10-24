# subset_fonts.py : fabrique les polices allégées du site à partir des originales (fonts/src/)
# Lancer avec : py fonts/subset_fonts.py   (il faut : py -m pip install fonttools brotli)
# - Fichiers « latin » : seulement les caractères utilisés par le site : latin de base, accents (Latin-1, œ, ²),
#   ponctuation (— … › « » ’ “ ”), € ™ ×, et l'espace fine insécable (U+202F) des nombres en français (« 8 551 $US »)
# - Fichiers en plus pour les autres langues (24/10/2026) : chargés par le navigateur SEULEMENT sur les pages qui
#   contiennent ces lettres (unicode-range dans style.css) : les pages anglaises et françaises ne les téléchargent pas.
#     * « latin-ext » : les lettres turques Ğ ğ İ Ş ş (ı, ü, ç, ö sont déjà dans les fichiers latin)
#     * « cyrillic » : l'alphabet russe (+ Ё ё et №)
#   Barlow Condensed n'existe pas en cyrillique : les titres russes utilisent Roboto Condensed (700, très proche),
#   déclarée dans style.css sous le même nom « Barlow Condensed » pour ces lettres seulement.
# - Inter : seulement les graisses 400 à 600 (les seules utilisées : --fw-regular, --fw-medium, --fw-semibold)
# Licences : SIL Open Font License (Inter, Barlow Condensed, JetBrains Mono) et Apache 2.0 (Roboto Condensed),
# qui autorisent ces versions allégées (fonts/LICENSE.txt).
import os
from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options
from fontTools.varLib import instancer

HERE = os.path.dirname(os.path.abspath(__file__))
LATIN = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100))
    + [0x131, 0x152, 0x153, 0x2C6, 0x2DA, 0x2DC, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E,
       0x2022, 0x2026, 0x2032, 0x2033, 0x2039, 0x203A, 0x2044, 0x202F, 0x20AC, 0x2122, 0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0xFEFF]
)
TURKISH = [0x11E, 0x11F, 0x130, 0x15E, 0x15F]
CYRILLIC = list(range(0x410, 0x450)) + [0x401, 0x451, 0x2116]

FONTS = [
    ("inter-latin.woff2", LATIN, {"wght": (400, 600)}),
    ("barlow-condensed-700-latin.woff2", LATIN, None),
    ("jetbrains-mono-400-latin.woff2", LATIN, None),
    ("inter-latin-ext.woff2", TURKISH, {"wght": (400, 600)}),
    ("barlow-condensed-700-latin-ext.woff2", TURKISH, None),
    ("jetbrains-mono-400-latin-ext.woff2", TURKISH, None),
    ("inter-cyrillic.woff2", CYRILLIC, {"wght": (400, 600)}),
    ("roboto-condensed-700-cyrillic.woff2", CYRILLIC, None),
    ("jetbrains-mono-400-cyrillic.woff2", CYRILLIC, None),
]

for name, unicodes, axes in FONTS:
    font = TTFont(os.path.join(HERE, "src", name), lazy=False)
    options = Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]      # garde le crénage, les ligatures et les chiffres alternatifs
    options.hinting = False              # les navigateurs récents n'en ont pas besoin
    options.desubroutinize = True
    options.name_IDs = ["*"]             # garde les noms et la mention de licence
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=unicodes)
    subsetter.subset(font)
    if axes and "fvar" in font:
        font = instancer.instantiateVariableFont(font, axes)  # après le tri des caractères
    out = os.path.join(HERE, name)
    font.flavor = "woff2"
    font.save(out)
    before = os.path.getsize(os.path.join(HERE, "src", name))
    print(f"{name} : {before // 1024} Ko -> {os.path.getsize(out) // 1024} Ko")
