# AGRO-03 — Extension multi-productions des indicateurs agroclimatiques

Base : `origin/main 167adec`. Catalogue **hors production**, aucun déploiement,
aucune acquisition ni modification de publication. Huit nouveautés météo
documentées, vingt recettes existantes réutilisées, onze contextes de production
(dont le groupe bovins historique et les sous-contextes lait/viande).

- [Mission et frontières](TASK.md)
- [Inventaire des treize historiques, de temperature_mean et d'AGRO-02](INVENTORY.md)
- [Matrice priorisée, sélection et indicateurs reportés](MATRIX.md)
- [Validation, coûts et limites de la recette](VALIDATION.md)
- [Intégration progressive proposée](INTEGRATION.md)
- [Catalogue machine avec références et métadonnées agronomiques](evidence/catalogue.json)
- [Couvertures nationales par recette/période](evidence/matrix.json)
- [Rapport indépendant, coûts mesurés et empreinte d'entrée](evidence/report.json)

## Références et limites scientifiques

[ETCCDI, définitions des 27 indices](https://etccdi.pacificclimate.org/list_27_indices.shtml)
documente TR, ID, CWD, R10mm et Rx1day. Les comptes/seuils météo sont réutilisés
sur des fenêtres UTC explicites ; les séquences de Tmin>20 et Tmax<0 sont des
extensions descriptives. Aucun indice annuel officiel ou seuil biologique n'est
revendiqué. Aucune référence ne transforme une pluie en bilan hydrique, une Tmin
en dommage de gel ou une nuit chaude en absence de récupération animale.

[McMaster & Wilhelm, 1997](https://doi.org/10.1016/S0168-1923(97)00027-0)
documente les conventions de sommes thermiques, sans valider les bases/stades
par espèce. [Bohmanova et al., 2005](https://www.ars.usda.gov/ARSUserFiles/80420530/Publications/Scientific/Conferences/2005/IB_33_160_BohmanovaEtAl.pdf)
est la référence héritée du THI bovin, sans transposition aux autres animaux.
[Muñoz-Sabater et al., 2021](https://doi.org/10.5194/essd-13-4349-2021)
documente ERA5-Land et ses limites de représentation.

Ces références identifiables précisent la portée de chaque méthode ; aucune revue
experte nouvelle ni validation de rendement, stade ou santé n'a été réalisée.
Les sources et paramètres exacts sont transportés dans le catalogue machine.

## Reproduire hors ligne

Depuis la racine, dépendances du `pnpm-lock.yaml` installées (Node 24 dans la recette),
Python 3.12 standard pour l'oracle :

```sh
node --import ./apps/web/node_modules/tsx/dist/loader.mjs scripts/agro03_replay.ts
apps/web/node_modules/.bin/tsc --noEmit -p scripts/tsconfig.agro03.json
cd apps/web
node_modules/.bin/vitest run features/multiproduction features/agroclimatic features/climate-quality features/edition-maps features/editorial-map-selection --maxWorkers 2
```

Le script lit uniquement les archives gelées CORE-01 et écrit uniquement dans
`docs/codex/AGRO-03/evidence`. Les anciens dossiers de preuves restent inchangés.
Son oracle Python contrôle les formules indépendamment du moteur TypeScript.
Les cas de chaleur/gel aux seuils sont synthétiques et clairement distingués des
archives réelles automnales ; leur pertinence biologique n'est pas validée.
