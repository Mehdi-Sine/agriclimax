# État live DEV — lecture seule

Contrôle du 16 octobre 2026 via `agriclimax_read_daily(null,null)` : HTTP 200,
1505 ms, 281754 octets de réponse JSON (latest et selected inclus).
Dernière fenêtre : 2026-10-11 → 2026-10-13 inclus, étiquettes source UTC.
Calcul : 2026-10-16T13:48:14.270668+00:00. Cinq stations blé et cinq bovins.
Les jours météo ne sont pas du 16 : affichage stale, même si le calcul est récent.
La date du calcul n'est pas la date exacte de publication en base.

Le lecteur n'expose pas l'état du dernier run ; aucun succès du dernier run n'est
inféré. Une fenêtre historique absente reste absente ; seule une action explicite
permet de consulter la dernière publication réussie. Aucun polling de source,
backfill, écriture, suppression, migration ou déclenchement GitHub Actions daily.
La préservation d'une publication après panne est testée synthétiquement ; aucune
panne réelle n'a été provoquée. L'anomalie THI reste indisponible sans référence
homologue incluant l'humidité. Aucune interpolation ni couverture France continue.
