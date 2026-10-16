# Minimisation du diagnostic — 16 octobre 2026

Le diagnostic live ne sérialise plus le portfolio blé ou le résultat THI complet
dans un bloc JSON. `diagnosticDto` construit côté serveur une liste explicite des
champs consommés par la présentation de méthode : règle/version/statut, qualité,
limites, couverture et références blé, ou formule/source scientifique et premier
seuil THI. La traçabilité agrégée déjà affichée est conservée. Le filtre client
reçoit uniquement les identifiants et noms des stations, sans coordonnées ni
métadonnées de récupération. Le rendu et la projection sont `server-only`.

La lecture quotidienne complète et sa validation restent côté serveur. Aucun
changement des RPC, migrations, calculs scientifiques ou règles d'absence/erreur.
L'historique conserve sa série quotidienne affichée, distincte du diagnostic.

## Vérifications

- `pnpm test` : 201 tests, 15 fichiers ; trois nouveaux tests de forme exacte du
  DTO blé/bovins et de sélection absente. `pnpm typecheck` : PASS.
- `PYTHONPATH=engine/src make check` : PASS, dont 144 tests Python, contrôles de
  qualité/contrats/sécurité/migrations, lint, typage, tests web et build production.
- `pnpm build` : PASS (également exécuté par `make check`).
- `node tests/e2e/daily-risk.mjs` : PASS, source HTTPS synthétique, blé/bovins,
  quatre vues, desktop 1440/mobile 390, WCAG AA, contexte, absence, déconnexion,
  maintien d'une publication précédente, aucun fallback. Provenance enrichie d'un
  marqueur privé pour détecter sa fuite, sans modifier la fixture de référence.
- `E2E_BASE_URL=http://127.0.0.1:3017 node tests/e2e/live-risk.mjs` : PASS, lectures
  réelles seules sur DEV, quatre vues, deux productions et deux tailles ; aucune
  acquisition, écriture distante ou migration déclenchée.
- Audit dédié : réponse HTML initiale (RSC embarqué compris), réponse RSC explicite
  avec vérification du type `text/x-component`, absence de `<pre>` dans le diagnostic,
  recherche des champs du payload brut et du marqueur privé ; PASS pour les deux
  productions et tailles sur sources réelles et synthétiques. Les 19 fichiers JS
  du bundle client ne contiennent ni lecteur quotidien, ni secret serveur, ni
  ancien bloc JSON. Rapports `privacy-*.json` : compteurs uniquement, aucun corps
  HTML/RSC ou payload réel enregistré.
- E2E démonstration : PASS, desktop/tablette/mobile, accessibilité et responsive.
- E2E intégration : PASS, 30 états responsive/WCAG AA.
- E2E blé existant : PASS, 18 audits responsive/thème/vue et navigation.
- Audit secrets source/bundle et `check_client_secrets.py` : PASS.
- Budget JS/CSS gzip : 568827 octets / 2097152 autorisés : PASS.
- `pnpm audit` : seule exception préexistante GHSA-vfj7-8cjw-p6xm (`braces` 3.0.3,
  chaîne ESLint de développement), contrôlée par `audit-exceptions.mjs --build`,
  absente des dépendances production et des traces serveur. Aucune exception ajoutée.
- Audit Python des trois lockfiles : aucune vulnérabilité connue.

Les rapports réels et synthétiques sont distincts. Les captures et journaux
complets restent dans `work/diagnostic-minimization/` ; seuls les rapports sans
payload source sont versionnés ici. Ces vérifications portent sur le diagnostic
live Task 16 ; les autres modes de diagnostic ne sont pas modifiés.
