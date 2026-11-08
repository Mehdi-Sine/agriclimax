# Décision SAFRAN

Références lues directement sur la branche COUV-01 de la PR #63 :
ROOT_CAUSE_AUDIT, NATIONAL_SOURCE_STRATEGY, SAFRAN_PILOT, ACCEPTANCE. Aucun code de
cette branche n'est fusionné, modifié ou copié dans la chaîne de production.

Le pilote annonce et documente 675 supports numériques complets, 38 partiels,
aucune PRA sans support et 60 journées. Ce sont ses preuves gelées, pas une
nouvelle acquisition ni des mesures recalculées dans CORE-01. Crozon y garde un
support partiel. Les diagnostics stationnels peuvent inclure des stations
assimilées : ils ne certifient pas une validation indépendante.

ERA5 existant permet déjà de restituer 67 valeurs descriptives de portions sans
nouveau fournisseur. Cela évite de dupliquer acquisition, archivage, validation
et normales. Cela ne remplit ni Crozon ni les surfaces inconnues. SAFRAN reste
pertinent comme candidat national homogène ultérieur, plutôt que complément
silencieux PRA par PRA. Les biais ERA/SIM et les définitions différentes des
extrêmes et journées de pluie interdisent une substitution transparente.

Avant intégration : confirmer datum/emprise auprès du fournisseur, qualifier les
38 résidus, préserver les fenêtres UTC et les noms de variables, établir des
témoins indépendants hors assimilation, assurer rétention durable et protocole
de révision. L'adaptateur devra renseigner le contrat commun, ses propres source,
méthode/grille/poids, période et preuves ; aucune identité ERA ne sera réutilisée.
Aucune normale, anomalie, séquence ou THI ne sera raccordé entre ERA et SIM.

Recommandation : poursuivre l'évaluation de SAFRAN dans une tâche séparée ; ne pas
basculer la production dans CORE-01. La nouvelle fondation supprime le besoin de
réécrire les règles métier pour tester cet adaptateur.
