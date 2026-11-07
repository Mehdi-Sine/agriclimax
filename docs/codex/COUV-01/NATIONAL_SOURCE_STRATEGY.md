# Stratégie nationale des sources

| Critère | A — SAFRAN national | B — ERA5-Land + SAFRAN local |
|---|---|---|
| Cohérence historique | Une source, cinq définitions explicitement versionnées | Rupture de source entre territoires ; risques d'interprétation nationale |
| Support prouvé dans ce pilote | 675 complets, 38 partiels, 0 sans information | ERA : 645/67/1 ; SAFRAN complète 30 des 68 anciennes PRA problématiques |
| Dates | 60 jours réels ; accès annuel catalogué, non acquis | ERA Storage 14 jours ; anciens agrégats 30 jours restaurés séparément |
| Tmoy | Comparaison commune possible avec réserve d'échantillonnage | Biais non négligeable : pas de raccordement implicite |
| Pluie/extrema | Définition homogène dans le produit SIM | Fenêtres et opérateurs incompatibles avec ERA existant |
| Fraîcheur observée | Dernier jour 06/11 pour catalogue du 07/11 | Dernier ERA Storage 01/11 dans l'instantané examiné |
| Coût | Conversion Parquet récente compatible avec les plafonds | Réutilisation ERA possible mais dette de deux chaînes et validation croisée |

Décision : **A comme fondation candidate, pas comme bascule de production**.
Le pilote résout l'accès économique et vérifie une vraie série nationale ; il
ne démontre pas 713 supports complets et scientifiquement qualifiés. B n'apporte
pas une solution complète aux 38 supports résiduels et créerait une mosaïque de
méthodes. Les séries existantes restent disponibles sous leur méthode d'origine.

Le contrat distingue `native_complete`, `qualified_estimate`, `partial_support`,
`unavailable`, `unknown`. L'agrégateur ne génère aucune estimation : seuls les
états correspondant aux preuves sont émis. Provenance, période, unité, support,
complétude et validation scientifique sont des champs séparés. Les fenêtres
refusent changement de source/modèle/méthode/support ou de récupération source,
jour manquant, duplicata, valeur non finie et estimation. Aucun changement des
moteurs agroclimatiques existants : l'adaptateur opt-in et le lecteur local
forment une fondation vérifiable, sans activation métier prématurée.

Pour les 38 résidus : obtenir une confirmation du fournisseur sur le datum et
l'emprise des cellules, examiner les petites îles et les trous sans modifier les
contours officiels, puis établir un protocole d'estimation séparé. Une extension
de Voronoï, un plus proche voisin ou une translation ne serait pas native.
Le protocole devra pré-déclarer ses paramètres et témoins, bloquer spatialement
les cibles, comparer à des stations indépendantes, mesurer biais/MAE/extrêmes et
incertitude, et refuser les cibles hors domaine validé. L'IDW Crozon Task29,
validé contre le champ ERA voisin, ne certifie ni SAFRAN ni le microclimat côtier.

Pas de normales, tendances, anomalies ou THI inter-sources. Pas d'homogénéisation
statistique improvisée à partir de deux semaines. La certification reste bloquée
par les preuves scientifiques manquantes, pas par un seuil que l'on pourrait abaisser.
