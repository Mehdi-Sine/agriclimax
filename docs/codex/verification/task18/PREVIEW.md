# Preview Vercel — bloquée par authentification

PR draft : https://github.com/Mehdi-Sine/agriclimax/pull/39
Branche : `codex/18-v02-integration`, base main 6e876b2.
Preview : https://agriclimax-git-codex-18-v02-integration-mehdi-sines-projects.vercel.app
Déploiement initial : Vercel Ready, 16 octobre 2026 15:19:31 UTC.

Le GET de la preview depuis l'environnement de vérification renvoie HTTP 302
vers `vercel.com/sso-api`. Aucune donnée applicative, aucun parcours ni mesure de
performance de l'application déployée n'est donc vérifié. Le statut Vercel vert
prouve un déploiement, pas le fonctionnement des lectures DEV depuis la preview.
Aucun accès SSO, token Vercel ou secret d'automatisation disponible n'a été trouvé
dans les variables de session dédiées. Aucun contournement, désactivation de la
protection ou modification de configuration Vercel n'a été effectué.

Accès demandé à l'utilisateur, via connexion Vercel ou secret d'automatisation
configuré hors du chat. La Task 18 reste NON TERMINÉE tant que les parcours réels
blé/bovins et les mesures sur cette preview ne sont pas vérifiés.

Après accès : exécuter `tests/e2e/live-risk.mjs` avec E2E_BASE_URL sur la preview,
collecter les mesures HTTP des quatre vues et répéter les audits HTML/RSC.
Ne pas transmettre de secret dans l'URL, les logs, le dépôt ou la documentation.
