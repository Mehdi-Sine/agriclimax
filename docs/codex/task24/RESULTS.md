# Résultats locaux — Task24

**LOCAL_IMPLEMENTATION_READY** — développement local livré ; aucune validation de Preview ou de données DEV réelles revendiquée.

Base : `e835a5745178c723359e904983eb439931529182` (merge #52), confirmée par le propriétaire et vérifiée localement. Branche unique : `codex/24-unified-product-ux`. Aucun fetch supplémentaire, merge, ingestion, migration ou déploiement. Aucun secret ou changement de configuration distante.

## Fonctionnel livré

Accueil France/Corse 713 PRA, trois espaces, même canvas conservé entre onglets, recherche/clic/survol et fiche, navigation URL/retour/rechargement, responsive et filtres mobiles repliables. Climat : valeurs, normales/anomalies homologues, historique/tableau accessible, jours/périodes, pluie, gel, chaleur et degrés-jours côté serveur. Correctif du contrat de couverture historique et contrôles de doublons. Analyse blé : registre de règles descriptives, sans exposition ni impact inventés. Productions : variables et provenance SAA, état à connecter ; aucun millésime ni chiffre fictif.

Les lecteurs utilisent les vraies RPC existantes. Les appels locaux aux services distants renvoient 502 ; les captures montrent donc honnêtement l’état inaccessible et des contours neutres. Les valeurs quantitatives, normale/anomalie, historique, égalité carte/fiche et états partiels/absents sont vérifiés avec transports simulés **dans les tests uniquement**. Aucune capture livrée n’utilise ces simulations.

## Vérifications réellement exécutées

| Vérification | Résultat |
|---|---|
| `pnpm lint` | Passe, zéro avertissement |
| `pnpm typecheck` | Passe |
| `pnpm test` | 249 tests, 21 fichiers, tous passent |
| `pnpm build` | Passe, routes produit/API générées |
| Contrats, automatisations YAML, sécurité sources, migrations | Passent |
| Sécurité bundle, HTML et RSC | Passe ; clé serveur configurée, 44 artefacts/réponses contrôlés, aucune fuite détectée |
| Budget JS/CSS client | Environ 591 ko gzip, sous 2 Mio ; hors workers cartographiques |
| Quality Python / Node | 9 / 8 tests passent |
| Tests scientifiques Python disponibles, hors suites climate/territories | 120 passent |
| Python complet | Collecte bloquée par 13 erreurs de dépendances manquantes : numpy, xarray, pyproj, shapely |
| Chromium — données simulées, `tests/e2e/task24.mjs` | Passe : polygone réel/tooltip/clic, égalité fiche, normale/anomalie/historique, même canvas, contexte PRA, retour/reload, période, indisponible/partiel, clavier et absence de débordement |
| Chromium — sans interception, `tests/e2e/task24-real.mjs` | Passe : 3 espaces × desktop/tablette/mobile, 713 contours, navigation/contexte, alias legacy, date invalide, zéro erreur JS non gérée |

Environnement local : Node 24, pnpm 10.0.0, dépendances préinstallées en cache. **Next et eslint-config-next en cache : 16.4.3 ; lockfile : 16.4.1.** Installation gelée hors ligne tentée une fois : paquet `next-16.4.1.tgz` absent. Lockfile inchangé. `make check` n’est donc pas déclaré vert : l’audit standard ne voit pas le graphe workspace installé normalement. Le même validateur exécuté sur le graphe réellement utilisé en cache passe, exception braces existante inchangée, 26 traces serveur contrôlées. Voir `local-dependency-audit.json`. Refaire l’installation verrouillée et le check complet en CI.

## Captures et mesures

Captures réelles relues visuellement, sans mocks : [Climat desktop](screenshots/climat-desktop.png), [Productions desktop](screenshots/productions-desktop.png), [Analyse desktop](screenshots/analyse-desktop.png) ; [Climat mobile](screenshots/climat-mobile.png), [Productions mobile](screenshots/productions-mobile.png), [Analyse mobile](screenshots/analyse-mobile.png). Les trois captures tablette sont dans le même dossier. 1440×900, 768 px, 390×844 ; aucun scroll horizontal. France et Corse visibles, fiche sous carte en mobile.

`browser-real.json` et `browser-synthetic.json` contiennent les résultats. Les temps de durée négatifs remontés pour certains workers par Chromium sont des mesures non exploitables et ne sont pas utilisés. Géométrie inchangée : 23 818 871 octets bruts, environ 9,66 Mo transférés compressés. Cache HTTP un jour + stale-while-revalidate une semaine. Premiers rendus mesurés localement entre 4,1 et 11,1 s, logiciel de rendu Chromium et tests concurrents ; pas une mesure sur téléphone réel ni un SLA. Le premier chargement géographique reste lourd ; les changements d’espace gardent cette géométrie en mémoire.

## Reprendre et valider à distance

Dans un environnement normalement équipé : `pnpm install --frozen-lockfile`, puis `PRA_NATIONAL_ENABLED=1 pnpm dev` avec les variables serveur existantes. Local testé : http://127.0.0.1:3020. Les tests navigateur acceptent `PLAYWRIGHT_MODULE_PATH` et `TASK24_BASE_URL` (localhost uniquement).

Restent : publication de cette branche et d’une unique PR draft ; CI complète sur versions verrouillées et dépendances scientifiques ; lecture réelle DEV (PRA complète/Crozon, normales, historique, agrégation 30 jours et latence RPC) ; Preview Vercel desktop/mobile. Agreste SAA doit encore être téléchargé et qualifié avant connexion d’une couche départementale. Aucun lien PR ou Preview n’a été créé. Le contrat SQL est vérifié contre la migration versionnée, sans exécution SQL distante. L’exposition agricole reste non quantifiée et THI reste stationnel.

Exports : `work/task24-export/task24.bundle`, `task24.patch` et `agriclimax-task24-local.zip`. Le dossier `/codex/.../output` prescrit par l’interface n’est pas accessible en écriture dans l’exécuteur sélectionné ; les artefacts sont donc conservés dans le workspace, avec sommes de contrôle, sans prétendre à un lien d’attachement disponible.

## Publication GitHub — 4 novembre 2026

Branche publiée, PR draft #53 : https://github.com/Mehdi-Sine/agriclimax/pull/53. Preview Vercel automatique déclenchée ; HTTP 200 et titre AgriclimaX confirmés avec l’accès automatisé existant. Aucun déploiement manuel ni merge.

La première CI sur les cinq commits a validé installation gelée, lint, typecheck, tests TS, build, audit des dépendances, sécurité, contrats Python et SQL (public/extensions). Le workflow ERA5 historique a également réussi (il cible sa propre branche Task12, ce n’est pas une validation des données PRA Task24). Le job navigateur a révélé que les redirections rendues côté page ne satisfaisaient pas le smoke HTTP et que des liens internes de caméra/publication supposaient encore `/`.

Correctif CI sur la même branche : redirections HTTP explicites conservant les paramètres vers `/demo` et `/stations`, URL internes de ces workspaces sur leurs chemins canoniques, tests historiques adaptés au lecteur territorial explicitement versionné et au nouvel emplacement stationnel. Le smoke HTTP conserve son test de l’ancienne URL et vérifie donc sa compatibilité. Le parcours Task24 simulé est ajouté à Quality, sans retirer les tests historiques ni changer les règles scientifiques ou les sources.
