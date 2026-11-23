# Fiches scientifiques AGRO-05

Toutes les fenêtres sont des journées UTC inclusives. ERA5-Land est une réanalyse de Copernicus agrégée au référentiel des 713 petites régions agricoles (PRA) selon `pra-native-1`. Les précipitations sont des lames d’eau moyennes sur le support. Le Tmin d’une journée est le minimum des cellules natives admissibles. La Tmoy est la moyenne spatiale du champ moyen quotidien. Le temps et le support doivent être complets et compatibles pour une valeur sur toute la PRA. Un support partiel vérifié et stable peut fournir une valeur de portion, réservée à la carte et à la fiche. Une journée lacunaire ou un masque variable interrompt la qualification de la fenêtre. Le zéro reste une valeur admissible. [ERA5-Land, Copernicus](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land) · [Règles nationales de couverture](../COUV-04/README.md)

## 1. Chaleur accumulée pour le maïs

| Champ | Définition |
| --- | --- |
| Question | Quelle offre thermique le territoire présente-t-il pendant une fenêtre de développement choisie pour le maïs ? |
| Formule et unité | Somme de `max(0, min(Tmoy_PRA, 30) − 6)` en °C·j. Tmoy en °C. |
| Temporalité | Fenêtre historique de 1 à 30 jours. Pertinence du semis à la maturité, selon la campagne et la zone. En dehors de la période culturale, la somme garde uniquement sa signification météorologique. |
| Paramètres | Base 6 °C et plafond 30 °C issus des conventions françaises de temps thermique pour le maïs. Aucun seuil d’alerte ou objectif variétal dans Climacta. |
| Validité | Une Tmoy ERA5-Land admissible chaque jour. On applique les bornes à la moyenne de la PRA. |
| Résultat | **Potentiel thermique** dérivé d’une réanalyse. |
| Limites | Le bornage après moyenne spatiale n’équivaut pas à la moyenne des degrés-jours à la parcelle. La Tmoy ERA5-Land diffère aussi de la demi-somme d’extrema de station. Les barèmes variétaux et stades suivis au champ exigent des données compatibles, la date de semis et les conditions de culture. |

[INRAE, projet AP3C et indicateurs agroclimatiques maïs](https://www.inrae.fr/sites/default/files/pdf/Adaptation%20des%20cultures%20au%20CC-projet%20AP3C.pdf) · [INRAE, temps thermique et choix de méthode](https://mots-agronomie.inrae.fr/index.php/Temps_thermique_%28sommes_de_temp%C3%A9ratures%29_-_Annexe_5) · [ARVALIS, besoins thermiques et groupes de précocité](https://www.arvalis.fr/file-download/download/public/244945)

## 2. Jours de gel en période sensible

| Champ | Définition |
| --- | --- |
| Question | Combien de jours avec gel météorologique pendant la période jugée sensible localement ? |
| Formule et unité | Nombre de journées où `Tmin_PRA < 0 °C`, en jours. |
| Temporalité | Fenêtre historique de 1 à 30 jours, fournie par l’utilisateur. Au printemps, la pertinence se vérifie avec le stade local. Les périodes automnales se lisent comme des décomptes météorologiques. |
| Seuil | 0 °C strict définit la journée météorologique de gel. Le seuil agronomique dépend notamment du stade, de l’espèce et de la durée d’exposition. |
| Validité | Tmin natif quotidien vérifié sur un support stable. Aucune dérivation depuis la température moyenne. |
| Résultat | **Réanalyse** du signal météorologique. |
| Limites | Le franchissement du seuil dans une maille ne donne ni les hectares concernés, ni la température des organes, ni la durée du gel. Dans l’export, le RPG indique les groupes de production déclarés, sans preuve de sensibilité pendant la fenêtre. |

[Météo-France, définition de la journée de gel](https://education.meteofrance.fr/changement-climatique/les-gelees-seront-elles-de-plus-en-plus-rares-dans-le-futur) · [ARVALIS, sensibilité au stade montaison](https://www.arvalis.fr/infos-techniques/cereales-faut-il-craindre-le-retour-du-froid)

## 3. Plus longue séquence sans pluie significative

| Champ | Définition |
| --- | --- |
| Question | Pendant combien de jours consécutifs les apports de pluie ont-ils été faibles, par exemple après un semis ? |
| Formule et unité | Longueur maximale des suites de jours où `P_PRA < 1 mm`, en jours. Une journée à exactement 1 mm coupe la séquence. Si toutes les journées atteignent 1 mm, la valeur est 0. |
| Temporalité | Fenêtre historique complète de 1 à 30 jours. La séquence peut avoir commencé avant ou se poursuivre après la fenêtre. |
| Seuil | 1 mm/j est la convention climatique CDD pour une journée sèche. Elle identifie une faible lame d’eau moyenne, sans seuil de réponse de la plante. |
| Validité | Pluie quotidienne non négative et support continu, sans traverser de jour lacunaire. |
| Résultat | **Réanalyse** d’une séquence météorologique, calculée sur la fenêtre affichée. |
| Limites | La moyenne spatiale peut masquer des averses locales. Une séquence ne renseigne ni l’humidité du sol, ni l’irrigation, ni le déficit par rapport à une normale. |

[Environnement et Changement climatique Canada, méthode CDD](https://climate-scenarios.canada.ca/?page=climdex-indices)

## 4. Pluie reçue avant une intervention

| Champ | Définition |
| --- | --- |
| Question | Quelle pluie est tombée avant une date de semis, récolte ou passage envisagé, pour cibler les vérifications du ressuyage au champ ? |
| Formule et unité | `Σ P_PRA` en mm cumulés sur la fenêtre choisie. |
| Temporalité | Fenêtre historique de 1 à 30 jours, par exemple les sept jours précédant la date d’intervention. À durée identique, des cumuls peuvent être comparés entre territoires ou fenêtres homologues. |
| Seuil | Aucun seuil de portance. Les classes de la carte facilitent la lecture. |
| Validité | Lames d’eau quotidiennes complètes et support stable. |
| Résultat | **Réanalyse** de la pluie antécédente. |
| Limites | La portance dépend notamment de la texture, du drainage, du tassement, de l’état hydrique initial et des engins. Le cumul donne le contexte pluviométrique avant une vérification à la parcelle. |

[ARVALIS, cumuls, fréquence et capacités de ressuyage](https://www.arvalis.fr/infos-techniques/les-cereales-vont-elles-pouvoir-compenser-face-aux-exces-deau)

## 5. Plus fort cumul de pluie sur cinq jours

| Champ | Définition |
| --- | --- |
| Question | Quel a été le plus gros apport sur cinq jours de suite, susceptible de concentrer les difficultés d’intervention ? |
| Formule et unité | Maximum de `P[d−4] + … + P[d]`, en mm. Chaque fenêtre de cinq jours doit être entièrement incluse dans la période sélectionnée. |
| Temporalité | Fenêtre historique complète de 5 à 30 jours. Sur exactement cinq jours, le résultat égale le cumul total. Comparer des périodes d’égale durée. |
| Seuil | Cinq jours est la durée de l’indice Rx5day. Aucun seuil d’inondation, de rareté ou de dommage. |
| Validité | Série de lames d’eau quotidiennes non négatives, support homogène et complet sur toute la fenêtre. |
| Résultat | **Réanalyse** d’un maximum glissant, adaptation de Rx5day à une fenêtre libre. |
| Limites | La durée fixe mesure la concentration temporelle des pluies à l’échelle PRA. Sans référence historique homologue, aucune qualification statistique d’excès. Drainage, engorgement et dégâts restent inconnus. |

[Environnement et Changement climatique Canada, méthode Rx5day](https://climate-scenarios.canada.ca/?page=climdex-indices) · [ARVALIS, pluie et excès d’eau en céréales](https://www.arvalis.fr/infos-techniques/les-cereales-vont-elles-pouvoir-compenser-face-aux-exces-deau)

## Indicateurs différés

| Indicateur | Ce qui manque |
| --- | --- |
| Risque agronomique de gel | Stades territorialisés, seuils espèce/stade transférables et exposition qualifiée. AGRO-04 peut documenter la présence et des fenêtres indicatives. |
| Ressuyage, portance ou accès | État initial et profil hydrique du sol, propriétés et drainage, validation auprès des parcelles et contexte des engins. |
| Croissance potentielle de l’herbe | Méthode confrontée aux systèmes prairiaux et prise en compte du stress hydrique. Le repère thermique de l’Idele démarre au 1er février, souvent au-delà des fenêtres de 30 jours et sans archive printanière nationale qualifiée dans ce rejeu. [Idele et INRA Toulouse](https://idele.fr/fileadmin/medias/Documents/fiche_sommes_de_temperatureVersion2016.pdf) |
| Stress bovin national | Humidité historique absente. Les axes THI existants exigent déjà un couple T/RH compatible. Une extension nationale nécessite un support horaire validé et un lien avec les conditions d’élevage. |
| Déficit et anomalie de pluie ou de température pour ces cinq vues | Séries de référence homologues aux formules et au support utilisés. Les anomalies déjà proposées dans Climat restent celles des variables et normales compatibles. Pour les séquences, plafonnements et maxima glissants, dériver une normale exige les chroniques quotidiennes historiques, puis le calcul par année avant agrégation. |
