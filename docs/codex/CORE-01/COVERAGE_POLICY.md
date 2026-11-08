# Politique climatique 1.0.0

Les états numérique, spatial, scientifique, d'éligibilité et de publication sont
séparés. Tous les résultats restent exploratoires, y compris les supports natifs
numériquement complets. La complétude n'est pas une certification de microclimat.

| Famille | Support partiel stable et temporellement complet | Territoire / Journal |
|---|---|---|
| Moyennes, pluie, GDD | valeur descriptive conservée | estimation seulement si ≥90 %, support natif identifié et certificat indépendant de méthode versionné |
| Extrêmes, événements | valeur ou compte sur support observé | aucune extrapolation ; un zéro ne vaut pas absence territoriale |
| Séquences | jours consécutifs et même support/source/run/grille | pas de raccordement ; descriptif seulement |
| Normales/anomalies | non admis | référence homogène et compatible exigée ; anciennes restrictions conservées |
| Spécifiques / THI | support complet requis | couple T/RH même grille, origine et fenêtre ; humidité jamais inventée |

La tolérance 1e-4 est une fermeture numérique héritée, pas un seuil scientifique.
Le seuil 90 % ouvre seulement l'examen d'un certificat : il n'en tient pas lieu.
Aucun nouveau certificat représentatif de toutes les PRA littorales n'est produit
par CORE-01. Les anciens estimés Task26/29 restent reproductibles sous 1.1/1.2 ;
la nouvelle voie les qualifie descriptifs tant que la représentativité n'est pas
établie indépendamment. La grille de sensibilité 80/85/90/95/99 % doit distinguer
nombre de candidats et nombre effectivement certifiés (ce dernier peut rester 0).

Une valeur descriptive n'entre ni dans les dénominateurs des faits territoriaux,
ni dans les trois chiffres clés et focus du Journal. Elle peut être visible sur
la carte avec trame, fraction et preuve. Une période manquante bloque le résultat
intégré ; les séries de journées disponibles restent consultables séparément.

Les certificats autorisés sont inscrits dans `estimate_certificates` du fichier
versionné : méthode exacte, liste explicite d'identifiants de supports et preuves.
Ce registre est vide. Une chaîne de caractères fournie dans les métadonnées ne
suffit donc jamais à autoriser une estimation. Les tests positifs emploient un
registre synthétique injecté, distinct de la configuration de production.
