# Recette CORE-01 et limitations

## Résultat livré

Qualification commune versionnée, registre de certificats fermé par défaut,
adaptateurs des archives existantes, propagation Climat/Analyse/blé/veille/Journal,
présentation des supports partiels sur contours officiels entiers et supervision
exécutable sans nouvelle programmation. Anciennes versions scientifiques conservées.

Le gain réel est la conservation de 67 valeurs descriptives supplémentaires dans
la chaîne blé, sur 1 et 7 jours, avec preuves et portée bornée. Crozon reste absent.
Les 36 anciennes estimations automatiques ≥90 % de Climat restent visibles comme
valeurs descriptives sous 1.3 ; aucun certificat nouveau ne les rend territoriales.
Les prévisions complètes et les valeurs de veille/Journal restent inchangées.

## Vérification

- Suite web complète et tests de contrat partagés TypeScript/Python.
- Oracle indépendant : 35 650 cas, 71 300 scalaires, erreur maximale 2,84e-14 ;
  aucune régression sur les valeurs natives complètes comparables.
- Suite moteur Python, gardes de qualité Python/Node, typage strict du module
  ajouté et Ruff ; lint, TypeScript et build web.
- Gardes secrets sources et bundle navigateur, migrations forward-only,
  structure des workflows et contrats ; aucun changement de dépendance majeure.
- Recette navigateur réelle : ordinateur 1440×1000, mobile 390×844 ; cartes
  Climat/Analyse avant 1.2 et après 1.3, Journal responsive, six PRA contrastées
  supplémentaires par taille. Rapport sans erreur JavaScript ni débordement.
  Les cartes après portent 713 géométries, 712 valeurs et 67 valeurs partielles ;
  couche découpée désactivée sous le nouveau contrat.

Les reçus exécutés et les captures sont dans `evidence/`. Les tests réels sont
opt-in et ne remplacent jamais une archive inaccessible par une fixture.

## Ressources

`runtime.json` mesure un processus isolé : lecture/validation froide, calcul des
deux fenêtres blé, rejeu mémoïsé, veille, RSS et tailles. Les qualifications de
veille sont factorisées sans arrondi dans des modèles partagés avec vecteurs
exacts de fractions et supports ; la réponse nationale doit rester sous 4 Mo
(test bloquant), pour préserver la limite serverless avec marge.

L'ordre de grandeur mesuré est 1,2–1,9 s pour les deux fenêtres blé, 0,9–1,3 s
pour la détection météo et environ 0,04 ms pour le rejeu mémoïsé ; RSS de l'ordre
de 500 Mo avec archives et synthèses chargées. Les chiffres exacts du reçu font
foi. La campagne exhaustive stocke davantage d'entrées gelées et n'est pas un
coût à chaque visite. Aucun nouveau service ou fournisseur payant, aucune requête
par PRA, pas de nouvelle acquisition nationale.

## Limites et suites avant T33 / AGRO-02

1. Le stockage historique consulté ne fournit que 14 dates ; la fenêtre de
   30 jours reste non évaluable. La continuité native pérenne doit être rétablie
   par une tâche d'archivage autorisée, sans inventer les journées manquantes.
2. Les supports partiels n'ont pas de nouveau certificat indépendant de
   représentativité : descriptifs autorisés, conclusions territoriales bloquées.
3. Les prévisions ont une couverture numérique, sans garantie terrestre côtière.
   Le blé refuse une intégration multi-modèles ; la veille conserve explicitement
   ses segments sans les joindre en séquence.
4. La supervision est préparée et testée ; aucune activation de cron ni publication
   automatique à 06:30 Europe/Paris n'est effectuée.
5. SAFRAN reste une candidate séparée, avec datum, définitions, supports résiduels
   et validation indépendante à lever. Aucune fusion de #63 ni mélange de séries.
6. Le complément spatial Task29 reste reproductible sous 1.2 ; il n'est pas
   automatiquement réactivé sous 1.3 ni converti en mesure native de Crozon.
7. L'oracle indépendant vérifie l'arithmétique après adaptation. Il ne remplace
   pas une nouvelle réagrégation des cellules sources ou une validation stationnelle.

La PR doit rester draft pour revue scientifique des changements de portée et
revue d'architecture. Aucun merge automatique, aucun secret, quota, calendrier,
schéma DB ou enregistrement de production modifié.

## Reproduction

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
PYTHONPATH=engine/src python -m pytest engine/tests
NODE_USE_ENV_PROXY=1 CORE01_REAL=1 PRA_NATIONAL_ENABLED=1 pnpm --filter @agriclimax/web exec vitest run features/climate-quality/real.test.ts
NODE_USE_ENV_PROXY=1 CORE01_RUNTIME=1 pnpm --filter @agriclimax/web exec vitest run features/climate-quality/runtime.real.test.ts
python scripts/verify_core01_frozen.py
CORE01_ORIGIN=http://localhost:3000 node scripts/core01_browser.mjs
```

Les deux commandes réelles exigent les variables serveur existantes ; aucune clé
n'est transmise dans les URL, captures ou fichiers de preuve. Les dépendances de
développement sont installées avec les lockfiles du dépôt et pnpm 10.

Audit des dépendances : zéro vulnérabilité haute ou critique au seuil exécuté ;
une alerte modérée préexistante concerne minimatch 10.2.6 dans la chaîne ESLint
(`GHSA-g3hv-75wg-m249`). Le lockfile et les exceptions de sécurité ne sont pas
modifiés par CORE-01. Le correctif annoncé exige minimatch 11 ; aucune substitution
majeure transitive non validée n'est forcée dans cette tâche scientifique.
Cette réserve reste visible dans le reçu de sécurité et la PR draft.

Les empreintes des preuves livrées se contrôlent depuis `evidence/` avec
`sha256sum -c MANIFEST.sha256`. Les modèles compressés de veille sont développés
sans perte par `qualityForEvidence` avant contrôle du contrat complet.

Rendu cartographique : le reçu `render.json` mesure, sur Chromium headless avec
SwiftShader et caches locaux chauds, 15,38 s avant et 12,77 s après entre
navigation et carte prête. Les deux cas portent 713 géométries et 712 valeurs ;
le nouveau parcours supprime les 67 géométries de surcouche découpée. Deux mesures
séquentielles ne démontrent pas une accélération universelle ; le heap JavaScript
n'a pas été forcé au GC et ne permet pas une comparaison mémoire avant/après.
La mémoire serveur est mesurée séparément dans `runtime.json`.

Contrôle des courbes historiques : les journées des supports partiels portent
leur identifiant stable dans `series`. La recette réelle exige une série
observée complète pour chaque portion éligible sur 1/7 jours ; les PRA natives
complètes gardent leur historique et leurs références, sans série de substitution.
Les captures de séries partielles sont vérifiées par un point quotidien réel.
