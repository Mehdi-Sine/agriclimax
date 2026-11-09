# Analyse des cinq contrôles sur la réponse réelle du 9 novembre

L’archive source reste immuable : e1f6d85baaa74237ff9d94be5b97dd4f2234f4969f2773ecc63e6f4a03cfa4da.
Son texte, ses références, ses dates et son verdict initial `rejected` avec cinq codes
ne sont pas réécrits. La projection publique conserve ce verdict et présente séparément
le réexamen actuel : `needs_editorial_review`, aucune erreur automatique restante,
revues SEMANTIC_REVIEW_REQUIRED et SEASONAL_CONTEXT_REVIEW. Aucune certification.

| Contrôle initial | Passage réel et preuve | Analyse / correction |
|---|---|---|
| SEASON_AS_OBSERVATION | alternatives[0].reason associe ALM-005 à « sans renseigner à elle seule l’état des sols » | Aucun stade observé n’est affirmé. Le lien saisonnier implicite mérite une réserve éditoriale, pas un constat d’observation fausse. Les affirmations « Les semis sont terminés » restent rejetées même si kind=context. Le prompt demande désormais de ne citer seasonal_ids que dans un contexte théorique explicite. |
| TEXT_NUMBER_OR_DATE | « Du 9 au 15 novembre », preuves 2026-11-09/2026-11-15 | Faux positif : les tirets ISO étaient lus comme signes négatifs et 09 différait littéralement de 9. Normalisation des composantes calendaires, conservation des mesures négatives. Les dates françaises sont aussi confrontées aux dates citées : changer novembre en décembre ou l’année reste rejeté. Aucun nouveau chiffre n’est inventé. |
| UNPROVEN_AGRONOMY | lead « ne permettent pas d’évaluer des dommages agricoles », rubrique régionale « sans évaluation de dommage agricole » | Faux positif sur des négations. La portée est limitée à la proposition ; un « mais » ou une nouvelle phrase n’hérite pas de la négation. Les assertions positives de dommage, causalité, maladie ou stade restent bloquantes. |
| TEXT_UNIT | article[1] évoque moins de 1 mm/j ; fact-c9e1f221e0aebff5c7c0e76e décrit explicitement ce seuil et porte une valeur principale de 4 jours | Faux positif : la preuve comporte à la fois durée et seuil de pluie. Les unités peuvent provenir de la valeur ou du texte exact du fait cité ; chiffres et références restent contrôlés. Une unité absente des deux reste rejetée. |
| FORECAST_AS_OBSERVATION | article[3] « ne permet pas d’affirmer une évolution observée récente » | Faux positif sur une réserve négative. La prévision ne devient pas une observation ; le contrôle continue à rejeter une observation affirmée sans preuve. |

Le prompt est versionné editorial-board-fr-2 pour les prochaines générations. Aucun
nouvel appel OpenAI n’a servi à tester ces changements. Les tests emploient des
contre-exemples positifs/non étayés, des dates et unités incompatibles, ainsi que
la projection du vrai texte et ses faits. L’original est relu depuis le JSON exact
archivé, pas depuis un rapport JSONB réordonné qui invaliderait ses empreintes.
