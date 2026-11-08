# Recette et préparation T35

## Contrôles

- Suite Python complète : 415 tests passés. Les 63 avertissements existants portent sur NumPy/netCDF4 ; aucune erreur de test.
- Suite web complète : 423 tests passés, 7 tests live optionnels ignorés.
- Tests ciblés T33 : 20 cas TypeScript (résolveur, épisodes, comparaisons, budget, preuves, T34, API) et 5 cas Python de contrat partagé.
- Typecheck web/build et CLI, lint ESLint, Ruff et mypy strict ciblés, garde de secrets et contrats V1 : exécutés, journaux dans evidence/.
- Le replay identique accepte les fichiers immuables existants et conserve le même bundle_id ; metrics.json, non factuel, peut varier en temps/RSS.
- Vérifications navigateur desktop 1440 et mobile 390 : résultats et captures dans evidence/browser ; vérification Preview dans evidence/preview lorsqu'elle est disponible.

Audit pnpm : aucun avis high/critical ; un avis low et un moderate restent visibles dans audit.log. Les contrôles navigateur locaux passent sur les deux tailles, y compris filtres, mois, repères culturels, calendrier invalide et ETag du dossier. Next peut répondre HTTP 200 à une 404 rendue après démarrage du streaming : la page invalide montre bien la 404 et porte noindex.

## Limites explicites

Les comparaisons 3/7/14 jours ne sont qualifiées que sur les supports compatibles. 30 jours comparatifs restent insuffisants. Les 2 734 épisodes sont des épisodes PRA sur archive d'octobre ; 571 en cours signifie au cutoff historique, jamais actuellement. Pas d'interprétation agronomique validée.

Six familles mobiles restent annual_source_required, car aucune éphéméride ou date annuelle fiable n'a été fournie. Seuls Pâques et ses fêtes dérivées sont calculés. Le filtre régional reste documentaire lorsque la zone du maître n'identifie pas explicitement une région ; il ne fabrique pas de distribution géographique des productions.

Les archives réelles de prévision disponibles ne permettent pas un couple à horizon exact de trois jours ; le diagnostic ne maquille pas cette absence. Les onze rapprochements T34 sont faibles, aucune concordance contemporaine complète n'est revendiquée. Aucun article externe intégral n'est archivé ici.

Le CLI actuel exploite l'historique local DATA-01. Il prépare l'archivage et expose l'extension contrôlée des épisodes, sans nouveau stockage de production ni batch quotidien activé. La nouveauté éditoriale peut recevoir des topic_keys antérieurs via le moteur ; le replay initial part d'une liste vide.

Le déploiement Preview est vérifié sur son origine Vercel par le même scénario Chromium. Voir PREVIEW.md et evidence/preview/report.json. Le faux positif Gitleaks sur une empreinte publique de lot est expliqué dans SECURITY.md ; exception limitée à un fingerprint, sans désactiver de règle.

## Verdict

Fondations déterministes utilisables pour développer T35 en Preview, avec preuves et réserves explicites. Ce n'est pas une autorisation de publication IA autonome. Avant activation : alimenter l'historique courant et 60 jours compatibles, ajouter les sources annuelles des mobiles, charger l'état antérieur des épisodes et des sujets, qualifier les correspondances documentaires, fixer un budget de tokens mesuré, puis intégrer la rédaction IA avec EvidenceBundle, traçabilité et revue éditoriale. Aucun cron ni appel OpenAI n'est activé par T33.
