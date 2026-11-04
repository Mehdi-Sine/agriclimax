# Export portable

Base requise : `e835a5745178c723359e904983eb439931529182`. Branche : `codex/24-unified-product-ux`.

L’export contient tous les commits de la Task, un bundle incrémental Git, une boîte de patchs avec données binaires, les captures et les rapports de validation. Les secrets, node_modules, .next et fichiers .env sont exclus. Le bundle dépend du commit de base déjà présent dans le dépôt du propriétaire.

Après extraction, choisir **une** méthode dans le dépôt AgriclimaX :

```sh
# Méthode bundle
git bundle verify /chemin/task24.bundle
git fetch /chemin/task24.bundle codex/24-unified-product-ux:codex/24-unified-product-ux
git switch codex/24-unified-product-ux
```

```sh
# Ou méthode patchs, à partir du commit de base
git switch -c codex/24-unified-product-ux e835a5745178c723359e904983eb439931529182
git am /chemin/task24.patch
```

Les deux méthodes restituent les mêmes commits ; ne pas les cumuler. Ne pas réinitialiser une branche préexistante. Les sommes SHA-256 accompagnent les artefacts. Publier ensuite cette seule branche et créer une unique PR **draft**, avec le texte préparé dans `docs/codex/task24/PR_DRAFT.md`. Aucun merge ni déploiement production n’est autorisé par cette livraison.
