# Exécution

Depuis la racine, dépendances verrouillées inchangées :

```sh
PYTHONPATH=engine/src python scripts/national_daily_climate.py --pilot --from 2026-10-19 --to 2026-10-20 --max-days 2
```

Par défaut, dry-run hors réseau : il ne prétend pas vérifier la disponibilité et marque `anchor_verified=false`. `--execute` n'accepte que le projet DEV `yyfbpecxvxglzxopsmel.supabase.co`. Le pilote fixe inclut 28341 (complète), 06245 (partielle) et Crozon 29102. Aucun lot RPG ni climatologie 1991–2020 ne peut être demandé par cet adaptateur.

Workflow existant `pra-climate.yml` : mode `national-daily`, `daily_pilot=true`, dates explicites et `execute=true` pour le pilote. Après sa validation, `daily_pilot=false`, `daily_downloads=64`, une journée d'abord. Ne pas lancer deux workflows simultanés. Même groupe de concurrence que les anciens lots, CDS séquentiel. Le mode planifié est enregistré mais exclu par la condition dispatch-only ; son activation exige une décision de recette DEV et une nouvelle revue. Aucun traitement national de production autorisé.

Bornes : 3 dates par défaut (7 maximum), rattrapage 14 jours ; backlog plus ancien refusé sans plage explicite ; 1–64 tuiles nouvelles, 128 invocations CDS maximum, 240 s par invocation, 1320 s de travail, 23 min timeout externe et job 30 min, espace d'adressage 4 Gio, fichier source 16 Mio, charge utile source cumulée 128 Mio, quota workspace 448 Mio. Les retries HTTP/persistance existants restent bornés ; les octets réseau retransmis par le SDK ne sont pas un compteur réseau mesuré.

Les artefacts compacts (tiles avec SHA, batches et outputs immuables, state et run.json) sont conservés 7 jours même en échec. Reprise automatique du dernier artefact de cette branche parmi 20 runs, ou `checkpoint_run_id`. Le cache source brut n'est pas transporté. Si l'artefact a expiré, aucune présence de cache n'est supposée ; la preuve de persistance DEV évite de republier les PRA acquises.

La première tentative locale a été interrompue proprement conformément à la consigne utilisateur : 103,433 s, acquisition 81,402 s, 2 appels CDS, 57171 octets source, zéro écriture. Son unique tuile compacte reste dans le workspace. Ne pas relancer l'acquisition nationale depuis cet environnement ; les exécutions suivantes utilisent les runners GitHub.
