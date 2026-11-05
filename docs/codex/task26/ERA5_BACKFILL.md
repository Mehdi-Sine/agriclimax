# Task26B — rattrapage borné

État DEV vérifié le 5 novembre : 19 octobre national713 ; 20 octobre3 pilotes. Cible horloge30 octobre, preuve réelle attendue après acquisition des24h T et du31 octobre00UTC pluie. Aucun jour n'est publié sur la seule base de cette cible.

Optimisation : une emprise2° couvre jusqu'à7 jours contigus ; découpage mensuel par le fournisseur existant. Le splitteur écrit les clés quotidiennes compatibles Task26, puis les lots assemblent les jours manquants contigus par PRA (maximum7). Les trois PRA du20 sont exclues de leur acquisition/publication ; les sous-tuiles partiellement en cache ne sont pas réacquises. Conservation SHA256, conflits immuables, garde375Mo,22min,4GiB,128Mio source,448Mio workspace, concurrence1.

Les descriptions sources identiques sont mutualisées par SHA256 dans les seuls nouveaux lots multi-jours. Les anciennes métadonnées/identités ne changent pas. Les dates et reçus restent complets. Plan froid7jours :30 emprises au lieu de210 (hors frontière mensuelle ou cache hétérogène). Mesures réelles et runs à compléter après exécution.
