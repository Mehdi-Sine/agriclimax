> État courant du 18 octobre : [audit national à deux instants, limites structurelles et budget PostgreSQL recalibré](FINAL_SCIENTIFIC_STORAGE_REVIEW.md).
> Les résultats ci-dessous restent les preuves datées des étapes précédentes.

> État courant après réception de l’archive OFB/MASA :
> [intégration des 713 contours, poids, pilote réel et stockage](OFFICIAL_PRA_INTEGRATION.md).
> Les éléments ci-dessous décrivent les observations antérieures. La comparaison
> INRAE/OFB est désormais reproduite ; le contrôle administratif indépendant reste ouvert.

> Mise à jour du 17 octobre 2026 après réception des fichiers : voir
> [validation PRA INRAE / Agreste](PRA_INRAE_VALIDATION.md).
> Les 713 codes officiels concordent ; le 714e est Paris 75000.
> Les 17 238 lignes répètent 715 contours, dont un sans code non résolu.
> La comparaison avec les géométries ministérielles reste bloquée : NOT READY.
> Les relevés ci-dessous précèdent cette analyse et restent des preuves séparées.

# Vérification et critères d’acceptation — Task 19

**Recommandation : NOT READY. NATIONAL OPERATIONAL VALIDATION PENDING.**
La fondation est implémentée, mais le critère de référence officielle intégrée
n’est pas satisfait. Ne pas appliquer le label « CODE READY » tant que cet import
et le pilote réel sur PRA ne sont pas contrôlés. Le déploiement national 30 jours
nécessite ensuite une autorisation séparée et des mesures de couverture/coût.

Branche : `codex/19-national-coverage`. Base/tag v0.2.0 :
`8cb47998178cb68e244cadf456c5d57ebae9da53`. Identité Git Mehdi-Sine
<mehdi.sine@acta.asso.fr>. Un seul PR draft, aucun merge. SHA final et état CI
font foi dans les commits/checks du PR ; les preuves ci-dessous identifient leurs
sources et ne transforment pas un check vert en couverture nationale.

## Mesures réellement observées

| Contrôle | Résultat |
|---|---|
| Référence PRA officielle importée | **0**, téléchargement proxy 403 ; attendu documentaire 713 |
| Géométries officielles / hiérarchie / trous / Corse | non vérifiés sur l’export officiel |
| Pilote CDS réel | quatre petites zones, 1er octobre 2026 ; 36 cellules, 34 complètes |
| Agrégation du pilote | quatre boîtes géographiques, **non PRA** ; valeurs/manquants conservés |
| PRA avec météo/diagnostics validés | **0** ; aucune couverture nationale déclarée |
| Volume source du pilote | 143 114 octets, quatre fichiers ; horaires hors dépôt/DB |
| DB DEV avant / après développement local | 24 598 195 / 24 598 195 octets |
| Storage distant | 0 objet / 0 octet |
| Migration distante Task19 | **aucune**, aucune table pra_* distante présente |
| Stockage local synthétique 90 jours | 64 170 lignes, 29 696 000 octets table + index |
| Géométrie nationale / coût national / mémoire nationale | non mesurés |

Les deux cellules côtières incomplètes restent inconnues, jamais mises à zéro ni
interpolées. Les données du pilote ne sont pas une preuve d’application agricole
à une vraie PRA. L’état après développement local ne prédit pas les écritures
éventuelles du workflow historique Task12 déjà présent, qui checkout sa branche
historique et effectue un petit test DEV. Aucun nouveau workflow national lancé.

## Tests de code et staging local

- Suite Python : 167 tests (166 dans la passe complète puis un test de reprise datée ajouté), dont 23 nouveaux tests territoriaux (contrôles
  spatiaux, petites/multipart/coast/mountain/Corse, poids, champs incomplets,
  seuil avant espace, cumul pluie temporel, UTC/bissextile/DST, reprise et budget).
- Web : 219 tests passants, dont API territoriale et diagnostics : paramètres,
  pagination, source réanalyse distincte, nulls, valeurs complètes, erreurs privées,
  DTO minimaux sans payload ni provenance source brute.
- `make check`, lint, typage, build Next production et garde d’exception existante : PASS.
- Ruff et mypy strict du module et des scripts territoriaux : PASS.
- PostGIS jetable PG17 : dispositions extension `public` et `extensions` testées.
  Migration additive, import SQL généré synthétique rejoué, empreintes géométrie/
  poids, RLS forcée, grants, refus navigateur, invoker/timeouts, atomicité et rejeu.
  Diagnostics ajoutés sur une météo existante sans duplication des lignes climatiques.
- E2E `/territories` 1440/768/390 px : filtres URL, absence explicite, route station
  préservée, aucun débordement, aucune violation axe A/AA ciblée. **Mode déconnecté**,
  pas une validation d’affichage de vraies statistiques PRA ; captures identifiées.
- Scans source/bundle et valeurs de credentials dans les preuves : PASS.
- Actionlint du nouveau workflow et YAML/JSON : PASS.
- Audits dépendances geo ajoutés au job de sécurité ; état du dernier commit dans CI.

Les validations locales antérieures peuvent précéder les derniers ajustements de
journalisation ou de DTO ; la CI du dernier commit répète l’ensemble. Aucun échec
intermédiaire (proxy/pnpm de version différente, test de navigation trop précoce)
n’est présenté comme une validation réussie.

## Migrations / tables

Nouvelle migration : `20261017190818_pra_territorial_aggregation.sql`.
Appliquée **oui, seulement local jetable** ; DEV/production **non**.
Dix nouvelles tables privées : geo_versions, pra_regions, pra_departments,
pra_territories, pra_grid_weights, pra_batches, pra_daily,
pra_indicator_definitions, pra_diagnostics, pra_reference_statistics.
Aucune table existante modifiée ni donnée v0.2 purgée. Quatre nouvelles RPC privées
invoker. [Schéma et rollback](SCHEMA.md).

## Estimations, pas des mesures nationales

Budget 90 jours hypothétique : environ **334,3 MB** avec réserves explicites de
référence/mapping, provenance hebdomadaire et diagnostics sparse. `free_tier_fit_verified`
reste false. Un an sans rétention dépasse 500 MB. Voir [STORAGE.md](STORAGE.md) et
`evidence/storage-budget.json`. Une fois la vraie géométrie importée, recalculer
le plan et mesurer les tables/indexes, batches et croissance v0.2 avant go-live.
Aucun paiement, upgrade, nouveau service objet ou cron national activé.

## Impacts et limites

- Actions : nouvelle exécution manuelle bornée, reprise des tuiles compactes,
  concurrence 1, budget de téléchargement global ; pas d’acquisition nationale sur PR.
  Coût mensuel et quotas disponibles du compte à mesurer avant activation.
- Vercel : une page et deux routes agrégées, pas de bulk, DTO et pagination bornés.
  Preview du commit produit 999a8f7 : HTTP 200 sur /territories, absence de référentiel
  explicitement affichée ; en-tête d’automatisation limité à son origine, sans suivi
  de redirection ni valeur archivée. Voir evidence/preview.json.
  Build validé ; aucune configuration de production changée. L’interface station
  reste le comportement v0.2 ; la nouvelle sélection PRA est additive jusqu’au
  staging de référence et aux preuves réelles, pas une bascule primaire silencieuse.
- Météo-France n’est jamais diffusé spatialement comme un champ PRA. Les observations,
  réanalyse et démo restent distinctes. Pas de prévision ajoutée.
- Le blé reste exploratoire. THI grille non supporté : humidité absente et validation
  scientifique du support non réalisée. Aucun nouveau modèle ni seuil.
- Les résultats de plus de sept jours restent recomputables depuis les intermédiaires
  natifs ; ne pas concaténer des maxima de séquences pour inventer une séquence longue.
- La rétention est configurable mais **dry-run seulement** jusqu’à revue des dépendances,
  archive/recalcul et autorisation ; elle ne purge jamais les données historiques v0.2.
- Aucun appareil mobile physique, audit humain exhaustif, test de charge ou SLA déduit.

## Blocages avant READY FOR REVIEW

1. Autoriser les domaines de la source officielle dans le proxy, acquérir le vrai
   fichier, vérifier licence/date/champs/CRS, compte réel, codes, géométries, couverture
   et hiérarchie, puis archiver son checksum. Aucun substitut non officiel.
2. Valider la correspondance et le pilote climatique sur de **vraies PRA** contrastées,
   traiter explicitement les cellules côtières manquantes et les exclusions.
3. Mesurer le coût complet de la géographie, provenance, index et exécution ; confirmer
   le budget Free avec la croissance existante et préparer la rétention sans perte.
4. Faire le staging autorisé du référentiel et des lectures territoriales, puis tester
   les parcours PRA renseignés. Ne pas appliquer de migration de production automatiquement.
5. Pour déclarer la couverture opérationnelle nationale : autorisation dédiée du
   traitement réel 30 jours, ≥99 % de couverture valide ou exclusions justifiées,
   complétude temporelle/diagnostics et coûts effectivement mesurés.

Les éléments 1–4 empêchent la recommandation technique READY. Le point 5 est un
jalon opérationnel distinct. Voir [RUNBOOK.md](RUNBOOK.md) pour la reprise exacte.

## Inventaire des fichiers livrés

- `engine/src/agriclimax/territories/` : spatial, agrégation, pipeline, dépôt, rapport, SQL d’import.
- `engine/src/agriclimax/wheat/calculate.py` : extraction de noyaux purs, formules inchangées.
- `scripts/pra_reference.py`, `pra_climate.py`, `pra_real_pilot.py`, `pra_workflow.py`.
- `apps/web/lib/server/territories.ts`, `pra-diagnostics.ts` et leurs tests ;
  routes `app/api/territories/`, page `app/territories/` et lien de découverte dans `app/page.tsx`.
- `engine/tests/territories/`, `tests/e2e/territories.mjs`, tests SQL PRA/import/stockage,
  harness SQL et compte RLS actualisé pour dix tables supplémentaires.
- Migration versionnée, lockfile geo, option geo de pyproject, workflows qualité/sécurité
  étendus et workflow PRA manuel ; .gitignore pour l’état transitoire CLI.
- Fichier task, audit, sources, méthodes, schéma, coûts, runbook, rapports, logs et captures.

Le diff du PR donne l’inventaire exhaustif. Aucun lockfile produit JavaScript,
aucune migration antérieure, aucune règle de seuil ni donnée v0.2 n’est modifiée.
