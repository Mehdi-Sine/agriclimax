# OPTI-01 · Nettoyage en simulation

**0 octet immédiatement supprimable avec les preuves actuelles.** L’alerte porte sur les octets transférés. Les objets de la famille la plus lue restent nécessaires à Cartes du jour et à la restitution historique. Une réduction de lectures offre un effet direct sur les prochains transferts.

## Inventaire de candidats

| Candidat | Quantité et gain brut | Références à résoudre | Décision |
|---|---:|---|---|
| Clés partageant taille et ETag | 47 groupes, 83 copies au-delà d’un exemplaire par groupe, 71 494 610 o théoriques | Vérifier indépendamment SHA-256, catalogues, liens des cycles natifs, masques versionnés et snapshots. | Conserver chaque clé actuellement. Les ETags sont des indices. |
| `forecast-masks` et copies sous `forecast-native/v1` | Les 25 plus gros groupes ETag ont trois occurrences chacun, 50 secondes copies à vérifier | `binding.json`, index journaliers et composites, qualifiés, provenance et configurations pin SHA. | Dédupliquer à terme avec pointeurs versionnés et rejeu comparé. |
| Artefacts `t36-forecast-checkpoints` du 25–27 | 6 clés d’artifact retenues, 467 504 685 o au total. Cinq checkpoints concentrent 467 459 123 o, rétention de 3 jours | Reprise des jobs, chaîne de preuve et archivage exact des reçus. | Laisser expirer selon la politique existante. |
| Rapports navigateur GitHub | 421 artifacts, 5 302 360 440 o. Les 333 datés d’avant le 13 novembre totalisent 3 475 876 955 o | Captures et traces utiles à la démonstration des régressions. Le plan de rotation concerne les futurs fichiers. | Laisser expirer les anciens. Appliquer 14 jours aux nouveaux. |
| `candidates/` | 10 clés, 117 408 o | Index SIM actif, candidats en attente, reprises et références historiques. | Garder tant que les pointeurs et les preuves sont incomplets. |
| `catalogues/` | 35 clés, 96 417 o | Révisions de checkpoints et restauration chronologique. | Gain faible. Conserver les versions actives et historiques. |
| Diagnostics PostgreSQL | 7 151 616 o dont 6 635 520 o TOAST | Coûts, contrôles, réponses, preuves d’incident et rapports de publication. | Proposer export compressé et politique de consultation après sauvegarde vérifiée. |
| Éditions, bundles et inputs historiques | 6,12 + 53,46 + 90,83 Mo | Couverture, reproduction, validation et révisions. | Conservation obligatoire. |

Les entrées sont des hypothèses de regroupement et de rétention. La liste précise des clés candidates ETag, où chaque copie conserve ses références par famille, est fournie hors Git dans `cleanup-candidates.ndjson`. Aucun gain théorique ne représente un gain d’egress.

## Validation des références

Construire la fermeture du graphe de références à partir des éditions consultables (toutes révisions), runs et dossiers gelés, checksums, registres et reçus, catalogues et leurs versions retenues, bindings et suites de masques, candidats encore en cours et configurations actives des trois environnements. Pour chaque objet, conserver la liste de références directes, les parents traversés, la date de dernière lecture connue, la preuve d’identité SHA-256, la décision de conservation et la procédure de rétablissement. Toute référence dynamique ou historique non résolue laisse le candidat en attente.

Rechercher les révisions reconstructibles et objets orphelins parmi les fichiers en dehors de ce graphe, avec revue des chemins résolus depuis Python, TypeScript et SQL et double inventaire avant/après. Pour les diagnostics et JSON volumineux, comparer taille exacte, gzip et zstd sur copie. Préserver les chaînes exactes hachées et les positions canoniques lorsque le format l’exige. Conserver les versions antérieures jusqu’à restauration et rejeu par date.

Une action de nettoyage distante nécessite la liste finale, la sauvegarde validée et l’autorisation explicite du propriétaire. La simulation ne contient aucune commande de suppression.

### Relevé OPTI-01A

L’inventaire hébergé confirme le même total d’objets et d’octets. La simulation conserve les 47 groupes de taille/ETag, 83 copies candidates et 71 494 610 o théoriques en attente de SHA-256 et de résolution des références. Calculer les empreintes sur les octets de la sauvegarde chiffrée afin d’éviter une deuxième lecture de masse. Résoudre les manifestes des 25, 26 et 27, les pointeurs météo et les archives historiques avant de proposer un seul retrait. Le gain autorisable reste indéterminé. Aucun retrait n’a été exécuté.
