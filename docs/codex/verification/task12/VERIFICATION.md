# Task 12 — vérification

## État

**Implémentation préparée et testée ; acceptation réelle ERA5-Land incomplète.**
Aucun backfill ERA5-Land réel ni anomalie calculée à partir de données ERA5-Land
réellement acquises n'est revendiqué. Aucune migration ou donnée Task 12 écrite
sur DEV. L'exemple JSON livré est explicitement fictif et purement numérique.

## Contrôles de base et Task 11

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

## Validation locale

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

## Tentative réelle ERA5-Land et blocage

Commande exécutée sur une petite bbox autour de Brest, 1–3 septembre 1991,
période de référence déclarée 1991–2020/minimum 30, snapshot explicite. Sortie
contrôlée exit 1, sans clé ni corps upstream. `CDSAPI_KEY` et `CDSAPI_URL` absentes ;
le provider utilise une URL CDS fixe et ne requiert donc que la clé.
L'hôte CDS et ses hôtes de téléchargement ne figurent pas dans la liste réseau
configurée. Aucun contournement du proxy, récupération de clé dans le chat ou
remplacement par une fixture effectué. Configuration demandée pendant le travail.

Pour lever le blocage : autoriser `cds.climate.copernicus.eu` et les hôtes de
fichiers réellement retournés ; lier `CDSAPI_KEY` comme secret ; accepter la
licence `reanalysis-era5-land` dans le compte CDS. Confirmer format NetCDF réel,
variables/dimensions, licence et version reçues. Ensuite seulement : acquisition,
normalisation, test de rejeu et persistance réelle ; comparer à l'export quotidien
Météo-France avec l'association point/station explicitement documentée.

Le changelog Supabase demandé par la compétence a répondu 403 (domaine non
accessible) ; documentation Supabase consultée via son outil `search_docs`.
La migration CLI a été générée via Supabase 2.120.0 avec SUPABASE_HOME dans work,
pas en écrivant dans le répertoire personnel. Les premiers échecs de runtime
(pnpm 11, caches personnels, socket Docker sans permission réseau) ont été
résolus par pnpm 10 local, caches de travail et contexte réseau de commande.

## Prochaines étapes pour achever l'acceptation

1. Configurer l'accès CDS puis valider le vrai format source. Le décodeur refuse
   actuellement ZIP et dimensions non prévues : adapter explicitement si nécessaire.
2. Acquérir une petite série France réelle, vérifier unités/horaires/checksums,
   puis tester SQL réel et replay avant application de la migration à DEV.
3. Alimenter des années homologues suffisantes pour une normale (pas déduire une
   normale 1991–2020 depuis trois jours d'une seule année). Exporter exemple réel.
4. Valider la comparaison station/grille et harmoniser les fenêtres quotidiennes,
   puis revue scientifique avant tout usage agronomique. Aucun résultat validé.
5. Définir RH/ET0 si nécessaires, stockage objet durable, rétention, accès de
   lecture borné et jointure territoriale ; aucune autre Task commencée ici.
