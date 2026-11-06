# Comparaison scientifique THI — Institut de l'Élevage

Consultation du 6 novembre 2026. La page fournie est désormais consultée dans un navigateur normal, après son écran de vérification ; les vérifications TLS restent actives. Les contenus complets restent dans les fichiers de travail : seules les références, empreintes et conclusions sont livrées.

## Références effectivement consultées

1. Institut de l'Élevage, Aguerre et al., **Vers une amélioration de la tolérance à la chaleur chez les bovins (bilan CAICalor)**, 20 juin 2025. [Publication officielle 23327](https://idele.fr/umt-ebis/publications/detail-article?cHash=d4293b55e7d0f2bd1b624358cb19fa72&tx_atolidelecontenus_publicationdetail%5Baction%5D=showArticle&tx_atolidelecontenus_publicationdetail%5Bcontroller%5D=Detail&tx_atolidelecontenus_publicationdetail%5Bpublication%5D=23327).
2. Vinet et al. (2023), **Estimation of genotype by temperature-humidity index interactions on milk production and udder health traits in Montbeliarde cows**, Genetics Selection Evolution, [doi:10.1186/s12711-023-00779-1](https://doi.org/10.1186/s12711-023-00779-1), [texte intégral PMC9854084](https://pmc.ncbi.nlm.nih.gov/articles/PMC9854084/). Cet article est lié directement par la publication Idele ; son paragraphe « Meteorological data » est consulté dans le texte intégral XML Europe PMC.
3. La référence NRC (1971) identifiée dans cet article est *A guide to environmental research on animals*, National Academy of Sciences. Cette source primaire ancienne n'a pas été consultée intégralement : ne pas lui attribuer une vérification directe.

Empreintes et URLs dans `evidence/thi-scientific-sources.json`.

## Formule et résolution

L'article de Vinet et al. explicite :

`THI = (1.8 × T + 32) − (0.55 − 0.0055 × RH) × (1.8 × T − 26)`

avec T moyenne sur 24 h en °C et RH moyenne sur 24 h en %. C'est exactement l'équation de `config/cattle/thi-v1.json`, `features/cattle/thi.ts` et du moteur Python. Le nom interne historique `bohmanova-2005-thi-26-v1` et la référence déjà versionnée restent inchangés ; cette comparaison ajoute une concordance documentaire avec la formulation NRC citée par les travaux français, sans créer une formule concurrente.

La synthèse quotidienne est donc documentée scientifiquement comme convention de calcul. Elle n'est pas un maximum horaire, ni la moyenne des THI horaires, ni une durée d'exposition. Les calculs exigent toujours une paire T/RH de même source, run et fenêtre quotidienne, avec couverture complète ; aucune humidité manquante n'est inventée.

## Seuils : comparaison sans changement de paramètre

| Élément | Publication Idele / travaux liés | Interprétation retenue dans AgriclimaX |
|---|---|---|
| Production laitière | Le bilan décrit des performances différentes suivant le THI ; il rapporte notamment un contraste entre la zone 45–55 et les conditions supérieures à 70 dans les populations étudiées. | Le seuil 72 existant reste un repère exploratoire, pas un seuil universel d'apparition de dommages. Aucun rendement ni volume de lait perdu calculé. |
| Reproduction | Le bilan rapporte une dégradation au-delà de 60, d'ampleur différente suivant les races et le caractère suivi. | Une valeur inférieure à 72 n'est jamais une preuve d'absence d'effet biologique. Aucun diagnostic de fertilité ni score de sensibilité. |
| Embryons et fenêtres de sensibilité | Le bilan distingue des effets autour de la collecte, avec plusieurs fenêtres antérieures ; il évoque aussi des conditions THI > 68 pour certaines analyses. | Aucun stade, fenêtre de sensibilité ou effet différé attribué automatiquement à une PRA. |
| Population et échelle | Holstein, Montbéliarde, Normande ; l'article de 2023 utilise SAFRAN et des rattachements géographiques d'élevages, avec moyenne du THI des trois jours précédant les contrôles laitiers. | Des données ERA5-Land/AROME/ARPEGE/IFS agrégées aux PRA ne sont pas une réplication de cette étude ni une mesure d'élevage. Pas de transposition des coefficients de perte ou du modèle génétique. |

L'article de 2023 travaille notamment sur des contrôles 2016–2020 en Montbéliarde, alors que le bilan Idele résume plusieurs études et populations sur 2010–2020. Ces périmètres ne doivent pas être confondus. Des températures moyennes journalières comparables dans la formule ne prouvent pas une exposition identique dans les bâtiments, sur toute une PRA ou pour tous les animaux.

## Décision scientifique V1

Conserver la formule, le seuil initial 72 et les comparaisons strictes existantes. Conserver `scientific_status: exploratory` et `parameter_status: exploratory`. La concordance documentaire valide l'identité de la formule et justifie ses limites ; elle ne transforme pas les seuils en seuils biologiques universels ni la restitution en diagnostic animal.

Aucune modification de formule, configuration, seuil ou classe. Les 20 tests TypeScript ciblés THI/calcul partagé passent après consultation ; les preuves scientifiques Python/TypeScript antérieures ne sont pas recalculées nationalement. Toute future évolution des seuils exigerait une justification liée au caractère, à la population et à la fenêtre, une nouvelle version de règle et des tests de non-régression.
