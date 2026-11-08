# Recette DATA-01

## Verdict

**Récupération et lecture de trente jours réels validées pour 645 PRA ; fondation
quotidienne renforcée, activation automatique et engagement 06:30 non qualifiés.**
Aucune écriture distante, aucune acquisition nationale nouvelle, aucun changement
de calendrier actif, aucune rédaction IA ni merge. Les obstacles restants sont
explicitement séparés des validations acquises.

## Données réelles

- Trente dates legacy réellement lues, 21 390 lignes ; identités et versions prouvées par 21 390 correspondances SHA256 de batch.
- Cinq blobs Storage vérifiés et enveloppes relues ; 14 jours récents accessibles.
- 8 556 lignes communes comparées ; divergences de précision conservées et séries séparées, pas de concaténation silencieuse.
- Fenêtres 1/7/14/30 jours legacy passées par `wheatHistory`, dix indicateurs × 713 PRA, 645 valeurs natives complètes chaque fois.
- API agroclimatique par défaut : Tmoy sur 01–30/10, 713 résultats, 645 natifs complets.
- Températures, pluie cumulée, degrés-jours, jours chauds/gelés, fortes pluies, jours secs et séquences : 6 450 résultats de trente jours revérifiés indépendamment en Python à partir des exports RPC. Erreur maximale 1,71e−13.
- PRA partielles : 67 valeurs descriptives conservées sur 02–08/10 pour Tmoy, degrés-jours et pluie, via les supports CORE-01 existants. Absence de support le 01/10 : pas de résultat descriptif complet artificiel sur 30 jours. Crozon reste indisponible.
- Rejeu ERA5 01/11 : 713 lignes, zéro acquisition / écriture ; dernier cycle prévisionnel 07/11 relu et réencodé octet pour octet, 49 910 lignes source, 32 085 sélectionnées, 713 PRA.
- Températures et pluie prévisionnelles : 713/713 disponibles pour les jours sélectionnés du cycle testé ; humidité variable selon le jour (88 à 692/713 dans le reçu complet). Ce n'est pas une preuve de supports territoriaux tous complets ni une observation J−1.

Les données récupérées sont conservées avec reçus dans `evidence/legacy` et dans le
bootstrap serveur versionné. `MANIFEST.sha256` vérifie les preuves livrées. Le
produit calculé compressé est restitué sans perte et possède un oracle indépendant.
Aucune fixture n'est présentée comme validation opérationnelle.

## Fiabilité et limites d'exécution

Les tests de panne couvrent téléchargement tronqué/échoué, budgets, interruption,
reprise, rejeu, identité de checkpoints, publication, pointeur préservé et heure
Paris aux deux changements de saison. Les tests de publication utilisent un
transport mémoire : ils ne prouvent pas une écriture atomique sur un DEV distant.
La supervision réelle est exécutée : dernier ERA5 au 01/11, retard sept jours,
aucune lacune Storage interne, disponibilité fournisseur non certifiée.

Le preflight actuel échoue avec `binding_absent` pour AROME/GetCapabilities : les
bindings météo AROME/ARPEGE ne figurent pas dans les capacités disponibles. Il ne
s'agit pas d'une preuve de non-livraison fournisseur. Les clés stations ne sont
pas substituées. Les variables GitHub ne sont pas lisibles (403). L'artefact
historique Task29 est catalogué mais son payload est refusé (403). Les journaux
Actions lus n'ont pas fourni de familles d'erreur interprétables dans la collecte
bornée ; les raisons exactes des anciens échecs ne sont pas inventées.

Aucune autorisation distincte d'écriture sur un DEV identifié n'a été fournie :
toutes les phases sans écriture ont été terminées et les commandes de reprise
sont dans DAILY_OPERATIONS. Le groupe de concurrence est indispensable ; pas de
verrou multi-auteurs extérieur aux Actions. Les index immuables et la réparation
sont préparés mais leur écriture distante reste à qualifier après autorisation.

## Compatibilité et performances

Aucune règle blé, contrat `climate-coverage-1`, interface du Journal ou donnée de
production n'est modifiée. Le lecteur historique commun, le cache par identité,
les manifestes et la supervision sont les seuls raccordements applicatifs.
La couverture de 645 valeurs modernes est conservée en sélectionnant d'abord la
série moderne dès qu'elle couvre toute la fenêtre. Les périodes mixtes restent
incomplètes. Les anciennes versions API gardent leur chemin existant.

Les mesures incluent fenêtres, temps, cache, réponse API et mémoire. Pic de recette
~1,16 Gio : supérieur aux ~500 Mo CORE-01 et comprenant la factorisation et sa
preuve de restitution. Ce lot doit rester côté batch. API trente jours ~4,03 Mo,
proche de 4 Mio ; pas de nouveau endpoint national massif. Voir RESOURCE_BUDGET
pour les hypothèses à 3/12/24 mois et les extrapolations non mesurées à 50/100 productions.

## Vérifications reproductibles

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
PYTHONPATH=engine/src:scripts python -m pytest engine/tests
MYPYPATH=engine/src:scripts python -m mypy --strict scripts/data01_daily.py scripts/data01_history.py scripts/data01_verify_product.py scripts/archive_legacy_pra_reads.py scripts/era5_archive_daily.py scripts/pra_weather_store.py
python scripts/check_contracts.py
python scripts/quality/check_automation.py
python scripts/quality/security.py
python scripts/quality/migrations.py
python scripts/quality/budget.py
NODE_USE_ENV_PROXY=1 DATA01_REAL=1 PRA_NATIONAL_ENABLED=1 pnpm --filter @agriclimax/web exec vitest run lib/server/data01.real.test.ts
PYTHONPATH=engine/src:scripts python scripts/data01_verify_product.py
```

Les reçus de contrôles sont consignés dans `evidence/checks.json` après exécution.
La CI de PR doit également terminer ; aucun statut distant vert n'est déduit des
seuls tests locaux. Aucun changement UI : une nouvelle recette responsive n'est
pas requise ; le cycle Journal/veille reste celui vérifié par CORE-01 et le rejeu réel.

## Avant T33

1. Revoir la séparation des précisions et la portée scientifique du bootstrap legacy.
2. Rétablir / autoriser les bindings météo, vérifier les variables GitHub et l'espace réellement libre.
3. Autoriser un DEV isolé, exécuter une nouvelle acquisition puis interruption/reprise et publication distante ; rejouer la supervision.
4. Mesurer sept nuits, marge de lancement et dates réellement livrées ; ne pas promettre 06:30 avec les retards observés actuellement.
5. Qualifier le produit compact quotidien, la rétention des éditions et les références de preuves ; geler EvidenceBundle avant la future rédaction IA.

La PR reste draft pour ces revues ; aucun merge automatique.
