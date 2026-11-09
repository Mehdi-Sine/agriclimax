# Fenêtre nocturne

Un propriétaire : `.github/workflows/operational-journal.yml`, activé par
`AGRICLIMAX_NIGHTLY_ENABLED=true`, arrêté par `AGRICLIMAX_NIGHTLY_KILL_SWITCH=true`.
Tous les cron utilisent `timezone: Europe/Paris` (documentation GitHub vérifiée).
Actionlint passe en v1.7.12, version et checksum officiels épinglés.

| Paris | Étape |
|---|---|
| 02:15, 02:45, 03:15, 03:45, 04:15, 04:45, 05:15 | Réclamation atomique des seules sources exigibles ; budget et cooldown par source |
| 05:40 | Sélection des archives acquises avant cutoff ; T33/Almanach/T34 ; gel immuable ; génération uniquement ensuite |
| 06:30, 06:45, 07:00 | Supervision de la disponibilité, archive, publication, coût et diagnostics |

Les adaptateurs existants restent propriétaires de leurs méthodes scientifiques.
Forecast : découverte des cycles, vérification du catalogue avant acquisition,
aucun téléchargement/calcul si cycle déjà archivé. ERA5 : `next_day`, archives et
checkpoints existants ; aucun impératif J−1. Stations : chaîne quotidienne existante ; observations horaires : adaptateur
`ingest_weather --product observations` distinct, avec son propre bail et cooldown.
T34 : collecte bornée, archive documentaire dans le checkpoint.

Un bail partagé sérialise les deux écrivains du catalogue météo/ERA5. Stations et
veille ont leurs propres identités. Chaque écriture Storage T36 vérifie encore le
bail. Checkpoints compacts Actions conservés 3 jours, logs 21 jours ; pas de nouveaux
serveurs. Les pilotes manuels historiques cèdent leurs écritures quand T36 est actif.

Limites : les calculs restent à la granularité de l’adaptateur national, pas une
réduction différentielle par PRA. Aucun avancement automatique de la rédaction
avant 05:40 n’est livré. Le temps d’installation des dépendances et les retards
GitHub restent à mesurer sur plusieurs nuits. La cible 06:30 n’est pas une garantie.
