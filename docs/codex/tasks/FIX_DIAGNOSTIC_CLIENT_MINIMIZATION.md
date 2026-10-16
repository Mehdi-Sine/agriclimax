# Correction — minimisation du diagnostic client

Branche `fix/diagnostic-client-minimization` depuis main `eca504e` (Task 16 mergée).
Corriger exclusivement l'exposition du résultat complet dans le diagnostic live.

Frontières : projection serveur dédiée au diagnostic, rendu serveur, propriétés
minimales du filtre client, tests de contrat du DTO et audit HTML/RSC/bundle.
Lecture complète et validation serveur conservées. Aucune modification de RPC,
migration, règle scientifique ou politique de fallback. Carte, historique et
veille conservent leur fonctionnement ; seul le JSON brut du diagnostic disparaît.

Validation : tests web, E2E desktop/mobile réels et synthétiques, build, audits,
`make check`. Identité Git Mehdi-Sine <mehdi.sine@acta.asso.fr>.
Push et PR draft, aucun merge.
