# Task 18 — Intégration produit V0.2

Branche `codex/18-v02-integration`, depuis main `6e876b2`.
Parcours France → blé/bovins → indicateur → station → carte → diagnostic →
historique → veille. Conserver le contexte URL, distinguer live et démo,
harmoniser les indisponibilités, rendre la carte utilisable au clavier et au
toucher, vérifier responsive, accessibilité, minimisation, sécurité et performance.
Aucune nouvelle filière, règle scientifique, interpolation ou notification.

Frontières : contexte et présentation live ; projection du diagnostic ; E2E et
documentation. Aucun changement des pipelines, contrats ou migrations SQL.
Supabase DEV et publications Task 17 : lecture seule. Aucun secret dans les preuves.
Validation réelle et synthétique séparées dans `docs/codex/verification/task18/`.
Build, audits, make check, E2E desktop/mobile et preview requis avant clôture.
Push et PR draft, identité Mehdi-Sine <mehdi.sine@acta.asso.fr>, aucun merge.

Inspection initiale : minimisation déjà corrigée sur main ; lien dernière
publication perdant station/paramètres ; carte statique ; états configuration,
référence absente et absence de sélection à expliciter ; couverture E2E à étendre.
