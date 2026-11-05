# Exécution

Depuis la racine, dépendances verrouillées inchangées :

```sh
PYTHONPATH=engine/src python scripts/national_daily_climate.py --pilot --from 2026-10-19 --to 2026-10-20 --max-days 2
```

Par défaut, dry-run hors réseau : il ne prétend pas vérifier la disponibilité et marque `anchor_verified=false`. `--execute` n'accepte que le projet DEV `yyfbpecxvxglzxopsmel.supabase.co`. Le pilote fixe inclut 28341 (complète), 06245 (partielle) et Crozon 29102. Aucun lot RPG ni climatologie 1991–2020 ne peut être demandé par cet adaptateur.

Workflow existant `pra-climate.yml` : mode `daily-pilot`, dates explicites et `execute=true` pour le pilote. Après sa validation, mode `national-daily`, `daily_downloads=64`, une journée d'abord. Ne pas lancer deux workflows simultanés. Même groupe de concurrence que les anciens lots, CDS séquentiel. Le mode planifié est enregistré mais exclu par la condition dispatch-only ; son activation exige une décision de recette DEV et une nouvelle revue. Aucun traitement national de production autorisé.

Bornes : 3 dates par défaut (7 maximum), rattrapage 14 jours ; backlog plus ancien refusé sans plage explicite ; 1–64 emprises source nouvelles (blocs 2° ou sous-tuiles 1° manquantes), 128 invocations CDS maximum, 240 s par invocation, 1320 s de travail, 23 min timeout externe et job 30 min, espace d'adressage 4 Gio, fichier source 16 Mio, charge utile source cumulée 128 Mio, quota workspace 448 Mio. Les retries HTTP/persistance existants restent bornés ; les octets réseau retransmis par le SDK ne sont pas un compteur réseau mesuré.

Les dix entrées du dispatch sont validées par Actionlint. La source nationale est figée par le mode ; la révision explicite reste obligatoire dans le mode batch historique.

Les artefacts compacts (tiles avec SHA, batches et outputs immuables, state et run.json) sont conservés 7 jours même en échec. Reprise automatique du dernier artefact de cette branche parmi 20 runs, ou `checkpoint_run_id`. Le cache source brut n'est pas transporté. Si l'artefact a expiré, aucune présence de cache n'est supposée ; la preuve de persistance DEV évite de republier les PRA acquises.

La première tentative locale a été interrompue proprement conformément à la consigne utilisateur : 103,433 s, acquisition 81,402 s, 2 appels CDS, 57171 octets source, zéro écriture. Son unique tuile compacte reste dans le workspace. Ne pas relancer l'acquisition nationale depuis cet environnement ; les exécutions suivantes utilisent les runners GitHub.


## Exécutions réelles

- Pilote GitHub [42039017875](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42039017875) : deux journées × trois PRA, succès ; 333,893 s dont 300,258 s d'acquisition, 3,969 s de persistance, 14,177 s de lecture et 15,488 s de calcul/cache/contrôle. 9 appels CDS, 466485 octets de charge utile. Le compteur brut initial classait Crozon `partial` comme le schéma SQL ; la projection via comptes natifs distingue bien 1 complète / 1 partielle / 1 indisponible par jour.
- Premier national [42040512578](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42040512578) : arrêt borné après 1319,101 s ; 30 appels CDS, 1686605 octets, 68 PRA persistées, checkpoints conservés. Acquisition 1266,102 s, persistance 30,664 s, lecture 2,254 s, reste calcul/cache/contrôle 20,082 s.
- Reprise [42043749342](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42043749342) : arrêt de validation/source après 102,952 s et deux acquisitions (86769 octets), zéro nouvelle écriture. Les rapports suivants portent un code/stade d'échec explicite. La reprise des blocs amorcés ne redemande désormais que les sous-tuiles absentes.

Les mesures des reçus JSON sont conservées ; seules les listes détaillées de lots sont remplacées dans Git par leur compte et empreinte (originaux complets dans les artefacts et le workspace) ; aucun échec n'est transformé en succès. Une proposition d'augmentation du délai a été rejetée par le contrôle automatique ; le plafond de 22 minutes reste inchangé, avec reprise des seuls éléments manquants.


Pour la validation de valeurs (lecture seule), après téléchargement du dernier artefact compact :

```sh
PYTHONPATH=engine/src:scripts python tests/e2e/task26-verify-values.py --date 2026-10-19 --checkpoints work/runner-final --base http://127.0.0.1:3031 --output docs/codex/task26/values-preview.json
PLAYWRIGHT_MODULE_PATH=/chemin/vers/playwright TASK26_BASE_URL=http://127.0.0.1:3031 TASK26_ARTIFACTS=docs/codex/task26/preview node tests/e2e/task26-real.mjs
```

Le module Playwright réutilisé est la version verrouillée 1.62.1 ; Chromium système peut être sélectionné par `CHROMIUM_EXECUTABLE_PATH`. L'accès distant passe par `task26-preview-gateway.py` avec l'origine Preview exacte et le secret de bypass en environnement, jamais dans les fichiers ou le navigateur.


## Publication et rejeu

[42045716625](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42045716625) a fini l'acquisition et s'est arrêté à 1320,000 s après une partie de la persistance : acquisition 1263,280 s, persistance 16,161 s, agrégation instrumentée 0,00486 s, 32 appels CDS / 2163023 octets. [42048394950](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42048394950) a terminé en **168,522 s**, **zéro acquisition**, avec **127,481 s de persistance** et **0,06518 s d'agrégation**. Les deux passages instrumentés couvrent 645 lots ; les premiers 68 n'avaient pas encore ce chronomètre distinct. Le reste du temps comprend lecture des caches, décodage, référence et contrôles ; il n'est pas présenté comme temps de calcul pur.

Le rejeu [42050446210](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42050446210) réussit en **26,464 s**, sans téléchargement, calcul de nouveau lot ou écriture. Les dates d'acquisition et de calcul restent celles de la publication initiale. Les rapports et `workflow-consumption.json` distinguent temps programme, runner, queue et estimation financière.
