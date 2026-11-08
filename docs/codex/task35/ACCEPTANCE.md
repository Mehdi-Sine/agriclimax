# T35 — Recette et livraison

**READY_FOR_LIVE_AI_TEST** — réception technique en simulation, qualité rédactionnelle réelle non évaluée. Aucun appel payant, aucun modèle réellement testé, coût réel 0 €. La branche part de `b7b9f4f` (`origin/main`, PR #69 fusionnée).

## Résultats locaux

| Contrôle | Résultat |
| --- | --- |
| TypeScript / Vitest | 486 passés, 7 ignorés préexistants ; 63 tests T35 |
| Python | 417 passés ; deux validations croisées du contrat T35 incluses |
| Contrats, lint, typecheck web et CLI T33/T35 | passés |
| Build Next de production | passé |
| Qualité Python/Node | 21 + 8 tests passés |
| Secrets sources et bundle, secrets client, migrations, structure automation | passés |
| Budget JS/CSS gzip | 651 318 octets / 2 097 152 autorisés |
| Audit JS au seuil CI high/critical | aucun high/critical ; un low et un moderate préexistants restent rapportés |
| Exception de dépendance déjà approuvée | périmètre inchangé, 42 traces serveur contrôlées |
| Audit Python de la grille dev verrouillée | aucune vulnérabilité connue |
| Ruff / mypy du moteur éditorial existant et adaptation T33 | passés |
| Navigateur Chromium desktop/mobile | navigation, date absente, sélection PRA, clavier, pas de débordement ; zéro erreur JS et zéro requête OpenAI |

Les tests obligatoires sont répartis entre `editorial-ai.test.ts`, `reading.test.ts`, le contrat Python et `tests/e2e/task35.mjs`. Ils couvrent sortie valide/mal formée/refus/timeout/tokens, budget/clé/concurrence/idempotence, résultat ambigu sans relance, chiffres/unités/dates/territoires/PRA/nature/fraîcheur/couverture/causalité/stades/dommages/documentation/cartes, archive/révision/repli et navigation sans génération. Toute nouvelle prose reste soumise à revue humaine.

La CI de validation existante exécute maintenant aussi le typecheck CLI T35 et le scénario navigateur T35. Aucun workflow d'acquisition ou de production ni cron n'est modifié. Les résultats GitHub et la Preview distante seront renseignés dans la PR ; les validations ci-dessus sont locales.

## Exemples et mesures

- `evidence/simulated-edition.json` : vrai dossier T33 du 30 octobre, texte d'essai écrit pour la recette ; séquence peu arrosée en Nouvelle-Aquitaine, autre angle froid, filière blé, focus régionaux. Aucune carte inventée.
- `evidence/forecast-edition.json` : vrai Journal AGRO-01 et vraie carte CORE-01 du cycle du 7 novembre, période du 8 au 14 novembre ; texte simulé, 713 PRA et états de qualité conservés.
- `evidence/metrics.json` : dossiers de 82 135 / 67 313 octets ; bornes prudentes d'entrée 100 445 / 84 976 tokens, schéma et instructions inclus. Il ne s'agit pas d'une consommation mesurée du modèle.
- Archives compactes : 88 823 / 1 132 186 octets JSON ; 18 293 / 119 543 octets gzip. La seconde inclut les valeurs et preuves cartographiques, sans géométrie dupliquée.
- Dry-run de secours : environ 74 ms et 136 Mio RSS dans cet environnement ; réutilisation idempotente testée. Aucun recalcul national ni collecte.
- `evidence/browser/` : captures desktop/mobile, édition historique et date vide ; rapport de navigation. Les durées du scénario complet incluent les interactions et ne sont pas un score Core Web Vitals.

Une erreur d'intégrité trouvée en navigateur a été corrigée : l'import JSON direct de Turbopack modifiait certaines dernières décimales. Le manifeste compressé conserve maintenant les octets et toutes les empreintes, sans tolérance ajoutée au validateur.

## Limites et suite T36

Le modèle reste `unconfigured` tant qu'aucun modèle accessible et tarif réel n'est configuré. Pour tester réellement : clé serveur autorisée, modèle compatible vérifié séparément, tarifs euro versionnés, plafond par édition et activation explicite. La comparaison requiert son propre budget et un identifiant d'expérience.

Le rapprochement T34 réellement disponible est trop faible pour une citation : rubrique presse omise. L'Almanach enrichit les questions saisonnières mais ne prouve aucun stade réel. La journée calme est une fixture unitaire, pas une journée réelle présentée comme vérifiée.

Le store financier est local/DEV : T36 doit imposer un volume ou backend durable unique et partagé, entretenir les tarifs, réconcilier les appels ambigus, organiser la revue humaine, raccorder le manifeste atomique de publication et tester la disponibilité à 06 h 30 Europe/Paris plusieurs nuits. Aucune publication ni programmation de production n'est activée. Ne pas merger automatiquement.
