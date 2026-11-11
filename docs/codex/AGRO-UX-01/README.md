# AGRO-UX-01 — Journal agroclimatique intégré

**Statut : PARTIAL pour la production.** Branche `codex/agro-ux-01-journal-integration`, construite depuis main `bd475ff`, indépendante de MF-01. Aucun appel OpenAI payant, aucune publication ou fusion de PR, aucune modification de contrat ou donnée de production.

- [Synthèse, dépendances, conflits, ordre de fusion et retour arrière](INTEGRATION.md)
- [Tableau d’audit des 13 indicateurs historiques et de la température moyenne](INDICATORS.md)
- [Recette, tests, limites et récupération de l’artefact Actions](VALIDATION.md)
- [Recette utilisateur en 10 minutes](RECIPE-10-MIN.md)
- [Captures navigateur desktop et mobile](evidence/browser/)
- [Rapport réel de recalcul local du 11 novembre](evidence/local-run.json)
- [Couverture et NULL des 40 cartes](evidence/maps.json)
- [Rejeu déterministe des captures](evidence/replay.json)

UX-01 #77 réutilisée intégralement avec ses six commits. AGRO-02 #76, OPS-03 #78 et OPS-04 #79 déjà présentes dans main et réutilisées. COUV-01 #63 auditée mais non intégrée : elle n’est pas un prérequis UI et sa qualification nationale reste incomplète.

La version intégrée ouvre le Journal à l’accueil, conserve ses archives réelles et propose les rubriques UX-01. Les cartes de test gardent leur espace isolé ; l’absence de carte archivée opérationnelle n’est jamais remplacée par une carte calculée en test. Les valeurs manquantes et les 713 PRA, dont six corses, sont conservées.
