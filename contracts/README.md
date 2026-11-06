# Contracts

Les contrats sont l'interface entre workstreams. Ils sont versionnés et testés.

## Fichiers
- `jsonschema/*.schema.json` : échanges persistants/publics.
- `examples/` : fixtures conformes.
- `CONTRACT_CHANGE_PROCESS.md` : procédure de modification.

Après Wave 0, aucune tâche parallèle ne modifie ces fichiers sans PR dédiée.

`agroclimatic-1.schema.json` décrit les 713 résultats de l'API `/api/agroclimatic`.
La règle reste exploratoire ; `value` est NULL si la période ou sa provenance
est incompatible. `series` et `signals` sont détaillés uniquement pour le
paramètre `pra` sélectionné ; les autres tableaux restent vides afin de limiter
le transfert. Les cumuls ne traversent ni lacune ni changement de source/run.
