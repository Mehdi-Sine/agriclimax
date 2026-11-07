# Recette T32

Branche `codex/32-journal-editorial-ux`, base `origin/main` 0e7bcba intégrant PR #60. Périmètre : présentation `/journal`, composants et tests `features/journal/ui`, documentation T32. Aucun moteur, registre, contrat, API, schéma, workflow ou page `/` modifié. Aucun merge ni déploiement de production.

## Vérification technique

- 342 tests réussis, dont lecture réelle opt-in `TASK31_REAL=1` des archives vérifiées, plus quatre tests de présentation : dénominateur nul vs zéro, couverture partielle, proportions et exclusion des indicateurs non qualifiés.
- Typecheck, lint sans avertissement, build Next.js réussis.
- Contrats, sécurité source et bundle, migrations, budget : réussis.
- Qualité : 12 tests Python et 8 tests Node réussis.
- `evidence/real-edition.json` conserve l’édition réelle lue par l’API. Archives disponibles : 6 novembre 00 h/06 h et 7 novembre 2026 00 h UTC. Les tests navigateur relisent le 6 novembre, sans substitution.

## Reproduction

Utiliser pnpm 10 conformément au dépôt (le runtime fournit initialement pnpm 11). Installation avec lockfile figé. Depuis la racine : `pnpm --filter @agriclimax/web test`, `pnpm --filter @agriclimax/web typecheck`, `pnpm --filter @agriclimax/web lint`, `pnpm --filter @agriclimax/web build`, puis commandes qualité du package racine.

Serveur démarré avec les variables existantes et `NODE_USE_ENV_PROXY=1` dans cet environnement : `node apps/web/features/journal/ui/browser.mjs`. Installer au préalable les dépendances de `tests/e2e` ; Chromium système. `TASK32_ORIGIN` choisit la Preview ; `TASK32_OUTPUT` le dossier de preuves. Le bypass Vercel est transmis uniquement aux requêtes de l’origine choisie, sans inscription dans les rapports.

## Validation visuelle

Captures réelles desktop 1440, tablette 768 et mobile 390 : vue principale et page entière dans `evidence/local/`. Rapport : absence de débordement, carte présente, treize comparaisons, clavier, accès aux régions et archive, erreurs navigateur. Inspection humaine assistée des captures de la une et de page complète.

1. Titre dominant et nature prévisionnelle explicite ; faits juste après la une.
2. Carte de données réelle, légende et couverture ; graphique exact complémentaire.
3. Lecture courte autonome avant les détails scientifiques.
4. Couverture absente distinguée du zéro ; aucune couleur d’alerte inventée.
5. Rubriques fluides selon le nombre de contributions ; six filières actuelles sans fausse qualification.
6. Noms administratifs courants et treize régions accessibles.
7. Preuves et données accessibles à la demande, cycle conservé.
8. Aucun historique, hectare, dommage ou moyenne régionale fabriqué.
9. Mobile en colonne, titres lisibles, navigation répartie et carte dans la largeur.
10. Cas de journée calme : fallback sans carte ni faux signal ; couvertures nulles et faits de production non qualifiés vérifiés par tests synthétiques, explicitement réservés aux tests. Aucune archive réelle calme identifiée dans l’inventaire de trois cycles ; ne pas prétendre l’avoir testée sur une journée réelle calme.

Résultats et URL Preview complétés après publication de la PR draft. Aucune série temporelle qualifiée ajoutée.

## Mesure locale finale — build de production

Recette sur `http://localhost:3001` : **28 contrôles réussis**, aucune erreur navigateur, preuves numérotées ouvertes via ancre et détails natifs. Captures sans outils de développement Next.js.

| Format | FCP | LCP | JS compressé reçu | GeoJSON |
| --- | ---: | ---: | ---: | ---: |
| 1440 px | 164 ms | 1 184 ms | 190 408 octets | 0 |
| 768 px | 220 ms | 1 460 ms | 190 408 octets | 0 |
| 390 px | 124 ms | 1 144 ms | 190 408 octets | 0 |

Mesures de laboratoire sur ce runtime, sans bridage CPU/réseau, non assimilables à des percentiles terrain. La navigation historique réelle du 6 novembre est testée sur les trois formats. Audit `pnpm audit --prod` : aucune vulnérabilité connue. Relance finale des tests sans opt-in réel : 341 réussis et un test réel ignoré ; la passe avec opt-in réel avait réussi les 342.
