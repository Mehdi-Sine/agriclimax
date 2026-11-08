# EditorialBriefingBundle — editorial-briefing-1

Schéma canonique strict : `contracts/jsonschema/editorial-briefing-1.schema.json`. Validation Ajv TypeScript avec formats, Python jsonschema depuis le même fichier, puis contrôle des références, empreinte, budget et séparation prévisions/histoire. Chaque objet déclaré refuse les champs inconnus.

Identité : date éditoriale Europe/Paris, timestamp de génération/replay, versions moteur et Almanach, SHA du maître, empreinte complète des lignes climatiques qualifiées, mémoire d'épisodes, édition T31 éventuelle, lot T34, contributions, contexte de nouveauté et pont de signaux. La génération par défaut utilise le dernier timestamp des entrées pour être reproductible ; elle n'antidate pas l'acquisition à la date historique analysée.

Sections : validity ; national (faits, comparaisons retenues, diagnostics des quatre horizons, mémoire référencée et couverture) ; candidates ; contributions (IDs de faits agricoles) ; seasonal (fenêtres, URLs sources, repères, mobiles non résolus, questions de fond) ; documentary (publications et liens complets/faibles séparés) ; journal_proposals ; limitations.

Chaque fait transporte unité, période, règle, provenance, qualité et fraîcheur. Les séries PRA et observations d'épisodes restent dans l'archive annexe, pas dans le dossier IA. Le dossier référence l'empreinte de cette mémoire et les IDs vérifiables. Le payload brut de toutes les données n'est jamais transmis à un futur modèle.

Limites : 12 candidats, 20 références d'indicateurs, 16 IDs d'épisodes en exemple, 20 publications, 40 liens, 40 fenêtres maximum, 96 KiB JSON compact. L'exemple est un replay du 30 octobre, généré avec des entrées acquises ultérieurement, et non une édition publiée ce jour-là.

Une future IA doit utiliser ce seul dossier comme entrée factuelle bornée ; le moteur T35 doit conserver dossier, modèle, template, timestamp et marquage IA. Aucune API IA n'est intégrée ici.
