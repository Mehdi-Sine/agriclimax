# EDIT-04B — Diagnostic et correction

Base : `main` 1677bb1, après intégration EDIT-04. Aucun appel OpenAI, aucune écriture distante, aucune acquisition ou republication pendant cette intervention. Les copies originales du diagnostic restent locales ; la fixture du 15 contient les archives et cartes déjà produites, avec empreintes vérifiées.

## Deux rejets lexicaux prouvés

Archive IA du 15 : `fa2ed18d0d3d5601ecf43e7b9d2bafeca4f9f0f3f3d856ca74fcd813c57bd1ba`. Révision factuelle consultable : `6e625f034fc43ff35021c71722766a768af71566be3edd7db58af6715ed0a2b0`.

- `article[0]` : « Il s’agit d’un extrême local, **pas d’une moyenne régionale**. » Le contrôle ne reconnaissait pas cette négation nominale après une virgule. Faux positif `REGIONAL_EXTRAPOLATION`. Ajout limité à `pas d’un/d’une` immédiatement avant l’assertion contrôlée ; les limites de proposition restent actives.
- `article[3]` : « Le minimum territorial prévu est de **−0,8 °C** ». La preuve `fact-5ccc02049f33e7483d1a78b7` contient « Minimum territorial : **-0,8 °C** », valeur brute `-0.7542480468749773`. Le parseur ignorait le signe Unicode U+2212 et recherchait un **+0,8** absent. Faux positif `TEXT_NUMBER_OR_DATE`. Normalisation du seul signe mathématique vers le signe ASCII, avant extraction. Aucun nouvel arrondi accepté : le texte reprend l’arrondi déjà présent dans la preuve ; les chiffres clés conservent leur valeur exacte.

Le texte original entier, sans réécriture, passe désormais en `needs_editorial_review`, jamais en certification scientifique. Les tests rejettent toujours +0,8 à la place de −0,8, 48,0 à la place de 47,8, le 22 à la place du 21 et une moyenne régionale affirmative. Une négation ne couvre toujours pas une assertion après « mais » ou une nouvelle phrase. Aucune modification de la validation des preuves, unités, périodes, régions, causalités, prévisions ou stades agricoles.

## EDIT-04 était actif le 15

Le circuit effectif est workflow quotidien → `task36_editorial.ts` → `prepareDailySelection` → `generateOperational`, avec dossier cartographique dans **le même appel** que l’article. Le diagnostic `map_selection_request` et la réponse enveloppée du 15 le prouvent. Aucune activation supplémentaire ni nouvelle infrastructure nécessaire.

`ranking.mode = simulation` et `publication_enabled = false` appartiennent au contrat historique du **classement partagé EDIT-03**. `dailyRequest` le projette déjà en `mode = daily_selection`, `publication_enabled = true`. Ces champs historiques ne bloquent pas la projection des choix validés dans l’archive EDIT-04. Ils sont conservés pour ne pas changer les empreintes historiques. Le mode effectif du choix archivé est `map_selection.mode`.

La réponse réelle choisit la pluie prévue en principale, zéro complémentaire et cinq exclusions. **Quatre cartes admissibles sont omises** : pluie historique, température moyenne prévue, gel historique et degrés-jours historiques. Le contrat exige un classement exhaustif des dix cartes, même pour une sélection courte. `validateCommittee` rejette correctement par `EDIT03_BOARD_SELECTION`, d’où `selection.mode = deterministic` dans l’archive IA, avant même le secours textuel. Aucun faux positif ici ; ce contrôle reste inchangé.

Correction : le dossier quotidien `edit04-board-fr-2` explicite l’obligation de classer chaque carte exactement une fois, y compris les suggestions non retenues. Les schémas de sortie bornent désormais les motifs et références saisonnières aux identifiants fournis ; le serveur conserve sa vérification par carte. Aucune obligation d’ajouter des complémentaires, aucun motif inventé, aucune complétion silencieuse d’une réponse incomplète.

Autre défaut corrigé : OPS-07 remplaçait systématiquement une sélection valide par le classement déterministe quand seul le texte était rejeté. La nouvelle révision factuelle conserve maintenant la sélection indépendamment validée. Sélection invalide → classement déterministe ; réponse malformée ou panne fournisseur → secours factuel/déterministe, toujours sans deuxième appel. L’archive IA rejetée reste conservée. La conservation d’un choix IA court est testée avec un texte volontairement invalide.

## Comparaison locale et carrousel

Rejeu hors publication des archives réelles ; le résultat IA d’une prochaine édition ne peut pas être prédit sans appel. « Après » ci-dessous décrit le classement déterministe, pas une nouvelle décision IA.

| Édition | Avant publié | Après classement local | Principale locale |
|---|---|---|---|
| 13 novembre | 10 cartes, Tmin historique en tête | 6 : pluie prévue, Tmin prévue, pluie historique, Tmoy prévue, degrés-jours historiques, gel historique | Pluie prévue |
| 14 novembre | 10 cartes, Tmin historique en tête | 6 : pluie prévue, Tmoy prévue, pluie historique, gel historique, degrés-jours historiques, Tmin prévue | Pluie prévue |
| 15 novembre | 5 cartes déjà éditorialisées par le classement déterministe | Les mêmes 5, dans le même ordre : pluie prévue, pluie historique, Tmoy prévue, gel historique, degrés-jours historiques | Pluie prévue |

Le test d’une réponse courte **complétée localement uniquement comme cas de test** conserve la principale réelle du fournisseur et zéro complémentaire : accepté par le contrat existant, sans nouveaux critères. La réponse originale incomplète reste refusée. Le 15 aurait encore utilisé ses cinq cartes de secours avec cette réponse originale, même après correction des faux positifs textuels ; la future conformité du fournisseur n’est pas garantie par un test simulé.

Le chemin public est archive `map_selection` → `consultableEdition` (`hero_map_id`, `map_ids`) → `journalMapCards` → UX-03. Pour les trois éditions, tests d’égalité de l’ordre, de la principale, des métadonnées et périodes, des identifiants carte/miniature/lien et de l’édition. Les archives sans sélection gardent leurs dix cartes historiques. Le lecteur, le composant, les miniatures et les liens restent inchangés ; aucune modification visuelle nécessitant une nouvelle recette responsive.

Détail par identifiant et ordre dans [replay.json](evidence/replay.json). La relecture distante de fin d’audit confirme les archives, snapshots, acquisitions et publications identiques : [remote-preservation.json](evidence/remote-preservation.json).

## Ressources et périmètre

Un seul appel quotidien existant, même modèle configuré, même plafond de sortie de 6000 tokens, même délai de 120 s ; aucun appel IA de recette, aucun nouveau service, aucune migration. L’enrichissement du schéma ajoute des références dans la requête existante et peut augmenter légèrement les tokens d’entrée ; aucun coût facturé futur n’est inventé. Les réceptions et estimations existantes restent intactes.

Acquisitions, grilles, couvertures, seuils, règles scientifiques, calculs, SAFRAN/SIM, sources et workflows : aucun fichier modifié. OPS-07 et la reprise restent opérationnels ; aucune nouvelle publication historique. PR draft uniquement, sans fusion automatique.

## Contrôles exécutés

- **272 tests, 30 fichiers** : éditorial IA, sélection, cartes et cycle quotidien, fournisseurs simulés uniquement ([journal](evidence/tests.log)).
- TypeScript web strict et scripts de préparation EDIT-04 ; lint de tous les fichiers applicatifs touchés : succès.
- Contrats hors ligne et garde de secrets : succès.
- Rejeu des 13, 14, 15 : aucune mutation locale des documents source, aucun appel réseau de publication ou génération.
- Première exécution large depuis la racine et sous restriction IPC : arrêtée après erreurs de contexte des tests (chemins relatifs et socket tsx). La suite complète ci-dessus a été exécutée depuis `apps/web`, hors restriction IPC, sans modifier ces tests ni leur contrôle métier.
