# Task 07 — Veille structurée et EvidenceBundle vérifiable

La route `/watch` présente des signaux dérivés de résultats structurés, avec
filtres partageables, vues compacte/détaillée et détail de provenance. La fixture
existante est explicitement fictive ; le mode live non branché affiche son état
sans fallback. Confiance, fraîcheur, période, sources et règle/version sont
conservées dans un EvidenceBundle versionné avec digest et références validées.

La narration server-only utilise un provider déterministe, désactivable, sans
LLM réel ni accès libre à la DB. Les segments référencent leurs evidence IDs.
Tout ajout de valeur, URL ou conclusion hors projection factuelle est rejeté.
L’audit conserve le payload, le modèle/provider, la version et le timestamp UTC ;
les contenus assistés par IA sont distingués explicitement.

Contrats consommés : WatchSignalV1 et RiskResultV1, inchangés.
Impact scientifique/security/migration : aucun calcul, seuil, migration ou RLS
modifié ; isolation server-only et contrôle du bundle client. Pas de fournisseur
réel branché. Données de démonstration non validées scientifiquement.

Validation : baseline main et make check final, lint, typecheck, build,
44 tests Python, 52 tests web, tests qualité et contrats. Vérification navigateur
desktop/tablette/mobile avec axe, clavier et zéro requête externe ; captures et
logs dans `docs/codex/verification/task07/`.

Limites : route `/watch` dédiée ; raccordement du slot/navigation du shell au
workstream d’intégration documenté dans `cross-workstream/07-request.md`.
Adapter live et persistance de l’audit non branchés. Carte/diagnostic métier
restent aux Tasks 06/08. PR draft, aucun merge.
