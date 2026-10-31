# Disponibilité nationale observée

713 PRA effectivement traitées, 30 dates UTC uniques chacune. États par PRA : {'complete': 645, 'partial': 67, 'unavailable': 1}.

[Liste des 713 PRA](availability.csv) : état de période, nombres de journées complete/partial/unavailable, cellules attendues, bornes de valid_counts, fraction pondérée minimale et nombres de scalaires NULL.

Complete exige les 30 journées entièrement supportées. Unavailable signifie zéro valeur native sur toute la période ; partial couvre les autres cas incomplets. Aucun résultat incomplet n’est publié comme scalaire complet, aucun NULL remplacé par zéro. La fraîcheur est historique/stale. Aucun masque terrestre permanent ou couverture climatique complète n’est déduit de ce run.
