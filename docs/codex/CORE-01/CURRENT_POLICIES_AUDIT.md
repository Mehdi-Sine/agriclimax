# Audit préalable CORE-01

Base : origin/main ccc42256ea ; COUV-01 consultée en lecture seule.
Frontières : fournisseur/archives → adaptation des entrées → qualification spatiale
et temporelle → politique d'indicateur → synthèse/publication → API/carte.

| Chaîne | Support complet | Partiel conservé | 90 % | Temporalité / propagation |
|---|---|---|---|---|
| Python territories/aggregate.py | toutes cellules attendues | observed_value séparée, moyenne renormalisée | aucun | somme stricte ; spatial ≠ temporel |
| Archives ERA5 | valeurs strictes archivées | coverage, valid_counts, NULL natif | aucun | empreintes exactes ; compte de cellules ≠ durée sur support observé |
| spatial-restitution.ts | valeurs strictes inchangées | support_id, identité poids/référence, géométrie et observed_value vérifiés | ancien p.value pour moyennes | informations disponibles mais non consommées par AGRO-01 |
| calculateObserved 1.1/1.2 | calculate inchangé | observed_value ; events on support | moyennes/GDD/pluie ≥0,9 | stabilité identité/id/fraction ; ne contrôle pas directement temporal_coverage du support, dépend de l'adaptateur |
| unifiedData / Climat | agrégat des jours natifs | observed_value et série séparées | ancien contrat hérité | version/portée inégalement exposées ; carte colore la géométrie partielle |
| Agroclimatique historique | statut disponible et couverture ≥0,9999 | adaptateur du support vérifié | règle 1.2 | forecast strict ; support/grille pas toujours transmis au calculateur générique |
| Blé 2.0 | ≥0,9999, temps = 1, métadonnées homogènes | statut partial, valeur NULL | aucun | refus volontaire versionné ; lecteur ignore les archives de supports |
| Veille 1.0 | chaque variable disponible, ≥0,9999, temps = 1 | drapeau partial_spatial_support_not_evaluated | aucun | découpe source/run ; grille/poids non inclus dans la clé des segments |
| Journal carte T32B | detected non NULL + valeur finie | partiel grisé, preuve | aucun | valeur descriptive perdue si non éligible à détection |
| Journal blé | isPublishable 2.0 stricte | exclu | aucun | choix scientifique légitime, à préserver sous ancienne version |
| THI bovin | couple T/RH compatible ; horaire pour nuits | fragments explicitement bornés | aucun | pas d'humidité historique, pas de substitution |
| Normales/anomalies | référence homologue, 30 années, support complet | exclu | aucun | restriction légitime, inchangée |

Sources relues : Task19 audit littoral, Task26 COASTAL_SPATIAL_RESTITUTION,
Task28 SCIENTIFIC_RULES, Task29 FINAL_DECISION, Task30 SCIENTIFIC_SIGNAL_RULES,
AGRO-01 NATIONAL_COVERAGE et SCIENTIFIC_VALIDATION ; quatre documents COUV-01.

## Diagnostic

Le refus 2.0 n'est pas une erreur de calcul : son contrat impose un support entier.
Le défaut est l'absence d'une voie descriptive commune versionnée et l'absence de
propagation de la portée jusqu'aux consommateurs. La couverture numérique des
prévisions ne démontre pas la représentativité terrestre. Le proxy géométrique
ne vaut jamais masque physique. Les 90 % historiques sont une politique héritée,
pas une validation indépendante : la nouvelle voie exige un certificat de méthode
avant toute estimation territoriale. Sans certificat, conserver le descriptif.
Aucun zéro de portion ne prouve l'absence d'événement sur la surface inconnue.

Audit établi avant modification des modules applicatifs.
