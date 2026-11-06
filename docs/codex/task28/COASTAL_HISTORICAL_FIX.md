# Correction historique littorale — diagnostic et jalon initial

Branche exclusive `codex/28-agroclimatic-v1`, PR draft #56 conservée.

Frontières affectées : lecture des supports Task26D, qualification scientifique historique versionnée, contrats de résultats, carte/fiche Analyse et raccordement Climat. Aucune acquisition, migration, automatisation ou géométrie officielle modifiée.

Le lecteur agroclimatique exige actuellement `status=available` et `coverage>=0.9999` pour les archives et le repli national. Le calcul exige ensuite `complete=true`. Le lecteur Unified ne qualifie les supports que sur une seule journée et pour Tmoy/pluie. Le composant Analyse exclut explicitement les géométries de support de NationalMap. Ces trois barrières masquent les restitutions partielles déjà validées.

Les supports réellement exposés comprennent 36 PRA à couverture >=90%, 31 entre 0 et 90%, Crozon sans support. Le catalogue et le bundle versionné fournissent actuellement les journées 27–31 octobre ; les archives strictes plus anciennes ne contiennent que les agrégats PRA, NULL sur les supports incomplets, sans valeurs de cellules. Les artefacts GitHub de checkpoints natifs ont été identifiés, mais leur téléchargement est refusé par le transport (403). Aucune acquisition alternative ne sera lancée pour masquer cette absence.

Politique de correction : conserver le calcul strict 1.0.0 accessible ; qualifier Tmoy, GDD et pluie sur un support observé prouvé et stable. Les événements de pluie ne peuvent décrire que le franchissement du seuil de la moyenne de ce support, pas un événement garanti sur toute la PRA. Les extrema/gel/chaleur ne seront pas inférés de Tmoy. Une période incomplète ou dont le support change reste NULL, même si chaque journée a une valeur sur des supports différents.

Les tableaux avant/après, l'inventaire résiduel et les preuves de recette seront ajoutés à la clôture.

## Règles et résultats mesurés

La règle stricte `agroclimatic-1.0.0` reste accessible via `rule_version=agroclimatic-1.0.0`. La nouvelle règle `agroclimatic-1.1.0` est utilisée pour Tmoy/GDD/pluie sur supports observés vérifiés ; les anciens résultats et archives restent inchangés. La couverture spatiale et la couverture temporelle sont séparées. Le bundle Task26D ancré dans Git utilise les empreintes du référentiel et des poids versionnés ; le 31 octobre utilise celles de son archive immuable, identiques.

- Tmoy : moyenne des Tmoy journalières du même support.
- GDD : somme de max(0, Tmoy du support − base). Ce n'est pas la moyenne des GDD calculés cellule par cellule et ce n'est pas un modèle de stade.
- Pluie : somme des profondeurs moyennes journalières sur le même support ; pas un volume d'eau.
- Séquences/jours secs et fortes pluies : événements de la moyenne du support observé, jamais une fraction de surface effectivement touchée. Aucune promotion de ces événements en valeur PRA sur le seul seuil de 90%, même à haute couverture.
- Tmin/Tmax, jours chauds, gel et leurs séquences : pas de reconstruction à partir de Tmoy. Les exports accessibles ne donnent pas les extrema natifs des cellules manquantes ; la politique stricte reste appliquée.

Une portion n'est colorée que si toutes les journées ont une valeur temporellement complète, le même support_id natif, le même référentiel et les mêmes poids. Un masque différent ou une journée absente rend le cumul et son support cartographique NULL. Aucune union journalière n'est peinte. Le reste de la PRA reste grisé. Les graphiques n'additionnent pas les supports incompatibles et les normales/anomalies ne sont pas transférées à un nouveau support. Crozon reste sélectionnable sans historique, avec accès à la météo opérationnelle.

| Période UTC | Indicateur | Avant : règle stricte | Après : valeurs PRA, dont estimations ≥90% | Portions seulement | Sans valeur |
|---|---|---:|---:|---:|---:|
| 2026-10-31 → 2026-10-31 | Tmoy | 645 | 681 | 31 | 1 |
| 2026-10-31 → 2026-10-31 | GDD | 645 | 681 | 31 | 1 |
| 2026-10-31 → 2026-10-31 | Pluie | 645 | 681 | 31 | 1 |
| 2026-10-31 → 2026-10-31 | Jours chauds | 645 | 645 | 0 | 68 |
| 2026-10-31 → 2026-10-31 | Gel | 645 | 645 | 0 | 68 |
| 2026-10-31 → 2026-10-31 | Jours pluie >20mm | 645 | 645 | 67 | 1 |
| 2026-10-31 → 2026-10-31 | Jours secs | 645 | 645 | 67 | 1 |
| 2026-10-31 → 2026-10-31 | Séquence sèche | 645 | 645 | 67 | 1 |
| 2026-10-27 → 2026-10-31 | Tmoy | 645 | 681 | 31 | 1 |
| 2026-10-27 → 2026-10-31 | GDD | 645 | 681 | 31 | 1 |
| 2026-10-27 → 2026-10-31 | Pluie | 645 | 681 | 31 | 1 |
| 2026-10-27 → 2026-10-31 | Jours chauds | 645 | 645 | 0 | 68 |
| 2026-10-27 → 2026-10-31 | Gel | 645 | 645 | 0 | 68 |
| 2026-10-27 → 2026-10-31 | Jours pluie >20mm | 645 | 645 | 67 | 1 |
| 2026-10-27 → 2026-10-31 | Jours secs | 645 | 645 | 67 | 1 |
| 2026-10-27 → 2026-10-31 | Séquence sèche | 645 | 645 | 67 | 1 |
| 2026-10-25 → 2026-10-31 | Tmoy | 645 | 645 | 0 | 68 |
| 2026-10-25 → 2026-10-31 | GDD | 645 | 645 | 0 | 68 |
| 2026-10-25 → 2026-10-31 | Pluie | 645 | 645 | 0 | 68 |
| 2026-10-25 → 2026-10-31 | Jours chauds | 645 | 645 | 0 | 68 |
| 2026-10-25 → 2026-10-31 | Gel | 645 | 645 | 0 | 68 |
| 2026-10-25 → 2026-10-31 | Jours pluie >20mm | 645 | 645 | 0 | 68 |
| 2026-10-25 → 2026-10-31 | Jours secs | 645 | 645 | 0 | 68 |
| 2026-10-25 → 2026-10-31 | Séquence sèche | 645 | 645 | 0 | 68 |
| 2026-10-02 → 2026-10-31 | Tmoy | 645 | 645 | 0 | 68 |
| 2026-10-02 → 2026-10-31 | GDD | 645 | 645 | 0 | 68 |
| 2026-10-02 → 2026-10-31 | Pluie | 645 | 645 | 0 | 68 |
| 2026-10-02 → 2026-10-31 | Jours chauds | 645 | 645 | 0 | 68 |
| 2026-10-02 → 2026-10-31 | Gel | 645 | 645 | 0 | 68 |
| 2026-10-02 → 2026-10-31 | Jours pluie >20mm | 645 | 645 | 0 | 68 |
| 2026-10-02 → 2026-10-31 | Jours secs | 645 | 645 | 0 | 68 |
| 2026-10-02 → 2026-10-31 | Séquence sèche | 645 | 645 | 0 | 68 |

Les 681 valeurs qualifiées des moyennes/GDD/pluie comprennent 645 supports complets et 36 estimations exploratoires de couverture ≥90% ; les 31 valeurs supplémentaires décrivent uniquement les portions observées. **712 supports avec information ne signifient jamais 712 ou 713 mesures complètes.** La période positive de cinq jours est ajoutée pour vérifier un vrai cumul multi-jours, distinct des fenêtres obligatoires de 7/30 jours.

## Comparaison indépendante et inventaire résiduel

`evidence/coastal/comparison.json` contient 32 cas ciblés (pas les 130 cas antérieurs), avec 2 176 comparaisons indépendantes des 68 PRA incomplètes. Le calcul Python reprend les valeurs moyennes, couvertures, identités et disponibilités des exports Task26D déjà validés, puis recalcule indépendamment GDD, moyennes, pluie et événements. Il ne prétend pas revalider des valeurs de cellules natives non accessibles. Le retour explicite à la règle stricte est vérifié sur chaque période. Les 645 supports complets conservent leurs calculs ; un témoin complet est contrôlé en UI/API.

`evidence/coastal/residual-inventory.csv` liste individuellement les 68 PRA incomplètes par indicateur/période ; les trois vues THI incluent les 713 PRA, toutes sans RH historique dans ce contrat. Les cellules vides représentent NULL, jamais zéro.

- **67 PRA de support positif, journées antérieures au 27 octobre** : les sorties PRA strictes sont disponibles, mais les moyennes de portion ne sont pas conservées dans ces sorties. Il faut restaurer les checkpoints natifs déjà acquis (leur accès GitHub est actuellement refusé en HTTP403), vérifier leurs sommes de poids et échantillons, puis publier de nouveaux exports de support sous une version explicite. Ne pas réacquérir la météo pour combler un export manquant. Les fenêtres 25–31 octobre et 2–31 octobre restent donc à 645 résultats calculables.
- **68 PRA, extrema et événements chaleur/gel** : restauration et validation des Tmin/Tmax natifs et de leurs masques spécifiques nécessaires. Un masque Tmoy ne suffit pas à prouver la validité d'un extrême ou de sa séquence. Les agrégats stricts de ces PRA sont NULL dans les archives accessibles.
- **Crozon (`pra:29102`)** : zéro support ERA5-Land validé. Une restauration du même masque nul ne crée aucune donnée. Une reconstruction spatiale explicitement validée ou un complément SAFRAN ciblé pourrait être étudié ultérieurement, avec vérification de la grille, des journées, unités et représentativité. Aucun complément n'est lancé ici.
- **THI historique, 713 PRA** : RH absente du contrat existant ; aucune humidité supposée, aucune déduction d'effectifs exposés. Une source d'humidité ou un complément SAFRAN ne pourrait être utilisé qu'après qualification spécifique, pas comme remplissage automatique.

La correction supprime le masquage des informations réellement disponibles et rend Climat/Analyse cohérents sur ces supports. Elle ne résout pas l'absence d'exports historiques plus anciens, ne fabrique pas des extrema et ne constitue pas un succès national 713/713.

## Livraison et recette

Les tests ciblés portent sur couverture complète, ≥90%, <90%, zéro, jours absents, masques/poids incompatibles, version stricte conservée, comparaisons numériques et surfaces cartographiques. Les captures et la recette locale/Preview sont dans `evidence/coastal/`. Le scénario contrôlé inclut Beauce dunoise (28341), Coteaux niçois (06245), Littoral niçois (06249), Crozon (29102), jour/5j/7j/30j, GDD/Tmoy/pluie/chaleur/gel et le survol réel des portions colorées/grisées. L'attestation du dernier commit et la CI finale figurent dans la description de la PR #56.

La provenance nouvelle inclut le SHA256 de la sérialisation JSON du bundle Task26D versionné ou celui du blob d’archive immuable pour le 31 octobre, en plus des identités de poids, référentiel et masque. Une couverture contradictoire pour un même masque/poids est refusée, comme un changement de masque.

Recette de clôture littorale : 287 tests TypeScript (32 fichiers), typage et lint réussis. La Preview du commit intermédiaire 437edf6 a passé 41 parcours réels sans erreur applicative sur desktop/tablette/mobile ; captures et audit de fermeture dans `docs/codex/task28/evidence/coastal/preview/`. Le harness ajoute trois contrôles Climat, exécutés sur le dernier commit avec attestation dans la PR. Aucune nouvelle acquisition ni modification THI.
