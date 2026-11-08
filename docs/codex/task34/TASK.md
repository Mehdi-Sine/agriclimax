# T34 — périmètre exécuté

Demande : premier moteur batch de collecte et qualification d’actualités agricoles, rapprochement documentaire avec Veille/Journal, contrat versionné pour T35, pilote réel, documentation et PR draft sans merge.

Base : dernier `origin/main` au démarrage, `c837fcd` (fusion DATA-01). Branche : `codex/34-agricultural-news-ingestion`.

Frontières : `engine/.../news` possède acquisition, métadonnées, classement lexical et rapprochement documentaire ; `config/news` possède les sources et autorisations revues ; `scripts/task34_news.py` exécute le batch manuel ; ce dossier possède contrat documentaire et preuves. Aucun changement dans les contrats scientifiques, workflows, calculateurs, archives météo, DB, API web ou UI du Journal. Aucun appel OpenAI, abonnement payant, publication ou programmation automatique.

La demande originale transmise par fichier est implémentée avec les réserves explicites de `PILOT.md` et `RESOURCES_LIMITS.md` : autorisations non établies pour les instituts/presse exclus, zéro concordance contemporaine réelle sur le corpus disponible. Les rapprochements saisonniers sont séparés et ne confirment aucun événement.
