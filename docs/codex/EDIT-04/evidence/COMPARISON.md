# EDIT-04 — Comparaison avant / après

Contrôle déterministe hors ligne, pas une évaluation qualitative de choix IA. Aucun appel OpenAI, aucune publication ni acquisition. Les archives sources restent inchangées.

## 2026-11-12

Avant : 10 cartes, principale = temperature_min reanalysis. Après : 6 cartes, principale = temperature_min forecast.

| Carte | Nature | Période | Avant | Après | Score | Pénalité |
|---|---|---|---:|---:|---:|---:|
| temperature_min | reanalysis | 2026-10-30 → 2026-11-05 | 1 | écartée | 27.16 | 16.2 |
| temperature_mean | reanalysis | 2026-10-30 → 2026-11-05 | 2 | écartée | 14.95 | 19.99 |
| rain | reanalysis | 2026-10-30 → 2026-11-05 | 3 | 3 | 56.91 | 0 |
| frost | reanalysis | 2026-10-30 → 2026-11-05 | 4 | 6 | 45.86 | 0 |
| gdd | reanalysis | 2026-10-30 → 2026-11-05 | 5 | 5 | 46.79 | 0 |
| temperature_min | forecast | 2026-11-13 → 2026-11-14 | 6 | 1 | 62.25 | 0 |
| temperature_mean | forecast | 2026-11-13 → 2026-11-14 | 7 | 4 | 50.45 | 0 |
| rain | forecast | 2026-11-13 → 2026-11-14 | 8 | 2 | 61.77 | 0 |
| frost | forecast | 2026-11-13 → 2026-11-14 | 9 | écartée | 43 | 14.23 |
| gdd | forecast | 2026-11-13 → 2026-11-14 | 10 | écartée | 22.27 | 19.98 |

Le classement combine contraste spatial, seuil démontrable, contexte saisonnier sourcé, couverture, fraîcheur et diversité ; les motifs par carte et les six axes sont dans [le rapport](2026-11-12.json). Les cartes thermiques proches subissent la pénalité de redondance. Un score reste un proxy éditorial, jamais une intensité de risque ou un dommage. Les fenêtres historiques se chevauchent : aucune évolution observée n’est inférée.

gpt-6.1-terra : 66806 → 137223 tokens d’entrée sous borne conservatrice (1 token/octet + enveloppe), surcoût maximal estimé 0.077459 €, plafond de sortie inchangé : 6000. Cache non supposé. Coût réel du test : 0 €.
gpt-6-luna : 66803 → 137220 tokens d’entrée sous borne conservatrice (1 token/octet + enveloppe), surcoût maximal estimé 0.007746 €, plafond de sortie inchangé : 6000. Cache non supposé. Coût réel du test : 0 €.

## 2026-11-13

Avant : 10 cartes, principale = temperature_min reanalysis. Après : 6 cartes, principale = rain forecast.

| Carte | Nature | Période | Avant | Après | Score | Pénalité |
|---|---|---|---:|---:|---:|---:|
| temperature_min | reanalysis | 2026-10-31 → 2026-11-06 | 1 | écartée | 26.57 | 16.86 |
| temperature_mean | reanalysis | 2026-10-31 → 2026-11-06 | 2 | écartée | 14.73 | 19.98 |
| rain | reanalysis | 2026-10-31 → 2026-11-06 | 3 | 3 | 59.33 | 0 |
| frost | reanalysis | 2026-10-31 → 2026-11-06 | 4 | 6 | 45.93 | 0 |
| gdd | reanalysis | 2026-10-31 → 2026-11-06 | 5 | 5 | 47.35 | 0 |
| temperature_min | forecast | 2026-11-14 → 2026-11-15 | 6 | 2 | 61.79 | 0 |
| temperature_mean | forecast | 2026-11-14 → 2026-11-15 | 7 | 4 | 52.8 | 0 |
| rain | forecast | 2026-11-14 → 2026-11-15 | 8 | 1 | 72.67 | 0 |
| frost | forecast | 2026-11-14 → 2026-11-15 | 9 | écartée | 42.88 | 13.85 |
| gdd | forecast | 2026-11-14 → 2026-11-15 | 10 | écartée | 22.26 | 19.99 |

Le classement combine contraste spatial, seuil démontrable, contexte saisonnier sourcé, couverture, fraîcheur et diversité ; les motifs par carte et les six axes sont dans [le rapport](2026-11-13.json). Les cartes thermiques proches subissent la pénalité de redondance. Un score reste un proxy éditorial, jamais une intensité de risque ou un dommage. Les fenêtres historiques se chevauchent : aucune évolution observée n’est inférée.

gpt-6.1-terra : 67596 → 138921 tokens d’entrée sous borne conservatrice (1 token/octet + enveloppe), surcoût maximal estimé 0.078458 €, plafond de sortie inchangé : 6000. Cache non supposé. Coût réel du test : 0 €.
gpt-6-luna : 67593 → 138918 tokens d’entrée sous borne conservatrice (1 token/octet + enveloppe), surcoût maximal estimé 0.007845 €, plafond de sortie inchangé : 6000. Cache non supposé. Coût réel du test : 0 €.

## 2026-11-14

Avant : 10 cartes, principale = temperature_min reanalysis. Après : 6 cartes, principale = rain forecast.

| Carte | Nature | Période | Avant | Après | Score | Pénalité |
|---|---|---|---:|---:|---:|---:|
| temperature_min | reanalysis | 2026-11-01 → 2026-11-07 | 1 | écartée | 26.72 | 17.25 |
| temperature_mean | reanalysis | 2026-11-01 → 2026-11-07 | 2 | écartée | 14.55 | 19.97 |
| rain | reanalysis | 2026-11-01 → 2026-11-07 | 3 | 3 | 60.12 | 0 |
| frost | reanalysis | 2026-11-01 → 2026-11-07 | 4 | 4 | 48.97 | 0 |
| gdd | reanalysis | 2026-11-01 → 2026-11-07 | 5 | 5 | 48 | 0 |
| temperature_min | forecast | 2026-11-15 → 2026-11-16 | 6 | 6 | 45.8 | 0 |
| temperature_mean | forecast | 2026-11-15 → 2026-11-16 | 7 | 2 | 61.18 | 0 |
| rain | forecast | 2026-11-15 → 2026-11-16 | 8 | 1 | 73.3 | 0 |
| frost | forecast | 2026-11-15 → 2026-11-16 | 9 | écartée | 30.59 | 12.63 |
| gdd | forecast | 2026-11-15 → 2026-11-16 | 10 | écartée | 22.25 | 20 |

Le classement combine contraste spatial, seuil démontrable, contexte saisonnier sourcé, couverture, fraîcheur et diversité ; les motifs par carte et les six axes sont dans [le rapport](2026-11-14.json). Les cartes thermiques proches subissent la pénalité de redondance. Un score reste un proxy éditorial, jamais une intensité de risque ou un dommage. Les fenêtres historiques se chevauchent : aucune évolution observée n’est inférée.

gpt-6.1-terra : 67837 → 139098 tokens d’entrée sous borne conservatrice (1 token/octet + enveloppe), surcoût maximal estimé 0.078387 €, plafond de sortie inchangé : 6000. Cache non supposé. Coût réel du test : 0 €.
gpt-6-luna : 67834 → 139095 tokens d’entrée sous borne conservatrice (1 token/octet + enveloppe), surcoût maximal estimé 0.007839 €, plafond de sortie inchangé : 6000. Cache non supposé. Coût réel du test : 0 €.
