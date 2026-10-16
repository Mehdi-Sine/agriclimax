# Matrice de vérification

## Vérifié réellement

- Supabase DEV : lecture RPC privée Task 17, publication météo réelle, aucun write.
- E2E navigateur blé et bovins, carte → diagnostic → historique → veille,
  station + indicateur + fenêtre conservés dans l'URL, retour arrière/avant.
- 1440, 768 et 390 px ; absence de débordement horizontal, audits axe WCAG AA.
- Zoom, recentrage, pan clavier/souris et événements tactiles Chromium à 390 px.
- Diagnostic : HTML, RSC explicite, bundle ; ni payload complet ni provenance privée.
- Mesures HTTP de pages renseignées (station 29075001), trois lectures par vue et
  production ; scans des réponses sans enregistrer leur contenu brut.
- DEV : RLS/grants, lecteur quotidien SECURITY INVOKER, reader historique sans bypass.

## Vérifié synthétiquement

`node tests/e2e/daily-risk.mjs` lance un serveur HTTPS local de publications
synthétiques et un vrai build Next production. Séparation des preuves explicite.
Deux productions, quatre vues, trois tailles, indicateur changé par le formulaire,
contexte URL, retour navigateur, disponibilité/fraîcheur, absence de publication,
fenêtre non publiée, date impossible (aucun appel upstream), station inconnue
(sélection conservée), résultat insuffisant/veille indisponible, source 503,
maintien d'une publication antérieure et absence de fixture de remplacement.
Un marqueur privé de provenance vérifie la minimisation HTML/RSC/bundle.
Erreur de configuration : test unitaire serveur, secret absent, message utilisateur.
Démo : E2E existants desktop/tablette/mobile, libellé de données fictives.

## Commandes

```sh
PYTHONPATH=engine/src make check
DAILY_ARTIFACTS=work/task18/synthetic node tests/e2e/daily-risk.mjs
E2E_BASE_URL=http://127.0.0.1:3000 E2E_LIVE_ARTIFACTS=work/task18/real-final node tests/e2e/live-risk.mjs
CHROMIUM_EXECUTABLE=/usr/bin/chromium QUALITY_ARTIFACTS=work/task18/demo node tests/e2e/demo.mjs
INTEGRATION_BASE=http://127.0.0.1:3020 INTEGRATION_ARTIFACTS=work/task18/integration node tests/e2e/integration.mjs
WHEAT_ARTIFACTS=work/task18/wheat node tests/e2e/wheat.mjs
python scripts/quality/security.py --bundle apps/web/.next/static
python supabase/scripts/check_client_secrets.py
python scripts/quality/budget.py
pnpm audit --json
pip-audit -r engine/requirements-dev.lock -r engine/requirements-climate.lock -r scripts/quality/requirements.lock --no-deps --cache-dir work/pip-audit-cache
```

Environnement local : Node 24.19, pnpm 10.0.0, Python 3.12, Chromium système.
Dépendances installées depuis les lockfiles. Le serveur Next local utilise
`NODE_USE_ENV_PROXY=1` pour le proxy de session ; aucune modification réseau produit.
Les premiers essais ont révélé un miroir local en retard, la configuration du
proxy Node et une cible SVG à améliorer ; ils ne sont pas comptés comme validations.
Les E2E d’intégration existants utilisent un serveur séparé sans configuration
Supabase sur le port 3020 ; leurs absences/erreurs sont des scénarios synthétiques,
pas un constat de panne DEV.
Les logs finaux sont conservés dans `logs/`, les rapports dans `evidence/`.

## Résultats locaux finaux

- `make check` : PASS, 144 tests Python, 203 tests web, lint, typage, build et
  contrôles contrats/sécurité/migrations/exception de dépendance.
- E2E live DEV : PASS, 24 vues (2 productions × 4 vues × 3 tailles).
- E2E publications synthétiques : PASS, 24 vues et cas d'erreur de chaque production/taille.
- Démo : PASS, desktop/tablette/mobile et accessibilité.
- Intégration : PASS, 30 états responsive/WCAG AA (serveur isolé non configuré).
- Blé existant : PASS, 18 audits responsive/thème/vue.
- Confidentialité diagnostic HTML/RSC/bundle : PASS, sources réelles et canary synthétique.
- Audit Python : aucune vulnérabilité connue ; audit Node : seule exception
  préexistante documentée, garde d'exception PASS ; scans secrets et budget PASS.
- Mesures de performance : 24 réponses HTTP réelles renseignées, données DEV.

## Non vérifié / hors périmètre

Voir [LIMITS.md](LIMITS.md). Preview : déployée mais validation bloquée par authentification (voir PREVIEW.md).
CI : contrôles à relever sur le dernier commit après archivage final.
