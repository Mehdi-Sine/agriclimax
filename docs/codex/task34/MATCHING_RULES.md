# Rapprochement documentaire v1

Le service `matching.py` est pur et indépendant du réseau/stockage. Entrées : publications normalisées et événements existants issus d’une archive Journal/Veille. Sortie : candidats documentaires traçables avec cinq axes `match`, `unknown`, `mismatch`. L’événement conserve sa période, son identifiant, ses productions, sa région, son phénomène et sa provenance. Aucune règle climatique n’est recalculée.

1. Publication horodatée et non rejetée ; date comparée à l’intervalle de l’événement (borne de fin incluse dans ce rapprochement documentaire).
2. Distance de publication à cet intervalle ≤ 14 jours pour `links`. Cette proximité n’est pas une période observée et ne prouve pas un même épisode.
3. Phénomène documentaire explicitement identique au phénomène de l’événement. `thi` ne correspond pas automatiquement à `heat` : pas d’équivalence scientifique inventée.
4. Intersection des productions explicites, sinon axe inconnu si une des listes est vide. Des listes connues disjointes excluent le rapprochement.
5. Région administrative explicitement identique, sinon inconnue si aucune région documentaire ; région différente exclue.
6. Thème agroclimatique présent ; une incertitude géographique ou de production reste dans les axes et impose le statut `documentary-candidate`. Tous les axes compatibles et connus donnent `documentary-overlap`, toujours documentaire.

Une fenêtre de contexte agricole mensuel distincte à 15–30 jours alimente uniquement `background_links`, statut `documentary-background`, utile pour des plans d’adaptation ou soutiens saisonniers. Le moteur n’allonge jamais la fenêtre au-delà de 30 jours. Cette liste ne doit pas être fusionnée silencieusement avec `links` ni présentée comme un même événement. L’essai réel montre précisément la différence entre contexte d’été publié en octobre et prévisions de novembre.

Toutes les sorties portent `scientific_confirmation: false` et une réserve explicite. Aucun identifiant PRA n’est propagé de l’événement à la publication ; aucune preuve de dommage n’est créée. Un article de gel viticole ne démontre pas un dommage dans les PRA viticoles où du gel était prévu. La présence de mots dans un résumé ne valide ni le phénomène ni sa causalité.

Les événements/références exacts et l’empreinte de l’archive sont embarqués dans le bundle. Les fenêtres et algorithmes appartiennent à la version de rapprochement ; toute évolution nécessite une revue documentaire, pas une modification des contrats scientifiques.
