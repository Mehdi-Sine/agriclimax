# Wheat MVP : indicateurs climatiques réels du blé tendre

Ajoute dix indicateurs descriptifs versionnés et configurables pour blé tendre,
calculés en Python depuis les lots quotidiens réels Météo-France Task11. Carte,
diagnostic et veille descriptive affichent les résultats avec couverture,
fraîcheur, paramètres, provenance, sources et limites, sans risque agronomique ni
stade inféré. Cinq stations et deux fenêtres sont livrées comme instantanés réels
traçables : 80 valeurs et 20 anomalies indisponibles. Les anomalies appellent
Task12 mais exigent des références locales et années suffisantes.

`make check` passe avec pnpm 10.0.0 : 90 tests Python, 145 tests web, lint,
typecheck et build. 18 audits navigateur sur trois tailles, deux thèmes et trois
espaces sans violation WCAG AA. SQL local public/extensions, mypy strict, ruff,
audits dépendances, secrets et bundle client passent ; exception JS préexistante
inchangée. Méthodes et preuves dans `docs/codex/verification/task13/`.

La migration Wheat privée est préparée et testée localement, **non appliquée à
distance** : application refusée par l'approbation automatique sans autorisation
distante explicite. Le mode par défaut utilise les instantanés réels serveur ;
le mode Supabase reste optionnel après autorisation. Task12, ses migrations et
les contrats de risque restent inchangés. PR **draft**, aucun merge.
