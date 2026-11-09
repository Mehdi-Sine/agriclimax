# Recette T36 — état après essai réel

1. **DEV** : registre, RLS et RPC appliqués séparément ; migration ciblée des tentatives opérationnelles 20261109152744 appliquée. Aucun tableau ajouté, historique HTTP400 intact, aucun contrôle comptable dans la génération T36. Admission manuelle même date testée sur le vrai snapshot avec rollback ; deux connexions locales concurrentes : une admission, une refusée.
2. **OpenAI réel** : réponse complète obtenue dans le run 42646091222, 14845 tokens entrée /1689 sortie, estimation 0,025619 €. Le texte et ses sources sont archivés en DEV et proposés à l’inspection propriétaire dans la maquette actuelle. **Rejet scientifique conservé : cinq contrôles bloquants, aucune approbation ni publication.**
3. **Exploitation** : gel et réutilisation des archives réelles vérifiés ; passage sans IA réexercé sans appel. L’espace personnel distingue désormais réponse reçue rejetée, brouillon validé techniquement et approbation éditoriale. Le Journal public reste inchangé.
4. **Restant** : revue scientifique du texte ; fusion manuelle après CI ; NIGHTLY et contrôles DB quotidiens à activer après configuration health/bypass Vercel. Aucun approbateur obligatoire editorial-ai-dev. Watchdog inactif et Vault sans token ; configurer son token séparément si utilisé. Aucune nouvelle clé OpenAI ni pièce comptable requise.
5. **Limite réelle** : aucune nuit complète mesurée, aucun engagement de disponibilité entre 06:30 et 07:00. Reprises à 30 minutes, planning Paris et contrôles sont implémentés/testés, puis doivent être observés en exploitation réelle.

[Preuve de l’essai et détails](FIRST_REAL_AI_EDITION.md), preuves assainies dans
`evidence/operational/`. PR #73 conservée sur sa branche, sans merge automatique.

Validation finale locale : **559 tests passés, 7 ignorés**, lint, typecheck et build
réussis. Aucun appel fournisseur dans ces tests. Le workflow manuel réel est rouge
pour rejet scientifique ; cela ne représente pas un nouvel échec HTTP.
