# Instructions et sortie structurée

Template versionné `editorial-board-fr-1`, empreinte conservée dans chaque édition. Les responsabilités de rédaction en chef, journalisme climat/agriculture, agronomie et secrétariat de rédaction sont réunies dans une seule instruction ; aucun réseau multi-agents.

Le modèle compare fraîcheur, solidité des preuves, temporalité, extension, persistance, saison, documentation et nouveauté. Le maximum de PRA n'est pas un classement agronomique. Seuls critères et justification éditoriale concise sont demandés.

Le contrat strict `editorial-draft-1.schema.json` impose des blocs tracés, des chiffres recopiés, des identifiants candidats, des rubriques dynamiques, des références presse et des illustrations disponibles. Inconnus interdits à chaque objet rédactionnel. Aucun parsing Markdown. L'enveloppe d'archive est construite par le serveur, pas par le modèle.

Toutes les données externes sont explicitement non fiables comme instructions. Le seul message utilisateur contient le dossier T33 validé et les métadonnées nécessaires des illustrations, jamais leurs séries détaillées. Aucun outil de navigation, DB ou calcul n'est fourni. Le transport n'ajoute aucun outil et désactive la conservation Responses (`store:false`). Aucune reproduction intégrale de presse.

L'Almanach propose des questions saisonnières théoriques, jamais des stades ou travaux observés. Les dictons ne prédisent pas. Le modèle doit accepter les journées calmes et raccourcir son article quand les preuves le justifient. Une injection ou une assertion subtile non reconnue par les règles reste soumise à revue humaine.
