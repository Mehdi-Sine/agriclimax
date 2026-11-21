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
| Rendu de référence après le premier raccordement | 9,42 à 24,43 s sur les neuf parcours Chromium du 14 novembre, avec charge de recette concurrente |
| Limites Vercel | Durées de la cible active à mesurer en canari |

Le volume de contours GeoJSON est de 23 Mio avant compression. Le fond simplifié du Journal a été écarté pour Explorer après mesure de l’écart de surface en EPSG:3035. Sa différence symétrique atteint 6,23 % pour une PRA. La mesure sous 5 secondes à chaud doit être obtenue sur un navigateur de référence avant activation.
