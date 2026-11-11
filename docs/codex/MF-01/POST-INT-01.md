# MF-01 — finalisation après INT-01

## Décision et périmètres

**GO technique pour la fusion #81 après succès de la CI complète et de la recette nationale sur le commit final. NO-GO pour une publication automatique de la prochaine édition.** Les résultats finaux, SHA et exécutions sont consignés dans le descriptif de #81 ; un contrôle en attente ou en échec laisse le GO de fusion conditionnel.

Base intégrée : `c6811acca079851ff7bcbd3ef59f05d67ac9baa1`, fusion #82 INT-01, après #80 `4c538492`. Fusion locale de main dans MF-01, sans conflit ; historique MF-01 conservé intégralement, aucune fusion distante effectuée. Le workflow qualité conserve simultanément les nouveaux contrôles MF-01 et le navigateur préinstallé / parcours INT-01 apportés par #80/#82. #77 est absorbée par #80 et ne doit plus être proposée à la fusion. #63 reste indépendante et non intégrée.

Frontières touchées : orchestration bornée des acquisitions manuelles, sélection de la période cartographique parmi les données sélectionnées existantes, recette isolée. Aucune formule, seuil, qualité CORE-01, géométrie, contrat JSON/API, migration ou politique de publication modifiée. Les champs manquants restent NULL, l'humidité et les supports côtiers restent limités.

## Ruptures reproduites et corrections

1. **Budget OPS-04 trop court.** `manual_sources.py` tuait le forecast après 600 s, alors qu'une acquisition nationale MF-01 mesurée prenait 669,8 s. Le forecast peut maintenant utiliser le budget partagé de 21 minutes ; les autres sources utilisent seulement le temps restant. Au plus 1 250 s de sous-processus avant émission du rapport, sous le délai de 1 260 s de l'appelant. Les sources non tentées sont explicites. Aucun plafond de requêtes/octets fournisseur augmenté.
2. **Fenêtre J0/J1 incompatible avec les runs frais.** La sélection nationale conserve légitimement AROME J0 issu de 00Z et J1 issu de 06Z. Le moteur multiproduction refuse cette discontinuité ; avant correction, la recette calculait des mesures, mais toutes les cartes prévisionnelles étaient absentes. La période utilisée par OPS-04 et INT-01 est désormais la première paire de dates contiguës à partir de l'édition, ayant une seule source/modèle/run sélectionné. Le moteur scientifique qualifie ensuite les valeurs et supports avec ses règles inchangées. Pas de mélange de modèles, d'utilisation de lignes non sélectionnées, de maximisation opportuniste des valeurs ou d'élargissement de la fenêtre.

Sur le cycle réel du 11/11 à 06Z, la paire retenue est **13–14 novembre, ARPEGE du 11/11 à 06Z**. Les cinq cartes prévisionnelles ont chacune 713 valeurs selon la méthode exploratoire existante. Elles ne sont ni des cartes J0/J1 ni des cartes homogènes J+7. Leurs périodes et cycles restent dans `EditionMap`, l'API et les légendes INT-01 ; la différence de période avec l'article reste affichée.

## Compatibilité vérifiée avec INT-01

- `edition-maps-1`, `EditionMap`, publication/manifeste immuables, ID/checksum d'édition et empreintes d'entrées inchangés.
- La même fonction de période est partagée entre les indicateurs manuels et `buildEditionMaps` ; aucune sélection indépendante dans une page ou une API.
- Recette réelle préliminaire : 92 690 mesures, dix cartes (cinq historiques 29/10–04/11, cinq prévisionnelles 13–14/11), restauration locale et deux fabrications cartographiques identiques. Voir [avant](evidence/post-int01/recipe-before-window-fix.json) et [après](evidence/post-int01/recipe-after-window-fix.json).
- Repréparation réelle, en lecture seule, de l'ancienne édition `bdde45…97af5` avec le code combiné : SHA de lot **`80245fade38bc42251720aa9ec602a092600fdbcd14c53605c05b8d7d5ae8cd6`**, identique à INT-01. Les dix cartes historiques conservent leurs périodes, leurs 68 NULL historiques et leurs 713 identités. [Preuve](evidence/post-int01/frozen-map-compatibility.json).
- Les tests API continuent à refuser une mauvaise édition, un checksum différent, les candidats non publiés et l'exposition de reçus privés. Les parcours navigateur complets, dont Journal/cartes/Corse/archives/état non publié, sont exécutés par la CI issue d'INT-01, sans modifier ses assertions.

## Recette intégrée reproductible sans publication

1. Depuis le commit final de #81 :

   `gh workflow run meteofrance-ingestion.yml --ref codex/mf-01-acquisition-reliability -f probe_only=true -f sample_data=true -f station_window=true -f national_qualification=true`

   Examiner les catalogues, DPObs v1/v2, station J-1, heures des observations récentes, dates/échéances GRIB et audits indépendants. Les quatre familles et IFS sont vérifiées séparément. Télécharger l'artefact national ; extraire seulement `cycle.compact.json.gz` dans un nouveau répertoire de `work/`. Aucun `--publish-dev` dans cette recette.

2. Avec les bindings Supabase existants pour lire l'historique réel :

   `NODE_USE_ENV_PROXY=1 NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/mf01_integrated_recipe.ts --weather work/recette/cycle.compact.json.gz --out work/recette-integree-nouvelle`

   Le script verrouille le transport à **GET uniquement sur l'origine Supabase configurée**. Tout POST, appel fournisseur/IA ou autre origine est refusé avant transport. Il ne fait aucune modification distante ; le code de préparation réutilisé est appelé en lecture seule.

3. Vérifier successivement le rapport :

   - Acquisition : SHA, `run`, `acquired_at`, dates réelles, couverture par variable/PRA du rapport natif.
   - Persistance **locale** : archive météo adressée par SHA, entrées compressées immuables, readback exact, dossier nouvellement gelé et nouvelle archive candidate ; pas d'écrasement dans le répertoire.
   - Indicateurs : moteur multiproduction existant, périodes explicites, mesures/erreurs et NULL conservés ; aucune déduction d'un THI national sans paires T/RH qualifiées.
   - Cartes : contrat INT-01 vérifié, unité/provenance/cycle/qualité conservés, lot compressé adressé par SHA et fabrication répétée identique.
   - Édition : texte déterministe `mode=fallback`, sans reçu IA, **non consultable comme édition IA opérationnelle**, `candidate_not_published`. Aucun reçu inventé ni suppression d'un marqueur de test existant : le dossier local est construit de zéro et n'est pas promu.

Cette recette établit la consommation de données fraîches par les indicateurs et les cartes. Elle ne prétend pas avoir testé une écriture Supabase opérationnelle ni la visibilité d'une nouvelle édition publiée. Le parcours API/écrans INT-01 est vérifié séparément sur son édition gelée réelle avec les tests existants ; aucune carte fraîche n'est attachée à cet ancien article.

## Passage opérationnel restant, pour la prochaine édition

| Étape | Propriétaire / opération réelle | Rupture ou condition restante |
|---|---|---|
| Acquisition et persistance météo | T36 `stage=acquire`, `task36_nightly.py`, `national_weather.py --publish-dev`, `ArchiveStore.publish_weather` | La recette MF-01 produit un artefact local. Seul le chemin opérationnel écrit le blob, catalogue/version et pointeur courant. Vérifier lease, cooldown, `acquisition_enabled`, arrêt d'urgence et reçus ; un `no_op` n'est pas une nouvelle acquisition |
| Observations J-1 | DPClim cinq stations MVP ; ERA5 nationale séparée | Cinq stations ne sont pas une couverture nationale de 713 PRA. ERA5 actuellement au 04/11 ; le modèle ne devient pas une observation J-1 |
| Entrées et dossier | T36 `stage=prepare` pour une nouvelle date admissible | Un cycle présent dans le catalogue doit être antérieur au cutoff d'entrée. Une acquisition tardive nécessite le circuit de reprise explicite ; jamais remplacement d'un gel existant |
| Indicateurs / cartes | Moteurs AGRO et `buildEditionMaps` | Deux jours homogènes effectivement disponibles, pas sept jours composites. Les limites d'humidité, pluie et littoral restent visibles |
| Article consultable | T36, garde `consultableEdition` | Des données nouvelles modifient le bundle ; une ancienne réponse IA n'est réutilisable que si elle est exactement compatible. Le candidat fallback de recette ne satisfait pas ce garde. Aucun nouvel appel OpenAI autorisé dans cette tâche |
| Candidats cartes persistables | `edition-maps.yml` ou `int01_maps.ts prepare ID` | Nécessite une édition consultable et ses entrées réellement gelées/persistées. `prepare` reste en lecture seule ; son artefact n'est pas une publication |
| Visibilité Journal / Cartes du jour | Publication du manifeste INT-01 après revue exacte du lot | Revue des cartes et revue éditoriale distinctes ; `publication_enabled=false` respecté. Aucun manifeste publié ici |

Après fusion humaine, le scénario supervisé consiste à lancer **`stage=acquire` uniquement** pour la date à alimenter, vérifier le catalogue privé et les dates/qualités par readback, puis **`stage=prepare` uniquement** pour une nouvelle édition après son cutoff. Ne pas lancer `stage=run`, `resume` ou `publish` sous l'hypothèse qu'ils sont sans IA. Le registre peut rendre une acquisition inéligible : consulter sa raison plutôt que réinitialiser des leases ou des succès à la main.

Si l'édition du 11 novembre est déjà gelée, la conserver ; la prochaine date admissible est préparée dans son propre contexte. Aucun reset de snapshot, archivage rétrospectif forcé ou réemploi de l'ancien texte sur un nouveau bundle. La création d'un nouvel article IA, si nécessaire, exige une autorisation distincte. La préparation puis la revue des cartes suivent INT-01, sans `publish --execute` dans cette tâche.

## Fraîcheur et réserves scientifiques

La preuve nationale précédente portait sur le cycle du 11/11 06Z jusqu'au 18/11, 442 requêtes / 90,6 Mio ; humidité 232/713 le 11 et 616/713 à J+7, pluie 707/713 à J+5. Ce sont des résultats datés, pas des garanties pour l'exécution suivante. La nouvelle recette finale doit rapporter ses propres cycles, dates et couvertures. Les bornes RH, supersaturation éventuelle, accumulations non monotones et représentativité terrestre restent à qualifier sans correction automatique.

Les gardes scientifiques ne sont pas levés pour obtenir un GO de fusion. **GO de code n'est pas GO de publication ni promesse d'observations nationales J-1.** Les consommateurs savent afficher les données qualifiées et les manques ; la prochaine édition n'utilisera les données fraîches qu'après leur persistance opérationnelle et un nouveau gel cohérent.

## Contrôles du commit final et retour arrière

La CI complète du commit final doit couvrir Python/contrats, Mypy/Ruff, tests qualité et budgets, types/lint/build web, toutes les suites TypeScript, SQL/RLS/leases (public/extensions), audits de dépendances/secrets, Chromium et parcours d'INT-01. Les commandes d'acquisition sont relancées séparément sur ce même SHA. Le rapport final #81 fournit les liens et conclusions réels ; pas de GO sur une CI antérieure ou partielle.

Retour arrière code après fusion autorisée : branche depuis main actualisée, PR de `git revert -m 1 <merge-MF-01>` ou `git revert <squash-MF-01>`, revue et CI complètes. La base de retour est **main après INT-01**, pas main avant #80/#82. Ne pas reverter les migrations ou effacer les blobs, catalogues de révision, snapshots, manifestes de cartes ou publications. Le code précédent peut reprendre son dernier cycle qualifié avec ses dates réelles. Les objets de recette sont locaux ; aucune restauration de production n'est nécessaire pour cette tâche.
