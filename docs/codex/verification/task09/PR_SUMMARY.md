Task 09 rebasée sur main Tasks 01–05 (`a5c7c90`), sans changement métier,
UI, contrat ou migration. CI transversale, scans, guards bundle et logger conservés ;
SQL réutilise le harness Task 04 en matrice public/extensions. E2E adaptés au shell,
clavier/dialogues/thèmes/catalogue et smoke API/live. Workflow ingestion intact.

Validation : make check, 44 tests Python, 33 web, 7 guards, 2 logs, couverture 82 %,
build, contrats, SQL/RLS/RPC deux schémas, smoke et absence de secrets client passent.
Captures desktop/tablette/mobile et preuves : docs/codex/verification/task09/.

Blocages revalidés : pytest 8.4.2 (PYSEC-2026-1845), braces high sans correctif ;
AJV moderate également signalé. E2E bloque sur WCAG 2.5.3 du lien de marque desktop
(signature visible absente du nom accessible). Aucun bypass. Ancienne alerte RLS
résolue par Task 04 retirée. Gitleaks : seul faux positif SHA-1 Git historique
exclu précisément après vérification. PR draft, aucun merge.
