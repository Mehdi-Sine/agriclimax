## Problème et résultat

Le diagnostic scientifique doit rester accessible et auditable après l’intégration
de la carte Task 06. Cette PR fournit la vue métier Task 08, sa route partageable
et son accès depuis la cellule sélectionnée de la carte, sans calcul scientifique
frontend. Hazard/exposure/sensitivity/risk, confiance, fraîcheur, qualité, règle,
fenêtre/série, provenance, statut et limites restent distincts. Une composante
absente ne vaut jamais zéro ; les métadonnées absentes de V1 sont annoncées.

**Blocage sécurité restant :** `pnpm audit --audit-level high` échoue sur
`braces 3.0.3` (GHSA-vfj7-8cjw-p6xm), sans correctif publié. L’audit et son seuil
restent actifs. PR draft, aucun merge.

## Périmètre

- Task / branche : Task 08, `codex/08-scientific-diagnostic`, rebasée sur main `9159764` contenant Task 06.
- Imports ObservationSpace et diagnostic conservés ; accès à location protégé au rendu serveur, contexte carte/deep-link préservé.
- Lien diagnostic ajouté au panneau carte et au résumé mobile, fondé sur l’identité et la version reçues.
- Contrats consommés : RiskResult V1, map/series existants ; aucun contrat modifié.
- Impact scientifique : aucun changement de règle, paramètre, configuration ou moteur.
- Sécurité : AJV 8.17.1 → 8.18.0 ; pytest 8.4.2 → 9.0.3, borne dev ajustée et compatibilité testée. Aucun autre paquet Python modifié.
- Migrations/workflows/seuils : inchangés. Pas d’écriture distante ou déploiement.

## Vérification

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (86 tests), `pnpm build`, `python -m pytest engine/tests` (44 tests) et `make check` : passent.
- Audits Python stricts du lock engine et du lock qualité : passent ; audit navigateur npm high : passe.
- Audit JS high : 1 high braces, sans correctif publié, aucun moderate/critical après AJV. JSON avant/après conservés.
- E2E Observation, Diagnostic et Task 09 : desktop/tablette/mobile, carte et sélection, couches, contexte, deep-link/retour, drawer/clavier et clair/sombre ; zéro violation axe détectée.
- Guard bundle client : passe, aucun secret détecté. Démo explicitement marquée, erreurs live sans remplacement fictif.
- Rapport actuel : `docs/codex/verification/task08/INTEGRATION.md` ; résultats, audits et captures : `docs/codex/verification/task08/integration/`.
- Limites : aucune définition complète de méthode/seuil/nature de valeur dans V1 ; absences affichées. Live non vide testé via API simulée validée, sans insertion distante. Axe ne certifie pas WCAG complet.
