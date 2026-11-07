# Intégrer une production ou un indicateur

## Situation réelle

Adaptateur par défaut découvert à partir des identifiants `PRODUCTIONS` (RPG Task30) et `RULES` (catalogue scientifique). Rubriques : blé tendre, maïs, vigne, vergers, prairies et bovins. Le contexte RPG existe pour les cinq premières ; aucune présence animale n'est inventée pour les bovins.

Tous les indicateurs du catalogue scientifique actuel sont `exploratory`. Leur inventaire conserve version, période, échelle, qualité et limites ; ils sont marqués non qualifiés et sans valeur disponible dans cet adaptateur. La liste des indicateurs effectivement publiés reste vide. Les phénomènes météorologiques Task30 sont publiés comme descriptifs indépendants, jamais comme sensibilité spécifique à une culture.

## Procédure exacte

1. Ajouter la production et/ou règle au catalogue propriétaire avec identifiant stable, libellé, famille, version, unités, période/échelle de validité, exigences de complétude et réserves. Ne pas ajouter de règle spéciale dans le moteur du journal ou la page.
2. Tant qu'un calcul et sa qualification ne sont pas disponibles, laisser `qualified:false`, `publishable:false`, `status:'unavailable'` ou `'insufficient'`. L'inventaire est conservé, la valeur exclue.
3. Pour une intégration qualifiée, créer un `Contributor` (`id`, `version`, `contribute(summary)`) dans l'adaptateur métier. Sa `Contribution` respecte les contrats de `registry.ts` : libellé/famille, présence déclarée avec source/millésime, limites, liens relatifs sûrs et indicateurs versionnés.
4. Chaque indicateur publiable fournit ses faits contrôlés : identifiant unique, texte, valeur finie, unité, période exactement identique à celle de l'indicateur, source, règle versionnée, empreintes de provenance, qualité/fraîcheur et lien. Il doit avoir `status:'available'`, `qualified:true`, `publishable:true`.
5. Enregistrer avec `createRegistry([...existingContributors, contributor])` et injecter ce registre dans `buildEdition(summary,{now,registry})`. Le point de composition serveur peut sélectionner ce registre. Incrémenter la version du contributeur pour toute évolution du calcul ou de la qualification.
6. Tester la porte de publication, les preuves, les limites et l'absence de chiffre sans référence. Exécuter la validation AJV de l'édition complète. Les faits entrent automatiquement dans `evidence`, le composant générique affiche la nouvelle rubrique et ses faits.

## Exemple exécutable

`model.test.ts`, test « publishes a new qualified contributor with its proof bundle », ajoute `new` / `new-index` au registre sans modifier `model.ts` ni le composant UI. La valeur 4 °C est strictement synthétique de test. Le même indicateur devenu `insufficient` disparaît de la liste publiable et reste dans l'inventaire. Le test de nouvelle production seule prouve également la découverte générique.

Une règle exploratoire nouvellement ajoutée au catalogue sera découverte, mais ne franchira pas automatiquement cette porte. Une présence RPG seule reste une exposition déclarée : aucun stade, sensibilité, risque de dommage ni hectare touché. Les données SAA restent dans leur espace et maille d'origine ; aucune redistribution vers les PRA n'est ajoutée.
