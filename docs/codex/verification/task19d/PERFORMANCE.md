# Performances nationales réelles

Build production local → Supabase DEV distant, sans mocks. Trois essais par taille ; aucune promesse de SLA Vercel.

| PRA lues | Médiane HTTP | Pages | Octets reçus |
|---:|---:|---:|---:|
| 1 | 194.9 ms | 1 | 1091 |
| 10 | 208.8 ms | 1 | 7740 |
| 713 | 1442.2 ms | 8 | 527897 |

Lecture/comparaison des **21 390 journées nationales** via l’endpoint territorial existant : 42.84 s. Historique d’une PRA sur 30 jours : médiane 4813.8 ms (30 appels paginés/date, protocole existant).
94608 scalaires comparés, NULL et comptes/flags/provenance/fraîcheur contrôlés. La sérialisation float4 PostgreSQL est explicitement vérifiée ; erreur de restitution maximale observée 5.0814e-05.

Aucun diagnostic systématique ou calcul scientifique ajouté aux routes. Pas de nouvelle UI ni captures inutiles. Reproduction : application locale configurée DEV, puis `PYTHONPATH=engine/src python scripts/pra_national_review.py --destination supabase --http`.
