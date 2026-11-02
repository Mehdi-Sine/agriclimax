# Stockage Task22

Mesures en Mo décimaux. Base DEV initiale : **88,987315 Mo**, Task21 conservée.
Task21 n'a **aucune anomalie persistée**. Ses 88 412 lignes scalaires prennent
6,635520 Mo de heap et 6,053888 Mo d'index (12,730368 Mo avec index/FSM).
Les quatre statistiques disponibles (normale/p10/médiane/p90) représentent
1,279680 Mo de valeurs utiles ; les comptes, 0,176824 Mo. Le reste du heap est
constitué des identifiants, clés calendaires, en-têtes MVCC, bitmap NULL,
alignement et espace de page : ces octets ne sont pas attribuables sans ambiguïté
à une seule colonne. Provenance immuable : **981 octets** ; releases/support et
leurs index : 0,311296 Mo. Diagnostics PRA préexistants : **0,385024 Mo**, aucune
création de diagnostic systématique Task22. Qualité des normales : comptes par
variable et règles mutualisées, pas de JSON répétitif.

La projection annoncée **358,62 Mo** n'est pas un volume de seules normales :
239,863025 Mo = projection annuelle de 713 × 379 × 4 scalaires à
147,939217 octets/ligne **avec marge 50 %**, plus environ 75,68 Mo de base
initiale, 13,079602 Mo pour la fenêtre Task21 conservée et 30 Mo de réserve.
Les 379 périodes préparées incluaient 366 jours, 12 mois et une année ; Task22
requiert les seules normales journalières. Le gate initial documentait
358,568790 Mo avant les dernières variations de taille de base. Les 52 Ko
d'écart n'ont pas d'incidence sur le choix. Les anomalies ne sont pas la cause.

## Modèle retenu et budget préalable

`pra_climatology_daily` : une ligne PRA × jour, quatre `real`, quatre comptes
`smallint`, un jour `smallint`, release integer, PRA text ; une seule clé primaire
(release, PRA, jour), qui couvre aussi la FK support. Aucun index supplémentaire,
quantile, anomalie ou JSON par ligne. Provenance et géographie réutilisent les
tables releases/support Task21. L'ancien schéma et ses données restent intacts.

Mesure locale PostgreSQL 17 (PGlite 0.3.14), sur les **85 560 vraies normales
quotidiennes Task21**, regroupées en **21 390 lignes** : heap **1 449 984 octets**,
index **671 744**, total **2 154 496**, soit **100,724451 octets/PRA/jour**.
Projection : 260 245 lignes pour 365 jours, **260 958** pour les 366 positions
calendaires ; **26,284852 Mo** supplémentaires. Base totale projetée :
**159,414592 Mo**, en conservant Task21, avec 50 % de marge sur l'ajout,
30 Mo de réserve et 1 Mo de métadonnées. L'ancien modèle est écarté.
La même mesure est confirmée octet pour octet par PostgreSQL 17 natif
(`native-budget.json`). Voir `storage-budget.json` et le script reproductible.

## Sécurité et reprise

Migration additive créée avec le CLI 2.75.0. RLS activée et forcée, SELECT/INSERT
service_role seulement, fonctions SECURITY INVOKER, search_path pg_catalog,
timeouts, limites de lots et de dates, collision immuable rejetée. Aucun nouveau
droit PUBLIC/anon/authenticated. Les avertissements historiques PostGIS et
anciennes RPC existaient avant Task22 ; aucune modification de ces objets.
Une seconde migration forward-only ajoute le garde réel par lot : taille de base
+ 1 Mo de marge pour le lot doit rester sous 375 Mo, sinon l'import s'arrête.

NetCDF, checkpoints PRA, manifest et cache restent sous `work/task22`, hors
PostgreSQL et Supabase Storage. Spool brut limité à 2 Gio, trois acquisitions,
download sérialisé, SHA256 avant réduction et éviction. Ce workspace est
éphémère ; aucun archivage externe durable n'est prétendu. Les 30 jours Task21
proviennent des agrégats SQL publiés, sans recalcul ni nouvel achat de stockage.

## Mesure finale réelle

Après import et replay : **115 488 435 octets de base totale (115,49 Mo)**.
La table annuelle représente **17 620 992 octets de heap**, son index primaire
**8 241 152**, total avec pages auxiliaires **25 903 104 octets**.
Les 260 958 lignes et 1 043 832 scalaires/comptes correspondent au cache binaire ;
aucune anomalie persistée. Le résultat est inférieur à la projection de
159,4 Mo incluant marges et réserves. Les caches sont restés hors Supabase.
Une migration finale fixe uniquement la précision de sortie JSON de la RPC
pour préserver les valeurs float32 et permettre de reproduire l'anomalie lue.
