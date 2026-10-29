TASK 19B — Activation nationale progressive à 10 % des PRA
Crée une branche codex/19b-national-pilot depuis le dernier main contenant Task 19 mergée.
Doctrine de travail
À partir de cette task :
- ne bloque pas sur les petites incohérences documentaires, géométriques ou historiques déjà connues si elles ne faussent pas les résultats ;
- documente-les clairement dans les limites connues ;
- ne cherche pas à résoudre tous les cas marginaux avant d’avancer ;
- réserve BLOCKED aux problèmes susceptibles de :
  - fausser les résultats scientifiques ;
  - corrompre les données ;
  - exposer des secrets ;
  - casser la sécurité/RLS ;
  - provoquer une dérive forte des coûts ;
  - rendre le pipeline non exploitable ;
  - ou empêcher réellement l’exécution.
Les anomalies Marseille/Lyon restent documentées et ne doivent plus bloquer le pilote.
Ne modifie pas leurs géométries.
Objectif
Valider l’exploitation réelle d’AgriclimaX à une échelle significative avant passage national.

Pilote cible :

73 PRA, soit environ 10 % des 713 PRA.

L’objectif est de tester réellement :
- acquisition ERA5-Land ;
- agrégation PRA ;
- persistance ;
- idempotence ;
- performances ;
- volumétrie ;
- stockage ;
- fraîcheur ;
- reprises après erreur ;
- cas complet / partiel / absent ;
- coût potentiel d’un passage à 713 PRA.
1. Sélection des 73 PRA
Construire un échantillon déterministe et représentatif.

Inclure notamment :
- plaines céréalières ;
- zones méditerranéennes ;
- façade Atlantique ;
- Bretagne ;
- Nord / Hauts-de-France ;
- Grand Est ;
- Massif central ;
- Alpes ;
- Pyrénées ;
- Jura ;
- Corse ;
- PRA littorales ;
- PRA continentales ;
- PRA de grande surface ;
- PRA petites ;
- PRA proches des frontières ;
- PRA avec couverture ERA5 potentiellement partielle.
Éviter une sélection purement aléatoire qui pourrait mal représenter la diversité géographique.

Produire un fichier versionné décrivant :
- code PRA ;
- nom ;
- département(s) ;
- surface ;
- catégorie géographique ;
- raison de sélection.
La sélection doit être reproductible.
2. Fenêtre temporelle
Commencer par 7 jours réels complets.

Utiliser uniquement des dates réellement disponibles dans ERA5-Land.

Ne pas prendre une période trop récente si elle risque d’être incomplète.

Le lot doit être :
- borné ;
- rejouable ;
- idempotent ;
- versionné.
3. Acquisition ERA5-Land
Lancer l’acquisition réelle pour les cellules nécessaires aux 73 PRA.

Réutiliser :
- cache ;
- tuilage ;
- checksum ;
- reprise ;
- limites de concurrence ;
- contrôles Task 15/19.
Ne pas télécharger inutilement des données déjà présentes dans le cache.

Aucun fan-out illimité.

Mesurer :
- nombre de requêtes CDS ;
- volume téléchargé ;
- durée totale ;
- durée par PRA ;
- taux de cache hit ;
- erreurs/réessais ;
- mémoire maximale si disponible.
4. Agrégation PRA
Produire les agrégations réelles pour les 73 PRA.

Variables actuelles :
- Tmin ;
- Tmax ;
- Tmean ;
- précipitation.
Respecter les pondérations PRA existantes.

Ne jamais :
- interpoler silencieusement ;
- renormaliser une PRA incomplète pour faire croire qu’elle est complète ;
- remplacer une cellule manquante par une station Météo-France ;
- transformer une absence en zéro.
Pour chaque PRA/date/variable, exposer au minimum :
- valeur ;
- nombre de cellules attendues ;
- nombre de cellules valides ;
- fraction pondérée couverte ;
- état :
  - complete ;
  - partial ;
  - unavailable ;
- fraîcheur ;
- version source.
5. Persistance Supabase
Avant toute écriture :
- vérifier l’état actuel de Supabase DEV ;
- régulariser si nécessaire l’historique des deux migrations daily sans rejouer leur DDL ;
- appliquer uniquement la migration Task 19 si elle n’est pas déjà appliquée ;
- vérifier RLS et privilèges.
Ne jamais faire un db push aveugle.

Les écritures du pilote doivent être :
- idempotentes ;
- bornées ;
- versionnées ;
- traçables.
Rejouer le même lot une deuxième fois et démontrer l’absence de doublons.
6. Budget stockage
Mesurer le volume réel généré par :

73 PRA × 7 jours

Puis extrapoler vers :
- 73 PRA × 30 jours ;
- 713 PRA × 30 jours ;
- 713 PRA × 90 jours.
Séparer :
- tables métier ;
- index ;
- diagnostics ;
- métadonnées ;
- cache externe ;
- objets bruts hors Postgres.
Comparer deux scénarios :
A — diagnostics complets
B — diagnostics minimisés
Recommandation attendue :

choisir le scénario soutenable sur le plan Free.

Ne cherche pas à conserver toutes les traces détaillées si elles ne sont pas nécessaires à l’usage produit.
7. Performance
Mesurer sur les données réelles :
- temps d’écriture ;
- temps de lecture PRA ;
- carte de 73 PRA ;
- diagnostic PRA ;
- pagination ;
- agrégation JSON ;
- endpoint HTTP.
Tester au moins :
- lecture de 1 PRA ;
- 10 PRA ;
- 73 PRA ;
- requête par date ;
- requête par variable.
Ne prétends pas à un SLA.

Donne les valeurs réellement mesurées.
8. Tests de résilience
Introduire de manière contrôlée des cas simulés :
- une cellule ERA5 manquante ;
- une tuile absente ;
- téléchargement interrompu ;
- timeout ;
- replay après interruption ;
- doublon ;
- checksum différent ;
- PRA partiellement couverte.
Vérifier :
- aucun faux état complete ;
- aucune donnée inventée ;
- reprise correcte ;
- aucun doublon ;
- dernière donnée valide préservée.
9. Carte et API
Vérifier qu’une sélection de 73 PRA peut être affichée correctement.

Les états doivent être distinguables :
- données disponibles ;
- partielles ;
- indisponibles.
La carte ne doit pas faire croire à une couverture nationale complète.

Ne pas redesign l’interface.

Corriger seulement les problèmes nécessaires à l’exploitation du pilote.
10. Critères de décision
À la fin, produire l’une des décisions suivantes :
READY_FOR_30_DAYS
si :
- acquisition stable ;
- persistance stable ;
- pas de corruption ;
- pas de fuite ;
- coûts maîtrisés ;
- performance correcte ;
- taux de données partielles acceptable et correctement exposé.
READY_WITH_LIMITS
si certaines limites existent mais n’empêchent pas d’étendre le pilote.
BLOCKED
uniquement si :
- résultats faux ;
- pipeline instable ;
- stockage incompatible avec le plan Free ;
- sécurité compromise ;
- forte perte de données ;
- ou coût/exécution réellement non soutenable.
Ne bloque pas pour :
- métadonnées historiques incomplètes mais documentées ;
- petites incohérences géographiques ;
- millésime imparfait ;
- cas rares déjà connus ;
- documentation non parfaite.
11. Suite automatique
Si READY_FOR_30_DAYS ou READY_WITH_LIMITS :

préparer immédiatement le plan d’extension :

73 PRA × 30 jours

sans encore lancer les 713 PRA.

Estimer ensuite le passage :

713 PRA × 30 jours

à partir des mesures réelles.
12. Documentation
Créer :

docs/codex/verification/task19b/

avec :
- README.md
- PRA_SAMPLE.md
- REAL_RUN.md
- STORAGE.md
- PERFORMANCE.md
- RESILIENCE.md
- DECISION.md
Les logs détaillés et artefacts lourds peuvent être réduits.

Ne pas gonfler le dépôt avec des centaines de fichiers de preuve inutiles.

Conserver seulement les preuves nécessaires à reproduire les conclusions.
13. Git
Configure :

git config user.name "Mehdi-Sine"

git config user.email "mehdi.sine@acta.asso.fr"

Pousse la branche.

Crée une PR draft.

Ne merge rien.

Avant de coder, donne une synthèse courte du plan d’exécution.
Ensuite exécute le pilote de bout en bout sans t’arrêter sur des incohérences mineures déjà documentées.