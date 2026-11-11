# OPS-03 — Journal quotidien : déblocage et résilience

Demande du 11 novembre 2026 : diagnostiquer avant modification les acquisitions stations/prévisions et le snapshot absent ; réparer les causes constatées ; permettre une publication dégradée documentée ; reprendre une date passée sans génération IA en double ; préserver les éditions existantes, validations et budgets ; tests, migration minimale, runbook et PR sans fusion.

Frontières affectées : adaptateurs Python → rapports/leases Supabase ; archives météo → qualification T33 ; métadonnées T34 → contrat T33 ; snapshot immuable → génération/validation IA ; archive partagée → contrôle du Journal. Aucun calcul scientifique, contrat d'authentification ou choix UX modifié.
