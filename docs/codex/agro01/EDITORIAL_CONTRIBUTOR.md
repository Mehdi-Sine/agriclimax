# Contribution éditoriale du blé

## Architecture et contrat conservé

`features/wheat/qualified.ts` possède la liste blanche et la qualification. `features/wheat/national.ts` calcule une synthèse déterministe : dix indicateurs, France et treize régions, couverture et motifs, comptes de PRA franchissant un critère, maximum dans une PRA nommée. Aucun tableau individuel des 713 résultats ni géométrie n'entre dans le Journal.

`lib/server/wheat.ts` réutilise les archives météorologiques vérifiées. Un lot charge les données une seule fois puis mutualise les entrées par variable (quatre, pas dix lectures nationales). J+1 et la fenêtre de sept jours sont calculés à partir du même cycle, sans acquisition. `wheatHistory` sert à la recette/relecture des archives ; il n'est jamais appelé pendant une visite au Journal.

`WheatEditorialContributor(snapshots)` est **synchrone**, sans accès réseau. Il reçoit des snapshots préparés côté serveur et produit les types existants `Contribution`, `Indicator`, `IndicatorFact`. Il vérifie empreinte de synthèse, version, nature prévisionnelle, cycle/source identiques à la veille, période contenue dans celle-ci, population nationale de 713 PRA, statut de qualification et correspondance à la liste blanche (ID, unité, formule, seuil, référence). Les snapshots historiques ne sont pas injectés dans une édition prévisionnelle.

Les faits éditoriaux retiennent France et au maximum **une** région par indicateur (tri déterministe par nombre de PRA franchissant le critère, puis maximum descriptif, puis nom). Pour la pluie cumulée, pas de critère de franchissement inventé : sélection par maximum. Pour GDD et température moyenne, seuls les faits nationaux sont envoyés afin de borner le payload ; les treize régions restent dans le snapshot. Toutes les treize régions restent disponibles dans la synthèse et les rubriques génériques T31. Le maximum est explicitement situé dans une PRA ; ce n'est jamais une moyenne ou une valeur représentative de la France. Un compte de PRA possède son dénominateur ; aucun hectare de blé n'est estimé.

Chaque fait transporte ID stable haché, valeur non arrondie, unité, période, source, version de règle, empreinte de synthèse, référence scientifique, provenance météo, fraîcheur, drapeaux et lien d'analyse avec les paramètres existants `agro`, `agro_start`, `agro_end`, `weather_run`, `pra`. Le lien ouvre l'analyse détaillée existante sur les mêmes entrées ; cette interface conserve sa version historique de calcul et n'est pas transformée en UI 2.0.

`qualified:true` signifie ici **qualification technique pour description**, jamais validation agronomique. `scientific_status:exploratory` et `agronomic_interpretation:not_validated` sont conservés dans la synthèse, les limites et les drapeaux des faits. Les indicateurs refusés restent dans `indicator_inventory`, avec leurs motifs ; aucun nombre n'est publié pour eux.

## Trois points d'intégration minimaux

1. `registry.ts` exporte additivement `defaultContributors`; `defaultRegistry` reste inchangé dans son comportement. Le serveur remplace uniquement le contributeur blé dans une instance composée avec `createRegistry`.
2. `lib/server/journal.ts` prépare les snapshots asynchrones avant `buildEdition`, attend au maximum 1 500 ms pour cet enrichissement et conserve la publication nationale en cas de panne/délai. Une indisponibilité transitoire n'est pas mémorisée comme édition définitive enrichie ; la visite suivante peut bénéficier du calcul terminé. Les requêtes d'archives ont leur propre borne existante de 12 s ; le timeout éditorial ne prétend pas annuler ce travail borné.
3. Une phrase générale devenue fausse dans les réserves de `model.ts` est actualisée : des calculs qualifiés peuvent être publiés descriptivement tout en restant exploratoires. **Aucun changement** de structure `JournalEdition`/`EditorialFact`, page, CSS, composant ou flux T32.

Les faits entrent automatiquement dans `evidence.facts` et les rubriques de production. `assertEdition` vérifie le schéma et les références. La production blé et l'éventuelle présence RPG sont distinctes : les comptes météo portent sur l'ensemble des PRA évaluables ; RPG ne prouve pas une culture en place ni son stade.

## Cache et ressources

Cache mémoire single-flight de trois cycles et Next Data Cache persistant via `unstable_cache` (compatible avec la configuration Next 16 actuelle sans activer globalement Cache Components). Clé : SHA-256 du blob météorologique, version 2.0 et empreinte de toutes les règles/qualifications. Identité de synthèse : règles publiées, paramètres, source, cycle, nature, période, couverture et preuves. Changer une source ou règle invalide l'identité. Aucun job ni écriture Supabase ajouté. Les archives existantes gardent leurs propres caches et limites.

## Intégrer un prochain indicateur ou une autre production

Ajouter une règle métier versionnée et ses références ; écrire une vérification indépendante ; mesurer sa disponibilité réelle et définir séparément ses exigences de calcul et d'interprétation. Ajouter explicitement l'ID à la liste blanche seulement après qualification ; conserver les paramètres et l'empreinte dans le snapshot. Produire une synthèse bornée et un contributeur métier sur les contrats existants. Tester indisponibilité, provenance incompatible, seuil personnalisé, preuve manquante et absence d'inférence biologique. Ne pas élargir automatiquement cette liste aux bovins, vigne, maïs, prairies ou vergers.

Exemple réel intégral : [evidence/journal.json](evidence/journal.json). Synthèses complètes avec toutes les régions : [evidence/summaries.json](evidence/summaries.json).
