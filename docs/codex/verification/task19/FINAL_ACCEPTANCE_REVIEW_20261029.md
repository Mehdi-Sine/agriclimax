# AgriclimaX — revue finale du 29 octobre 2026

**Recommandation : NOT READY.** Deux points empêchent de recommander le merge :
acceptation de la couverture géographique non close et validation CI actuelle
bloquée par l'infrastructure GitHub. La réconciliation daily est en revanche
résolue au niveau du diagnostic : ses objets existent et correspondent à Git.
Leur DDL ne doit pas être rejoué.

Branche distante : `codex/19-national-coverage`, PR #40 conservée ouverte en draft.
Base main/v0.2.0 : `8cb47998178cb68e244cadf456c5d57ebae9da53`. À la reprise,
HEAD PR : `b6a573e0a4f5fd6bbed4ef5fb9b8d94579825623`, 0 commit manquant de main,
10 commits propres à la PR, MERGEABLE/CLEAN. Les références ont été récupérées ;
aucun conflit constaté. Le SHA publié de cette revue et ses checks sont dans la
description actualisée de la PR, pour éviter une référence circulaire au commit.

## Décision géographique proposée

**Accepter la provenance et la fidélité du snapshot officiel comme artefact
technique ; ne pas clore son acceptation comme référentiel territorial national.**
Les 713 PRA, codes, attributs et 14 541 poids sont vérifiés ; la conversion du
XML officiel archivé reste reproductible. Les géométries sont valides et sans
chevauchement anormal. Cela ne prouve pas une couverture administrative exhaustive.
Le millésime géométrique demeure inconnu ; la nomenclature Agreste 2017 ne le date
pas. Aucun contour, code, poids ou indicateur n'a été modifié dans cette reprise.

Le contrôle ciblé porte sur l'union des cinq plus grands écarts de chaque type,
soit les départements 13, 17, 29, 33, 44, 49, 56 et 69. Il utilise les limites
Etalab/IGN 2018 à généralisation 5 m, des communes issues de la même archive et
EPSG:3035. Les composants significatifs sont livrés en GeoJSON, avec les sources
et empreintes. [Résultats](evidence/acceptance-20261029/geography-targeted.json),
[composants](evidence/acceptance-20261029/geography-components.geojson),
[sources](evidence/acceptance-20261029/geography-sources.json).

### Ce que les 1 625,88 km² mesurent réellement

Le rapport précédent somme, par département, la différence entre sa limite et
les PRA **qui lui sont assignées**. Il faut distinguer cette mesure des surfaces
sans aucune PRA, tous départements confondus. Une partie des « lacunes » est
couverte par une PRA portant un autre code départemental historique.

| Département | Lacune assignée km² | Dont couverte par une autre PRA départementale | Sans aucune PRA km² |
|---|---:|---:|---:|
| 13 | 405,754 | 4,536 | 401,218 |
| 44 | 79,476 | 73,886 | 5,590 |
| 49 | 10,283 | 10,283 | 0 |
| 56 | 62,114 | 8,476 | 53,637 |
| 69 | 55,118 | 7,448 | 47,671 |

Les 1 134,57 km² de dépassements restent une somme hors département assigné,
pas une mesure de dépassement du territoire national. Aucun de ces totaux bruts
n'est converti en « taux d'erreur PRA » sans qualification des sources.

### Millésime/rattachement : cas confirmé de Freigné

La commune nouvelle de Vallons-de-l'Erdre (44180, contour 2018 : 190,319 km²)
est entièrement couverte par les PRA, mais 65,552 km² restent dans `pra:49356`
et 124,767 km² dans `pra:44356`. Le grand composant de lacune assignée du 44
mesure 65,43 km². Le décret **2017-1757**, applicable au 1er janvier 2018,
transfère précisément Freigné du 49 vers le 44. C'est une différence de
rattachement compatible avec une géographie antérieure au transfert, pas une
justification pour découper/recoder les PRA ici. Cela ne certifie pas le millésime
de l'ensemble du fichier. Conserver la hiérarchie de la version source explicite.

### Littoral, eau et généralisation : ne pas surinterpréter

Le composant de 155,25 km² situé à 4,9985–5,2301°E / 43,3997–43,5563°N est
cohérent avec l'étang de Berre, dont le GIPREB publie une superficie de 155 km².
Cette localisation et cette surface constituent une explication plausible ;
faute de superposition à une couche hydrographique compatible, ce n'est pas une
certification de chaque mètre carré. Le WFS GeoPF n'a pas répondu dans le délai
borné ; aucune attribution automatique à l'eau n'est faite.

Pour les départements 13, 29 et 69, respectivement 9,47/10,08, 22,57/23,72 et
5,72/6,07 km² des dépassements sont à moins de 100 m de la limite administrative.
Dans le 56, 23,97/26,60 km² le sont. Ces bandes sont compatibles avec des écarts
de contours/précision ; **elles ne prouvent pas leur cause ni leur acceptabilité**.
Les bandes de 10/50/100/250 m sont purement diagnostiques. La classe de
généralisation 5 m n'est pas une précision géodésique garantie. Aucun buffer,
snap, clipping, réparation ou simplification n'est appliqué au référentiel.

### Anomalies terrestres qui restent ouvertes

| Commune indépendante 2018 | Surface km² | Surface sans aucune PRA km² |
|---|---:|---:|
| Marseille (13055) | 241,892 | **240,987** |
| Lyon (69123) | 47,980 | **47,035** |

Les grandes composantes contiguës des lacunes du 13 et du 69 correspondent à
ces communes. Elles ne sont pas expliquées par quelques mètres de généralisation,
et le cas lyonnais n'est pas littoral. Une publication de l'établissement public
VNF (tarifs 2023, p.81) place Lyon dans la « Zone maraîchère de Lyon » : c'est un
indice documentaire contre une exclusion urbaine supposée normale, sans remplacer
le référentiel communal officiel 2017 et un contour compatible.

**Fait établi : absence de couverture de ces surfaces dans le snapshot.** Cause
exacte non établie : exclusion voulue, traitement des arrondissements municipaux
ou défaut de production sont des hypothèses, pas des conclusions. Aucune erreur
de notre conversion n'est démontrée (elle reproduit le XML officiel), ni géométrie
invalide à réparer. Il reste une anomalie de couverture de la source à qualifier.
Je ne propose donc pas de lever ce blocage d'acceptation en l'assimilant à l'eau.

Pour fermer l'acceptation : obtenir une règle d'exclusion ou un rattachement
officiel communal documenté pour ces deux villes et confirmer l'emprise voulue
auprès de métadonnées/producteur ; sinon obtenir une nouvelle version officielle
corrigée, puis recalculer/retester les poids sous une nouvelle version. Une
acceptation humaine d'un périmètre explicitement restreint peut aussi faire
l'objet d'une décision séparée. Aucun périmètre restreint n'est activé ici.
`reference_verified_national=false` est conservé.

Reproduction ciblée, sans acquisition météo ni DB :

```sh
python scripts/pra_acceptance_review.py \
  --reference config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json \
  --departments work/departements-2018.geojson.gz \
  --selected-communes docs/codex/verification/task19/evidence/acceptance-20261029/selected-communes-2018.json \
  --output work/acceptance-replay
```

L'archive départementale se récupère par l'URL et le SHA des sources livrées ;
les entités communales sélectionnées sont conservées sans changement de géométrie.
Les autres entités nominales du sous-ensemble sont ignorées par le CLI.

## Réconciliation Supabase

Voir [le rapport précis et le plan non destructif](SUPABASE_RECONCILIATION_20261029.md).
Les neuf migrations enregistrées sont identiques à Git après normalisation des
fins de ligne. Les deux daily ont un historique incomplet, mais des objets
conformes, documentés en service dès le 16 octobre. Aucun autre numéro de
migration dans les neuf lignes ne les contient. **Ne pas réexécuter leur DDL.**

26 498 739 octets mesurés, dix publications daily, zéro table/RPC Task19, zéro
objet Storage, aucune relation cron.job. Les 20 tables métier ont RLS activée et
forcée ; les droits daily concordent avec le rejeu local. L'advisor conserve ses
exceptions historiques Task04/18, sans nouveau SECURITY DEFINER Task19.
Aucun journal DDL continu ne permet de certifier « aucun DDL intermédiaire » ;
les observations démontrent l'historique inchangé et l'état actuel compatible.

La migration additive Task19 est inchangée, sans collision de noms observée.
Rejeu local de toutes les migrations, PostGIS dans public puis extensions : PASS.
Le catalogue daily distant correspond au catalogue local même après ajout
Task19. Aucune modification des tables, RPC ou règles v0.2.0 n'est introduite.
La version PostGIS distante n'a pas été mise à niveau ; pas de staging distant
modifié ou de branche payante créée. Réparation d'historique et déploiement restent
des opérations soumises à autorisation, pas des actions de cet audit.

## Tests, API, stockage et infrastructure

- Suite Python : **196 tests**, dont sept nouveaux tests de réconciliation
  refusant catalogue vide, dérive SQL/colonne/RLS/privilège ou mauvais alias SQL.
  Les tests scientifiques existants, 713 géométries, 14 541 poids, provenance,
  reprises/idempotence, absence explicite et modèles blé/bovins sont conservés.
- `make check` final, après correctifs de sécurité : **196 tests Python et
  220 tests web**, lint, typecheck, build, contrats, confidentialité et garde
  forward-only passent. Les sept nouveaux tests sont intégrés à la suite.
  Ruff/mypy strict des nouveaux outils : PASS. Aucune UI modifiée.
- Navigateurs locaux sur Next 16.4.1 : démo desktop/tablette/mobile et WCAG AA,
  PRA indisponible, 30 états d'intégration, 18 vues/thèmes blé, parcours daily
  blé/bovins et frontière déconnectée : PASS. Sources d'intégration synthétiques,
  sans acquisition nationale. Le test live utilisait le proxy même pour la
  boucle locale ; le proxy conserve désormais les cibles externes et laisse
  uniquement localhost/127.0.0.1/::1 atteindre les fixtures locales. Le rejeu de
  la frontière déconnectée réussit sans modifier ni affaiblir ses assertions.
- Import/rejeu réel du paquet géographique dans un conteneur local : PASS.
  Aucun lot météo national ajouté ; les fixtures SQL ne prouvent aucune
  disponibilité climatique réelle nationale.
- RPC locales avec 713 PRA réelles et 100 résultats demandés : lookup
  **3,34–4,04 ms**, lecture sans données météo **3,91–4,96 ms**, trois observations
  par requête. Mesures SQL locales, pas SLA HTTP ni test de charge national.
- Lecture REST daily DEV : trois HTTP 200, **2 063 / 825 / 764 ms**, 432 836 octets,
  dernière fenêtre 18–24 octobre. Aucun corps météo privé enregistré. Le serveur
  réduit toujours ce payload pour le client. La fraîcheur n'est pas déduite du
  seul succès HTTP ; la publication du 25 vieillit depuis sa période source.
- Preview existante : `/territories` 200, référentiel non déployé explicite ;
  lookup territorial 502 contrôlé, routes démo/live 200. Les marqueurs textuels
  de navigation ne sont pas pris isolément pour certifier la séparation des modes ;
  les contrats/tests dédiés sont la preuve de non-régression.
- Budget 90 jours recalé avec la taille DEV : **248 040 307 octets / 248,04 Mo**,
  ou **172 108 659 octets / 172,11 Mo** sans diagnostics systématiques. Une révision,
  mêmes réserves et hypothèses que le 19 octobre. Marge sous 250 Mo : **1,96 Mo** ;
  sous 375 Mo : **126,96 Mo**. Plan Free toujours confirmé, limite DB 500 Mo,
  Storage/egress distincts. Mesure nationale réelle et coûts d'acquisition absents.
  Le modèle ne promet pas que 50–100 productions ou plusieurs révisions tiennent
  dans ces marges. Aucune purge automatique ; 90 jours reste un horizon budgétaire.

Preuves et logs : [acceptance-20261029](evidence/acceptance-20261029/).

### Correctifs de dépendances nécessaires après l'interruption

L'audit actualisé détectait dix avis npm non exemptés, dont deux critiques et
deux élevés. Les anciens checks verts ne couvraient pas ces publications.
Les avis Next.js GHSA-2464-fhr4-w9xw et GHSA-673q-mjm6-r5xr, publiés dans la base
GitHub le 22 octobre, indiquent 16.4.1 comme version corrigée. Les mises à jour
suivantes sont réalisées dans cette branche, sans changer de modèle scientifique :

| Dépendance verrouillée | Avant | Après |
|---|---|---|
| next / eslint-config-next | 16.4.0 | 16.4.1 |
| vitest et son mocker | 4.1.11 | 4.1.12 |
| sharp, transitif de Next | 0.35.5 | 0.35.5 (inchangé) |
| zod, outillage ESLint | 4.6.5 | 4.6.7 |
| fast-uri, transitif d'ajv | 3.1.8 | 3.1.9 |
| certifi, trois lockfiles Python | 2026.7.22 | 2026.10.19 |
| filelock, outillage qualité Python | 4.1.0 | 4.2.1 |

Le correctif sharp était déjà présent pour le chemin SVG, mais l'audit de Next
et l'avis distinct sur use cache exigeaient toujours la mise à jour du framework.
Aucune exploitation réelle de l'application n'est déduite d'un avis de package.
Le pin `ajv>fast-uri` corrige uniquement la dépendance transitive affectée ; ce
n'est pas une exclusion d'audit. Le manifeste Vitest rejoint sa version effective
déjà imposée par override, avec le correctif de patch. Les lockfiles sont mis à
jour. Aucune nouvelle exception, aucune migration ou configuration scientifique.

Après correction : audit npm sans avis non exempté, audit navigateur sans avis,
cinq audits pip-audit sans vulnérabilité connue et pip check réussi. L'exception
historique braces GHSA-vfj7-8cjw-p6xm reste contrôlée, uniquement en outillage
ESLint, jusqu'au 10 novembre 2026 ; elle n'est ni élargie ni prolongée. Les
exceptions advisor Supabase décrites plus haut sont distinctes de ces audits.
La v0.2.0 sur main et le déploiement production ne sont pas modifiés : ces
correctifs ne sont pas prétendus déployés en production avant décision séparée.

### CI et Vercel : ancien succès et blocage actuel distincts

Les 11 checks du commit de reprise b6a573e et son statut Vercel sont toujours
success ; il s'agit de validations du **19 octobre**, pas d'un nouveau run du 29.
La nouvelle validation du commit de revue doit être examinée dans la PR.

Le workflow daily v0.2.0 sur main a réussi le 25 octobre, puis échoué du 26 au 29.
Le job du 29 n'a **aucune étape exécutée** et aucun runner assigné. Son annotation :
échec de paiement récent ou plafond de dépenses à augmenter. L'annotation ne
permet pas de départager ces deux causes ni de certifier un quota restant.
Voir [preuve GitHub](evidence/acceptance-20261029/github-runner-block.json).

Il ne s'agit pas d'une régression du code Task19 : le SHA main est celui de
v0.2.0 et le job n'a pas exécuté le pipeline. Mais l'accès aux runners est un
blocage de validation distante actuelle et d'exploitation quotidienne. Ne pas
réutiliser les anciens checks pour déclarer le nouveau commit validé. Ne pas
augmenter le plafond, activer de facturation ou contourner les contrôles pour
obtenir du vert ; l'opérateur doit traiter son compte et relancer les checks
sur le SHA exact via des ressources autorisées.

## Critères de merge et critères nationaux

**Bloquants merge :** décision d'acceptation du référentiel avec qualification des
deux trous terrestres ; validation Quality/Security actuelle sur le commit final
après résolution du blocage de runner. Le logiciel est testé localement, mais ces
deux critères ne sont pas remplacés par un budget inférieur à Free.

**Non bloquants pour le code, bloquants avant exploitation nationale :** réparation
de l'historique, migration/import autorisés, pilote distant, mesures réelles de
complétude/coût, politique littorale et cadence d'exploitation saine. Le masque
ECMWF auxiliaire ne certifie toujours pas les 269 absences observées ; 713 supports
structurels restent inconnus. Les scalaires incomplets restent NULL, sans
interpolation/renormalisation ; ERA5, stations Météo-France et démo demeurent
séparés. Aucune couverture nationale complète annoncée.

## Impact et suite

Correctifs : distinguer historique daily manquant et DDL présent ; mettre à jour
les dépendances vulnérables et leurs verrous. Ajouts : deux outils d'audit hors
ligne, sept tests, une requête de catalogue READ ONLY et preuves. Aucun changement
de géométrie, pondération, migration existante, modèle agricole, configuration
Vercel, workflow daily ou politique RLS.
Quality inclut désormais les outils d'audit et le test de catalogue local.
La v0.2.0 main est intégralement préservée ; aucun merge effectué.

[Cadrage court de la Task19B](TASK19B_START.md). Aucun démarrage national,
écriture Supabase distante, branche/PR nouvelle ou service payant activé.
