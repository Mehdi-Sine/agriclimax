# Vérification EDIT-03

## Résultat

**237 tests réussis dans 23 fichiers**, dont 23 nouveaux tests EDIT-03, les suites
éditoriales IA, les publications cartographiques et les régressions nocturnes
OPS-07. [Journal de test](evidence/tests.log).

```sh
cd apps/web
node_modules/.bin/vitest run features/editorial-map-selection features/nightly features/edition-maps features/editorial-ai
node_modules/.bin/eslint features/editorial-map-selection/*.ts
```

TypeScript web et scripts EDIT-03 : réussis. Contrôle des secrets et
`git diff --cached --check` : réussis. Simulation répétée : neuf fichiers de
résultats identiques octet pour octet aux preuves versionnées. Aucune interface
n'étant modifiée, aucune recette responsive ni activation de site n'est requise.

```sh
apps/web/node_modules/.bin/tsc --noEmit --project apps/web/tsconfig.json
apps/web/node_modules/.bin/tsc --project scripts/tsconfig.edit03.json
python scripts/quality/security.py
git diff --cached --check
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/edit03_simulate.ts
```

Un premier passage final a dépassé de 0,2 seconde la limite par défaut de cinq
secondes du test de comparaison qui vérifie deux bundles réels complets, alors
que les vérifications TypeScript tournaient simultanément. Le délai de ce seul
test est fixé à quinze secondes ; le passage final complet est réussi.

## Points couverts par les nouveaux tests

- Intégrité de l'archive, du manifeste et des dix cartes ; refus d'altération,
  mauvaise liaison d'édition, identité PRA inventée et date hors périmètre.
- Exactitude des couvertures 645/713 et 713/713, distribution et géographie ;
  URL interactive liée à l'édition et à la carte exactes.
- Exclusion des valeurs partielles et des valeurs non admises au Journal ;
  maintien de NULL et zéro ; pas de seuil quotidien inventé depuis un cumul.
- Absence d'évolution déduite des fenêtres réellement chevauchantes/décalées ;
  branche comparable testée sur une copie synthétique avec contrôle des supports.
- Déterminisme, diversité, pénalité de corrélation, sélection de six ou zéro
  cartes, augmentation du nombre de PRA qualifiées et univers normalisé.
- Entrées gelées récursivement : aucune mutation du catalogue, des cartes ou
  de l'archive en mémoire.
- Comité à références contrôlées : refus des scores, titres ou preuves inventés,
  des doublons, omissions et cartes sous le plancher ; données UX ordonnées.
- Fournisseur injecté appelé une fois ; dossier/modèle/prompt/horodatage conservés ;
  zéro appel en absence de sélection ; erreur ou réponse trop grande rejetée.

## Conservation des preuves distantes

Les archives ont été relues après les simulations par les mêmes opérations en
lecture (`archive_read`, `snapshot_read`, Storage GET). Les identifiants,
checksums d'archives, empreintes de bundles, identifiants de snapshots et
références de blobs publiés sont identiques au manifeste de départ :

| Date | Archive / révision | Checksum |
|---|---|---|
| 12 novembre | `650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee` / 1 | `da02f749abb01e20ce1617cea31d1278609310d836ad8614cea8b6fa7d61394b` |
| 13 novembre | `35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222` / 2 | `bd1a261966ef5b01aa3a7373e639ca1230fa44d90f58a8c83a3d3696e97b349f` |

La tâche effectue zéro écriture distante, acquisition et appel OpenAI. Les
réservations, générations, approbations et publications quotidiennes ne sont
jamais invoquées. L'empreinte en mémoire des archives et cartes est également
contrôlée avant/après chaque simulation.

## Coordination COUV-02 et OPS-07

La branche `codex/edit-03-editorial-map-selection` part du commit
`80aa4aa05dd17e4024a5c601f92985935eb4fc38` de main, fusion OPS-07. Aucun commit
COUV-02 n'est utilisé. Le diff ne comporte que de nouveaux fichiers sous :

- `apps/web/features/editorial-map-selection/` ;
- `scripts/edit03_*` et `scripts/tsconfig.edit03.json` ;
- `fixtures/editorial/edit03/` ;
- `docs/codex/EDIT-03/`.

Aucun fichier existant n'est modifié : acquisition, agrégations, sources,
indicateurs, contrats, stockage/publication, schémas et workflows restent ceux de
main. Les modules ne sont appelés que par les nouveaux tests et scripts hors
ligne. Les futures valeurs qualifiées de COUV-02 n'entrent pas dans ces archives.
Le classement utilise les proportions de l'univers reçu, pas le nombre 645.

## Limites et recommandation

Le gain estimé est un proxy éditorial interne, pas une mesure indépendante de
qualité. Les deux dates ne permettent aucune évolution homologue. Toutes les
cartes étant nationales, la couverture géographique reste à treize régions ;
elle n'est pas présentée comme un gain territorial.

Le comité réel n'a pas été exécuté ; les comparaisons emploient son contrôle
déterministe. Les bornes tarifaires utilisent le référentiel existant et ne
remplacent pas une mesure réelle de tokens, de coût et de qualité.

GO pour examen en simulation. **NO-GO pour activation quotidienne** avant revue
des poids/barèmes et choix éditoriaux, mesure du comité IA sur un échantillon
plus large et validation du coût dans le circuit d'appel unique existant.
Aucune fusion automatique, publication éditoriale ou modification historique.
