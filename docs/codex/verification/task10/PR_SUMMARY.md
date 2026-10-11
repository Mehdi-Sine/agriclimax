# AgriclimaX V0.1 — intégration des parcours existants

La navigation perdait la cellule courante entre carte, diagnostic et veille,
notamment au retour d’un diagnostic ouvert par deep-link. Les parcours partagent
maintenant cellule, production, indicateur, date, règle/version, comparaison et
caméra. La navigation shell ouvre le diagnostic partageable ; le lien signal →
carte transporte la règle/version de l’EvidenceBundle. Les identifiants pointés
acceptés par l’API restent présents dans l’URL.

Deux corrections mobiles empêchent le lien Diagnostic de partager la ligne de
validité du bottom sheet et la navigation fixe de recouvrir la fin de la veille.
Aucun redesign, fonctionnalité métier, formule, seuil, contrat, migration,
RLS, seed ou donnée métier ajouté. Veille live toujours non connectée et explicite.

Validation : make check, 109 tests web/44 Python, audits JS/Python/navigateur,
Gitleaks, scans bundle/source, trois API Supabase réellement vides, vérifications
SQL en lecture seule, E2E existants et intégration aux trois formats, captures et
contrôles axe. CI ajoute l’intégration avec API vide explicitement simulée ; les
preuves du live réel restent distinctes. Exception braces 3.0.3 héritée inchangée.

Documentation, limites et prochaines étapes : docs/codex/verification/task10/.
Statut Preview/CI et PR : DELIVERY.md. PR draft uniquement, aucun merge.

Preview : https://agriclimax-git-codex-10-integration-v01-mehdi-sines-projects.vercel.app
Déploiement Vercel réussi ; visite HTTP bloquée par la liste réseau du proxy
de l’environnement (403 CONNECT), donc accessibilité publique non attestée.
