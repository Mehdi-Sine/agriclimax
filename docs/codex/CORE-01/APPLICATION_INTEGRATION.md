# Intégration applicative

- Archives : valeurs strictes et empreintes inchangées ; adaptateur de support
  réutilisant observedSupportDay, ses géométries, identités et couvertures vérifiées.
  Le nombre de cellules valides natif n'est pas transformé en taux temporel sur
  une portion : seule la preuve journalière explicite permet cette qualification.
- Climat : version 1.3 par défaut ; value territoriale et observed_value séparées,
  qualité additive ; résultats natifs et références existantes conservés. Les
  normales et anomalies ne bénéficient pas de l'ouverture des supports partiels.
- Analyse : mêmes formules scientifiques et même contrat ; descriptifs et séquences
  limités au support prouvé, THI historique absent sans humidité. Paramètre
  rule_version conservé pour reproduire 1.0–1.2.
- Blé : voie additive 2.1, ancienne 2.0 conservée. Les dix règles consomment les
  mêmes supports vérifiés. La synthèse compte séparément supports complets,
  descriptifs de portions, estimations et absences. Le contributeur du Journal
  contrôle la version, la qualification et l'éligibilité effective.
- Prévisions : identité modèle/run/grille/poids/méthode/unité et intervalle UTC
  conservés. Une couverture numérique complète n'est jamais une qualification
  terrestre ; drapeaux fournisseur conservés, masque inconnu explicite.
- Veille 1.1 : application du contrat commun dans chaque segment homogène existant.
  Les segments ne sont pas raccordés en une séquence. Le maximum des durées des
  segments reste une statistique de segments, pas une séquence reconstituée de
  sept jours. Les preuves conservent chaque qualification de segment ; aucune
  qualification unique homogène inventée pour une période multi-modèles.
- Journal : mêmes métriques et preuves ; une valeur sur portion peut être
  cartographiée, mais detected reste NULL et elle ne contribue pas aux chiffres
  clés, aux faits régionaux ni aux conclusions territoriales. T32B conservé.
- Cartes : les 713 polygones officiels entiers restent sélectionnables ; trame
  existante pour les descriptifs partiels. La couche découpée historique est
  conservée seulement pour la restitution des anciennes versions.

Le paramètre rule_version est transmis par les écrans Climat/Analyse à l'API,
pour la reproduction et les captures avant/après. Aucune nouvelle refonte UX.
La présence d'un nombre, y compris zéro, ne détermine ni la qualité ni la portée.
