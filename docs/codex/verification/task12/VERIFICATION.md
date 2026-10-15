# Task 12 — vérification

## État

**Task 12 mergée dans `main` ; validation réelle ERA5-Land et persistance DEV réussies.**

La [PR #28](https://github.com/Mehdi-Sine/agriclimax/pull/28) a été mergée le
15 octobre 2026, commit `ccbf4805bf07f5b3ed3590d8e9c3ca92d51a51c3`.
Les validations GitHub Actions postérieures à la rédaction initiale ont levé
les blocages CDS et persistance DEV décrits alors. L'exemple JSON livré reste
explicitement fictif et purement numérique.

## Contrôles initiaux de base et Task 11 (historique)

Main GitHub confirmé `6c77faf4cf5d80508cbb34ce7e776d9230508f87` puis fetch Git
réussi avec le credential helper de `gh`, sans extraction de token. Worktree neuf
sur ce commit et identité locale demandée configurée immédiatement.

Avant code : source quotidienne Météo-France Brest 14 octobre 2026, dry-run réel,
complete, six valeurs, pas d'écriture ; catalogue Supabase HTTP 200 ; endpoints
Next locaux `/api/weather/stations?mode=live_meteofrance` HTTP 200, cinq stations,
et `/api/weather/series` Brest 1–30 septembre HTTP 200, trente lots.
SQL distant : 185 lots archive + cinq lots horaires ; aucune duplication ajoutée.
Le cron quotidien est présent dans main ; activation et secrets Actions non
attestés par cette tâche, aucun dispatch ni activation effectué.

## Validation locale initiale (historique)

- Python : **74 tests**, dont onze nouveaux cas climatologiques, sans skip.
- Contrats V1 et automation : PASS ; aucun contrat partagé modifié.
- Ruff nouveaux modules/tests/CLI et mypy strict : PASS.
- `make check` : PASS, incluant Python, 127 tests web, contrats, guards,
  lint, typecheck, build et contrôle de l'exception sécurité héritée.
- SQL jetable PostGIS `public` et `extensions` : PASS ; migration additive,
  RLS/grants, refus demo/unités incompatibles, idempotence et collision de clé.
  Aucun seed synthétique exécuté sur DEV.
- Audits Python moteur/outillage et nouvelle chaîne climatologique : zéro
  vulnérabilité connue ; audit navigateur : zéro ; JS : seule exception héritée
  GHSA-vfj7-8cjw-p6xm, braces 3.0.3 dev, aucun chemin production.
- Guard bundle et scan des valeurs de secrets serveur : PASS (30 artefacts).
  Budget JS/CSS gzip inchangé : 565 472 octets, limite 2 097 152.
- Gitleaks : historique et diff préparé PASS, sorties expurgées. Le premier scan
  de répertoire a retrouvé le SHA de blob déjà exclu par fingerprint historique
  (Task 04), pas un credential ; le scan Git conserve cette exclusion exacte.
- Migrations forward-only contre origin/main et `git diff --check` : PASS.

Les tests NetCDF utilisent des fichiers **synthétiques locaux**, sans source
scientifique supposée correcte parce qu'elle est dans une fixture. Le cas pluie
construit des cumuls horaires croissants et un cumul de J+1 distinct ; il vérifie
24 mm au lieu d'une somme incorrecte. Les cas thermiques vérifient 24 horaires,
min/max/moyenne et refus de moyenne si un horaire manque. Autres cas : quantiles
connus, égalités/rank, nulls, probabilités invalides, couverture insuffisante,
doublons, mauvaise unité, reprise/corruption, classement d'une période homologue,
CLI d'export Task 11 et résultat identique au rejeu.

Le runtime émet un warning binaire NumPy/netCDF4 et des dépréciations de shape
NumPy 2.5 ; les lectures/écritures et valeurs sont vérifiées, aucun warning
masqué. Une matrice de compatibilité plus large reste à établir.

## Validation réelle ERA5-Land via GitHub Actions

Le [workflow Task12 ERA5 real validation, run 38743428978](https://github.com/Mehdi-Sine/agriclimax/actions/runs/38743428978)
est vert, y compris les étapes de persistance réelle, replay/idempotence,
publication des artefacts et tests climatologiques.

- Accès réel Copernicus CDS avec le secret serveur `CDSAPI_KEY` : réussi.
- Téléchargement réel ERA5-Land et format NetCDF réel vérifiés : variables
  `t2m`, `tp` et grille latitude/longitude.
- Full smoke test réel sur la bbox continentale
  `(-1.8, 48.0, -1.4, 48.3)`, du 1 au 3 septembre 1991, snapshot
  `cds-snapshot-2026-10-15` : réussi.
- Persistance réelle dans Supabase DEV via `--persist-supabase` : réussie.
- Rejeu des mêmes entrées et idempotence : réussis ; le workflow vérifie
  explicitement `changed == 0` au replay.
- Tests climatologiques : verts.

Les checks de la PR #28 avant merge sont verts :
[Quality](https://github.com/Mehdi-Sine/agriclimax/actions/runs/38743428939),
[Security audits](https://github.com/Mehdi-Sine/agriclimax/actions/runs/38743428937),
[Vercel](https://vercel.com/mehdi-sines-projects/agriclimax/F8pbKZK5uaXwCsaWt8cSb52TYSSq)
et Task12 ERA5 real validation.

La tentative initiale autour de Brest s'était arrêtée faute d'accès CDS et de
clé configurés dans son environnement. Le fichier `era5-real-attempt.log`
conserve cette preuve historique ; il ne décrit plus l'état d'acceptation actuel.
Les tests NetCDF synthétiques locaux ci-dessus restent distincts de la validation
sur fichiers réellement téléchargés dans Actions.

## Contexte d'outillage initial (historique)

Le changelog Supabase demandé par la compétence a répondu 403 (domaine non
accessible) ; documentation Supabase consultée via son outil `search_docs`.
La migration CLI a été générée via Supabase 2.120.0 avec SUPABASE_HOME dans work,
pas en écrivant dans le répertoire personnel. Les premiers échecs de runtime
(pnpm 11, caches personnels, socket Docker sans permission réseau) ont été
résolus par pnpm 10 local, caches de travail et contexte réseau de commande.

## Limites scientifiques et suites hors smoke test

La période de référence déclarée reste 1991–2020 avec un minimum de 30 années.
Le smoke test de trois jours de 1991 valide la chaîne technique réelle ; il ne
constitue pas une normale climatique sur trente ans ni un backfill complet.

- Alimenter les années homologues suffisantes avant de produire une normale et
  un exemple climatologique réel représentatif.
- Valider la comparaison station/grille et harmoniser les fenêtres quotidiennes,
  puis effectuer la revue scientifique avant tout usage agronomique. La validation
  technique ne confère pas le statut scientifique « validé » aux résultats.
- Définir RH/ET0 si nécessaires, stockage objet durable, rétention, accès de
  lecture borné et jointure territoriale ; aucune autre Task commencée ici.

Cette mise à jour post-merge est documentaire : aucune nouvelle acquisition,
écriture DEV, migration ou exécution manuelle de workflow n'est effectuée.
