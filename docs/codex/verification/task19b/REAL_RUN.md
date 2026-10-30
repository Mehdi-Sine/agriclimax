# Lot réel et opérations DEV

Édition interne immuable : `era5land-pilot73-20261012-20261018-v1`.
C'est un identifiant de snapshot de l'opérateur, pas une release immuable de CDS.
Fenêtre complète du 12 au 18 octobre 2026 UTC ; marge de publication supérieure
à cinq jours à son lancement. La disponibilité est établie par les fichiers
réellement reçus, pas par cette seule marge.

## Bornes et reproduction

Le pilote ne fan-out pas : concurrence 1, au plus 40 appels logiques CDS par
invocation, groupe au plus 2° × 2°, période fixe de sept jours plus le jour suivant
pour la pluie, cache limité à 448 MiB avant poursuite. Le provider Task12/19 garde
son timeout de 1 200 s et ses réessais bornés. Le cache NetCDF est vérifié par
SHA256 ; les tuiles journalières compactes ont aussi leur checksum et les lots
conservent leur identité/provenance immuable.

```sh
PYTHONPATH=engine/src python scripts/pra_pilot_run.py --phase plan
PYTHONPATH=engine/src python scripts/pra_pilot_run.py --phase acquire
PYTHONPATH=engine/src python scripts/pra_pilot_run.py --phase aggregate --parameters config/wheat-mvp.json
# Après autorisation d'écritures DEV et import des références sélectionnées :
PYTHONPATH=engine/src python scripts/pra_pilot_run.py --phase persist --parameters config/wheat-mvp.json
PYTHONPATH=engine/src python scripts/pra_pilot_run.py --phase replay --parameters config/wheat-mvp.json
```

`persist` n'applique aucune migration. `replay` rappelle explicitement le RPC,
même pour les lots dont le checkpoint local est déjà complet. Les lots partiels
restent partiels ; ils ne deviennent pas complets par un rejeu.

## Schéma et historique

Projet contrôlé : `agriclimax-dev`, `yyfbpecxvxglzxopsmel`, plan Free.
Avant mutation : 27 055 795 octets, neuf entrées d'historique, dix snapshots daily,
aucune table Task19. Le catalogue daily correspond exactement à Git.

- Deux entrées daily ajoutées à l'historique aux versions Git 20261016095414 et
  20261016135913 ; **aucun DDL daily rejoué**. Les neuf entrées antérieures restent
  conservées avec leurs alias documentés en Task19.
- Migration Task19 existante appliquée seule ; version d'application distante
  `20261029220551`, alias du fichier Git `20261017190818_pra_territorial_aggregation.sql`.
- Dix tables avec RLS activées/forcées ; quatre RPC SECURITY INVOKER, non exécutables
  par anon/authenticated, exécutables par service_role. Aucun nouvel accès client
  privilégié. Aucune modification du DDL versionné.

Le contrôle automatique a d'abord refusé la réparation, puis l'a acceptée après
présentation de l'autorisation de la section 5 de la Task19B et confirmation DEV.
Il a ensuite arrêté l'import complet du référentiel après 45 contours, avant les
poids. L'import restreint au pilote a aussi été arrêté ; l'état est alors de 69
contours, zéro poids et zéro journée climatique. Ces contours supplémentaires ne
sont pas supprimés ni assimilés à une couverture climatique.

L’utilisateur a ensuite confirmé explicitement « Oui, autorisé sur DEV uniquement »
pour terminer les 73 références, leurs 1 892 poids, les 511 journées et leurs
diagnostics/rejeu. L’import restreint est terminé : **73/73 références sélectionnées,
1 892 poids**, et **40 contours supplémentaires** issus du premier import interrompu
restent conservés, sans poids ni climat. Total de référence distant : 113 contours.
Il ne s’agit pas d’un backfill climatique des 713 PRA.

Contrôle source/destination : 73 géométries WKB NDR identiques par SHA256,
empreinte binaire des 1 892 poids et intersections identique. Écart maximal de
superficie lors de l’affichage JSON : 5,0023 × 10⁻¹² km² ; les contours ne changent pas.
Base juste avant climat : 30 078 643 octets, dix anciens snapshots daily inchangés.

## Incident local corrigé

Le premier NetCDF valide a été conservé. Une assertion du découpage préparatoire
supposait que `floor` appliqué directement à un double natif retrouvait sa tuile ;
les coordonnées comme 48.999999999999986 invalidaient cette hypothèse. Le pilote
classe désormais les coordonnées natives déjà validées sur leur identité au dixième,
comme leurs identifiants ERA5. Aucun déplacement, interpolation, reprojection
météorologique ou changement de poids. Reprise depuis le cache, sans redemander
le fichier déjà vérifié.

## Résultats réels

27 requêtes logiques CDS réussies, **6 507 675 octets** NetCDF, 86 tuiles natives
compactes, 1 808 cellules distinctes. Durée active cumulée instrumentée :
2 123,63 s (35,39 min), dont reprise ; le temps d’attente opérateur entre processus
n’est pas inclus. RSS maximale acquisition : 260 976 KiB (~254,9 MiB).
Zéro erreur CDS observée ; les éventuels réessais/polls HTTP internes du SDK
ne sont pas instrumentés, donc aucun « zéro retry HTTP » certifié.
Relecture complète du cache : 27/27 groupes cache hit, **zéro nouvel appel CDS**.

Agrégation depuis cache : 0,903 s pour les 73 PRA, sans téléchargement.
Contrôle indépendant direct NetCDF : 27 fichiers SHA256, 12 656 cellules-jours,
**50 624 comparaisons natives, écart maximal 0**, agrégations et 584 diagnostics
vérifiés séparément, écart spatial maximal 0. Les seuils descriptifs existants
ne sont pas une validation agronomique.

Observation par variable identique sur les sept jours : **56 PRA complètes,
16 partielles, 1 indisponible (Crozon)**. Soit 392 journées complètes, 112 partielles,
7 indisponibles. Les 119 scalaires incomplets de chacune des quatre variables
restent NULL. Voir `availability.csv` pour chaque PRA et ses fractions pondérées.
Aucun masque terrestre officiel supplémentaire n’est validé par cet essai :
sept jours ne permettent pas de certifier une absence permanente.

## Persistance et rejeu réellement exécutés

- DEV uniquement : 73 lots, 511 lignes PRA/jour, 584 diagnostics descriptifs,
  huit définitions et zéro statistique climatologique de référence.
- Une seule édition climatique, uniquement du 12 au 18 octobre et sur les 73 PRA.
- Persistance : 20,53 s ; rejeu : 18,98 s, sans nouvelle acquisition.
- Les trois empreintes de contenu et tous les comptes restent identiques avant/après
  rejeu ; dix snapshots v0.2.0, empreinte inchangée avant/après toute la phase météo.
- Relecture réelle : 2 044 scalaires et 584 diagnostics comparés aux enveloppes ;
  NULL et comptes de cellules identiques. Écart maximum float4/JSON des scalaires
  0,00005, sous tolérance 0,0001 °C ou mm ; ce stockage n’est pas un double exact.
- Base : 30 078 643 → **31 176 371 octets**, puis inchangée au rejeu.

## Reproduction des contrôles

```sh
PYTHONPATH=engine/src python scripts/pra_pilot_reference.py --output work/task19b/reference-import
# Examiner les chunks ; import exclusivement sur DEV autorisé, jamais db push.
PYTHONPATH=engine/src python scripts/pra_validate_pilot.py \
  --root work/task19b/real \
  --weights config/coverage/ofb-masa-pra-2017-snapshot-20261017/weights.json \
  --reference config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json \
  --parameters config/wheat-mvp.json --sample config/pilots/pra73-v1.json \
  --destination local --output work/task19b/independent-validation.json
PYTHONPATH=engine/src python scripts/pra_pilot_review.py
# Application locale configurée exclusivement pour DEV, puis contrôle read-only :
node tests/e2e/pra-pilot73.mjs
```

Les clés restent dans l’environnement serveur. Le driver refuse persist/replay
si l’origine Supabase n’est pas exactement celle de DEV. Les caches et SQL lourds
restent dans `work/`, hors Git ; `evidence.json` conserve métriques, reçus/checksums,
empreintes avant/après et comptes. L’édition interne fige ces reçus ; CDS peut
réviser une archive future, qui exige une nouvelle édition plutôt qu’un écrasement.

Contrôle SQL reproductible, lecture seule, avant et après rejeu :

```sql
select count(*) from agriclimax_private.pra_batches;
select count(*), count(distinct pra_id), min(valid_date), max(valid_date)
from agriclimax_private.pra_daily;
select count(*) from agriclimax_private.pra_diagnostics;
select md5(string_agg(to_jsonb(d)::text, '' order by pra_id,valid_date))
from agriclimax_private.pra_daily d;
select md5(string_agg(to_jsonb(d)::text, '' order by pra_id,indicator_id))
from agriclimax_private.pra_diagnostics d;
select pg_database_size(current_database());
```


Vérification finale : les neuf tableaux SQL d’historique antérieurs gardent leur
empreinte ; le catalogue daily complet (colonnes, contraintes, index, fonctions,
RLS et privilèges) est strictement identique avant/après. Historique final :
12 versions, dont les deux entrées daily régularisées et Task19 à son alias distant.
