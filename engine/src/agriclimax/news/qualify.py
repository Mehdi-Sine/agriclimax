"""Conservative lexical classification; no commune geocoding or damage inference."""

import re
import unicodedata
from typing import Literal, TypedDict


class Classification(TypedDict):
    productions: list[str]
    regions: list[str]
    phenomena: list[str]
    themes: list[str]
    relevance: Literal["high", "context", "rejected"]
    classification_evidence: dict[str, list[str]]


PRODUCTIONS = {
    "wheat": ["blé", "blés", "froment"],
    "maize": ["maïs"],
    "viticulture": ["vigne", "viticulture", "viticole", "vignoble"],
    "cattle": ["bovin", "bovins", "vaches", "élevage bovin"],
    "grassland": ["prairie", "prairies", "fourrages", "herbe"],
    "arboriculture": ["arboriculture", "vergers", "pommes", "fruits"],
    "vegetables": ["maraîchage", "légumes"],
    "poultry": ["volailles", "aviculture"],
    "oilseeds": ["colza", "tournesol"],
    "sugar-beet": ["betterave", "betteraves"],
}
PHENOMENA = {
    "frost": ["gel", "gelées", "gelée"],
    "heat": ["canicule", "chaleur", "fortes températures"],
    "rain": ["pluie", "pluies", "précipitations", "inondations"],
    "dry": ["sécheresse", "déficit hydrique", "sans pluie"],
}
THEMES = {
    "plant-health": ["bsv", "santé du végétal", "ravageurs", "mildiou"],
    "agronomy": ["semis", "récolte", "irrigation", "agronomie", "fourrages"],
    "climate-adaptation": ["climat", "climatique", "adaptation", "eau"],
}
REGIONS = [
    "Auvergne-Rhône-Alpes",
    "Bourgogne-Franche-Comté",
    "Bretagne",
    "Centre-Val de Loire",
    "Corse",
    "Grand Est",
    "Hauts-de-France",
    "Île-de-France",
    "Normandie",
    "Nouvelle-Aquitaine",
    "Occitanie",
    "Pays de la Loire",
    "Provence-Alpes-Côte d’Azur",
    "Guadeloupe",
    "Martinique",
    "Guyane",
    "La Réunion",
    "Mayotte",
]


def normalize(text: str) -> str:
    return re.sub(
        r"[^a-z0-9]+",
        " ",
        "".join(
            c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c)
        ),
    ).strip()


def classify(text: str) -> Classification:
    normalized = f" {normalize(text)} "

    def scan(vocabulary: dict[str, list[str]]) -> dict[str, list[str]]:
        return {
            key: [term for term in terms if f" {normalize(term)} " in normalized]
            for key, terms in vocabulary.items()
            if any(f" {normalize(term)} " in normalized for term in terms)
        }

    productions, phenomena, themes = scan(PRODUCTIONS), scan(PHENOMENA), scan(THEMES)
    # Accent folding must not confuse the conjunction « mais » with maize.
    if not re.search(r"\bmaïs\b", unicodedata.normalize("NFC", text.lower())):
        productions.pop("maize", None)
    regions = scan({r: [r] for r in REGIONS})
    if phenomena:
        themes["agroclimate"] = list(phenomena)
    relevance: Literal["high", "context", "rejected"] = (
        "high" if phenomena and productions else "context" if themes or phenomena else "rejected"
    )
    if any(term in normalized for term in (" lyceens ", " recrutement ", " offre emploi ")):
        relevance = "rejected"
    return {
        "productions": list(productions),
        "regions": list(regions),
        "phenomena": list(phenomena),
        "themes": list(themes),
        "relevance": relevance,
        "classification_evidence": {
            **{f"production:{k}": v for k, v in productions.items()},
            **{f"phenomenon:{k}": v for k, v in phenomena.items()},
            **{f"theme:{k}": v for k, v in themes.items()},
            **{f"region:{k}": v for k, v in regions.items()},
        },
    }
