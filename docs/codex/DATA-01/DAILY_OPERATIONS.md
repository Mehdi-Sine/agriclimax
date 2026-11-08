# Exploitation quotidienne

## Chaîne unique et états

Le workflow `pra-climate.yml` reste le propriétaire de la chaîne nationale. Aucun
nouveau cron ni service n'est ajouté. Les modes existants et leurs limites restent
applicables. La supervision DATA-01 est raccordée au job health existant, en lecture
seule, avec conservation du reçu dans l'artefact daily-monitoring.

1. Lire les catalogues et les reçus ; déterminer le dernier cycle valide.
2. Chercher la première lacune après l'ancre legacy dans les dates Storage ; sinon avancer vers la prochaine journée, sous le plafond conservateur J−6.
3. Découvrir les runs météo disponibles via les métadonnées existantes. L'absence de clé / l'erreur réseau est un échec, pas une absence de livraison.
4. Réutiliser les tuiles et ranges vérifiés ; acquérir uniquement les éléments manquants dans les bornes existantes.
5. Agréger par PRA avec les mêmes poids et opérateurs ; contrôler 713 identités officielles, variables, UTC et supports.
6. Restituer les enveloppes et vérifier les empreintes avant tout pointeur ; calculer les produits compatibles une fois par identité.
7. Conserver les journées et supports immuables, les preuves puis les révisions d'index ; publier le pointeur courant vérifié.
8. Exécuter les gardes de fraîcheur, continuité, supports et CORE-01 ; préparer le dossier factuel daté pour le futur Journal.

`next_day` répare un trou avant d'avancer après la date maximale. Une période dont
les deux séries de précision ne couvrent pas intégralement les dates reste
incomplète : le planificateur ne la masque pas par une fusion de catalogues.
L'ancre RPC est lue, mais n'autorise pas une réacquisition des jours legacy.

## Distinction des diagnostics

- `waiting_for_provider_window` : rien à tenter selon le plafond conservateur ; **ne prouve pas** que CDS n'a rien publié.
- `not_yet_available_by_conservative_publication_ceiling` : date explicite trop récente ; zéro acquisition.
- `within_conservative_reanalysis_window` : dernier jour archivé sous sept jours et calendrier continu ; **ne certifie pas** la disponibilité fournisseur.
- `stale` : retard > sept jours ; alerte, même si HTTP répond correctement.
- `error` : absence d'archives ou trou de calendrier ; alerte.
- `failed_previous_publication_preserved` : acquisition / agrégation / intégrité interrompue ; garder les checkpoints et l'ancien current.

La fraîcheur historique et les prévisions ont leurs dates distinctes. Les 67 PRA
partielles ne sont pas une panne nationale ; une perte de leur preuve descriptive
est cependant une régression de qualité à signaler. Les 645 PRA complètes ne sont
pas remplacées par une estimation. Crozon peut rester indisponible.

## Commandes sûres dans cette session

```bash
PYTHONPATH=engine/src:scripts python scripts/data01_daily.py
PYTHONPATH=engine/src:scripts python scripts/era5_archive_daily.py --execute --replay-latest --root work/data01/replay
PYTHONPATH=engine/src:scripts python scripts/national_weather.py --mode replay --run-date 2026-11-07 --execute --root work/data01/weather-replay
python scripts/core01_monitor.py docs/codex/CORE-01/evidence/validation.json --baseline docs/codex/CORE-01/evidence/validation.json
```

Ces commandes ne publient rien. `--execute` du rejeu signifie lecture et validation,
pas autorisation d'écrire. La garde `read_only=True` interdit les mutations.

## Reprise DEV après autorisation distincte

Les commandes suivantes sont préparées, **non exécutées avec publication** :

```bash
# Acquisition bornée et checkpoints locaux ; pas de publication sans le dernier flag.
PYTHONPATH=engine/src:scripts python scripts/era5_archive_daily.py --execute --root work/data01/dev --max-downloads 4
# Après interruption, mêmes identité/date/dataset/checkpoints ; ne pas vider le dossier.
PYTHONPATH=engine/src:scripts python scripts/era5_archive_daily.py --execute --resume --root work/data01/dev --max-downloads 4
# Publication / réparation exclusivement après autorisation explicite sur le DEV identifié.
PYTHONPATH=engine/src:scripts python scripts/era5_archive_daily.py --execute --replay-latest --publish-dev --root work/data01/dev-repair
```

La dernière commande vérifie l'archive publiée avant de réparer le pointeur et sa
révision. Elle ne recrée pas les données. Pour publier une nouvelle journée vérifiée,
reprendre le writer avec `--publish-dev` seulement dans le pilote autorisé. Le mode
national exige en outre `--national-authorized` dans le workflow. Aucune commande de
production ne doit être déduite du nom du secret disponible dans l'environnement.

Le test de publication atomique est effectué avec transport mémoire et injections
de panne ; ce n'est pas un pilote distant. Les cas réseau tronqué, téléchargement
échoué, interruption, reprise et rejeu ont des tests existants réutilisés. Le pilote
réel présent est celui des **lectures et calculs**, pas d'une acquisition nouvelle
ou d'une mutation DEV. Aucun token ne doit apparaître dans les arguments / reçus.
