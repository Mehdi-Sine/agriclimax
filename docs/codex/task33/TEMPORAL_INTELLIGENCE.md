# Comparaisons qualifiées

Le comparateur `features/journal/history.ts` reste inchangé. L'adaptateur vérifie chaque ligne nationale par le lecteur DATA-01 (empreinte du gzip, 713 identités, source et variables), puis refuse les doublons et toute source autre qu'ERA5-Land / `pra-native-1` attendue. Une valeur éditoriale historique exige un support natif complet : statut available, couverture >= 0,9999, cellules valides égales aux cellules attendues. Les valeurs partielles ne deviennent pas des valeurs PRA.

La signature scientifique par PRA et variable comprend série de transport, dataset, méthode, empreinte géométrique et pondérations, paramètres, nombre de cellules, variable, unité et version de règle. Un changement ou une date manquante retire la PRA du support commun. Le support retiré et le dénominateur restent explicites ; ce n'est jamais une couverture nationale complète implicite.

Pour un horizon h, comparaison de [J-2h+1,J-h] et [J-h+1,J], uniquement sur l'intersection stable. Les deux fenêtres ont les mêmes dates relatives, unités et signatures. Intensité : extrême territorial, durée maximale pour la séquence sèche ; aucune moyenne non pondérée. Pour le gel, le signe de Tmin est inversé dans la magnitude interne afin que l'intensification signifie un froid plus marqué ; les faits gardent la valeur physique en °C.

Les seuils descriptifs reprennent PHENOMENA : Tmax > 25 °C, Tmin < 0 °C, pluie > 20 mm/j et séquence d'au moins 3 jours < 1 mm/j. Ce sont des critères éditoriaux descriptifs versionnés, pas des lois de dommage. La baisse spatiale reste `attenuation` avec la raison spatiale du comparateur ; disparition n'est affirmée que sur support complet.

Chaque comparaison distingue historical_evolution, forecast_revision, not_comparable et insufficient_history. Toute révision de prévision est explicitement étiquetée, quel que soit le statut retourné (y compris extension/apparition). Deux cycles n'ayant pas les mêmes validités, modèles, supports ou horizon exact ne sont pas homologués.

Sur 30 jours réels : 3, 7 et 14 jours partiellement exploitables ; 30 jours de durée documentée possibles, mais comparaison de deux fenêtres de 30 jours impossible sans 60 jours. Les résultats détaillés, supports et provenance sont dans `evidence/comparisons.json.gz`. Le dossier IA conserve le plus long horizon qualifié par proposition et les diagnostics globaux des quatre horizons.

Chaque comparaison conserve explicitement rule_version, data_freshness et quality_flags. La fraîcheur résume les bornes des timestamps calculés des entrées communes ; la provenance complète reste dans l’archive de comparaisons. Un support exclu ou une fenêtre insuffisante porte un flag explicite.
