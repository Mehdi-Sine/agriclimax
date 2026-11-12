# Vérifications EDIT-01

Le correctif d'exécution porte uniquement sur le prompt et sa version. Aucun
changement de validateur, contrat, acquisition, stockage ou parcours de publication.

La recette privée a vérifié les empreintes du snapshot, de l'archive et de la
requête OpenAI originale, puis reproduit exactement les deux rejets. Une relecture
distante a confirmé les documents inchangés et l'absence de publication. Les
preuves restent locales dans `work/edit01/private/` ; aucune donnée Supabase brute
ou métadonnée fournisseur privée n'est incluse dans cette PR publique.

La régression publique utilise uniquement `task35/evidence/forecast-edition.json`,
simulation déjà versionnée, sans la présenter comme une nouvelle génération réelle.
Les tests sont sans clé ni réseau. Depuis `apps/web` :

```sh
node_modules/.bin/vitest run features/editorial-ai/edit01.test.ts
```

Vérifications générales : suite web, TypeScript web et CLI éditoriale, lint web,
build Next.js, 7 tests de contrats éditoriaux Python, 28 tests qualité Python et
2 Node, contrats JSON, migrations, secrets source/client, budget bundle et contrôle
des exceptions de dépendances. Résultats finaux dans la description de PR.
Le build conserve son warning préexistant de traçage filesystem dynamique dans
archive.ts. Aucun changement d'interface : pas de recette navigateur ajoutée.

Sous charge, deux tests préexistants ont dépassé le délai de 5 secondes ; la suite
complète est aussi exécutée avec `--testTimeout=30000`, sans modification des
assertions ou de la configuration versionnée. Les sous-processus tsx utilisent
des sockets IPC locaux nécessitant une exécution autorisée hors sandbox.

[DIAGNOSTIC.md](DIAGNOSTIC.md) documente la cause et la procédure de reprise.
La qualité du nouveau prompt n'est pas déclarée validée par une nouvelle rédaction
OpenAI. **NO-GO pour une relance partagée qui pourrait rendre le résultat consultable.**
