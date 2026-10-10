# Task 09 — CI, guards sécurité et vérification du mode démo

Le main Task 01 avait des checks locaux mais aucune CI. Cette branche automatise
lint/typecheck/tests/build, contrats/config, forward-only SQL et exécution des
migrations sur PostGIS. Elle ajoute scans de secrets et dépendances, un guard du
bundle client avec faux secret sentinelle, E2E démo desktop/tablette/mobile avec
axe, budgets de base et artifacts exploitables.

Les nouveaux guards ont une couverture ciblée de 82 % avec seuil CI 80 %.
Le logger NDJSON testé élimine les champs non autorisés ; sa convention et les
codes d'erreur sont documentés. Actions/image/binaries sont fixés par SHA/digest/
checksum ; pnpm et Playwright disposent de lockfiles, les outils Python de pins.
Les overrides Vitest 4.1.11 / Tinypool 2.1.2 corrigent les alertes de test connues.

Validation locale : lint, typecheck, build, 10 tests engine, 3 tests web,
7 tests guards et 2 tests logs passent. Smoke, E2E aux trois formats, zéro
violation axe détectée, aucune fuite détectée par les scans, et deux migrations
appliquées avec succès sur DB jetable. Total client gzip : 174 695 octets.

**Blocages à conserver visibles :** audit JS high sur braces sans correctif
publié ; audit Python sur pytest 8.4.2, à corriger par Task 02 avec sa contrainte
<9. RLS du starter signalée à Task 04. Aucun bypass d'audit ajouté. La sécurité
dépendances n'est pas verte ; ce résumé ne constitue pas une recommandation de merge.

Contrats consommés : map-feature, risk-result et watch-signal V1. Contrats,
migrations, règles et formules modifiés : aucun. Les domaines métier et le shell
produit sont inchangés. La CI hébergée reste à exécuter ; les limites du harness
Supabase, des regex, de l'a11y automatisée et des budgets sont dans REPORT.md.

Aucune autre Task exécutée. Aucun merge.
