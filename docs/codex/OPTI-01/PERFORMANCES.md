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

## OPTI-01A · Politique de cache

| Ressource | Politique après OPTI-01A | Fraîcheur et contrôle |
|---|---|---|
| Accueil et alias par date | HTML Next dynamique. Aucun ISR. Registre partagé entre requêtes simultanées dans une instance, avec démarrage par la date visée. | Le catalogue déjà chaud peut grouper les lectures pendant 15 s. Les lectures ciblées et les reprises gardent les contrôles existants. |
| API d’édition | Recherche limitée à la date si fournie. ETag et `no-store`, y compris sur `304` et `404`. | Une nouvelle révision a sa propre identité. Les alias restent frais et les états indisponibles réessayables. |
| Index versionné de projection | Petits objets privés, vérifiés, cache mémoire borné à 48 entrées positives par instance. | Admission d’après le registre et concordance de l’édition. Erreurs et absences réessayables. |
| WebP immuables vérifiés | Clé HTTP par id d’édition, carte, version et SHA. Cache navigateur un an, CDN un jour et réutilisation pendant revalidation si disponible. | Un ETag correspondant à une référence vérifiée retourne 304 sans relecture du raster. Réponse 200 à partir des octets validés. Les erreurs et lectures du mail gardent `no-store`. |
| Métadonnées de disponibilité | `no-store`. La sonde lit l’état courant et le Journal daté. | Délai de six secondes maintenu. Un état public valide ne renseigne pas à lui seul le LCP. |
| Contours et science | Assets publics versionnés servis par Next, masques, valeurs et géométries détaillées à la demande dans les rubriques dédiées. | Les contrats de 713 PRA, six en Corse, et la couverture à 90 % restent ceux d’EDIT-09 et COUV. |

Le cache Supabase HIT mesure une lecture depuis le cache du fournisseur. Un HIT Vercel peut éviter cette lecture, selon la région et la clé. Les anciens articles sans projection et les requêtes de catalogue peuvent encore charger les bundles pour vérifier l’accès. Le benchmark de recette OPTI-01 isole une édition. Une revue Vercel sur une recette active et un échantillon d’archives est nécessaire pour chiffrer l’économie à l’échelle du site.

### Mesure et seuils d’acceptation

Mesurer sur le même déploiement et les mêmes révisions. Prendre un navigateur neuf, un premier rendu puis un rechargement. Enregistrer la navigation et les ressources via DevTools. Exporter un HAR épuré des cookies et en-têtes d’accès. Relever TTFB, LCP, arrivée du titre/chapeau et premier bloc d’article, deux événements `load` des images, nombres de requêtes et octets navigateur/JS. Consigner la région de mesure, `x-vercel-cache`, `Age`, ETag et compteurs Storage depuis les consoles. Contrôler mobile 390 × 844 et bureau, navigation entre les dates, carrousel, carte et Analyse. Arrêter l’essai si des réponses répétées ou un transfert disproportionné apparaissent.

Les vérifications locales couvrent le regroupement des consultations concurrentes d’une date, la liaison de la projection et le 304 du WebP à partir de l’index, ainsi que le rejet d’octets corrompus lors d’une lecture complète. Les tests de recette d’OPTI-01 restent la référence de dimensionnement. Tout relevé Preview avec drapeaux désactivés qualifie la voie historique. Le LCP mesuré sur une projection locale ne démontre ni le cache HIT CDN, ni la sonde de six secondes en production. [Cache CDN Vercel](https://vercel.com/docs/caching/cache-control-headers) · [Cache CDN Next.js](https://nextjs.org/docs/app/guides/cdn-caching)

La Preview Vercel de départ de la PR a renvoyé le 27 depuis `shared_archive` avec HTTP 200, `no-store` et `x-vercel-cache: MISS`. Temps jusqu’aux en-têtes **4 859 ms**, mesuré sur une seule requête de disponibilité. Le double contrôle du mail inclut aussi une page Journal et garde son propre budget.

### Rejeu supplémentaire OPTI-01A

Même build Next, édition réelle du 27 rejouée avec origine simulée à 80 ms et index sur disque. Une paire par configuration. Mobile 390 × 844, CPU ×4, 150 ms et 1,6 Mbit/s. Bureau 1 280 × 900 sans limitation ajoutée. Les temps du contenu indiquent son apparition dans le DOM.

| Mesure | Mobile historique froid / chaud | Mobile indexé froid / chaud | Bureau indexé froid / chaud |
|---|---:|---:|---:|
| TTFB | 863 / 30 ms | 506 / 37 ms | 445 / 24 ms |
| LCP | 3 036 / 592 ms | 1 464 / 592 ms | 916 / 88 ms |
| Titre et chapeau | 2 688 / 306 ms | 978 / 226 ms | 564 / 46 ms |
| Premier contenu d’article | 2 700 / 306 ms | 978 / 226 ms | 564 / 46 ms |
| Deux premiers chargements d’image, froid | 5 532 et 5 671 ms | 2 449 et 2 544 ms | 1 192 et 1 193 ms |
| Requêtes navigateur | 17 / 17 | 17 / 17 | 17 / 17 |
| Octets navigateur | 310 850 / 19 849 | 310 851 / 19 504 | 310 853 / 19 502 |
| Octets JS | 151 044 / 0 | 151 044 / 0 | 151 044 / 0 |
| Appels d’origine simulée | 12 / 1 | 2 / 0 | 2 / 0 |
| Bundle scientifique | 12 661 898 / 0 o | 0 / 0 o | 0 / 0 o |

Les appels au registre figurent parfois deux fois quand le chargement du catalogue suit la requête de date. Le regroupement ne concerne que les requêtes réellement simultanées d’un même processus. Aucun canvas, débordement ou chargement de géométrie dans ces visites Journal. Les identifiants et l’ordre des deux cartes correspondent à la projection et à la voie historique. L’échantillon est local et ponctuel. La médiane sur trois essais OPTI-01 constitue un repère complémentaire.
