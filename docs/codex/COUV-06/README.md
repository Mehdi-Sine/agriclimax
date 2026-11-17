# COUV-06 — Cartes historiques

**Mise à jour du 17/11 : activation directe demandée par l’utilisateur ; voir
[activation du 17 novembre](ACTIVATION-20261117.md). Le bilan ci-dessous décrit
la livraison et les preuves de la PR #102 avant cette activation.**

Le rendu historique ERA5 est raccordé au catalogue actif et aux nouvelles cartes
versionnées du Journal. **Aucune activation, fusion, republication ou écriture de
production n'a été effectuée.** Le complément SIM reste volontairement non public.

| Décision | Verdict de revue | Portée et limite |
| --- | --- | --- |
| Rendu historique partiel ERA5 | **GO technique pour activation manuelle** | Explorer climat, analyse, cinq cartes d'édition existantes, miniatures/carrousel ; uniquement dates et supports qualifiés. Archives publiées préservées. |
| Complément SAFRAN/SIM public | **NO-GO** | Canari numérique réel, mais `technical_checks_only`, éligibilités false, conventions de journées et fiabilité publique non levées. Aucun Tmin/Tmax substitué. |
| Persistance quotidienne SIM privée | **GO pour activation manuelle contrôlée** | Job existant raccordé, reprise distante vérifiée, reçus et pipefail ajoutés. L'exécution quotidienne reste désactivée et son succès futur doit être contrôlé sur le runner réel. |

Ces GO sont des recommandations techniques pour la revue de cette PR, pas une
activation distante ni une déclaration de qualification scientifique nationale.
La version Next.js déjà installée signale une vulnérabilité connue lors du build ;
cette réserve doit être traitée dans la décision de déploiement. Aucun changement
de dépendances n'a été mêlé à COUV-06.

Résultat observé sur les quatre cartes climatiques du **01/11/2026** : **681 PRA
entièrement colorées, 31 partiellement colorées, une grisée**, avec les **713
contours réellement rendus**, dont les six corses. Le THI historique sans humidité
reste **713 PRA grises**, avec leurs contours. Crozon reste gris en ERA natif.

Pour les cinq cartes historiques d'édition des **02–08/11**, le candidat ajoute
67 valeurs sur portion observée à chaque carte : le même classement visuel
681/31/1. Les 645 valeurs antérieures de chaque carte et toutes les valeurs
prévisionnelles sont strictement conservées. Ce candidat local n'est pas publié.

## Ce qui change

- Interrupteur de rendu **historique seul**, indépendant des prévisions/SIM.
  Réutilisation intégrale de `coveragePaint`, masques ERA et règles existantes.
- Compteurs et légendes explicitant surface qualifiée, complément gris et absence.
  Le seuil de 90 % ne supprime jamais un contour et ne certifie pas une valeur.
- Nouveau gel optionnel des supports ERA avant sélection/publication de nouvelles
  éditions. Géométries dédupliquées, entrées bornées, valeurs calculées par les
  moteurs existants ; aucun nouveau catalogue ni formule.
- Rendu des nouvelles cartes figé dans leur bundle ; anciennes publications
  et rasters restent identiques après changement de flag.
- Reçus restore/collect/save/readback du job SIM existant, 21 jours, Bash/pipefail.

L'archive d'entrées candidate utilise **7 716 702 octets comprimés** et
**100 065 337 octets décomprimés** (gardes existantes 8/96 Mio). Le bundle de cartes
fait **6 330 087 octets comprimés**. Dépassement ou preuve inaccessible : cartes
d'origine conservées et statut explicite ; le Journal n'est pas bloqué.

## Preuves et exploitation

- [Audit réel canari, stockage et frontières scientifiques](AUDIT.md).
- [Recettes, comptages, captures et limites](VALIDATION.md).
- [Activation séparée et retour arrière précis](ACTIVATION.md).
- [Rapports canari vérifiés](evidence/sim-audit.json), [29 workflows](evidence/actions-audit.json),
  [reprise privée et pointeurs inchangés](evidence/storage-audit.json).
- [Candidat d'édition et valeurs conservées](evidence/edition-recipe.json),
  [42 contrôles API du catalogue actif](evidence/active-catalogue.json).

Aucune acquisition nationale, aucun nouveau pilote, aucune reprise COUV-05E,
aucun appel OpenAI, aucune nouvelle infrastructure. Les originaux privés restent
uniquement dans `work/`, exclus du Git ; seules captures demandées et métadonnées
de validation sont jointes. **PR à revoir ; ne pas fusionner automatiquement.**
