# Task 21 — Résultat

**READY_FOR_NATIONAL_CLIMATOLOGY**

Pilote unique de 73/713 PRA (10,24 %), puis passage direct aux **713 PRA**, sans
nouveau téléchargement. Références 1991–2020 pour les 30 journées homologues du
19 septembre au 18 octobre et leur fenêtre de 30 jours ; comparaison à l'édition
nationale ERA5-Land du 19/09–18/10/2026, pas à des observations de station.

**88 412 agrégats stockés**, **79 980 normales/anomalies disponibles** pour
**645 PRA** ; **8 432 résultats absents** pour les **68 PRA** au support incomplet.
Les absences ne sont jamais remplacées par zéro. Tmin, Tmax, Tmean et pluie sont
séparés ; aucun THI. Les 21 390 lignes nationales actuelles sont inchangées.

| Mesure réelle | Résultat |
|---|---:|
| Source NetCDF, 14 fichiers | 764.95 Mo |
| Acquisition CDS, attente incluse | 87.7 min |
| Réduction quotidienne pilote / nationale | 42.72 / 88.47 s |
| Normales + anomalies pilote / nationales | 1.25 / 19.92 s |
| Pic mémoire du run national | 2.46 Go |
| Tables, index et métadonnées des vrais agrégats | 13.04 Mo |
| Base totale après import | 88.76 Mo |
| Lecture SQL réelle, une PRA /30 jours | 11,48 ms |
| Lecture API réelle, même sélection, médiane de 5 | 289.2 ms |
| Rejeu des 88 412 clés | 0 insertion |

Le pilote passe 90 812 comparaisons indépendantes ; le national en passe 884 412.
L'API vérifie 600 scalaires, les cas sans référence/valeur, la release inconnue,
la borne temporelle et le rejet d'une modification d'une référence immuable.
237 tests Python et 225 tests web passent, avec lint, typage, build, contrôles de
sources/contrats/sécurité et migrations. RLS forcée, droits serveur seulement,
RPC SECURITY INVOKER. Aucun nouveau constat de sécurité ; les avertissements
PostGIS et anciennes API bornées existaient avant la tâche.

## Calcul annuel préparé, non exécuté

Runner exécutable et verrouillé par le pilote, **92 requêtes grégoriennes exactes**,
checkpoints PRA et spool borné à 2 Gio hors Supabase. Les années non bissextiles
ne reçoivent pas de 29 février inventé. Projection du total PostgreSQL :
**358.62 Mo**, marge de 50 % sur les normales annuelles et réserve de
croissance de 30 Mo incluses, sous 375 Mo. Organisation Free vérifiée : **0 coût
de stockage Supabase additionnel projeté**, aucune capacité payante commandée.

À compression et débit identiques au pilote : ordre de grandeur
**6.9 Go transférés** et
**13.2 h CDS** pour l'année
complète. Ce sont des extrapolations, pas des mesures d'un run annuel. Le volume
transféré n'est pas le volume retenu : le spool est évincé après checkpoint
vérifié et les historiques PRA restent hors Supabase. Aucun tarif d'archivage
externe non configuré n'est inventé.

## Numérique et provenance

Un quantile commun au pilote et au national différait de 4,34e-19 mm, au point de
changer un dernier bit float32. L'import immuable a correctement rejeté la
collision. Le passage national vérifie désormais sources, géographie, masque et
équivalence des séries (écart maximal réel 4,26e-14), puis réutilise exactement les
73 séries validées. Aucune référence déjà publiée n'a été écrasée.

Release : `era5land-pra1991-2020-0919-1018-v1-479b2159dcce2b97`.
Les reçus, SHA256, requêtes et versions logicielles sont dans evidence/ ; les
NetCDF et historiques restent sous work/task21, hors Postgres et Supabase Storage.
Le workspace est éphémère : aucun archivage externe durable n'est prétendu.
Le chemin de livraison /codex n'est pas accessible en écriture sur cette instance ;
les preuves sont conservées dans le dépôt et les résultats utiles dans DEV.

Voir METHOD.md, SCHEMA.md et RUNBOOK.md pour les définitions et commandes.
