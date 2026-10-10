# Task 07 — Watch Ai Provenance

**Branche :** `codex/07-watch-ai`

## Objectif
Créer le fil de veille comme objet structuré et préparer une génération IA sûre, factuelle et vérifiable.

## Scope
- modèle `WatchSignal`;
- dériver les signaux d'événements/résultats structurés ;
- compacte/détaillée ;
- filtres territoire/production/risque ;
- EvidenceBundle ;
- template narrative versionné ;
- interface provider LLM mais `DeterministicTemplateProvider` par défaut ;
- marque “assisté par IA” ;
- provenance visible ;
- mécanisme anti-hallucination : chiffres/sources uniquement depuis EvidenceBundle ;
- clic signal → contexte carte/diagnostic.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- fonctionne sans LLM ;
- toute narration relie ses faits à evidence IDs ;
- tests qui interdisent l'invention de nouvelles valeurs/URLs dans le provider déterministe ;
- état IA indisponible sans casser la veille.
