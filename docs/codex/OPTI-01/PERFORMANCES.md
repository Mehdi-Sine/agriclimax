# OPTI-01 · Performances et mesure du transfert

## Avant et après sur l’édition du 27

Le Journal réel du 27 a été rejoué à partir de l’archive et du bundle vérifiés et copiés en lecture seule. La projection de recette a été matérialisée dans un répertoire local privé, sans acquisition, nouvelle rédaction ni appel OpenAI.

| Poste | Voie EDIT-09 | Projection OPTI-01 en recette |
|---|---:|---:|
| Archive du 27, JSON stocké | 423 424 o | 45 472 o d’index, archive de preuve conservée. |
| Réponse RPC de cette archive, mesurée | 474 490 o | 0 pour le chemin indexé, plus lecture du registre. |
| Bundle cartographique utilisé pour la vérification de l’édition | 6 330 949 o gzip | 0 pour le Journal indexé. Le bundle reste accessible via Cartes. |
| Vignettes du 27 | Rendu à froid selon le cache de processus et le CDN | 75 916 o pour deux WebP persistés, empreinte contrôlée par carte. |
| Volume maximum des trois objets de projection observés | — | 121 388 o pour l’index et deux WebP. |
| Trace Next du Journal, octets non compressés | 68,82 Mo relevés par EDIT-09 | 60 314 967 o dans un build local OPTI-01. |
| Trace Next de Cartes du jour | 40,05 Mo relevés par EDIT-09 | 31 328 257 o dans un build local OPTI-01. |
| Cached egress Acta | 13,44 Go dans l’alerte | Production inchangée. Objectif −70 % à usage comparable et < 3 Go/mois. |

Comparatif des traces `*.nft.json` du même environnement. Le premier build de recette incluait encore le rendu de publication côté web et le traçage large. Le dernier isole le rendu dans le producteur, borne le traçage de l’accès aux répertoires de recette montés et retire des quatre fonctions les 23 818 871 o de contours détaillés servis directement par Next. La géométrie statique reste fournie aux routes qui la demandent via HTTP. Les binaires Sharp restent justifiés pour les vignettes historiques. L’écart de traces indique un gain de packaging potentiel et exige un relevé Vercel agrégé.

| Route | Premier build local de recette | Dernier build local |
|---|---:|---:|
| Accueil | 131 872 065 o | 60 315 143 o |
| Journal | 131 871 818 o | 60 314 967 o |
| Vignette | 115 947 256 o | 85 838 617 o |
| Cartes du jour | 103 110 990 o | 31 328 257 o |

Les références client de l’accueil et du Journal ont été inspectées. Aucun composant MapLibre ni carte PRA interactive n’y figure. L’affichage et les liens du carrousel utilisent le même composant que dans EDIT-09.

## Transferts d’une production et d’une visite

La production du 27 a créé ou finalisé 7 658 720 o d’objets encore listés à 08 h UTC, dont un bundle de 6 330 949 o, un input gelé de 1 074 663 o et une archive ERA5 de 235 032 o. Ce sont des tailles de fichiers, pas le total des transferts de production. Le total des lectures de la fenêtre est disponible dans [Audit](AUDIT.md), avec plus de 1,5 Go des cartes servies en HIT, sans attribution fiable au job. Une prochaine passe doit mesurer du premier essai d’acquisition au rapport vérifié, en séparant météo, GitHub, lectures avant insertion, uploads, vérification et lectures de la preview. Le mode dégradé doit entrer dans la série des cas.

Pour une visite froide isolée avec une lecture scientifique, 6,33 Mo de bundle peuvent être évités dès que l’index est présent. Ce gain local est compatible avec une baisse importante du cached egress. Les scans de catalogue, archives anciennes, cartes interactives, autres services et autres projets restent à mesurer pour établir le résultat global. À titre de sensibilité, maintenir le profil du 27 pendant 30 jours produirait ~0,97 Go HIT hors cartes. Pour tenir 3 Go, il resterait environ 67,6 Mo/jour pour les cartes, soit une réduction de 95,5 % sur leur charge observée ce jour-là. Ce scénario ne prédit pas la fréquence mensuelle des pics. Les scénarios en fonction de la fréquentation figurent dans [Coûts](COUTS.md).

## Rejeu mobile contrôlé du 27

Trois paires à 390 × 844, depuis un processus Next neuf pour chaque premier chargement et une recharge dans le même contexte Chromium. Profil CPU ×4, 150 ms de latence ajoutée et débit descendant de 1,6 Mbit/s. La révision réelle a été copiée en lecture seule. Le registre, l’archive et le bundle sont rejoués localement avec une latence simulée de 80 ms par requête amont. L’index et ses WebP sont lus depuis le système de fichiers. Les deux modes sont servis par le même build. La latence réelle de R2 ou Supabase et le comportement du CDN Vercel restent à mesurer.

| Médiane sur trois visites | Voie historique, froid | Projection, froid | Voie historique, chaud | Projection, chaud |
|---|---:|---:|---:|---:|
| TTFB | 787 ms | 1 086 ms | 49 ms | 41 ms |
| LCP | 4 256 ms | 2 188 ms | 688 ms | 668 ms |
| Transfert navigateur | 310 862 o | 310 848 o | 19 843 o | 19 502 o |
| Bundle scientifique côté origine | 12 661 898 o | 0 | 0 | 0 |

Dans le rejeu à froid historique, les chemins du Journal et de la route de vignettes ont chacun chargé le bundle de 6 330 949 o. Dans les trois visites indexées à froid, seules deux petites réponses du registre étaient nécessaires à côté des objets locaux. Les cartes affichées dans tous les essais respectent l’ordre et les identifiants archivés. Aucun débordement, canvas ni appel de géométrie détaillée dans le Journal. La médiane locale est de 2,19 s, mais l’un des trois chargements indexés à froid a atteint 3,57 s. Le seuil de 2,5 s en production n’est pas établi.

## Seuils de recette et de production

Mesurer accueil, Journal daté et une édition historique, avec un premier rendu et une recharge. Utiliser 390 × 844, CPU ×4, latence 150 ms et débit descendant 1,6 Mbit/s. Relever séparément le cache navigateur, le cache CDN et l’instance Next. Reprendre le protocole sur production et recette avec les mêmes sources et volumes comparables, et conserver au moins cinq essais par état. Vérifier le titre, le chapeau et le premier bloc, l’ordre des vignettes, l’absence de canvas et de géométrie dans le Journal, le lien vers Cartes et les filtres visibles dans Analyse. Isoler les octets navigateur, réponses R2/Supabase, RPC, temps d’origine, LCP et TTFB. Pour la cible LCP **< 2,5 s**, suivre le p75 sur le profil mobile et les visites réelles si disponibles.

Qualifier la réduction de 70 % sur une période à fréquentation et nombre d’éditions comparables, en rapportant séparément scans administratifs, déploiements, explorations des cartes et copies d’objets. Le seuil de 3 Go concerne l’organisation et une fenêtre de facturation complète. L’activité du second projet doit être prise en compte. EDIT-09 mesurait 11,60 s à froid et 1,20 s à chaud sur un accueil Preview mobile. Cette série sert de référence historique avec limites de comparabilité. [Relevé EDIT-09](../EDIT-09/evidence/vercel-mobile.json)
