# Checkpoint portable Task25

Branche unique : `codex/25-national-agriculture-data`. PR draft : https://github.com/Mehdi-Sine/agriclimax/pull/54. Base requise : `78e2881ba072b0a468e782018689fff70c13c5dc`.

Un bundle de secours vérifié est conservé dans `work/task25/` du worker. Les sources RPG brutes, dépendances, fichiers de secrets et magasins de certificats ne sont pas exportés. Les 520 fichiers JSON publics de restitution, les méthodes, les contrôles et les captures locales sont versionnés dans la branche.

Pour régénérer un bundle nommé (choisir un nom de sortie non existant) :

```sh
git bundle create work/task25/task25-export.bundle 78e2881ba072b0a468e782018689fff70c13c5dc..codex/25-national-agriculture-data
git bundle verify work/task25/task25-export.bundle
```

Dans un dépôt contenant déjà le commit de base, importer sans écraser de branche préexistante :

```sh
git fetch /chemin/task25-export.bundle codex/25-national-agriculture-data:codex/25-national-agriculture-data
git switch codex/25-national-agriculture-data
```

Le checkout de départ Task24 a été vérifié par les empreintes exactes de l'arbre et du commit signé. L'historique complet de ses parents a ensuite été récupéré. Aucun nouveau socle parallèle n'a été créé.

La recette visuelle distante est passée via une passerelle locale en lecture seule vers la Preview, TLS amont vérifié normalement ; aucune modification du magasin de confiance personnel. Voir `preview/browser-real.json`.
