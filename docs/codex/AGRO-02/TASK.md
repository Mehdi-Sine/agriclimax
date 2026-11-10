# AGRO-02 — AgriClimaX : moteur agroclimatique multi-productions et enrichissement des indicateurs

## 1. Mission générale

Dépôt : `Mehdi-Sine/agriclimax`.

Partir du dernier `origin/main`, après fusion de la PR #75 (OPS-02).

Créer une branche indépendante :

`codex/AGRO-02-multiproduction-indicators`

**Objectif : faire évoluer AgriClimaX vers un véritable observatoire agroclimatique multi-productions, sans dupliquer les moteurs scientifiques.**

AgriClimaX a vocation à couvrir progressivement 50 à 100 productions agricoles végétales et animales.

Je souhaite construire une architecture scientifique modulaire, extensible, capable de calculer et de restituer quotidiennement des indicateurs utiles sur les 713 petites régions agricoles (PRA) de France métropolitaine et de Corse.

Cette tâche constitue une première extension importante, mais maîtrisée, du périmètre de production.

Il faut privilégier la pertinence agronomique, la qualité scientifique, la robustesse des calculs et la facilité d'extension plutôt que la multiplication artificielle d'indicateurs.

## 2. Contraintes impératives

Ne modifier aucun élément de la chaîne de production nocturne :

- GitHub Actions et ses crons.
- Watchdog Supabase.
- Acquisition Météo-France / ERA5-Land.
- Authentification et secrets.
- Génération OpenAI quotidienne.
- Publication et archivage du Journal.

Ne pas modifier les interfaces des pages `/journal`, `/veille`, `/analyse`, `/productions` ou `/`.

Une autre tâche, UX-01, travaille en parallèle sur les interfaces.

Les évolutions AGRO-02 doivent être préparées sous forme de services, contrats, calculs, métadonnées et contributeurs réutilisables. Leur intégration graphique définitive sera réalisée après fusion.

Aucun nouveau fournisseur météorologique obligatoire, aucune infrastructure supplémentaire ni migration lourde ne doivent être introduits.

## 3. Auditer les indicateurs existants

Commencer par examiner en profondeur :

- `apps/web/features/agroclimatic/`
- `apps/web/features/wheat/`
- `apps/web/features/cattle/`
- `apps/web/features/journal/registry.ts`
- `engine/src/agriclimax/`
- Les contrats nationaux PRA.
- Les références scientifiques et la documentation AGRO-01.
- Les données effectivement disponibles dans les archives opérationnelles.

Le catalogue actuel contient notamment dix indicateurs descriptifs de blé tendre et plusieurs indicateurs bovins, dont des mesures THI dépendant de la disponibilité de l'humidité.

Identifier les calculs réellement opérationnels, ceux qui sont exploratoires, ceux dont les données sont absentes et les éventuelles duplications.

Ne pas réécrire les calculateurs corrects.

## 4. Créer un moteur déclaratif multi-productions

Je souhaite pouvoir ajouter une nouvelle production essentiellement par configuration, sans recréer un calculateur complet.

Concevoir ou consolider un registre versionné associant :

- Production et famille agricole.
- Indicateurs applicables.
- Formule et unité.
- Paramètres et seuils configurables.
- Variables météorologiques nécessaires.
- Fenêtres temporelles admissibles.
- Sources disponibles.
- Statut scientifique.
- Conditions de disponibilité et de qualification.
- Limitations agronomiques.
- Compatibilité avec le contributeur éditorial du Journal.

Distinguer clairement :

1. **Indicateurs météorologiques génériques** : pluie cumulée, températures, jours secs, gel météorologique, séquences.
2. **Indicateurs agroclimatiques descriptifs** : sommes thermiques, expositions aux conditions potentiellement pertinentes pour une production.
3. **Indicateurs agronomiques interprétatifs** : stress, stade, risque, dommage ou impact sur la production, qui nécessitent des modèles et des validations spécifiques.

Ne jamais présenter une simple mesure météorologique comme un risque agronomique démontré.

Préserver l'identité des modèles, versions, sources, supports spatiaux et paramètres.

Un indicateur non calculable doit être identifié comme indisponible avec un motif explicite, et non remplacé par une valeur fictive.

## 5. Productions à intégrer ou enrichir

### A. Blé tendre

Consolider les dix indicateurs existants.

Vérifier leur bonne utilisation avec les archives nationales, leur disponibilité en historique et prévision et leur compatibilité avec le registre multi-productions.

Étudier notamment les fenêtres de 7, 14 et 30 jours, uniquement lorsque les séries sont homogènes.

Ne pas déduire automatiquement le stade du blé à partir des sommes thermiques.

### B. Bovins

Consolider les indicateurs thermiques et THI existants.

Vérifier rigoureusement la disponibilité des couples température-humidité et la compatibilité temporelle des valeurs.

Si l'humidité n'est pas disponible, conserver les indicateurs thermiques descriptifs sans calculer un THI approximatif.

Ne pas annoncer automatiquement un stress animal ou un impact zootechnique sur la seule base d'une température.

### C. Maïs

Ajouter un premier portefeuille descriptif :

- Sommes thermiques avec bases explicites.
- Température moyenne.
- Exposition aux températures élevées.
- Séquences chaudes.
- Cumuls et séquences de précipitations.
- Jours sans pluie significative.

Documenter les limites : stade, date de semis, variété, irrigation et disponibilité hydrique du sol inconnus.

### D. Vigne

Ajouter les indicateurs descriptifs pertinents :

- Exposition au gel météorologique.
- Températures minimales et séquences froides.
- Chaleur et cumuls thermiques.
- Précipitations et périodes sèches.

Ne pas confondre gel météorologique et gel dommageable pour la vigne.

Aucun stade de débourrement ou sensibilité variétale ne doit être inféré automatiquement du calendrier.

### E. Prairies et fourrages

Ajouter les indicateurs décrivant :

- Cumuls et fréquence des précipitations.
- Séquences sans pluie significative.
- Exposition à la chaleur et au froid.
- Cumuls thermiques descriptifs.

Ne pas en déduire automatiquement une pousse de l'herbe, une production fourragère ou une sécheresse agricole.

### F. Arboriculture

Préparer au minimum le contrat de contribution pour les vergers, et intégrer les indicateurs génériques déjà calculables lorsque leur qualification est suffisante.

Aucune inférence de floraison, d'espèce fruitière ou de sensibilité au gel sans données appropriées.

## 6. Gestion des fenêtres temporelles et des épisodes

Je souhaite que les indicateurs ne soient pas uniquement des mesures instantanées.

Le moteur doit exploiter des fenêtres de temps homogènes pour identifier :

- Une accumulation de pluie.
- Une séquence sèche persistante.
- Une période de gel.
- Une vague de chaleur météorologique.
- Une évolution des températures.
- Une évolution d'un indicateur entre périodes comparables.

Réutiliser autant que possible les mécanismes T33 de comparaison temporelle et les séries déjà disponibles.

Attention :

- Ne pas additionner des modèles de prévision incompatibles.
- Ne pas comparer directement des supports spatiaux différents.
- Ne pas mélanger observations, réanalyses et prévisions sans qualification.
- Ne pas présenter une variation non comparable comme une tendance.
- Ne pas déduire une continuité d'épisode lorsque les archives présentent une rupture.

La gestion temporelle doit être générique et réutilisable par toutes les productions.

## 7. Gestion des 713 PRA

Conserver le contrat de couverture commun développé dans CORE-01.

Les PRA partiellement couvertes doivent conserver leurs valeurs descriptives sur leur support documenté lorsque le calcul est qualifié.

Ne pas imposer artificiellement une couverture de 100 % pour tous les indicateurs.

Conserver :

- Surface et proportion effectivement renseignées.
- Nature du support spatial.
- Statut complet, partiel ou indisponible.
- Provenance et fraîcheur.
- Limitations de représentativité.

Ne jamais extrapoler silencieusement une donnée partielle à toute la PRA.

Crozon peut rester indisponible pour certaines données historiques tant qu'aucune méthode scientifiquement acceptable n'a été démontrée.

La cartographie doit conserver l'identité des 713 PRA, sans masquer les territoires non calculables.

## 8. Préparer les informations pour le Journal

C'est un objectif essentiel.

Chaque indicateur calculé et qualifié doit pouvoir fournir au comité éditorial T33/T35 un ensemble de faits structurés :

- Identifiant stable.
- Production concernée.
- Indicateur et version.
- Valeur et unité.
- Date ou période.
- PRA concernées.
- Région administrative de rattachement.
- Nature observation, réanalyse ou prévision.
- Comparaison temporelle si qualifiée.
- Source, fraîcheur, qualité et limites.
- Lien vers l'explorateur.

Les nouvelles productions doivent être découvertes par le registre, sans liste codée manuellement dans le Journal.

Préparer les contributions, mais ne pas modifier le prompt OpenAI ni les composants de rédaction de l'édition dans cette tâche.

L'intégration sera effectuée ultérieurement dans JOUR-02.

## 9. Privilégier un modèle efficient

Chercher à éviter des calculs inutiles répétés pour chacune des productions.

Un même calcul météorologique générique, effectué pour une PRA, une source et une période, doit pouvoir être réutilisé pour plusieurs productions, sous réserve de paramètres identiques.

Privilégier :

- Calculs déterministes.
- Contrats versionnés.
- Fonctions pures.
- Mutualisation des indicateurs météo.
- Agrégation et résultats réutilisables.
- Absence de calcul lourd au chargement des pages.

Évaluer les volumes et les temps de calcul sur un échantillon significatif puis, si possible, sur un pilote national.

Aucune modification de l'ordonnancement opérationnel pendant cette tâche.

## 10. Contrôle qualité et validation

Prévoir une validation scientifique et informatique approfondie.

### Tests scientifiques

- Vérification indépendante des formules.
- Tests d'unités.
- Tests de seuils stricts.
- Valeurs extrêmes.
- Données manquantes.
- Fenêtres incomplètes.
- Séries discontinues.
- Ruptures de modèles prévisionnels.
- Calculs sur PRA partiellement couvertes.
- Cohérence des agrégations et des cumuls.
- Réutilisation d'un indicateur par plusieurs productions.
- Non-inférence de stades, dommages ou rendements.

### Tests techniques

- Contrats et schémas versionnés.
- Calculs TypeScript et Python lorsque les deux implémentations existent.
- Régressions blé et bovins.
- Contributeurs éditoriaux.
- API existantes.
- Compatibilité des anciennes éditions.
- Exécution sur un jeu réel archivé.
- Comparaison avec résultats indépendants.
- Performances et mémoire.

Exécuter tous les tests, types, lint, build et contrôles de sécurité pertinents.

Ne pas affirmer qu'un indicateur est opérationnel sur toute la France en l'absence de vérification de sa disponibilité réelle.

Ne pas déployer une nouvelle écriture quotidienne ni un traitement national coûteux sans démonstration préalable.

## 11. Livrables attendus

Produire :

1. Un registre multi-productions réutilisable et versionné.
2. Les indicateurs qualifiés pour blé, bovins, maïs, vigne et prairies.
3. Le contrat arboriculture et les premières mesures compatibles, si qualifiées.
4. Les contributeurs éditoriaux compatibles T33/T35.
5. Des exemples de résultats réels sur plusieurs PRA contrastées.
6. Une matrice production × indicateur × disponibilité × statut scientifique.
7. Une documentation de la procédure d'ajout d'une production.
8. Un bilan de volumétrie et de performances.
9. La preuve d'absence de régression sur le système existant.

Ouvrir une seule PR draft :

`AGRO-02 — Multi-production Agroclimatic Indicators`

Ne pas merger automatiquement.

Ne pas modifier les composants d'interface, le Journal ou les workflows nocturnes.

### Critère de réussite

**AgriClimaX dispose d'un catalogue scientifique multi-productions cohérent, calculable, documenté et facilement extensible, dont les faits qualifiés pourront alimenter automatiquement les éditions quotidiennes du Journal.**

Prendre le temps d'aboutir à une livraison complète et testée, sans interrompre la tâche après un simple audit préparatoire.