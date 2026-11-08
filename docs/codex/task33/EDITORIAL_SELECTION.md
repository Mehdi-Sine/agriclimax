# Sélection explicable

Les faits historiques régionaux dénombrent les PRA dont un épisode est encore documenté au cutoff ; la durée affichée est le maximum documenté, pas une durée commune à toute la région. Les événements prévisionnels viennent du contrat T31 validé. Les contributions agricoles passent le contrat générique existant ; le blé historique a un adaptateur séparé. Le moteur général n'énumère aucune liste de productions.

Chaque proposition porte IDs de faits, territoire régional, nature, période, références temporelles, contexte de production saisonnier et manques. Les productions déclarées d'un événement restent distinctes de `production_context`, étiqueté hypothèse saisonnière : pas preuve de présence ni de stade. Le pont versionné `editorial-signal-bridge.v1.json` relie phénomènes et signaux du référentiel, seulement pour proposer une question.

Tri lexicographique : fraîcheur au regard de la date éditoriale, comparabilité temporelle, nombre de PRA concernées, persistance en jours, concordance saisonnière, apport documentaire complet puis nouveauté. Aucune température n'est additionnée à des mm ou à des jours. Les intensités physiques restent dans leur unité ; elles ne deviennent pas un score transversal de risque. Le second passage privilégie un sujet par phénomène puis par région avant de compléter, au plus douze propositions.

Les liens documentaires faibles ne donnent aucun bonus. La nouveauté peut recevoir les topic_keys déjà proposés via l'interface du moteur ; le CLI de replay initial n'a pas d'historique éditorial antérieur et le déclare par empreinte de liste vide. La diversité des productions est limitée par les preuves disponibles ; aucune variété artificielle n'est injectée.

Aucun fait : zéro candidat de une et au plus deux questions documentaires saisonnières. Archive ancienne : aucune proposition de une actuelle tirée de cette archive. Tous les candidats sont `publication_eligible:false` et nécessitent une revue éditoriale.
