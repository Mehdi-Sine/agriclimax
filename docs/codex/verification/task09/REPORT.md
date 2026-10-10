# Task 09 — vérification après rebase

Base main : `a5c7c903313f675a4910d06b0029f1db870174a1` (Tasks 01–05).
Branche distante précédente : `d8c40cef6bc9f3d251c01c2c255318453e413881`.
Rebase effectué avant les adaptations. Seul conflit : README, sections 05 et 09
conservées. Identité locale : Mehdi-Sine <mehdi.sine@acta.asso.fr>.

Les dossiers apps/web, engine, config, contracts, supabase et le workflow
 data-ingestion sont identiques à main. Aucun contrat, calcul, migration ou UI
modifié. Les versions récentes de main sont conservées.

## Résultats exécutés

make check : succès, contrats/config, 44 tests Python, 33 tests web, lint,
typecheck et build Next.js. Guards : 7 tests Python, 2 tests logs ; couverture
82 %, seuil 80 %. Ruff ciblé, YAML et actionlint des trois workflows : succès.
Quatre migrations exécutées via le harness Task 04 sur PostGIS 17 jetable,
public et extensions : RLS/permissions, publication, zoom, idempotence,
2 features/10 résultats V1/250 cell-days et plans de requêtes : succès.

Smoke production local : démo, trois API invalides avec 400/no-store/nosniff,
contexte live incomplet sans fallback fictif : succès.
Bundle reconstruit avec faux secrets serveur : guards Task 09 et Task 04 passent,
13 artifacts, aucun nom ni valeur SUPABASE_SECRET_KEY détectés. Budget client
195601 octets gzip, plafond 2 MiB ; HTML <256 KiB, navigations <15 s.

E2E Chromium système : desktop 1440×900, tablette 1024×768, mobile 390×844.
Parcours, clavier/lien d'évitement, focus trap/restauration mobile, diagnostic,
panneau tablette, thèmes, contexte invalide, absence réseau distant/overflow/
erreur navigateur et reduced-motion : passent. 12 audits page/thème/format,
plus 3 audits initiaux. Gate final en échec : desktop présente une violation
serious WCAG 2.5.3 label-content-name-mismatch du lien `.brand`, car le nom
accessible omet la signature visible. Tablette/mobile : aucune violation axe.
Le test collecte tous les résultats avant de bloquer ; aucun filtre de règle.
Captures et report.json correspondent au shell actuel, anciennes preuves remplacées.

## Audits actuels, sans reprise aveugle des anciennes alertes

Snapshots des lockfiles de main audités : pytest 8.4.2 / PYSEC-2026-1845 reste
présent (correctif >=9.0.3, contrainte engine<9). braces 3.0.3 /
GHSA-vfj7-8cjw-p6xm reste high, aucun correctif publié. Branche : 1 high,
1 moderate AJV GHSA-2g4f-4pwh-qvx6 (>=8.18.0), aucun critical.
Overrides Vitest/Tinypool corrigent les autres alertes de main. Outils Python
Task 09 et outillage navigateur : aucun avis détecté. Les audits bloquants
échouent effectivement ; aucun continue-on-error ni exception vulnérabilité.
L'ancienne alerte RLS absente est retirée : Task 04 l'a résolue.

Scan source et Gitleaks historique : passent. Une occurrence historique vérifiée
était un SHA-1 Git de migration 0004 dans la preuve Task 04 ; git cat-file et
hash-object confirment le blob. .gitleaksignore exclut uniquement son fingerprint,
sans exclusion de chemin/règle. Le rapport final masqué est vide.

## CI et limites

Quality réutilise le harness SQL Task 04, sans deuxième implémentation SQL.
Le workflow data-ingestion de main reste intact ; aucun doublon d'ingestion.
Security audits demeure indépendant et bloque les vulnérabilités réelles.
Workflows validés localement avec actionlint et checks YAML. Exécution hébergée
à consulter dans la PR ; la preuve locale ne prétend pas que GitHub Actions passe.

Les regex ne détectent pas tout secret obfusqué ; axe ne certifie pas WCAG complet.
Les budgets locaux ne mesurent pas les Core Web Vitals réels. Le harness SQL
n'émule pas toute la plateforme Supabase. Aucune connexion cloud effectuée.
Le logger opérationnel reste une primitive d'outillage, sans refactor métier.
PR draft : audits dépendances et gate a11y non verts. Aucun merge.
