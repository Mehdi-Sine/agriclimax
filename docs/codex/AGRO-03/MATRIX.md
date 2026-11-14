# Matrice multi-productions et priorités

**D** = directement calculable si variables et couverture qualifiées.
**P** = paramétrage agronomique requis avant toute interprétation propre à une
production. **S** = données supplémentaires requises ; calcul interprétatif reporté.
P1 = premier intérêt de surveillance, P2 = complément. Les périodes sont des
contextes à sélectionner localement, jamais des stades inférés du calendrier.

| Production | P1 — D, disponible par réutilisation ou nouveauté | P2 — D | P — paramètres à fournir | S — report et données manquantes |
|---|---|---|---|---|
| Blé tendre | gel/séquences, chaleur/séquences, pluie, sec/humide | nuits chaudes, pluie ≥10, max quotidien, sans dégel | base/cumul et origine semis, variété, stades ; fenêtres montaison/floraison/remplissage observées | échaudage, gel dommageable et rendement : phénologie, variété, eau du sol, exposition |
| Maïs | bases 6/10 déjà présentes, chaleur30/séquence, pluie/sec/humide, gel | nuits chaudes, max pluie, sans dégel | base/éventuel plafond et origine du cumul selon variété et méthode ; floraison observée | stress hydrique/rendement : sols, ET0, irrigation, enracinement, stade |
| Colza | gel/séquences, sans dégel, pluie/sec/humide, température | chaleur, nuits chaudes, max pluie | choix documenté de base/variété, date de levée et stade ; aucune nouvelle base arbitraire | défaut d'implantation, gel de tissus, rendement : peuplement, sol, pratiques, stade |
| Bovins lait | chaleur/séquences, Tmin>20 et séquences, Tmoy extérieure | sans dégel ; THI hérité conditionnel | seuil THI contextualisé, race, production, âge, adaptation | RH quotidienne qualifiée absente ; ventilation, rayonnement, vent, conditions intérieures et mesures horaires pour exposition réelle/récupération |
| Bovins viande | chaleur/séquences, Tmin>20 et séquences | sans dégel, Tmoy extérieure | race, âge, acclimatation, pâture/abri ; règle viande dédiée à documenter | THI/indice de charge : validation spécifique, rayonnement/vent, microclimat et état animal |
| Porcins | chaleur/séquences, Tmin>20 et séquences extérieures | sans dégel, Tmoy | stade/poids, densité, bâtiment, ventilation ; aucun seuil physiologique livré | THI porcin : formule et seuils contextualisés, T/RH et vitesse d'air du bâtiment, validation spécifique |
| Volailles | chaleur/séquences, Tmin>20 et séquences extérieures | sans dégel, Tmoy | espèce, souche, âge/poids, bâtiment et ventilation | THI aviaire : référence espèce/âge, T/RH et vitesse d'air intérieures ; ne pas transposer THI bovin |
| Viticulture | gel/minimum, pluie/sec/humide, base10 existante | chaleur, nuits chaudes, pluie ≥10/max, sans dégel | cépage, débourrement, origine du cumul et fenêtres locales | gel dommageable, mildiou, qualité : stade, humidectation, microclimat, pratiques ; pas d'indice de Huglin reconstruit avec variables inadéquates |
| Arboriculture | gel/minimum/séquences, sans dégel, pluie/sec/humide | chaleur, nuits chaudes, pluie max | espèce, variété, stade/floraison et seuils propres aux tissus | besoins en froid/gel dommageable : températures horaires, modèle de dormance, cultivar et observations phénologiques |
| Prairies/fourrages | pluie/sec/humide, cumuls thermiques existants, gel | chaleur, nuits chaudes, sans dégel, pluie ≥10/max | flore, base/point de départ, dates de coupe/pâture et fenêtres de récolte | pousse/biomasse, sécheresse fourragère : sols, ET0, stock hydrique, fertilisation et pratiques |

Les productions historiques conservent leurs identifiants ; `cattle` reste le
groupe générique. `dairy_cattle` et `beef_cattle` sont des contextes distincts,
pas des populations disjointes à additionner. De même, les mêmes jours de météo
partagés entre productions ne sont jamais des preuves indépendantes.

## Première sélection implémentée : huit recettes partagées

| ID nouveau | Définition exacte / unité | Référence et portée |
|---|---|---|
| `warm_nights20` | Σ 1(Tmin>20 °C), jours | TR ETCCDI ; Tmin du jour UTC, sans fenêtre nuit locale |
| `warm_nights20_sequence` | plus longue séquence Tmin>20 °C, jours | extension descriptive de TR, pas WSDI ni récupération animale |
| `wet_days1` | Σ 1(P≥1 mm), jours | définition du jour humide ETCCDI ; complément exact de `dry` <1 |
| `wet_sequence1` | plus longue séquence P≥1 mm, jours | méthode CWD ETCCDI, bornée par la fenêtre |
| `rain10_days` | Σ 1(P≥10 mm), jours | R10mm ETCCDI ; aucun seuil de dommage |
| `rain_max1day` | max P quotidien, mm | méthode Rx1day ETCCDI ; ni pluie horaire ni période de retour |
| `ice_days` | Σ 1(Tmax<0 °C), jours | ID ETCCDI ; température extérieure territoriale |
| `ice_sequence` | plus longue séquence Tmax<0 °C, jours | extension descriptive de ID ; pas résistance au froid d'une culture |

Pas de catalogue gonflé par duplication : huit nouveautés communes, réutilisables
sur les productions végétales et le contexte bovin générique. Pour chaque contexte
animal spécialisé, sept descripteurs météo (chaleur, séquence, Tmoy, nuits chaudes,
séquence, sans dégel et séquence) ; bovins lait : les trois THI existants en plus,
uniquement lorsque calculables. Aucun nouvel indice animal n'est fabriqué pour
atteindre un quota. Les autres indicateurs de la matrice sont **réutilisés**.

Toutes les recettes sont exploratoires en usage agricole. Les méthodes météo
sont documentées, sans revue experte ni validation biologique revendiquée. Les
fenêtres de 1–30 jours ne sont pas des indices ETCCDI annuels complets, et les
séquences sont censurées aux bornes de ces fenêtres. Les seuils 20 °C, 0 °C,
1 mm et 10 mm sont des conventions météo **génériques**. Les bases thermiques
et paramètres THI sont explicitement distingués : leur interprétation nécessite
un choix propre à la production et au contexte, non fourni par la météo seule.

Le [catalogue machine](evidence/catalogue.json) expose les affectations exactes,
les paramètres génériques/spécifiques, unités, variables, périodes, références,
limites et données nécessaires. Il se valide avec
`contracts/jsonschema/agro03-catalogue.schema.json`.
