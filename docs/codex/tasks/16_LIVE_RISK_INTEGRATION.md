# Task 16 — Intégration des indicateurs live

Branche `codex/16-live-risk-integration`, depuis main `8b73bfd` (Tasks 11–15).
Carte : production blé/bovins, indicateur, période, valeurs réelles aux points
station, sélection, diagnostic, historique et veille partageant le contexte URL.
Source, date, fraîcheur, statut scientifique, indisponibilité et limites visibles.
Aucun remplacement silencieux par fixtures ou instantanés en live. Responsive
et E2E obligatoires. Identité Git Mehdi-Sine <mehdi.sine@acta.asso.fr>.
Push, PR draft, aucun merge.

Frontières : routage et présentation live communs ; adaptateurs des lectures
Task11/13/14 ; catalogue et limites de couverture Task15 ; tests et documentation.
Aucune modification des règles scientifiques, contrats gelés ou schémas SQL.

## Reprise après validation réelle Task 17

Rebase sur `main` 5160f9b, consommation des publications quotidiennes atomiques
blé/bovins dans les quatre espaces. Frontières ajoutées : adaptateur serveur et
RPC privée bornée de lecture (migration additive uniquement), tests de cycle de
publication et E2E isolés. Aucun changement des tables existantes, des écritures
Task 17, des contrats gelés ou des règles scientifiques. L'absence de statut de
run et d'horodatage exact de publication doit rester explicite. Migration distante
non appliquée ; déploiement web conditionné à son installation. Voir le rapport
`docs/codex/verification/task16/README.md` pour les preuves et limites.
