# T33 — Architecture

Le moteur déterministe est dans `apps/web/features/editorial/`. Il prépare un dossier, jamais un article. Les quatre entrées restent indépendantes : archive historique DATA-01 / prévisions T31, contributions qualifiées du registre existant, Almanach canonique, lot documentaire T34.

`almanac.ts` résout le calendrier. `temporal.ts` adapte les journées ERA5-Land, appelle le comparateur T31 et reconstruit les épisodes PRA. `contributions.ts` adapte le résumé blé historique déjà calculé ; aucun calculateur n'est modifié. `briefing.ts` sélectionne des propositions et assemble les preuves. Les JSON Schemas stricts dans `contracts/jsonschema/` sont consommés par Ajv et Python. L'adaptateur Python appelle directement `agriclimax.news.matching.match` : aucune seconde collecte.

Le batch manuel produit un dossier immuable adressé par son identité, une mémoire complète compressée et les comparaisons détaillées séparées. La page `/almanach` utilise seulement le résolveur documentaire côté serveur. L'API `/api/editorial-briefing/example` expose un replay figé, avec ETag, sans recalcul national par consultation. Le Journal existant reçoit uniquement un lien secondaire en pied de page.

Frontières conservées : unités et règles scientifiques existantes, qualité CORE-01, lecture des archives DATA-01, contributions T31/AGRO-01, collecte T34, rendu Next. Aucune migration, nouveau fournisseur météo, modification de calcul blé/bovin, API OpenAI, écriture de production ou planification.
