# Preuves preview — 17 octobre 2026

Cible : branche Vercel Task 18, commit produit be9e018.
Ces fichiers sont des observations du déploiement, distinctes des preuves DEV
sur serveur local et des publications synthétiques archivées au niveau parent.

- `performance.json` : 24 réponses réelles, station publiée 29075001, blé/bovins.
- `publication.json` : métadonnées allowlist du RPC DEV en lecture seule ; dates
  comparées aux faits affichés sur la preview. Aucun payload source conservé.
- `states.json` : texte visible des modes live/démo, sans corps HTML/RSC brut.
- `browser-report.json` et `privacy-*.json` : parcours et contrôles diagnostic.
- Captures dans `../../screenshots/preview/`, logs dans `../../logs/preview/`.

Accès par en-tête `x-vercel-protection-bypass`, limité à l’origine HTTPS exacte
par `tests/e2e/preview-access.mjs`, sans suivi automatique des redirections.
Aucun HAR, trace réseau, cookie ou en-tête d’authentification archivé.
Le contrôle des scripts porte sur les bundles applicatifs `/_next/` chargés par
le diagnostic ; les scripts externes d’outillage Vercel en sont exclus.
