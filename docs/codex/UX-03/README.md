# UX-03 — Miniatures PRA du Journal

Base : `main` **2f0b47b**, après EDIT-03 (#88) et COUV-02 (#89).

Le Journal publié affiche les cartes de son bundle vérifié dans un carrousel,
immédiatement après le titre et le chapeau. Trois miniatures sur ordinateur,
deux sur tablette, une et l'amorce de la suivante sur mobile. Le défilement est
natif (swipe, pavé tactile, barre horizontale), avec flèches et touches ←/→,
Début/Fin. Aucun défilement automatique. Le mouvement réduit est respecté.

Chaque carte conserve son titre du registre, sa nature (historique/réanalyse ou
prévision), sa période, son unité et la légende du registre `semanticPalette`.
Le lien contient **date + edition_id + map_id** ; Cartes du jour reçoit exactement
la même carte archivée, sans substitution par les données actuelles.

## Fidélité et limites

- Le rendu part uniquement des résultats archivés qualifiés et des mêmes contours
  PRA que la carte interactive, en projection Mercator, Corse comprise.
- Classes et bornes : registre cartographique existant. Couleurs : lecture des
  tokens CSS existants ; aucun nouveau barème ni palette parallèle.
- Même règle d'affichage que `EditionMaps` : `value`, ou `observed_value` sur un
  support `observed_area`, avec hachures de statut partiel. NULL reste gris ; zéro
  garde sa classe. Une portion observée n'est pas extrapolée en valeur territoriale.
- Raster WebP **sans perte**, 480 × 300 ; les classes restent descriptives et ne
  deviennent pas des seuils de dommage. Les détails des supports et les sources
  complètes restent accessibles dans la carte interactive.
- La vue `JournalMapCard` réutilise les champs du contrat **SelectionView EDIT-03**
  (`map_id`, `order`, `role`, `title`, `caption`, `interactive_url`). Elle projette
  exclusivement le catalogue publié. Aucun appel au moteur, classement,
  sous-ensemble simulé ou choix de une EDIT-03 n'est activé : **dix cartes dans
  l'ordre publié** pour chacune des deux éditions de recette.
- Les anciennes éditions sans bundle conservent leur chemin d'illustration
  archivée et leurs états d'absence. Aucune carte récente ne les remplace.
  Les aperçus privés/personnels conservent leur présentation et leurs accès.

## Performance et robustesse

`GET /api/journal/thumbnail?id=…&map=…&v=ux03-1` vérifie l'édition et son bundle
avant rendu. Il n'accepte pas de chemin, source ou valeur arbitraire. Les
contrôles d'intégrité existants restent la frontière de qualification.

Les dix petites images sont demandées dès le rendu HTML, les deux premières
avec priorité haute. Taille réservée pendant le chargement. Aucun WebGL,
GeoJSON national ou payload de lignes PRA n'est chargé dans le Journal avec
bundle. Les liens Next désactivent le préchargement des pages interactives.

Cache mémoire borné à 40 rendus, promesses partagées pendant la génération ; clé
combinant l'identifiant immuable de carte, la version de rendu, les empreintes
des contours et des tokens. Cache HTTP public d'un jour et revalidation pendant
sept jours, ETag SHA-256 du raster et réponse conditionnelle 304. Candidats et
erreurs : `no-store`. Les assets sont explicitement inclus dans la trace Vercel.
Une modification du rendu, des contours ou des palettes exige de changer
`THUMBNAIL_VERSION` pour renouveler également les URL conservées par le navigateur.

Le cache est dérivé et jetable, sans nouvelle table, bucket ou écriture distante.
Un échec de miniature conserve titre, période, légende et lien interactif, avec
un état explicite. L'article, les avertissements expérimentaux et les archives
restent disponibles. Retour arrière : revenir au commit précédent de l'interface ;
aucune opération sur les données.

## Reproduire

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# Serveur de production dans un autre terminal :
NODE_USE_ENV_PROXY=1 pnpm --filter @agriclimax/web exec next start --port 3001
BASE_URL=http://localhost:3001 EVIDENCE_DIR=work/ux03/browser node tests/e2e/ux03.mjs
```

Le test navigateur utilise les archives réelles déjà figées dans
`fixtures/editorial/edit03`, compare leurs vingt payloads au serveur en lecture
seule et ouvre chaque lien sur desktop/mobile. Il contrôle les légendes, dates,
clavier, swipe natif, absence de WebGL dans le Journal, erreurs, chargement,
archives absentes, débordement et WCAG AA (axe). Les secrets de bypass Vercel
restent dans l'environnement et ne sont jamais écrits dans les preuves.

Voir [la consigne et les frontières](TASK.md) et [la recette finale](VERIFICATION.md).
