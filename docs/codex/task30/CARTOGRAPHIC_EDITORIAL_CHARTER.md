# Charte cartographique — semantic-1.0.0

Registre unique : `features/cartography/registry.ts`. Couleurs exclusivement via tokens CSS ; carte, légende et aide consomment les mêmes bornes et tokens. Classes à bornes supérieures inclusives ; dernière classe ouverte. NULL = gris, zéro reste une valeur. Qualité et fraîcheur indépendantes de l’intensité physique.

Température absolue : thermique. Anomalie thermique : bleu/froid, neutre autour de zéro, orange/rouge/chaud ; bornes symétriques stables. Historique thermique : anomalie par défaut, NULL conservé si la référence manque, valeur absolue sélectionnable. Prévisions : valeurs absolues uniquement.

Pluie : bleu séquentiel, jamais rouge pour un cumul fort. Écart de pluie à une référence homologue : déficit sec, neutre, excédent bleu ; écart absolu en mm, pas pourcentage avec référence quasi nulle. Gel : bleu séquentiel pour les jours. Chaleur et THI : jaune/orange/rouge. Sommes thermiques : ocre distinct du stress. Séquences sèches : couleurs sèches, sans diagnostic de sécheresse agricole. Quantités agricoles : verts, sans alerte.

Les hachures, supports couverts et reconstructions séparées sont conservés. Les 713 contours gardent 0,7 px et l’ombrage existant. Légendes numériques et tableaux évitent une lecture fondée uniquement sur la couleur. Valeurs absolues et anomalies portent des titres explicites. Les courbes temporelles différencient les séries source/normale par trait plein/pointillé ; leurs axes numériques ne sont pas des classes d’alerte.

Les palettes fixes ne cherchent pas à maximiser artificiellement le contraste de chaque sélection. Une carte uniforme est une information valide.
