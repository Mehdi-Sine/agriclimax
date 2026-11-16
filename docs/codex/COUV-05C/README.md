# COUV-05C — bilan et décision

**Livraison PARTIAL ; décision d'activation : NO-GO.** Aucune activation, publication, fusion, acquisition météo ou opération OpenAI effectuée.

Base : `191cdb5fef4bf219931a8ebdbe8e3002f92cde93`, fusion de #97. L'archive numérique exacte est `ed93ab41472f81cec83a6039d8634133fa1feb42fe71d6513090d74d6985a398` ; l'index privé réutilisé est `df8d1c4abc3a3427cee3df3daf200dc7058f408fa22be274bff84e476fbd9145`. Les 260 objets privés existants (172 331 262 octets) ont été relus et vérifiés. Les SHA des pointeurs `catalogue.json` et `current.json` sont identiques au début et à la fin de cette session ; ils ne sont pas comparés aux anciens pointeurs de #97, qui ont évolué avant cette session. Voir [private-read.json](evidence/private-read.json).

## Qualification spatiale exhaustive

| État | COUV-05B | COUV-05C |
| --- | ---: | ---: |
| Démontré (≥90 %) | 739 567 | 739 753 |
| Partiel | 15 828 | 18 219 |
| Absent | 660 | 660 |
| Inconnu | 2 577 | **0** |
| Total | 758 632 | 758 632 |

Les 2 577 lignes se répartissent entre THI, jours THI et séquence THI, sur 24 fenêtres ARPEGE/IFS. Seules les PRA concernées sont recalculées géométriquement, avec le producteur COUV-05 existant : intersection des cellules communes, contrôle EPSG:3035 et contrôle indépendant du rendu WGS84. Aucune modification du référentiel ou de ses 713 contours. 186 supports deviennent démontrés et 2 391 partiels ; aucun rejet géométrique résiduel.

Les 246 géométries nouvelles dédupliquées occupent 3 602 414 octets comprimés. Elles sont conservées dans cette PR pour audit, sans écriture Storage. [qualification.json](evidence/qualification.json) et [resolved-matrix.csv.gz](evidence/resolved-matrix.csv.gz) portent les empreintes et identités ; appliquer ces 2 577 lignes à la matrice immuable de COUV-05B, avec la clé modèle/cycle/début/fin/indicateur/PRA. Les autres lignes sont réutilisées sans retraitement.

**Ces 2 577 supports ne produisent aucune nouvelle valeur THI admissible.** Leur fraction commune va de 0,0953 % à 98,6168 %. La famille scientifique `specific` du THI interdit les valeurs sur support partiel et ne dispose d'aucun certificat d'estimation. Même les 186 supports ≥90 % restent donc gris faute de valeur exploitable. Le seuil cartographique ne remplace pas l'admissibilité scientifique.

## Qualification numérique

Le rejeu exhaustif est décrit dans [numeric-replay.json](evidence/numeric-replay.json), avec toutes les valeurs et tous les refus dans [numeric-matrix.csv.gz](evidence/numeric-matrix.csv.gz). Il couvre les 28 recettes AGRO-03, 38 fenêtres source/cycle et 713 PRA, soit les mêmes 758 632 combinaisons que la matrice spatiale. Le catalogue AGRO-03 reste hors activation en production.

**730 387 valeurs sont qualifiées ; 28 245 restent NULL**, dont 26 400 THI scientifiquement inadmissibles sur support partiel, 660 absences de support commun et 1 185 valeurs nécessitant encore un recalcul natif (945 pluie, 240 THI proches de la complétude).

Un agrégat existant est réutilisable uniquement lorsque les listes de cellules natives sont identiques dans la PRA pour **toutes** les variables et dates requises. La liaison contrôle également modèle, cycle, grille, poids, référence, provenance, intervalle UTC, unité et règle native. Chaque résultat reçoit une identité propre à la recette, au seuil, à la période et aux entrées. Une égalité de fractions ou d'empreintes des poids ne suffit jamais. Le THI conserve sa définition existante : synthèse de Tmoy et RHmoy compatibles sur le même support.

Chaque valeur acceptée est comparée exactement au calculateur scientifique existant sur ces mêmes entrées : **aucune différence numérique**. Les valeurs refusées restent NULL ; aucun zéro n'est substitué. Les supports changeants ne sont pas recalculés depuis les agrégats. Les champs natifs numériques du checkpoint ne sont pas chargés dans une requête web.

Le contrôle journalier indépendant [daily-numeric-replay.json](evidence/daily-numeric-replay.json) couvre 59 892 combinaisons, dont 57 954 admissibles, et 84 rendus de miniatures à 713 contours. Une fenêtre THI IFS de sept jours accepte 289 supports identiques et garde les autres refus explicites. Ce contrôle ne remplace pas la matrice exhaustive.

Les motifs, quantités et indicateurs résiduels sont détaillés dans [RESIDUALS.md](RESIDUALS.md). Les refus d'admissibilité, les absences natives démontrées et les défauts de preuve sont distingués. Une valeur non qualifiée n'est ni une absence du phénomène ni un résultat nul.

## Interfaces raccordées

| Interface | Liaison candidate |
| --- | --- |
| Explorer, météo | Lecteur natif de #97 conservé et renforcé ; `weatherQualityBundle` et support exact vers le moteur COUV-04. |
| Explorer, analyse agroclimatique | API agroclimat : support composite stable, qualité et géométrie associés au résultat exact. |
| Cartes agroclimatiques | Même API et même composant ; transport `forecast_support`, refus détaillés et filtrage par `support_id`. |
| Cartes du jour | `EditionMaps` reçoit une pièce de rendu indépendante pour les aperçus prévisionnels. |
| Journal | Même pièce de rendu dans la carte principale, sans modification du bundle signé ni de l'édition. |
| Miniatures / carrousel | Route de miniature commune, même pièce de rendu et moteur COUV-04 ; cache incluant la qualité utilisée. |

Pour une édition, le hash de la **capture complète des entrées d'origine** doit correspondre avant tout raccordement. La valeur recalculée doit être identique à la valeur archivée. Une entrée ou une valeur altérée reste grise. Les éditions déjà publiées conservent leur rendu initial ; seuls les aperçus non publiés reçoivent ces pièces candidates. Les archives et leurs identifiants ne sont jamais réécrits.

La source historique passe par `temporal=history`, sans document prévisionnel ni lecteur de masques prévisionnels. Une carte `nature=reanalysis` ne consulte jamais l'index prévisionnel. Le lecteur exige le SHA de l'archive exacte, le modèle et son cycle ; une archive actuelle ne remplace pas une archive gelée. Les tests vérifient ces séparations et l'immutabilité des cartes.

## Limites de lecture et performances

Le lecteur météo reste limité à cinq manifestes. Le mode composite autorise au maximum quatorze manifestes (deux variables × sept jours), en réutilisant les coordonnées certifiées seulement pour des cellules strictement identiques dans la PRA. Les plafonds cumulatifs restent **16 Mio comprimés et 64 Mio décomprimés**, avec 8 Mio par objet, 1 Mio pour l'index et douze fragments pour le premier manifeste géométrique. Un dépassement ou une preuve incompatible entraîne un refus explicite, sans repli sur une fraction agrégée. Les recherches imbriquées de correspondance sont remplacées par des index ; aucun second moteur de peinture n'est ajouté.

La qualification des 2 577 lignes prend 30,46 s, pic RSS 298 340 Kio, sans acquisition. Le rejeu exhaustif prend 137,71 s, pic RSS 631 416 Kio ; sa matrice gzip occupe 5 866 122 octets. Les 3 058 lectures **locales** cumulent 1 955 347 682 octets, avec réutilisation par fenêtre et groupe de variables. Le rapport figure dans `numeric-replay.json`. Ces mesures de lot hors ligne ne certifient pas la latence réseau ou la mémoire d'une fonction serverless en production. Aucun garde Storage n'est relevé ; les nouveaux éléments sont locaux à la PR et aucun objet privé n'est ajouté.

## Validation et limites d'activation

- Suite Python : 536 tests réussis. Suite web générale : 781 tests réussis, complétée par les contrôles ciblés finaux et les rejeux réels. Les tests réels sont facultatifs en CI et nécessitent les fichiers locaux vérifiés.
- Rejeu réel : valeurs qualifiées identiques, refus NULL, mêmes empreintes d'archives, 713 PRA et six corses dans chaque rendu de la matrice journalière ; géométries nouvelles contrôlées par le même producteur.
- API agroclimat réelle : 713 résultats et contrat JSON avec pièces de support facultatives. Aperçu d'édition réel : 713 valeurs admissibles, bundle inchangé ; hash ou valeur altérés refusés.
- Navigateur : composants réellement partagés, à 1440/768/390 px ; trois indicateurs, trois cartes par cas, 713 contours chacun, pas de débordement ni erreur JS, clavier du carrousel vérifié. [browser.json](evidence/browser/browser.json). Les réponses d'édition sont injectées depuis le rejeu réel dans une route locale isolée ; les images du carrousel sont remplacées par un repère, leurs rasters étant contrôlés séparément côté serveur. Les captures THI comprennent le cas de repli gris sans pièce exploitable.
- TypeScript, lint, Ruff, mypy strict ciblé, contrats, build, sécurité source/bundle et garde des migrations vérifiés. Budget client : 698 130 octets gzip pour un garde de 2 097 152.

**NO-GO pour activation globale** : les refus numériques résiduels doivent être traités ou scientifiquement acceptés ; les parcours complets des pages produit, sur plusieurs exports archivés et avec latence réseau réelle, ne sont pas certifiés par ce rejeu de composants. Les contrôles de rétention multi-cycles de #97 restent nécessaires. Les masques candidats ne sont pas publiés et aucune activation AGRO-03 n'est demandée.

## Reproduction et retour arrière

Voir [REPLAY.md](REPLAY.md). Les indicateurs `COUV05_RENDER_ENABLED` et `NEXT_PUBLIC_COUV04_RENDER_ENABLED` restent inactifs par défaut ; aucun environnement distant n'a été changé. Remettre le premier à sa valeur inactive rétablit le chemin antérieur sans lecture de sidecars ; le cache agroclimat inclut le flag et le pin de l'index. Conserver les pièces d'audit. Aucun rollback de données, formule ou archive n'est nécessaire.

Les deux configurations Vercel ajoutent uniquement `git.deploymentEnabled["codex/COUV-05C-composite-masks"] = false` afin que le push de cette PR ne déclenche pas de déploiement automatique. Aucune modification de workflow climatique, cron ou infrastructure.
