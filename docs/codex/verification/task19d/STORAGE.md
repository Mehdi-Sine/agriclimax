# Stockage réel national DEV

Base avant/après : **47.03 → 75.07 Mo**, delta **28.04 Mo**. Taille inchangée ou pages de maintenance distinctes du contenu au replay ; les comptes/empreintes restent identiques.

| Relation | Delta table/TOAST | Delta index | Total (octets) |
|---|---:|---:|---:|
| pra_batches | 8282112 | 434176 | 8716288 |
| pra_daily | 10952704 | 8323072 | 19275776 |
| pra_diagnostics | 0 | 0 | 0 |

Les anciennes éditions pilotes sont conservées, donc le compte global dépasse 21 390 ; le chiffre national est filtré sur son édition. Aucun nouveau diagnostic systématique et aucune purge automatique. Les archives horaires sont hors PostgreSQL et hors Supabase Storage.

Taille réelle **75.07 Mo**, sous budget 375 Mo et plafond Free 500 Mo. Aucun service payant activé, aucune augmentation de capacité pour faire passer le run. Les quotas objet/egress sont distincts et ne prolongent pas le budget DB.

La rétention 90 jours reste un horizon de planification, pas une suppression active. Surveiller DB/egress avant chaque acquisition ultérieure ; aucune croissance indéfinie compatible Free n’est promise.
