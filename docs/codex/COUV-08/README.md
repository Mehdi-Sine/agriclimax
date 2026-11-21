# COUV-08 · Cartographie nationale

| Volet | Verdict | État public |
| --- | --- | --- |
| ERA5-Land dynamique | **GO pour conserver l’activation** | Rendu qualifié déjà en service depuis le déploiement du commit `750a0fe`. COUV-08 corrige la superposition des hachures dans la prochaine version. |
| Prévisions AROME, ARPEGE et IFS | **NO-GO pour le rendu qualifié national** | Configuration publique antérieure conservée. Le rendu qualifié reste une recette locale. |
| Recalculs agroclimatiques natifs | **NO-GO pour les routes actives** | 1 185 valeurs réservées à leur contrat scientifique. |
| SIM/SAFRAN public | **NO-GO** | Aucun changement d’éligibilité ou de configuration. |

Base de travail `46cd3ceaf53f94eac1eab32da36c0ef4e2421885`, dernier `main` au début de la recette. Le contrôle Vercel de ce commit est vert. L’activation historique existante et son rollback sont décrits dans le bilan du 17 novembre. [Déploiement Vercel](https://vercel.com/mehdi-sines-projects/agriclimax/CknY6V3ngUU2QjYk1ArLh8bQzmtc) · [Activation historique](../COUV-06/ACTIVATION-20261117.md)

## Audit de départ

| PR | Preuve reprise | Écart restant |
| --- | --- | --- |
| [#96](https://github.com/Mehdi-Sine/agriclimax/pull/96) | Fonction de peinture `coveragePaint` et géométries de référence | Une hachure s’ajoutait à l’emprise des PRA partielles sur les cartes dynamiques. |
| [#97](https://github.com/Mehdi-Sine/agriclimax/pull/97) | Masques natifs, identités des archives et des PRA, empreintes des cellules et contrôles de géométrie | Le lecteur n’accepte que l’index épinglé à l’archive exacte. |
| [#99](https://github.com/Mehdi-Sine/agriclimax/pull/99) | Supports composites et lecteur commun aux cartes candidates | L’identité spatiale seule ne rend pas une valeur admissible. |
| [#100](https://github.com/Mehdi-Sine/agriclimax/pull/100) | Deux cycles préservés et entrées communes des 1 185 recalculs | Les parcours qualifiés à l’époque excluaient les 540 nouvelles emprises sous 90 %. |
| [#101](https://github.com/Mehdi-Sine/agriclimax/pull/101) | Conditionnement et lecture exacte des 1 185 recalculs | Contrat AGRO-03 incompatible avec les règles de l’analyse et des cartes publiables. |
| [#102](https://github.com/Mehdi-Sine/agriclimax/pull/102) | Rendu ERA5, bundle historique signé, cartes d’édition et miniatures | Le correctif du 17 novembre a déjà activé le rendu. Le commutateur global pouvait empêcher un rollback historique indépendant. |

La correction intervient dans la présentation MapLibre et ses légendes, avec conservation de la trame historique sur les cartes publiées. Les palettes et la décision scientifique de `coveragePaint` restent identiques. La recette vérifie le transport API, le référentiel OFB/MASA, les images et la navigation du Journal. L’audit Storage en lecture seule retrouve l’archive exacte même quand des cycles plus récents la précèdent dans le catalogue.

## Qualification historique

[La matrice API](evidence/matrix.json) couvre les 7 indicateurs d’Explorer climat et les 14 règles d’Explorer agroclimatique pour les 1 et 8 novembre 2026 et la période du 2 au 8 novembre. Chaque réponse contient 713 identifiants distincts, dont six corses. Les cas partiels associent la valeur et la géométrie à la même empreinte de support, pour la période et la variable requises.

| Cas API | Cas testés | Entières | Partielles | Grises |
| --- | ---: | ---: | ---: | ---: |
| Explorer climat, dont Tmoy, Tmin, Tmax et pluie | 21 | 681 | 31 | 1 |
| Explorer agroclimatique, règles de température et de pluie | 33 | 681 | 31 | 1 |
| THI, jours au-dessus du seuil THI et séquences THI | 9 | 0 | 0 | 713 |

En Corse, les cas historiques numériques donnent deux PRA entièrement colorées et quatre partiellement colorées. Aucun THI ni humidité historique ne sont imputés. Les jours de chaleur météorologique des bovins utilisent Tmax selon la règle en place.

L’[audit géométrique](evidence/geometry.json) porte sur 31 emprises sous 90 % pour chacune des 12 combinaisons période × variable. La géométrie source provient de l’intersection de la PRA avec les cellules qualifiées, selon le [producteur existant](../../../scripts/era5_spatial_restitution.py). En EPSG:3035, l’écart maximal de fraction surfacique mesuré est de 0,000484. La plus grande fraction hors contour mesurée est de 0,000000072, sous la tolérance de 0,001 prévue pour la géométrie d’affichage. Les contrôles GEOS relèvent sept auto-intersections WGS84 parmi les emprises partielles distinctes et trois invalidités après reprojection. Le rapport énumère les PRA concernées. La mesure d’aire utilise des géométries réparées en mémoire uniquement. Les masques et contours servis gardent les coordonnées conservées, avec leur simplification d’affichage existante de 10 m.

## Prévisions et limites de promotion

La partie `operational` de la [matrice API](evidence/matrix.json) contient 60 réponses réelles des cycles du 14 et du 15 novembre, à deux échéances de chaque modèle, pour les cinq variables natives. Les compteurs `legacy` décrivent les lignes proposées au rendu de production. Les compteurs `counts` appliquent localement `coveragePaint` au transport public. Toutes ces réponses ont `nativeProofTransport=false`. Leurs agrégats ne constituent donc pas une qualification des masques prévisionnels.

L’audit en lecture seule a relu 260 objets du premier index, 172 331 262 octets vérifiés, 268 requêtes, zéro écriture. Les empreintes de `current.json` et `catalogue.json` coïncident avant et après. Il a retrouvé l’archive du 14 novembre par l’empreinte de l’index conservé, alors que les trois archives les plus récentes étaient celles des 18, 19 et 20 novembre. Les objets privés restent hors de Git.

La lecture stricte du candidat COUV-05E utilise `multiproduction-agro03-1.0.0`. Explorer agroclimatique utilise `agroclimatic-1.3.0` et les cartes d’édition `multiproduction-descriptive-1.0.0`. Le test couvre le refus des deux versions actives face à l’ensemble des 243 fragments candidats, ainsi que le rejet d’une autre archive, d’un autre seuil et d’une autre provenance. La lecture compatible vérifie les 1 185 valeurs et les 540 emprises sous 90 % à partir des preuves conservées. Les 26 400 THI partiels et les 660 supports absents restent inadmissibles. [Contrat et paquet COUV-05E](../COUV-05E/README.md) · [Rapport numérique original](../COUV-05D/evidence/numeric-report.json)

Une exposition des 1 185 résultats dans les routes actives nécessite une qualification scientifique versionnée pour leurs règles et valeurs, suivie du rejeu HTTP et navigateur des 540 cas. L’index unique par processus ne garantit pas le rendu au changement de cycle. Les [preuves multi-cycles COUV-05D](../COUV-05D/VALIDATION.md) montrent la conservation des deux index et leur rattachement séparé.

## Navigateur et chargement

Les deux builds de production locaux ont utilisé les API du produit avec les données réelles. Chaque navigation est exécutée dans un contexte Chromium neuf. Les rapports contiennent la durée jusqu’à la réponse et jusqu’au rendu, les légendes et les compteurs. Les 18 navigations ERA5 ont rendu les 713 contours à 1440, 768 et 390 px, sans débordement ni erreur JavaScript. [Avant](evidence/before.json) · [Après](evidence/after.json)

| Largeur | Avant | Après |
| ---: | --- | --- |
| 1440 px | [Température](evidence/before-1440-temperature.png) | [Température](evidence/after-1440-temperature.png) |
| 768 px | [Température](evidence/before-768-temperature.png) | [Température](evidence/after-768-temperature.png) |
| 390 px | [Température](evidence/before-390-temperature.png) | [Température](evidence/after-390-temperature.png) |

Les 63 requêtes historiques publiques mesurées ont pris entre 188 ms et 6,80 s. Sur le candidat local, le rendu complet a pris entre 7,09 s et 29,65 s avec une charge de qualification concurrente. Ces temps incluent le chargement des API et le rendu logiciel de Chromium. Chromium n’a pas pu ouvrir directement l’origine publique à cause de la confiance TLS du proxy. Les contrôles HTTPS publics et le navigateur local ont conservé leur vérification TLS. Les captures de référence de Bretagne, de l’Atlantique, de la Méditerranée et de Corse sont également disponibles dans le [bilan COUV-06](../COUV-06/VALIDATION.md).

La suite web générale a réussi 814 tests. Seize contrôles conditionnels ont été ignorés lors de ce passage général. Les deux builds locaux, le contrôle TypeScript du script de recette et le lint des composants modifiés passent.

Une édition publique récente a été ouverte depuis le carrousel jusqu’à la carte interactive sur les deux builds. Les dix réponses de données et les dix miniatures WebP ont les mêmes SHA-256 avant et après. [Empreintes avant](evidence/archive-before.json) · [Empreintes après](evidence/archive-after.json)

Le rejeu optionnel du paquet natif a également réussi. Il relit les 1 185 résultats, vérifie 540 emprises partielles et refuse les deux versions actives. [Mesures du lecteur en local](evidence/composite-reader.json)

## Mise en production et retour arrière

La branche COUV-08 désactive son déploiement automatique Vercel. L’activation historique existante est conservée en production. Cette PR ne déclenche aucun déploiement ni aucune publication d’édition. Les réglages prévisionnels antérieurs restent en place.

- Historique dynamique. `NEXT_PUBLIC_COUV06_HISTORICAL_RENDER_ENABLED=false` suivi d’une reconstruction désactive la couverture historique, même si l’interrupteur de rendu prévisionnel est actif.
- Prévisions. `NEXT_PUBLIC_COUV04_RENDER_ENABLED` contrôle le rendu client au build. `COUV05_RENDER_ENABLED` et `COUV05_INDEX_SHA256` contrôlent la lecture serveur. Le runbook existant prévoit le retour aux valeurs antérieures et la désactivation du lecteur avant toute lecture de masque. [Runbook](../COUV-05D/ACTIVATION.md)
- Archives. Le rendu signé conserve sa version et les éditions déjà publiées restent consultables avec les mêmes objets. Le retour arrière du code se fait par redéploiement de la version précédente. Aucun objet à purger.

## Reproduction

Utiliser Node 24, pnpm 10, Chromium, Playwright et les dépendances du groupe Python `geo`. Les lectures de l’origine distante sont facultatives pour les suites unitaires.

```sh
pnpm --filter @agriclimax/web test
COUV08_ORIGIN=https://agriclimax.vercel.app COUV08_FORECAST=true \
  apps/web/node_modules/.bin/tsx tests/e2e/couv08-matrix.ts
COUV08_ORIGIN=https://agriclimax.vercel.app python tests/e2e/couv08-geometry.py
node tests/e2e/couv08.mjs
```

Pour les captures avant/après, démarrer `next start` sur deux ports avec le build production de la base et le build COUV-08. Les deux utilisent `PRA_NATIONAL_ENABLED=1` et les accès serveur existants. `COUV08_ORIGIN` et `COUV08_LABEL` identifient les rapports. `COUV08_EDITION_ID`, `COUV08_ARCHIVES_ONLY=true` et `COUV08_ARCHIVE_BASELINE` sélectionnent et comparent une édition publiée. Pour le lecteur composite, reprendre les commandes du [bilan COUV-05E](../COUV-05E/README.md).
