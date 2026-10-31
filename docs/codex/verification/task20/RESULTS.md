# Task20 — V0.3 nationale

**READY_FOR_V0.3**, parcours validé sur Supabase DEV réel. Réserve PostGIS admise explicitement par l’utilisateur le 31 octobre 2026, sans escalade de privilèges. L’ouverture publique reste une opération distincte, désactivée par défaut.

`/territories` affiche le parcours national avec `PRA_NATIONAL_ENABLED=1` : 713 contours source intacts, survol, clic, zoom/recentrage, recherche nom/code/département et liste accessible au clavier. La carte conserve les PRA partielles. Les couleurs portent la disponibilité, sans représenter une donnée absente comme zéro. MapLibre utilise `promoteId: code` pour les états des polygones.

Date initiale explicite : **18 octobre 2026 UTC**, fin de l’archive. Navigation du 19 septembre au 18 octobre, sélection PRA et lien direct `?date=2026-09-30&pra=pra%3A28341`. Diagnostic descriptif et historique des quatre variables : Tmin (minimum des cellules), Tmax (maximum), Tmean et pluie (moyennes spatiales). Source ERA5-Land, fraîcheur historique/stale, couverture par variable, valid_counts, NULL, méthode et lot de provenance affichés. Courbes interrompues aux lacunes ; tableau accessible. Aucun nouveau risque, THI, diagnostic systématique, climatologie ou anomalie.

Données nationales inchangées : **713 PRA / 21 390 journées / 645 complete, 67 partial, 1 unavailable** à la date contrôlée. Aucun backfill ou nouvelle acquisition. La séparation entre réanalyse, stations Météo-France et démo est conservée. Aucun fallback silencieux. Les anciennes pages pilotes et paramètres de référence explicites conservent leur parcours v0.2.

## Vérifications

- `make check` : **235 tests Python, 237 tests web**, lint/types/build et gardes réussis ; dernières vérifications web après ajustement du cache réussies.
- Migrations, contrats, RLS et requêtes v0.2 sur PostGIS jetable dans les schémas **public et extensions** : réussis, avec test ciblé du correctif PostGIS.
- Navigateur réel → DEV, sans mocks pour les données : PRA complète **28341**, partielle **06245**, **Crozon 29102 unavailable**, 30 lignes d’historique chacune ; survol et clic des polygones effectivement rendus.
- Date vide, erreur réseau simulée explicitement, reprise et resélection de la même PRA/date : états explicites, aucune fausse réussite.
- **1440, 768 et 390 px** : zéro débordement, zéro violation axe WCAG AA, zéro erreur JavaScript. Viewports émulés sur Chromium, sans prétendre tester tous les appareils physiques.
- Captures inspectées : [desktop](national-1440.png), [mobile](national-390.png). Mesures : [measurements.json](measurements.json). CI/Vercel du SHA final consignés dans la PR.

## Performance et coût de lecture

Carte et données prêtes en **3.69 s** sur la machine de test, changement de date en **1.36 s**. Trois mesures HTTP : médiane nationale **1.51 s**, historique sélectionné **1.33 s**. Aucun SLA Vercel déduit.

Le client reçoit **713 journées pour la date affichée** (525688 octets JSON) puis **30 lignes pour la PRA sélectionnée** (22247 octets), pas les 21 390 journées. Lecture nationale : huit RPC paginées bornées ; historique : 30 lectures bornées, concurrence quatre. Les valeurs sont projetées/validées côté serveur avec les règles Task19 existantes. Pas de nouveau privilège de données ni de cache climatique implicite.

Les contours complets représentent **23 818 871 octets JSON**, **9 658 498 octets compressés observés** au premier chargement. Une seule récupération des contours par workspace malgré les changements de date et de sélection. La requête porte la version immuable et demande le cache navigateur ; une nouvelle visite sur le navigateur testé retransfère cependant **9658798 octets**. Aucun bénéfice de cache persistant certifié. Aucun retrait de sommet ni contour synthétique pour réduire ce volume. Les changements de date mettent à jour les états des polygones, sans renvoyer les coordonnées. Le poids initial reste une imperfection documentée sur les connexions lentes ; suivre le trafic de cartes et l’egress des lectures avant une montée en charge.

## Reproduire / activer en DEV

Configurer les variables serveur existantes pour **agriclimax-dev** (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`), puis `PRA_NATIONAL_ENABLED=1 pnpm dev`. Ouvrir `/territories`. Sans ce drapeau, l’ancien parcours reste disponible et `/api/national` répond 503 ; les déploiements publics ne sont pas activés implicitement.

Build : `pnpm --filter @agriclimax/web build`. Contrôle réel : démarrer le build sur 127.0.0.1:3020 avec le drapeau DEV, puis `node tests/e2e/national.mjs`. Le build génère le fichier cartographique depuis le référentiel versionné ; il reste hors Git, sans duplication des 24 Mo source.

Aucune migration distante appliquée, aucun diagnostic nouveau, aucun service payant. La mise à disposition publique nécessite une décision d’exploitation tenant compte de [la réserve Supabase](SECURITY.md).
