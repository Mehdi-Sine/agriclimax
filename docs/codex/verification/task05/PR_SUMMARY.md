# Task 05 — Design system et shell responsive AgriclimaX

Le socle affichait une page minimale. Cette branche fournit l'identité AgriclimaX,
les tokens clair/sombre, primitives réutilisables, états scientifiques explicites,
assets SVG originaux, polices locales et un shell Observation/Veille/Diagnostic.
Sur mobile : Carte/Veille, filtres en sheet et détails plein écran ; sur tablette :
veille repliable. Le catalogue `/design-system` et les guides documentent les API.

La branche est rebasée sur `main` **e3c14d6**, après merge des Tasks 02–04. Le conflit
package.json a été résolu en conservant les dépendances API de main et les types
React DOM de Task 05. Les composants, tokens, styles et assets validés sont conservés.

Le shell garde la démo locale par défaut. Le mode `?mode=live` lit via le repository
serveur Task 04, avec contexte scientifique explicite. Une réponse live vide affiche
« Données absentes », sans niveau de risque ou signal fictif ; une erreur reste
visible sans fallback démo. Les résultats live non vides sont seulement comptés,
en attente de la restitution cartographique Task 06.

- Scope : UX/UI et documentation Task 05 seulement. Aucun diff dans moteur,
  ingestion, config scientifique, migrations, contrats, handlers/API ou repository serveur.
- Contrats consommés : fixtures V1 map-feature/risk-result/watch-signal pour la démo ;
  DTO live validé par le repository existant. Aucun JSON Schema modifié.
- Sécurité : server-only conservé, aucun secret navigateur, aucune écriture/seed DEV,
  migration ou déploiement. Seul ajout dev : @types/react-dom.
- Validation : **make check complet réussi**, lint, typecheck, build, 33 tests web,
  44 tests Python, contrats ; scan de 13 artefacts navigateur sans secret.
- Responsive/accessibilité : 1440×900, 1024×768, 390×844 ; clavier/focus, thèmes,
  reduced motion ; 15 audits axe sans violation et 44 paires de contraste valides.
- Live réel : map, series et territory **HTTP 200** avec réponses vides, no-store ;
  shell live vide fonctionnel aux trois résolutions, paramètres préservés.
- Preuves : `docs/codex/verification/task05/` — rapport, logs, captures, audits,
  inventaire et scripts reproductibles.
- Limites : pas de carte métier, moteur de veille ou diagnostic final ; Chromium
  uniquement, aucune certification WCAG ou PWA offline revendiquée.

PR draft vers main ; aucun merge.
