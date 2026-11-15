# COUV-04 — PARTIAL ; NO-GO pour l'activation nationale

Base : `origin/main` 9ff71e4 (COUV-03B fusionné). Livraison en PR draft,
aucune fusion, aucun flag distant changé, aucun workflow déclenché. Le contrat
réutilisable et la reprise SIM sont implémentés et vérifiés ; la couverture
spatiale exhaustive de toutes les prévisions n'est **pas** démontrée.

## Frontières de responsabilité

- Collecte/stockage : canari SIM privé de 32 PRA, cinq variables natives,
  jamais une source publiée ni un substitut prévisionnel.
- Qualification : calculateurs CORE-01/AGRO-02/AGRO-03 conservés, fenêtres,
  unités, seuils, preuves et éligibilités inchangés.
- Présentation : `cartography/coverage.ts`, commun à MapLibre et aux miniatures.
  À partir de 90 % qualifiés, contour entier coloré ; en dessous, seul le masque
  exact du résultat reçoit sa couleur, complément gris clair. Une valeur absente
  reste absente ; zéro reste zéro. Tous les contours sont conservés.
- Publication : les éditions publiées, y compris leurs miniatures, restent sur
  le rendu antérieur. Les prévisualisations non publiées peuvent tester COUV-04.
  Les archives et leurs objets n'ont pas été réécrits.

Le remplissage intégral à 90 % est une convention d'affichage demandée dans cette
tâche, **pas** un certificat de représentativité scientifique. La fraction réelle,
la portée observée de la valeur et l'exclusion des faits territoriaux restent
inchangées. Les normales et anomalies exigent toujours une référence compatible.

Un résultat à moins de 90 % dont le masque qualifié manque reste gris avec ses
contours : sa fraction numérique seule ne suffit pas à fabriquer sa géométrie.
Cette protection explique le NO-GO restant, elle ne vaut pas implémentation de
surfaces prévisionnelles qui ne sont pas disponibles dans les archives actuelles.

## Preuves

- `evidence/matrix.csv.gz` : **282 348 lignes**, 713 PRA dont six corses,
  28 recettes incluant AGRO-03 et cinq variables météo brutes, quatre fenêtres historiques (1/7/14/30 jours),
  deux fenêtres prévisionnelles (1/7 jours), sélection et trois familles modèles.
  **556 140** comparaisons avec le catalogue antérieur : aucun résultat modifié.
- `evidence/matrix-summary.json` : effectifs, limites, empreinte de l'entrée réelle
  gelée CORE-01, temps et mémoire. Un filtre modèle sur le snapshot sélectionné
  ne valide pas les scénarios alternatifs non retenus par ce snapshot.
- Exemple ERA du 1er novembre : pluie, Tmoy et Tmin donnent chacun
  **681 remplissages entiers, 31 surfaces partielles, une PRA grise**.
  Ce n'est pas une mesure de disponibilité du 15 novembre.
- `evidence/sim-matrix.csv.gz` : 713 identités × 6 dates × 5 variables,
  **21 390 lignes** ; les 681 PRA non collectées sont explicitement marquées
  `not_collected`, pas déclarées sans données chez le fournisseur.
  Recalcul indépendant de la qualification des 32 cibles : **192/192 PRA-jours**
  Tmoy et **192/192** pluie utilisables à 90 %. Tmin/Tmax ne sont pas substituées.
- `evidence/storage-roundtrip.json` : sauvegarde et reprise **réelles** du canari
  gelé dans le bucket privé existant. Index identique après restauration,
  empreintes `catalogue.json` et `current.json` inchangées.
- `evidence/*-before.png`, `*-after.png` : mêmes valeurs réelles, même palette,
  ancien/nouveau moteur de miniatures. SVG reproductibles, compressés.
- `evidence/browser-*.png` et `browser.json` : vraie carte MapLibre avant/après,
  1440/768/390 px, 713 contours par carte, sans débordement ni erreur JS.
  Banc local isolé, pas une recette complète de chaque parcours de production.

## Limites scientifiques et travaux restant avant GO

1. AROME/ARPEGE/IFS : les archives fournissent couverture/poids et agrégats,
   mais pas le masque des cellules valides par variable/run/période requis pour
   restituer chaque surface partielle. Il faut produire et vérifier ces masques
   en amont, y compris l'intersection temporelle et multivariable. La matrice ne
   présente pas les modèles filtrés comme trois nouvelles acquisitions complètes.
2. SIM reste candidat et inéligible aux indicateurs/Journal. Cette PR automatise
   sa persistance ; elle n'intègre pas silencieusement son analyse aux cartes ERA.
   Le sélecteur historique ERA prioritaire/SIM complémentaire public reste à
   qualifier puis raccorder. Pas de raccordement SIM aux prévisions.
3. Tmoy SIM `]00UTC-00UTC]` et pluie SIM `]06UTC-06UTC]` gardent leurs journées.
   Le dernier jour de la collecte originale du 15 novembre est le **13 novembre**
   (J−2), pas le 14. Aucun report du dernier jour. Les autres variables et toutes
   les dates ne sont pas qualifiées par le seul succès Tmoy/pluie.
4. Les supports changeants restent bloqués par les calculateurs existants ; on
   ne recalcule pas un indicateur multijour à partir de fractions moyennes.
   THI historique sans humidité commune reste indisponible, pas nul.
5. AGRO-03 reste un catalogue hors production ; son rejeu vérifie le contrat,
   sans activation de ses indicateurs dans le Journal.
6. Les cartes d'éditions déjà publiées gardent leur rendu gelé. Une nouvelle
   version de publication explicitement approuvée sera nécessaire pour étendre
   COUV-04 aux éditions publiées futures sans changer les archives passées.
7. La disponibilité quotidienne à long terme et les sept mises à jour distinctes
   demandées par COUV-03B restent à observer. Pas de prétendue garantie J−1.

Décision : **PARTIAL pour la livraison technique ; NO-GO pour activer le rendu
national en production** avant résolution des points 1, 2 et 6 et recette des
parcours complets. Collecte/persistance et rendu ont des switches indépendants.
Voir `ACTIVATION.md`, `AUDIT.md` et `VALIDATION.md`.
