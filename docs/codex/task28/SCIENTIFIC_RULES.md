# Catalogue scientifique V1

Le catalogue exécutable est `apps/web/features/agroclimatic/catalogue.ts`, version agroclimatic-1.0.0. Formules, unités, variables, seuils, période admissible, qualité et motifs NULL y sont explicites. Tous les indicateurs restent exploratoires. Aucun stade phénologique n'est déduit du RPG.

- GDD : Σ max(0,Tmoy−base), base initiale 0 °C, paramétrable. La Tmoy du contrat météo est utilisée ; ce n'est pas systématiquement (Tmin+Tmax)/2. McMaster & Wilhelm (1997), *Growing degree-days: one equation, two interpretations*, doi:10.1016/S0168-1923(97)00027-0 ; référence vérifiée via Crossref le 6 novembre 2026. Convention explicite, sans modèle phénologique.
- Comptes de journées : comparaisons strictes > ou <. Chaleur 25 °C, gel 0 °C, sec 1 mm, pluie importante 20 mm : paramètres exploratoires de lecture, pas seuils biologiques universels. Les méthodes de comptes et séquences sont apparentées aux méthodes ETCCDI ; les seuils personnalisés ne sont pas des indices ETCCDI standard.
- Séquences : fréquence des épisodes et durée maximale sur des journées calendaires consécutives ; aucune extrapolation à travers une lacune.
- Pluie : somme en mm des profondeurs quotidiennes spatialisées ; pas volume d'eau ni mesure parcellaire.
- THI : formule existante config/cattle/thi-v1.json et fonction features/cattle/thi.ts, sans changement du seuil 72. THI(Tmoy,RHmoy), maximum des synthèses journalières pour une période complète ; ni maximum horaire ni heures d'exposition. Référence Bohmanova et al. (2005) conservée avec ses limites US Holsteins. Les seuils ne décrivent pas un diagnostic animal ni l'intérieur d'un bâtiment.

La consultation du site Institut de l'Élevage a rencontré une page de vérification de connexion (HTML conservé dans les fichiers de travail). La comparaison indépendante de ses recommandations n'est donc pas déclarée validée. Aucun seuil n'a été modifié à partir d'une référence non consultée.

Une valeur complète exige des variables finies, physiquement admissibles, compatibles et entièrement couvertes sur toutes les journées. Toute lacune rend le cumul NULL. Les valeurs quotidiennes restent consultables, avec source, run et nature ; un changement de source/run interdit l'agrégation de période. Les estimations récentes issues de prévisions sont étiquetées comme telles. Aucune interpolation entre ERA5-Land et la météo récente.
