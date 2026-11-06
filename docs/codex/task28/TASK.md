# TASK 28 — AgriClimaX : Intelligence agroclimatique V1, blé tendre, bovins, UX et cartographie nationale

## 0. Mission générale

**Dépôt :** `Mehdi-Sine/agriclimax`

**Branche de départ :** `main`, après fusion de la PR #55.

**Branche de travail :** `codex/28-agroclimatic-v1`

Créer une seule PR draft pour l'ensemble de cette Task.

### Objectif

Transformer AgriClimaX en un véritable outil de lecture et d'anticipation agroclimatique pour les conseillers agricoles, experts et instituts techniques.

La première version fonctionnelle doit couvrir deux productions :

1. **Blé tendre** : exposition à la chaleur, au gel, aux précipitations et évolution des sommes de températures.
2. **Bovins** : exposition thermique et THI, avec une qualification explicite de la disponibilité des données.

Les calculs doivent exploiter les données réelles disponibles sur les **713 PRA de France métropolitaine et de Corse**, avec une restitution cartographique, des indicateurs territoriaux, une lecture historique et une anticipation à J+7.

Cette Task comprend aussi une évolution importante de l'UX et du design cartographique.

### Contraintes impératives

- Réutiliser le socle national des Tasks 19 à 26D.
- Ne pas reconstruire les pipelines AROME/ARPEGE/IFS/ERA5-Land.
- Ne pas modifier l'automatisation quotidienne récemment activée.
- Ne pas réingérer les données climatiques ou RPG existantes.
- Ne pas développer de nouveau moteur géospatial.
- Conserver les 713 géométries officielles et leurs identifiants.
- Ne jamais descendre sous la PRA pour la restitution.
- Ne créer aucune infrastructure payante.
- Ne pas lancer d'acquisition nationale supplémentaire sans nécessité démontrée.
- Conserver les données manquantes en NULL.
- Préserver les historiques, normales et archives existantes.
- Ne pas déployer en production ni fusionner automatiquement la PR.

Les validations intermédiaires doivent être exécutées automatiquement par Codex. Ne pas s'arrêter après chaque phase pour demander une nouvelle Task.

---

# PHASE A — Audit ciblé et architecture du moteur agroclimatique

## A1. Réutiliser les modules existants

Examiner prioritairement :

- `engine/src/agriclimax/wheat/`
- `engine/src/agriclimax/cattle/`
- `engine/src/agriclimax/science.py`
- `engine/src/agriclimax/indicators.py`
- `apps/web/features/wheat/`
- `apps/web/features/cattle/`
- `apps/web/features/agriculture/`
- `apps/web/features/unified/`
- `apps/web/features/operational/`
- `apps/web/features/national/map.tsx`
- Les API et contrats territoriaux déjà existants.

L'application possède déjà :
- Des indicateurs climatiques exploratoires pour le blé.
- Une formule THI bovin versionnée.
- Des calculs scientifiques testés en Python et TypeScript.
- Des contextes agricoles RPG/SAA.
- Des historiques et des prévisions quotidiennes par PRA.

**Réutiliser ces briques plutôt que créer un deuxième calculateur agroclimatique.**

## A2. Construire une architecture extensible

Préparer un catalogue de règles agroclimatiques versionnées.

Chaque indicateur doit préciser :

- Production concernée.
- Identifiant stable et version.
- Description scientifique.
- Variables climatiques nécessaires.
- Paramètres et seuils.
- Formule exacte.
- Période admissible.
- Échelles spatiale et temporelle.
- Source scientifique vérifiable.
- Source des données météorologiques.
- Nature historique, estimation ou prévision.
- Niveau de validation scientifique.
- Contraintes de qualité.
- Conditions d'indisponibilité.
- Unité.
- Limites d'interprétation.

Préparer une structure permettant d'ajouter ultérieurement d'autres espèces, sans développer un moteur par production.

Séparer strictement les données météorologiques, les calculs agroclimatiques et leur interprétation agricole.

**Livrable A : contrats et catalogue versionnés, avec premier commit de sauvegarde.**

---

# PHASE B — Indicateurs agroclimatiques pour le blé tendre

## B1. Développer le portefeuille V1

Sur la base des données existantes, proposer les indicateurs suivants :

| Indicateur | Fonction |
|---|---|
| Somme de températures | Degrés-jours cumulés, base paramétrable |
| Jours de chaleur | Nombre de journées au-dessus d'un seuil Tmax |
| Séquences chaudes | Nombre et durée des épisodes consécutifs |
| Jours de gel | Nombre de journées avec Tmin sous un seuil |
| Séquences de gel | Durées et fréquences des épisodes |
| Pluie cumulée | Total des précipitations sur une fenêtre |
| Jours secs | Nombre de jours sous un seuil paramétrable |
| Séquences sèches | Durée des périodes sans pluie significative |
| Évolution thermique | Trajectoire de température et GDD sur la période |
| Perspectives à J+7 | Indicateurs descriptifs calculés sur les prévisions disponibles |

Réutiliser les formules et fonctions scientifiques déjà présentes.

Les seuils doivent être :
- Explicites.
- Modifiables lorsque cela a du sens.
- Documentés avec leur origine.
- Qualifiés comme exploratoires lorsqu'ils ne sont pas validés pour un stade ou une variété particulière.

Ne pas inventer un stade phénologique du blé à partir du seul RPG.

Ne pas attribuer automatiquement une période de sensibilité agronomique à une parcelle.

Si une fenêtre de stade est proposée, elle doit être fournie explicitement ou provenir ultérieurement d'un modèle validé.

## B2. Historique et prévision

Calculer les indicateurs sur :
- Les journées historiques réellement disponibles.
- Des fenêtres mobiles de 7 et 30 jours lorsque les dates sont complètes.
- Les prochaines journées J+1 à J+7.
- Les périodes personnalisées dans des limites techniques raisonnables.

Ne pas additionner automatiquement des données de différentes sources ou initialisations incompatibles.

Les lacunes entre ERA5-Land et la météo récente ne doivent pas être interpolées.

Pour les prévisions, respecter les règles de sélection AROME/ARPEGE/IFS existantes.

Les indicateurs doivent conserver les propriétés de couverture et de qualité de leurs variables sources.

Un cumul incomplet ne doit pas être présenté comme un cumul complet.

## B3. Croisement agricole avec le RPG

Réutiliser le RPG 2025 déjà intégré.

Pour chaque PRA, pouvoir présenter :
- La surface déclarée en blé tendre.
- Sa part dans les surfaces RPG présentes.
- Les indicateurs climatiques du territoire.
- La période d'observation ou de prévision.
- Les limitations de couverture.

Conserver une distinction claire entre :
1. Aléa climatique territorial.
2. Présence agricole déclarée.
3. Sensibilité biologique de la culture.
4. Risque de dommage agricole.

**Les deux premiers peuvent être décrits avec nos données. Les deux derniers ne doivent pas être estimés sans modèle et validation supplémentaires.**

Ne pas calculer de pertes de rendement, de dégâts ou d'hectares effectivement touchés.

Ne pas attribuer à une PRA une statistique SAA départementale.

## B4. Premiers signaux descriptifs

Créer des signaux de vigilance agroclimatique exploratoires, par exemple :
- Chaleur prévue au-dessus d'un seuil.
- Gel prévu.
- Plusieurs journées sans pluie significative.
- Épisode de précipitations importantes.

Les qualifier comme « conditions climatiques à surveiller », jamais comme alertes officielles, prédictions de dégâts ou recommandations automatiques de traitement.

Chaque signal doit expliquer :
- Quelle variable l'a déclenché.
- Sur quelle date et quel territoire.
- Quel seuil a été utilisé.
- Quelle est la source météorologique.
- Quelles limites empêchent une interprétation directe en risque agronomique.

**Livrable B : indicateurs blé calculés sur données réelles, avec restitution nationale et preuves scientifiques.**

---

# PHASE C — Indicateurs agroclimatiques pour les bovins

## C1. Réutiliser le moteur THI existant

Le dépôt possède une formule THI et une configuration versionnée.

Réutiliser prioritairement :
- `engine/src/agriclimax/cattle/thi.py`
- `apps/web/features/cattle/thi.ts`
- `config/cattle/thi-v1.json`

Ne pas introduire sans justification une formule THI concurrente.

Documenter la variante retenue, ses paramètres et ses limites d'utilisation.

Comparer la documentation existante aux références de l'Institut de l'Élevage et aux publications scientifiques, sans changer silencieusement les seuils de l'application.

## C2. Construire les indicateurs territoriaux

Sur les PRA disposant des variables nécessaires, calculer :

- THI journalier synthétique.
- THI prévisionnel quotidien.
- Nombre de jours dépassant un seuil THI.
- Séquences de dépassement, lorsque les observations sont suffisamment complètes.
- Évolution du THI sur la période.
- Conditions de chaleur prévues sur J+7.

Attention :
- Un THI calculé avec Tmoy et humidité moyenne n'est pas un maximum horaire.
- Ne pas déduire des heures d'exposition d'une valeur journalière.
- Ne pas supposer une homogénéité parfaite du territoire.
- Ne pas déduire les conditions réelles à l'intérieur des bâtiments d'élevage.
- Ne pas attribuer automatiquement une exploitation bovine à chaque PRA.

## C3. Gérer rigoureusement les lacunes d'humidité

La couverture de l'humidité relative reste partielle sur plusieurs journées.

Avant de calculer le THI :
- Vérifier la disponibilité conjointe de la température et de l'humidité.
- Contrôler l'origine et la compatibilité des variables.
- Refuser les valeurs physiquement invalides.
- Respecter les statuts NULL.
- Ne pas inventer une humidité pour compléter les 713 PRA.

Si la température est disponible, mais pas l'humidité, afficher une information de chaleur météorologique distincte du THI.

Une PRA doit rester sélectionnable même si son THI est indisponible.

## C4. Contexte agricole bovin

Examiner les données agricoles existantes réellement disponibles.

S'il existe une source départementale ou régionale appropriée sur les cheptels bovins, la restituer à son échelle officielle, sans affectation artificielle aux PRA.

Ne pas utiliser les surfaces RPG de prairies comme équivalent du nombre de bovins.

Pour cette V1, la couverture climatique nationale peut être présentée indépendamment de l'existence documentée d'animaux sur le territoire.

**Livrable C : THI territorial exploratoire, cartes et séries prévisionnelles, sans inférence de dégâts ni diagnostic de bien-être animal.**

---

# PHASE D — Refonte UX de l'espace « Analyse agroclimato »

Cette phase est un livrable majeur de la Task 28, pas un simple habillage.

## D1. Une interface conçue pour les conseillers agricoles

L'utilisateur doit pouvoir répondre rapidement à quatre questions :

1. Quelle production m'intéresse ?
2. Quel territoire ou quelle PRA ?
3. Quels phénomènes climatiques ont été observés ou sont prévus ?
4. Comment évoluent les indicateurs dans le temps ?

Conserver les espaces existants :
- Climat.
- Productions agricoles.
- Analyse agroclimato.

Concentrer la nouvelle expérience métier dans « Analyse agroclimato ».

Réutiliser le design, la navigation, les états partagés et la carte nationale de l'application.

## D2. Nouvelle organisation de l'écran

Prévoir un écran organisé autour de quatre composantes.

### A. Bandeau de sélection

En haut :
- Production : Blé tendre / Bovins.
- Famille d'indicateurs.
- Indicateur précis.
- Temporalité : Historique / Récent / Prévisions.
- Période ou date.
- Paramètre de seuil si applicable.
- Recherche PRA.

Organiser les contrôles pour qu'ils soient utilisables sans surcharge visuelle.

### B. Carte centrale

Afficher les 713 PRA avec une légende adaptée à l'indicateur.

Changer de production ou d'indicateur doit actualiser :
- Les valeurs cartographiques.
- Les couleurs.
- La légende.
- Le titre.
- Les unités.
- La période et le statut des données.

Ne pas recréer une instance MapLibre à chaque changement.

### C. Fiche PRA

Lorsqu'une PRA est sélectionnée, présenter :

- Nom et code PRA.
- Production.
- Indicateur et valeur.
- Période.
- Source et qualité.
- Courbe d'évolution.
- Perspective J+7 lorsque disponible.
- Éventuels seuils franchis.
- Contexte RPG/SAA à son échelle de validité.
- Explication scientifique courte.
- Limites de l'interprétation.

Un utilisateur doit pouvoir passer d'un indicateur à l'autre en conservant la même PRA.

### D. Synthèse nationale

Sous la carte ou dans un panneau dédié, proposer :
- Nombre de PRA disposant de données exploitables.
- Répartition des valeurs par classes.
- Nombre de PRA franchissant un seuil climatique descriptif.
- Dates de référence.
- Indication des données partielles.
- Possibilité de parcourir les territoires concernés.

Ne pas appeler « PRA à risque » celles qui franchissent simplement un seuil météo.

## D3. Visualisation temporelle

Concevoir des graphiques adaptés aux variables :
- Courbe de température et seuil.
- Cumul des degrés-jours.
- Histogramme des précipitations.
- Évolution quotidienne du THI.
- Historique et prévisions clairement séparés.

Ne pas représenter une période future comme déjà observée.

Ne pas tracer de courbe continue à travers des jours manquants.

Conserver les sources, dates et échéances des modèles.

## D4. Ergonomie et navigation

- Desktop, tablette et mobile.
- Sélection PRA persistante entre les trois espaces.
- URL partageable avec les filtres actifs.
- Raccourcis J+3/J+7.
- Messages d'indisponibilité compréhensibles.
- Légendes et couleurs adaptées aux unités.
- États de chargement non intrusifs.
- Consultation au clavier et au toucher.
- Bon contraste et lisibilité.
- Pas de second système de navigation concurrent.

Conserver les anciens parcours blé/bovins lorsqu'ils restent utiles, avec navigation cohérente vers la nouvelle expérience territoriale.

**Critère de réussite : le conseiller agricole doit pouvoir choisir « Blé tendre → Gel prévu → J+7 → PRA », ou « Bovins → THI → prochaine semaine », puis lire immédiatement une carte et une fiche interprétables.**

---

# PHASE E — Amélioration esthétique de la cartographie

## E1. Corriger les contours littoraux en gras

Le problème est identifié dans :

`apps/web/features/national/map.tsx`

La couche `pra-outline` utilise actuellement :
- 0,5 px pour une PRA ordinaire.
- 1,6 px pour une PRA partielle.
- 3 px pour une PRA sélectionnée.

**Cette différence doit disparaître.**

Appliquer une épaisseur uniforme, environ 0,6 à 0,8 px selon le rendu réel, à toutes les limites PRA, indépendamment de leur statut.

Conserver les mêmes limites et la même finesse de trait pour les littoraux, la Corse et les PRA complètes.

Pour la PRA sélectionnée, préférer un halo, une surbrillance ou une couche de sélection distincte plutôt qu'un changement de l'épaisseur intrinsèque des contours.

Vérifier qu'aucune superposition des couches `pra-fill`, `pra-covered-fill` et `pra-outline` ne crée de double contour.

Les supports partiellement couverts doivent rester identifiables par les surfaces, motifs et légendes, pas par un trait géographique plus épais.

## E2. Ajouter un léger ombrage de la France

Améliorer l'esthétique du fond national avec un effet très discret de relief visuel.

Style recherché :
- Carte élégante, claire et scientifique.
- Fond sobre.
- Silhouette de la France légèrement détachée du fond.
- Ombre douce, de faible opacité, légèrement décalée.
- Contours fins et homogènes.
- Couleurs des données conservées comme élément visuel prioritaire.

Privilégier une solution technique légère :
- Silhouette nationale pré-calculée et mise en cache si nécessaire.
- Couche d'ombre dédiée sous les PRA.
- Décalage léger, opacité faible et flou maîtrisé.
- Aucune modification des géométries officielles.
- Pas de service externe de tuiles payant.
- Pas de raster lourd à télécharger à chaque consultation.

Ne pas créer une ombre autour de chacune des 713 PRA.

L'effet doit concerner l'enveloppe extérieure de la France métropolitaine et de la Corse, avec une gestion cohérente des îles et des côtes.

Il ne doit pas suggérer une information topographique réellement mesurée.

## E3. Harmoniser le rendu

Profiter de cette intervention pour vérifier :
- Les couleurs de données.
- La lisibilité des PRA de petite taille.
- Les états partiels et indisponibles.
- Les légendes.
- La sélection.
- Le zoom national et territorial.
- La représentation de la Corse.
- Les performances WebGL.
- Les différentes tailles d'écran.

La carte doit rester fluide et les données doivent primer sur les effets décoratifs.

Ne pas modifier les 713 identifiants PRA ni leurs géométries officielles.

**Livrable E : correction effective du défaut de contours et amélioration visuelle du fond national.**

---

# PHASE F — Calcul national, API, qualité et performances

## F1. Calculer sur les 713 PRA

Le moteur doit produire les indicateurs disponibles sur les 713 PRA à partir des agrégats existants.

Ne pas relancer les téléchargements météo.

Ne pas créer une requête par PRA lorsqu'une lecture nationale mutualisée existe.

Privilégier :
- Calcul vectorisé ou mutualisé.
- Cache par cycle météo, date et règle.
- Données dérivées compactes.
- Recalcul seulement si la source ou les paramètres changent.
- Contrats de provenance et de qualité explicites.

Toute variable indisponible doit produire un état NULL avec motif.

## F2. Versionnement scientifique

Les résultats doivent identifier :
- Source et version météo.
- Modèle et run.
- Version de règle agroclimatique.
- Paramètres.
- Date de calcul.
- Couverture.
- Statut scientifique.

Les versions anciennes ne doivent pas être réécrites silencieusement.

Les calculs doivent être reproductibles depuis les archives nationales.

## F3. Validation indépendante

Tester notamment :
- Degrés-jours et seuils.
- Détection des séquences.
- Périodes incomplètes.
- Changement d'année.
- Jours manquants.
- Cumuls de pluie.
- THI calculé et refusé si RH absente.
- Comparaison Python/TypeScript sur cas de référence.
- Statut historique/récent/prévision.
- Provenance.
- Cas littoraux.
- Rejeu sur archives immuables.

La présence d'une valeur météo dans les 713 PRA ne doit pas conduire à affirmer que tous les indicateurs agronomiques sont disponibles partout.

## F4. Performance

Mesurer :
- Temps des calculs nationaux.
- Temps de réponse API.
- Taille des données dérivées.
- Temps de chargement carte et graphiques.
- Impact sur le stockage.
- Comportement mobile.

Ne pas augmenter le volume Supabase de manière disproportionnée.

Le calcul des indicateurs doit pouvoir suivre les nouveaux cycles météo sans réacquisition des données sources.

---

# PHASE G — Recette fonctionnelle et livraison

## G1. Recette réelle

Tester dans la Preview les parcours suivants.

**Blé tendre**
1. Sélectionner une PRA de grandes cultures.
2. Afficher les degrés-jours historiques.
3. Afficher les jours de chaleur.
4. Passer aux conditions prévues à J+7.
5. Vérifier le contexte blé RPG 2025.
6. Vérifier les limites scientifiques et les périodes incomplètes.

**Bovins**
1. Sélectionner Bovins.
2. Afficher le THI lorsqu'il est calculable.
3. Consulter les jours prévisionnels disponibles.
4. Vérifier la réaction lorsqu'il manque l'humidité.
5. Vérifier l'absence de faux diagnostic d'impact sur les animaux.

**Cartographie**
1. Comparer les contours littoraux aux contours intérieurs.
2. Vérifier Crozon, La Hague, Camargue et Corse.
3. Vérifier l'absence de double contour.
4. Vérifier le léger ombrage national.
5. Tester les zooms et sélections.
6. Mesurer l'absence de régression de performance.

**Navigation**
1. Changer de production.
2. Changer d'indicateur.
3. Conserver la PRA.
4. Basculer historique/récent/prévision.
5. Partager une URL.
6. Tester desktop/tablette/mobile.

**Régression**
1. Vérifier les trois espaces existants.
2. Vérifier RPG/SAA.
3. Vérifier les normales.
4. Vérifier la conservation des données littorales.
5. Vérifier la fraîcheur des catalogues.
6. Vérifier que les workflows quotidiens météo n'ont pas été modifiés ou interrompus.

## G2. Documents de livraison

Créer `docs/codex/task28/` avec :

- `ARCHITECTURE.md`
- `SCIENTIFIC_RULES.md`
- `WHEAT_RESULTS.md`
- `CATTLE_THI_RESULTS.md`
- `AGRICULTURAL_CONTEXT.md`
- `UX_AND_CARTOGRAPHY.md`
- `NATIONAL_PERFORMANCE.md`
- `ACCEPTANCE.md`
- `FINAL_DECISION.md`

Le rapport final doit indiquer :
- Les indicateurs réellement opérationnels.
- Les indicateurs encore exploratoires.
- La couverture par indicateur sur les 713 PRA.
- Les résultats blé et bovins.
- Les travaux UI réalisés.
- Les captures desktop/tablette/mobile.
- Les limites scientifiques.
- Les temps de calcul.
- Les volumes supplémentaires.
- Les éventuels blocages.
- La liste précise des travaux encore nécessaires pour la version suivante.

Verdicts indépendants :

`READY_FOR_WHEAT_V1`

`READY_FOR_CATTLE_THI_V1`

`READY_FOR_AGROCLIMATIC_UX`

`READY_FOR_NATIONAL_MAP_VISUAL_REVIEW`

Ne déclarer READY que si le calcul réel, la lecture API et l'interface Preview sont validés.

---

# PHASE H — Discipline stricte d'utilisation des crédits Codex

Cette Task est volontairement longue pour éviter les microtasks.

Consignes :

1. **Un seul agent principal** responsable de l'ensemble de l'intégration.
2. Une seule branche et une seule PR draft.
3. Ne pas refaire l'audit des Tasks antérieures.
4. Réutiliser les modules scientifiques existants.
5. Ne pas retélécharger ERA5, AROME, ARPEGE ou IFS.
6. Ne pas relancer les pipelines RPG/SAA.
7. Ne pas modifier les automatismes quotidiens actuellement en observation.
8. Développer par jalons internes et committer régulièrement.
9. Effectuer les tests ciblés pendant les développements.
10. Réserver la CI complète aux validations majeures.
11. Réutiliser les preuves scientifiques et jeux de tests existants.
12. Ne pas introduire de dépendance cartographique lourde ou de fournisseur payant.
13. Ne pas développer une architecture séparée pour chaque production.
14. Enchaîner directement les phases lorsque les contrôles passent.
15. Ne pas interrompre le travail pour demander une nouvelle Task après un simple pilote.
16. En cas de blocage extérieur, poursuivre les volets indépendants.
17. En cas d'épuisement de crédits, sauvegarder et pousser tous les changements, puis documenter une reprise exacte sans recalcul.
18. Ne pas fusionner la PR ou déployer en production sans autorisation utilisateur.

### Critère final de réussite

**Une application dans laquelle l'utilisateur peut sélectionner le blé tendre ou les bovins, consulter une carte agroclimatique nationale, explorer les indicateurs historiques et prévisionnels, ouvrir une fiche PRA et comprendre les limites des données.**

Le rendu cartographique doit être harmonisé et plus élégant, avec des contours PRA uniformes et un léger ombrage de la France.

Tout cela doit fonctionner avec les données nationales déjà acquises et les futurs cycles automatiquement publiés, sans refaire les fondations techniques d'AgriClimaX.