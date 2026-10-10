# Prompts de lancement parallèle — Wave 1

Après merge de Task 01, créer **8 tâches Codex distinctes**. Pour chaque tâche :

> Read `AGENTS.md`, `docs/codex/ORCHESTRATION.md`, and `docs/codex/tasks/XX_....md`. Execute that task only on the specified branch. Respect directory ownership. Do not modify shared contracts; if a contract change is required, stop that part and write a cross-workstream request. Run the task's tests and provide a PR-ready summary. Do not merge other agents' branches yourself.

Puis ajouter le numéro de task correspondant.

## Conseil de parallélisme
Si les ressources Codex sont limitées : lancer d'abord 02, 03, 04, 05. Puis 06, 07, 08, 09 dès que 05 ou les APIs minimales sont suffisamment stables. Le mode démo permet néanmoins à 06–08 d'avancer sans backend réel.
