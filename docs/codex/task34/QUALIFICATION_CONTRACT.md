# Contrat documentaire pour T35

Modèles runtime stricts (champs supplémentaires refusés) : `engine/src/agriclimax/news/models.py`. Export : `editorial-news-1.schema.json`. Version `editorial-news-1`, qualificateur `documentary-keywords-1`, rapprochement `documentary-match-1`. Une modification sémantique nécessite une nouvelle version ; le bundle transporte ces versions et une identité SHA-256 factuelle distincte de son heure de génération.

`EditorialNewsBundle` contient : identité, génération UTC, empreinte registre, état de chaque source, publications normalisées, doublons potentiels, événements archivés et leur provenance, empreinte de l’archive source, `links` contemporains, `background_links` saisonniers, limitations.

Chaque publication contient : identité et révision, empreinte du titre, source/éditeur, titre, URL originale et canonique, publication UTC nullable et collecte UTC, auteur optionnel, catégories source, résumé autorisé optionnel, type, productions, régions, phénomènes, thèmes, pertinence, preuves lexicales, limitations, version du classement, empreinte du flux et lien des droits.

Vocabulaires contrôlés dans `qualify.py` : productions `wheat`, `maize`, `viticulture`, `cattle`, `grassland`, `arboriculture`, `vegetables`, `poultry`, `oilseeds`, `sugar-beet` ; phénomènes documentaires `frost`, `heat`, `rain`, `dry` ; thèmes santé végétale/agronomie/adaptation/agroclimat ; noms administratifs régionaux explicites. Ces termes ne sont pas de nouvelles règles de risques et ne produisent aucun score scientifique.

L’URL dite canonique est le permalien du flux normalisé, sans vérification de balise HTML `rel=canonical` : aucun article lié n’est ouvert.

La région est reconnue seulement si son nom administratif complet figure dans les métadonnées autorisées. Une commune, un département, une ancienne région, un sigle ambigu ou la région de l’éditeur ne suffisent pas. Inconnu = liste vide, sans géocodage implicite. Les productions sont elles aussi explicites ; aucune présence agricole n’est déduite d’un thème. L’accent du maïs est préservé pour éviter la conjonction « mais ».

Pertinence `high` : phénomène et production explicites ; `context` : thème agronomique/climatique ou phénomène sans production connue ; `rejected` : pas d’indice suffisant, ou recrutement/orientation scolaire identifiés. Ce classement heuristique porte ses mots déclencheurs ; négations, polysémies, portée des phrases et pertinence effective restent à relire. Pas de localisation ou causalité ajoutée pour remplir le contrat.

Types : nouvelles régionales `news`, rubrique BSV vérifiée `plant-health-bulletin` ; `technical-publication` réservé aux futures sources de ce type. La date du flux est une publication, jamais une date de dommage ou de livraison agricole supposée. Date invalide, sans fuseau, ou absente : `null`, limitation, exclusion du rapprochement temporel. Date future de plus d’un jour : item rejeté.

Déduplication stricte par URL canonique au sein du lot ; premier flux du registre prioritaire. Les doublons gardent l’identifiant de source et l’empreinte du flux secondaire. Empreinte égale du titre sur URL différente = `possible-republication`, conservée pour revue, jamais fusionnée comme preuve équivalente. Une nouvelle révision de la même URL est conservable dans les archives entre lots. La similarité sémantique/paraphrase n’est pas résolue par ce premier moteur.

Consommation future : décompresser le bundle, valider avec le schéma, vérifier empreintes/version/date, filtrer les rejets et afficher les réserves. `background_links` ne peut pas servir à formuler une phrase de concordance contemporaine. `links` n’autorise pas davantage à affirmer un dommage, une causalité ou une confirmation. Aucun prompt ou appel OpenAI n’est intégré dans T34.
