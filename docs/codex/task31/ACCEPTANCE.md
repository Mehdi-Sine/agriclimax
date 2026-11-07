# Recette Task31 — 7 novembre 2026

## État

Fondation en prévisualisation, sans merge, sans déploiement de production, sans migration, cron, acquisition ni écriture climatique. La branche part de `main` 50eac24. La livraison documente explicitement la limite historique ; elle n'annonce aucune tendance observée à partir de prévisions.

## Exemple réel

Archive météo nationale vérifiée `f6ea69aa15b7dffc1e5c19156bd2dcd3c39f0f6e1c2740c16cb68b87747760e3`, cycle **2026-11-07 00:00 UTC**, validités **8–14 novembre 2026**. Sélection nationale existante AROME/ARPEGE/IFS ; sources exactes et empreintes dans les preuves Task30.

Titre : **« Gel météorologique attendu : le point en Auvergne-Rhône-Alpes »**. Fait principal : **85 PRA sur 112 évaluables** franchissent Tmin < 0 °C ; minimum territorial prévu **−19,8 °C**. Il s'agit d'un extrême territorial échantillonné, sans diagnostic de dommage agricole.

Les autres faits diversifient les phénomènes : pluie quotidienne >20 mm/j en Provence-Alpes-Côte d'Azur (35/35 PRA évaluables, maximum territorial 98,3 mm) et séquence sans pluie significative en Normandie (17/36, maximum 4 jours). Ces seuils sont descriptifs et exploratoires ; le dernier fait n'est pas une sécheresse agricole.

Rubriques opérationnelles : blé tendre, maïs, vigne, vergers, prairies, bovins. Les cinq premières exposent le contexte RPG 2025 ; les bovins ont une présence non documentée. Aucun indicateur agroclimatique exploratoire non qualifié n'est publié comme validé. Treize régions officielles sont consultables ; trois sont mises en avant de façon déterministe.

## Vérifications

- Tests unitaires de toute l'application : 337 réussites lors de la recette complète, dont lecture réelle explicite. Les ajouts de tests ultérieurs sont consignés dans la livraison finale.
- Tests Task31 : quinze situations demandées, reproductibilité, refus de références cassées, registre invalide, contributeur qualifié et exclusion d'un indicateur incomplet. Fixtures explicitement synthétiques, uniquement dans les tests.
- API : paramètres invalides 400, absence d'archive 503 sans détail sensible et `no-store`, succès 200 et ETag 304, changement de classe de fraîcheur invalidant l'ETag, relecture du 6 novembre avec identité différente.
- Lecture réelle optionnelle `TASK31_REAL=1` : compare chaque fait à l'événement Task30 source, vérifie treize régions et enregistre l'inventaire des archives.
- TypeScript et build Next.js 16.4.1 réussis ; lint sans avertissement.
- Contrats existants, garde-fous secrets source/bundle, migrations forward-only, budget client : réussis. Budget client mesuré : 630 462 octets gzip pour une limite de 2 097 152.
- Tests qualité : 12 Python + 8 Node réussis.
- Chromium système : desktop 1440×1000 et mobile 390×844, clavier, absence de débordement, absence de chargement GeoJSON, ouverture des autres régions, date du cycle historique, absence d'erreurs navigateur.

Captures et rapports : `evidence/local/desktop.png`, `evidence/local/mobile.png`, `evidence/local/report.json`. Sortie réelle : `evidence/real-edition.json`. Catalogue observé : `evidence/archive-inventory.json`.

## Reproduire

Avec pnpm 10, depuis la racine : `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm check-contracts`, `pnpm check-security`, `pnpm check-bundle`, `pnpm check-migrations`, `pnpm check-budget`, `pnpm test-quality`.

Dans `apps/web` : `TASK31_REAL=1 pnpm test` active la lecture réelle, avec les variables serveur existantes. Dans cet environnement cloud, utiliser `NODE_USE_ENV_PROXY=1` pour les processus Node. Aucun secret dans les rapports.

Serveur construit démarré, depuis la racine : `NODE_USE_ENV_PROXY=1 node tests/e2e/task31-journal.mjs`. `TASK31_ORIGIN` et `TASK31_OUTPUT` sélectionnent la Preview et le dossier de recette ; `CHROMIUM_PATH` permet de choisir Chromium. L'en-tête de bypass reste limité à l'origine Vercel sélectionnée et n'est jamais enregistré.

## Coûts et limites

Aucun abonnement ni appel IA, aucune nouvelle base, aucun stockage persistant ajouté. Coût marginal : un petit calcul TypeScript de sélection et sérialisation par nouvelle identité, au-dessus du lecteur Task30 partagé ; trois éditions en mémoire par instance. Environ 0,14 Mo JSON non compressé par édition lue, évitable via ETag ; coût monétaire dépend du trafic et du plan Vercel existant, sans chiffre garanti.

Les séries historiques natives existent partiellement, mais ne sont pas encore adaptées en snapshots éditoriaux qualifiés avec continuité d'épisodes. La comparaison pure est testée ; les tendances réelles à 3/7/14/30 jours restent `insufficient_history`. Voir `EVENT_HISTORY.md`.

Task32 : qualification et adaptateur d'historique, preuve de continuité des épisodes, qualification des indicateurs de production, éventuelle rédaction IA strictement sur preuves et revue des seuils exploratoires. Task33 : archivage immuable et révisions, publication quotidienne après validation, design éditorial et visualisations approfondies. La mise en production nécessite une décision ultérieure.

## Preview

URL et résultat de recette Preview ajoutés après création de la PR draft et construction Vercel.
