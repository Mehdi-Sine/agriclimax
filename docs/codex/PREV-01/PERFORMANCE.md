# Performance

Le serveur évite de relire les objets immuables proches en mémoire. Le cache des objets compressés est borné à 64 références et 24 Mio. Les requêtes simultanées partagent une lecture en cours. Les erreurs et absences sont retirées du cache. Deux archives décodées par processus peuvent coexister, ce qui évite un rechargement systématique lors d’un changement de cycle. Une nouvelle empreinte déclenche la résolution de nouveaux objets. L’API conserve `Cache-Control: no-store`.

Les recherches d’identités utilisent des index en mémoire. Le navigateur diffère l’historique détaillé de la PRA après la réponse cartographique. MapLibre réutilise sa source de contours initiale et les couches partielles identiques. Aucune simplification ne modifie les coordonnées des PRA ou des géométries scientifiques.

Le protocole API demande les réponses compressées et relève le transfert, le délai au premier octet et les phases `archive`, `masks` et `response` via `Server-Timing`. Le script utilise un processus neuf pour le premier cas, puis alterne trois couples modèle–cycle. Le protocole Chromium indique séparément le délai jusqu’à l’API et le délai jusqu’aux 713 contours et à la coloration finale. Les durées incluent le stockage distant sur la campagne native et le rendu logiciel Chromium.

```sh
python tests/e2e/prev01-performance.py --origin http://127.0.0.1:3020 \
  --pid <PID_NEXT> --output work/prev01/performance.json
```

| Contrôle local | Résultat |
| --- | --- |
| API froide AROME | 6,75 s, dont 4,05 s pour l’archive, 2,24 s pour les preuves et 0,08 s pour la réponse |
| API chaude, 27 lectures alternées | p95 1,66 s, 80 061 à 85 246 octets gzip |
| Contre-mesure sur processus neuf, 27 lectures alternées | Froide 4,21 s, p95 chaud 2,006 s. Pic RSS 722 044 Kio. |
| Rendu de référence après le premier raccordement | 9,42 à 24,43 s sur les neuf parcours Chromium du 14 novembre, avec charge de recette concurrente |
| Rendu après réutilisation des sources MapLibre, cycle du 15 novembre | 6,89 à 15,96 s sur neuf contextes Chromium neufs, API 1,57 à 5,95 s |
| API composite, 234 contrôles en alternance, concurrence 3 | p95 2,76 s, 28 686 à 85 081 octets gzip |
| Pluie partielle, trois contextes neufs | 8,52 à 61,82 s sous campagne concurrente de 234 contrôles HTTP et lecture du Journal |
| Mémoire du processus sous campagne | Pic RSS 1 006 968 Kio pendant la matrice nationale et la recette Chromium concurrentes |
| IFS sans campagne concurrente, processus déjà chaud | 5,54 s en contexte neuf et 4,98 s sur répétition dans le même contexte. Transfert 10,48 et 9,77 Mo. |
| Limites Vercel | Durées de la cible active à mesurer en canari |

Le volume de contours GeoJSON est de 23 Mio avant compression. Chromium a transféré 9,66 Mo pour cet objet, 10,47 Mo au total par contexte neuf. Le transfert des contours a pris 2,26 à 7,22 s. Le fond simplifié du Journal a été écarté pour Explorer après mesure de l’écart de surface en EPSG:3035. Sa différence symétrique atteint 6,23 % pour une PRA. L’essai hors ligne en EPSG:3035 à 5 m conservait 81,9 % des sommets et limitait l’écart de surface à 0,0654 %, mais simplifiait les PRA séparément et n’apportait pas de preuve de raccord des frontières. À 10 m, 39 PRA dépassaient 0,1 % d’écart. Les coordonnées de référence sont conservées. La répétition IFS satisfait de justesse le seuil à chaud. Les autres mesures et la campagne concurrente ne qualifient pas ce seuil pour l’ensemble des parcours. Le p95 à 2 secondes n’est pas reproductible sur les deux séries mesurées. Le seuil de 10 secondes est également dépassé sur des cartes réelles sous charge.
