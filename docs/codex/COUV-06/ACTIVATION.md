# Mise en production et retour arrière

Aucune variable distante, publication, collecte source, fusion ou infrastructure
créée par COUV-06. La branche désactive son déploiement Vercel dans les deux racines.
Les commandes ci-dessous sont des instructions pour une décision humaine ultérieure.

## Rendu historique ERA5 seul

1. Revoir la PR et les captures. Fusion et déploiement manuels uniquement.
2. Dans une preview isolée, définir au **build**
   `NEXT_PUBLIC_COUV06_HISTORICAL_RENDER_ENABLED=true`.
   Garder `NEXT_PUBLIC_COUV04_RENDER_ENABLED=false` et `COUV05_RENDER_ENABLED=false`.
   Reconstruire : Next incorpore les variables publiques au bundle navigateur.
3. Rejouer `tests/e2e/couv06.mjs` avec les API réelles. Vérifier 713 contours,
   unités/périodes, absence de débordement, 681 entières / 31 partielles / 1 grise
   pour les quatre variables du 01/11 ; THI 713 grises, aucune humidité inventée.
4. Déployer cette configuration uniquement après décision humaine. SIM n'est pas
   requis pour cette amélioration. Le flag ne change aucune admissibilité numérique,
   palette, formule, normale, anomalie ou sélection éditoriale.
5. Retour arrière : retirer ce flag et reconstruire/redéployer la version précédente.
   Le flag global COUV-04 doit rester false, sinon il active lui aussi le rendu.

## Nouvelles éditions et miniatures

Switch **séparé**, absent/false par défaut : variable de dépôt
`AGRICLIMAX_COUV06_EDITION_ENABLED=true`. Ne pas déclencher le cycle pour cette recette.
Après revue, le prochain gel normal peut incorporer les supports ERA dans son
archive d'entrées existante. Aucun nouveau cron/bucket/table.

Le catalogue reste `temperature_min`, `temperature_mean`, `rain`, `frost`, `gdd`.
Les mêmes calculateurs sont utilisés ; les supports/valeurs partiels passent par
l'adaptateur historique déjà utilisé dans l'explorateur. Aucune activation AGRO-03.
Les masques sont stables sur toute la fenêtre et par variable. Les géométries sont
dédupliquées par identité dans les entrées, puis figées dans les cartes signées.
Les références publiées existantes ne sont jamais enrichies après coup.

Le marqueur signé `couv06-history-1` fixe le rendu des nouvelles cartes publiées :
carte interactive et miniature utilisent leur propre géométrie archivée, même après
retrait d'un flag. Sans marqueur, une ancienne publication conserve son rendu exact.
Le cache reste lié à l'identité immuable de la carte ; aucun cache ancien à purger.
Une preview est explicitement marquée RECETTE et n'est pas une publication.

Contrôler `preparation-metrics.json` : `historical_cartography_status=frozen`.
`unavailable_preserved_original_maps` ou `budget_exceeded_preserved_original_maps`
signale une dégradation et conserve les cartes d'origine. Les gardes existantes
8 Mio comprimés pour les entrées/bundles et 64/96 Mio décomprimés ne sont pas relevées.
Les entrées candidates font 100 065 337 octets décomprimés, sous 96 Mio.
La recette mesurée utilise 7 716 702 octets d'entrées : marge limitée, à surveiller.

Retour arrière : retirer `AGRICLIMAX_COUV06_EDITION_ENABLED`. Les prochains gels
reprennent les cartes d'origine. **Les éditions déjà publiées, anciennes ou nouvelles,
restent figées**. Ne pas régénérer leur snapshot, modifier leur sélection ou republier.

## Persistance quotidienne SIM privée

Le raccordement restore → collect → save → restore existe déjà dans le job indépendant
`sim-candidate`. COUV-06 ajoute quatre reçus conservés 21 jours et force le shell Bash
avec `pipefail`, pour que `tee` ne transforme pas un échec en succès. Un seul écrivain,
concurrence du cycle entier, cinq minutes maximum, non bloquant pour le Journal.

Après revue, conserver `AGRICLIMAX_SIM_CANDIDATE_ENABLED=true` et définir manuellement
`AGRICLIMAX_SIM_PERSISTENCE_ENABLED=true`. Ne pas lancer un écrivain CLI concurrent.
Le prochain créneau normal utilise le job indépendant et désactive l'étape embarquée
ERA. Les secrets déjà utilisés par ERA sont nécessaires ; aucun nouveau secret.
Contrôler le job lui-même et ses reçus, pas seulement le statut global du workflow.

- `restore.json` : checkpoint précédent ou état empty explicite.
- `collect.json` : dates réellement disponibles, 32 PRA / 807 cellules, manque J−1
  explicite ; aucune recopie du dernier jour.
- `save.json` : génération/empreinte/octets, relecture distante vérifiée.
- `readback.json` : même empreinte restaurée dans un répertoire neuf.

Bucket privé existant, huit slots, plafond 16 781 312 octets. Aucun chemin publié
n'est écrit. Les reçus ne contiennent pas de secret. Une interruption avant le
pointeur conserve la dernière génération valide. Arrêt : remettre la variable de
persistance à false ; le canari embarqué reprend. Retirer le flag candidat arrête
également la collecte. Conserver les objets existants, ne pas purger les archives.

## Complément SIM public : ne pas activer

Le canari courant est `technical_checks_only`, `indicator_eligible=false`,
`journal_eligible=false`. Il n'est pas un complément publiable par changement de flag.
Tmoy `degC` sur ]00UTC–00UTC], pluie `mm` sur ]06UTC–06UTC] : pas de raccordement
silencieux des journées de pluie ERA et SIM. Les moyennes d'extrema horaires SIM ne
sont ni Tmin ni Tmax ERA. Ni THI/GDD/gel/séquences/normales/anomalies hybrides.

La qualification publique des dates/conventions et de la représentativité reste à
lever, ainsi que l'observation de sept mises à jour quotidiennes indépendantes.
Le rendu ERA et la persistance privée ne dépendent pas de cette décision scientifique.
