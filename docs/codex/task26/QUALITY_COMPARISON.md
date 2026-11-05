# Qualité — preuves et limites

- Deux journées ERA5 réelles,19et20octobre, Beauce28341 : sortie multi-jours égale exactement aux deux sorties quotidiennes,0acquisition/0écriture. Déduplication descriptions2→1. `multiday-real-equivalence.json`.
- Archive716sorties réelles : restauration octet-identique, donc floats/NULL/qualité/provenance préservés. Ce test n'est pas une restauration transactionnelle PostgreSQL.
- Contrat `pra-weather-1` : nature, UTC, run/lead, unité, valeurs physiques, support manquant validés ; tests rejettent prévision relabellisée, cycle incomplet/doublon, échéance erronée et pluie manquante assimilée à0.
- Poids IFS indépendants : emprises natives0,25° densifiées, intersections total-PRA, contrôle de fermeture ; cas côtier synthétique séparé des preuves de données réelles. Pas de renormalisation sur les seules cellules valides.
- Comparaison analyse/stations J−1 : **non exécutée**, authentification401 actuelle. Aucun biais/RMSE inventé.
- Comparaison estimation récente/ERA5 : **non exécutée**, aucune analyse disponible et aucune date commune actuellement obtenue.
- Comparaison AROME/ARPEGE/IFS : **non exécutée**, champs Météo-France inaccessibles. Pas de raccordement modèle supposé valide.
- IFS : prévision unique, faible durée ; validation structurelle/exploratoire ne valide pas statistiquement J+7. Min/max3–6h peuvent manquer les extrêmes ; moyenne trapézoïdale et RH Magnus sont des approximations explicites. Cellules côtières incluent de la mer ; modèle non substituable au masque terre ERA5.

Contrôle indépendant réel IFS :420agrégats,52NULL attendus, écart maximal1,42e−14 ; preuve `operational-evidence/ifs-independent-values.json`. Rejeu compact natif sans réseau restitue exactement les420lignes publiées.12différences négatives de pluie et123échantillons RH invalides restent traçables/NULL, pas une correction cachée. Aucun indice de skill J+7 n'en est déduit.

Recette réelle IFS locale et Preview :90comparaisons API/fiche par environnement,12PRA, J+1/J+7, cinqvariables, NULL, même canevas, desktop1440/tablette768/mobile390, aucun débordement ou erreurJS. Rapports et captures `operational-local/` et `operational-preview/`. TLS normal, gatewayGET/HEAD Task25/26, aucun mock. La comparaison de run accepte les représentationsUTC équivalentesZ/+00:00 sans relâcher la sémantique temporelle.

Campagne complète locale :283testsPython et260TS, lint/typage/build/guards réussis ; puis nouveau test réel UTC et trois cas supplémentaires d'axe horaire validés ciblés. CI7f58c9f :286Python/261TS et les suites SQL public/extensions, web-demo, sécurité au vert. Une course de titre Next dans un ancien audit navigateur a été corrigée en attendant le titre réel non vide avant axe, sans désactiver de règle d'accessibilité.
