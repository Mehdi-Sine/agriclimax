# Stockage et sécurité

`pra_climatology_releases` porte une fois la période 1991–2020, la règle, la
version géographique et la provenance. `pra_climatology_support` impose une FK
vers la géographie exacte ; `pra_climatology_normals` stocke seulement PRA,
période, variable, normale, p10/médiane/p90 et nombre d'années. Les quatre codes
sont Tmin, Tmax, Tmean, pluie. Un n<30 impose quatre statistiques NULL.

Les sources horaires et les historiques PRA par année restent hors Postgres.
Les anomalies sont des différences calculées à la lecture, pas un second
stockage de toutes les valeurs. Pas de combinaisons systématiques de fenêtres,
paramètres ou productions dans la base.

Le stockage JSONB `pra_reference_statistics` existant reste vide et inchangé :
il était conçu pour des indicateurs calendaires clairsemés, avec de longues
clés et sans fenêtres explicites. Le nouveau stockage compact évite de multiplier
ces clés et la provenance JSONB à chaque statistique nationale.

RLS activée et forcée sur les trois relations. Politiques uniquement service_role,
droits SELECT/INSERT seulement, RPC SECURITY INVOKER, search_path pg_catalog,
limites de lignes/dates/octets et timeout. Aucune fonction SECURITY DEFINER.
Les rôles anon/authenticated/PUBLIC n'ont ni lecture ni écriture ni EXECUTE.
Une collision de release ou de valeur est rejetée, jamais écrasée.

Les lectures choisissent la release et l'édition actuelle explicitement. Référence
absente : normale/anomalie NULL ; actuel absent : actuel/anomalie NULL. Un zéro
réel reste un zéro. P10/p90 n'autorisent aucune interpolation de rang percentile
supposant une loi normale ; les rangs empiriques nécessitent le cache annuel PRA.
Le RPC laisse donc ce rang absent et l'explicite. Les exports portent le rang
empirique calculé avec les 30 vraies années homologues.

Les projections incluent tables et index, une marge de 50 %, le stockage de la
fenêtre actuelle conservé et une réserve de croissance de 30 Mo, sous 375 Mo.
Le test de capacité utilise des lignes synthétiques clairement étiquetées,
annulées par ROLLBACK ; les mesures finales portent sur les vrais agrégats.
Tarif vérifié : organisation en Free, limite de base 500 Mo ; aucun stockage
payant ou nouvelle capacité n'est commandé. Hors Supabase, le spool est borné ;
le coût d'un futur archivage objet dépend du fournisseur choisi et n'est pas inventé.
