# Inventaire des indicateurs

Audit de `main` à `3a2a764` après fusion de [#112](https://github.com/Mehdi-Sine/agriclimax/pull/112). Le catalogue actif Analyse et les recettes éditoriales expérimentales ont des points d’entrée distincts. Les systèmes et cultures documentés par AGRO-04 renseignent l’exposition déclarée et les fenêtres de surveillance. Ils ne produisent pas une nouvelle variable météo. [Inventaire précédent AGRO-03](../AGRO-03/INVENTORY.md) · [Règles AGRO-04](../AGRO-04/README.md)

## Catalogue Analyse déjà accessible

**H** = réanalyse du 24 au 30 octobre 2026. T, Tn, Tx et P sont les champs quotidiens ERA5-Land natifs. **P1** = prévision sélectionnée du 23 novembre, J+1 du cycle conservé du 22 novembre, avec modèles AROME, ARPEGE et IFS. Effectifs sur les **713 PRA**, sous la forme **PRA entières / portions descriptives / sans valeur**. Les dates d’audit ne prouvent pas une disponibilité sur les autres jours ou cycles.

| Règle active | Calcul avec le paramètre par défaut | H | P1 |
| --- | --- | ---: | ---: |
| `gdd` | Σ max(0, T − 0), °C·j | 645 / 67 / 1 | 713 / 0 / 0 |
| `hot` | Compte des jours Tx > 25 °C | 645 / 67 / 1 | 713 / 0 / 0 |
| `hot_sequence` | Plus longue suite Tx > 25 °C | 645 / 67 / 1 | 713 / 0 / 0 |
| `frost` | Compte des jours Tn < 0 °C | 645 / 67 / 1 | 713 / 0 / 0 |
| `frost_sequence` | Plus longue suite Tn < 0 °C | 645 / 67 / 1 | 713 / 0 / 0 |
| `rain` | Σ P en mm | 645 / 67 / 1 | 713 / 0 / 0 |
| `heavy_rain` | Compte des jours P > 20 mm | 645 / 67 / 1 | 713 / 0 / 0 |
| `dry` | Compte des jours P < 1 mm | 645 / 67 / 1 | 713 / 0 / 0 |
| `dry_sequence` | Plus longue suite P < 1 mm | 645 / 67 / 1 | 713 / 0 / 0 |
| `thi` | Maximum des THI synthétiques journaliers | 0 / 0 / 713 | 425 / 0 / 288 |
| `thi_days` | Compte des jours THI > 72 | 0 / 0 / 713 | 425 / 0 / 288 |
| `thi_sequence` | Plus longue suite THI > 72 | 0 / 0 / 713 | 425 / 0 / 288 |
| `cattle_heat` | Compte des jours Tx > 25 °C, identique à `hot` | 645 / 67 / 1 | 713 / 0 / 0 |
| `temperature_mean` | Moyenne des T, °C | 645 / 67 / 1 | 713 / 0 / 0 |

Ces recettes utilisent des fenêtres inclusives de 1 à 30 jours UTC. En mode opérationnel, le même cycle doit couvrir tous les jours, avec J+1 à J+7 pour la prévision ou J−1/J pour l’estimation récente. La qualification se fait par fenêtre. Le THI utilise T et l’humidité relative moyenne H compatibles, avec la formule `(1,8T+32) − (0,55−0,0055H)×(1,8T−26)`. Il est dépourvu de couples en réanalyse et conditionnel selon les modèles en prévision. Les stations Météo-France et le moteur Python ponctuel n’ont pas été extrapolés aux PRA. [Détail par PRA, fenêtre et état](evidence/couverture-par-pra.csv.gz)

## Calculs existants sur les autres points d’entrée

| Point d’entrée | Recettes, paramètres et source | Disponibilité documentée |
| --- | --- | --- |
| Climat | Tmoy, Tmin, Tmax, pluie, jours chauds, jours de gel, degrés-jours paramétrés. ERA5-Land native. Valeur du jour ou agrégat de 1 à 30 jours. Normale et écart 1991–2020 pour les variables compatibles et jours homologues, selon les contrôles du point d’entrée. | Les quatre variables météo ont 645 supports historiques complets, 67 portions qualifiées et une PRA sans valeur native en COUV-06 sur le 1er novembre. Le rendu peut étendre la couleur au contour à partir de 90 % sans promouvoir les portions en faits nationaux. La disponibilité des normales est contrôlée séparément par variable/jour/support. |
| AGRO-02 | `gdd_base6`, `gdd_base10` sans plafond, jours et séquence Tx > 30 °C, minimum de période des Tn, jours P > 0,1 mm. Fenêtres de 1 à 30 jours. Même qualification ERA5-Land ou modèles de prévision. | 645 / 67 / 1 en réanalyse de 1, 7 et 14 jours finissant le 1er novembre dans la matrice AGRO-03. Le J+1 gelé du 8 novembre donne 713 / 0 / 0. Le J+1 à J+7 du même cycle ne donne aucun cumul qualifié là où source ou support change. |
| AGRO-03 | Jours et séquence de nuits Tn > 20 °C, jours et séquence P ≥ 1 mm, jours P ≥ 10 mm, max de pluie sur un jour, jours et séquence Tx < 0 °C. Moteur multi-productions et registre de recettes. | Même matrice par fenêtre, sans publication systématique. Pour la fenêtre à cheval du 3 octobre au 1er novembre, la série retenue ne garantit aucun agrégat complet. |
| Journal et veille nationale | Sélection des signaux de gel, chaleur, pluie et séquence sèche issus des sources qualifiées. AGRO-04 ajoute des rapprochements saisonniers avec RPG 2025 et OTEX 2020 échantillonnées. | Quatre rapprochements exploratoires en prévisualisation. Le nombre de faits retenus dépend du cycle, de l’exposition documentée et de la sélection éditoriale. Aucune couverture nouvelle des 713 PRA déduite de ces filtres. |

[COUV-06](../COUV-06/README.md) · [Matrice AGRO-03](../AGRO-03/evidence/matrix.json) · [Calculs climat et références](../../../apps/web/features/unified/model.ts)

## Vues AGRO-05

| Vue | Calcul mobilisé | 24–30 octobre et 10–16 novembre | 1–30 octobre |
| --- | --- | ---: | ---: |
| Chaleur accumulée pour le maïs | Moteur GDD existant. Base 6 °C et plafond de Tmoy à 30 °C. AGRO-02 reste sans plafond. | 645 / 67 / 1 | 645 / 0 / 68 |
| Jours de gel en période sensible | `frost` inchangé, seuil météorologique fixe et fenêtre choisie. | 645 / 67 / 1 | 645 / 0 / 68 |
| Plus longue séquence sans pluie significative | `dry_sequence` inchangé à 1 mm. | 645 / 67 / 1 | 645 / 0 / 68 |
| Pluie reçue avant une intervention | `rain` inchangé, fenêtre antécédente choisie. | 645 / 67 / 1 | 645 / 0 / 68 |
| Plus fort cumul de pluie sur 5 jours | Nouveau maximum de cumuls consécutifs de 5 jours. Distinct du maximum quotidien existant. | 645 / 67 / 1 | 645 / 0 / 68 |

Pour le mois d’octobre, le lecteur utilise la série héritée sur toute la fenêtre. La qualification des portions exige un support vérifié sur chaque jour, d’où les 68 abstentions entières. Aucun assemblage de morceaux d’archives distincts. [Rejeu et cas littoraux](evidence/rejeu.json) · [Fiches et reports](FICHES.md)
