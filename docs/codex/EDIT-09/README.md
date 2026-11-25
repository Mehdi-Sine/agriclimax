# EDIT-09 · Le Journal agroclimatique

## Décision

**NO-GO pour une mise en production immédiate.** La révision du 25 novembre est prête en recette. Sa mise en ligne dépend du déploiement du lecteur de révisions et de la vérification publique décrite ci-dessous. L’objectif LCP de 2,5 s reste à démontrer sur un profil mobile de référence.

## Édition du 25 novembre

Le snapshot `01d06f9a12d50359c7bf32ae1e51e8239867ed718e3ac206807de39148ac03c3` a été gelé après cinq acquisitions réussies. Le diagnostic de réponse et l’archive IA d’origine concordent sur le texte. Le briefing contient douze faits nationaux et aucune publication documentaire exploitable. Le reçu OpenAI porte 60 648 jetons d’entrée, 3 266 de sortie, 45,1 s et 0,084676 €.

Le chapeau contient la phrase suivante.

> Le minimum territorial prévu est une valeur locale, pas une température représentative de toute la région.

Le contrôle `REGIONAL_EXTRAPOLATION` repérait « toute la région ». Le découpage lexical isolait la proposition après la virgule et le contrôle reconnaissait « pas d’une » mais pas cette négation nominale. Le fait cité, `fact-5a37d7baf05c41ba882855de`, établit un minimum territorial de −20,6 °C et 112 PRA sur 112 évaluables sous 0 °C en Auvergne-Rhône-Alpes du 25 novembre au 1er décembre dans les modèles. Le chapeau distingue ces deux informations. Les autres occurrences de la règle dans le brouillon, notamment la réserve sur la pluie en Provence-Alpes-Côte d’Azur, étaient déjà correctement qualifiées. Le rejeu isole donc un faux positif.

Le correctif reconnaît deux formes nominales immédiatement après une virgule et en fin de phrase. Une affirmation distincte sur la région entière reste bloquante. Le brouillon du 25 reste identique. La revalidation complète donne `needs_editorial_review`, zéro erreur et `SEMANTIC_REVIEW_REQUIRED`. Les deux cartes du comité restent liées aux entrées gelées. La révision de recette a été calculée sans acquisition, écriture distante ou appel OpenAI.

| Archive | Identifiant |
|---|---|
| IA rejetée, révision 1 | `be7b0dc1e9d9c33b71ab5695cb77f9e50df5bd38efaf68c1341bf4b482041a79` |
| Secours visible en production, révision 2 | `f45f14d6670f16332b62ca26ae6f63700543d31b59e19700fa44fdcbf976fa26` |
| IA revalidée en recette, révision 2 | `d00c32fbb96087fcaac8dc7796abebc467c87d3f9ce3bd59543d8e0130ef07e6` |

### Reprise après déploiement

Depuis le commit déployé, utiliser l’environnement éditorial autorisé. Exécuter d’abord la commande sans les deux derniers drapeaux pour vérifier l’identité de la révision et les diagnostics. L’ensemble s’appuie sur l’archive originale et les entrées gelées.

```bash
AGRICLIMAX_EDITION_DATE=2026-11-25 pnpm editorial:nightly revalidate \
  be7b0dc1e9d9c33b71ab5695cb77f9e50df5bd38efaf68c1341bf4b482041a79 \
  --source-checksum 6243200dd3902d2ff434f2108380a724b62448e94a9e3bf258954b9c73f92a14 \
  --execute-revalidation --publish-experimental-maps
```

Vérifier `/api/journal/edition?date=2026-11-25` et `/journal?date=2026-11-25`. Le premier doit retourner l’identifiant de la révision IA revalidée, `mode: live` et `scientifically_validated: false`. Le Journal doit afficher le chapeau IA et ouvrir ses cartes avec le même identifiant d’édition. L’URL explicite de la révision de secours reste consultable. En cas d’interruption après l’écriture de l’archive, la commande se rejoue avec la même identité. La promotion certifiée reste sous le contrôle existant `publication_enabled`.

## Validation et récupération

| Contrôle | Effet |
|---|---|
| Contrat, identité, références, preuve structurée et liaison cartographique | Rejet des incohérences, y compris valeur, unité, période, attribution et référence régionale. |
| Dates, nombres et portée régionale dans le texte | Rejet des chiffres absents des preuves et des extrapolations non qualifiées. |
| Prévision, réanalyse, ancienneté et observations | Rejet du passage d’une prévision à un constat ou d’une preuve trop ancienne présentée comme actuelle. |
| Agronomie, couverture, saison et documentation | Rejet des dommages, causalités, stades et confirmations abusives. Une réserve publiée reste liée à la portée et à la source. |
| Prose nouvelle et incertitudes lexicales | Revue éditoriale requise. L’accès expérimental conserve le statut et les réserves. |
| Erreur localisable dans le contexte du corps | Lorsque le seul diagnostic est `REGIONAL_EXTRAPOLATION`, un seul bloc de contexte peut être retiré si au moins trois blocs factuels restent présents et que le brouillon complet repasse la validation. Le diagnostic privé conserve le bloc, son index, le motif et le résultat. |
| Erreur résiduelle | Le repli factuel est conservé. Les révisions factuelles et les révisions IA restent traçables. |

L’incident réel du 13 novembre est rejoué avec le brouillon archivé. Les tests ajoutent ensuite une extrapolation dans un bloc de contexte et dans le chapeau pour vérifier respectivement la récupération et le repli. Le chapeau réel du 25 est rejoué séparément. Les extraits de formulation invalides restent soumis aux mêmes règles.

## Agronomie, Almanach et sources

Le briefing réemploie la règle, les supports et la projection existante des synthèses. Pour AGRO-06, la présélection comporte le nombre et la séquence de jours humides, le nombre de jours à au moins 10 mm, le maximum quotidien, le cumul et la moyenne des jours humides, le nombre et la séquence à Tmin > 20 °C et à Tmax < 0 °C. Elle retient au plus une vue par famille AGRO-06 dans l’ordre du catalogue. Les indicateurs de chaleur sont éligibles de mai à septembre et le froid d’octobre à avril. Les candidats exigent sept jours continus, 80 % de PRA évaluables au minimum et des valeurs qui varient entre PRA. Les règles AGRO-05 complètent la sélection, jusqu’à quatre synthèses. Le calcul thermique du maïs reste exclu.

Les réanalyses qualifiées du 22 au 25 font ressortir les jours humides, maximum de sept jours sur 645 PRA évaluables. Le lecteur peut ouvrir l’indicateur, retrouver sa période et ses références méthodologiques dans Analyse, puis revenir à l’édition. Les productions affichées proviennent des déclarations RPG historiques. Ces données décrivent le climat et la production déclarée. La portance, les stades, l’exposition du jour et les dommages dépendent de preuves distinctes.

Les synthèses orientent le choix d’angle et alimentent le Regard agricole côté serveur. Le prompt conserve l’exigence d’identifiants factuels pour le texte libre. L’Almanach réutilise les identifiants de la veille et les fenêtres saisonnières du dossier. Le raccord documentaire conserve les rapprochements vérifiés. Le 25, la source Actualités a bien été acquise, tandis que le dossier archivé ne contient aucun document retenu.

| Édition | Briefing archivé | Briefing rejoué | Archive sélectionnée avant |
|---|---:|---:|---:|
| 22 | 40 866 o | 58 618 o | 408 562 o |
| 23 | 40 897 o | 58 684 o | 409 021 o |
| 24 | 55 605 o | 55 829 o | 422 015 o |
| 25 | 55 835 o | 56 059 o | 418 161 o |

Le briefing du 25 garde une marge de 42 245 octets sous 96 Kio. En prenant un jeton supplémentaire par octet ajouté, les 224 octets de différence seules représenteraient au plus 224 jetons et environ 0,00025 € au tarif d’entrée diagnostique, hors variations de sortie et de cache. Le coût réel du nouveau prompt reste à observer. L’appel quotidien unique, le plafond de sortie et les paramètres financiers restent ceux du flux existant. [Rejeu des archives](evidence/rejeu.json)

## Design et ressources

Carrousel restauré depuis `4e11b2d`, tel qu’il apparaissait avant la fusion EDIT-08 dans `740d2ee`. La sélection des cartes et l’identité de la période restent archivées. La vignette ouvre Cartes du jour avec l’identité de la carte et celle de l’édition. La première vignette est prioritaire et les suivantes utilisent le chargement différé du navigateur. Le rendu éditorial a une frontière Suspense distincte pour le carrousel.

L’audit de l’implémentation historique a trouvé des WebP rendu à froid via la route de miniature, avec cache HTTP et mémoire de processus. Les publications existantes archivent le catalogue et les valeurs gelés. La persistance durable des octets WebP et un index éditorial de lecture à froid restent à traiter. Les archives déjà vérifiées sont réutilisées sur une instance chaude tant que le registre les référence. Le premier chargement peut encore lire des archives et des bundles cartographiques côté serveur. Les révisions dispensent le navigateur de télécharger les géométries, masques et valeurs détaillées avant l’ouverture de Cartes.

Le build Next signale un traçage dynamique dans `features/editorial-ai/archive.ts` qui peut embarquer des fichiers supplémentaires dans certaines fonctions. Le transfert du Journal et le stockage historique des fonctions Vercel sont des métriques distinctes. Les tableaux Vercel Function Storage et Supabase Usage/Billing doivent être relevés sur la période comparable pour mesurer les octets agrégés et la part facturée. Les économies de requêtes serveur et de transfert nominal du navigateur ne donnent pas directement ces valeurs.

### Gouvernance UX

Le Journal est l’accueil, avec une navigation visible et un carrousel de vignettes statiques. Cartes assure l’exploration interactive. Analyse permet de choisir les filières, familles et indicateurs et de consulter leur méthode. Tout changement substantiel à la navigation, à l’accueil, au rubriquage, aux cartes, au parcours ou à la densité doit être soumis au propriétaire sous forme de maquette avant implémentation.

## Rapport et nuit suivante

Les diagnostics du 25 montrent le briefing gelé, cinq acquisitions réussies, 0,084676 € d’usage OpenAI, une tentative éditoriale terminée et un secours vérifiable plus tard dans la matinée. Le rapport n’avait pas de preuve de consultation enregistrée. Au rendu, la branche rouge est déclenchée lorsqu’aucune édition n’a pu être vérifiée, même si la génération et l’archivage ont réussi. Les autres motifs rouges du code, arrêt d’urgence, état OpenAI incertain et échec persistant des acquisitions, ne figurent pas dans ces diagnostics. Le contrôle de page est borné à 6 s. Une lecture ultérieure de l’API de disponibilité a pris 15,37 s avant ses en-têtes. Ce relevé est compatible avec un délai dépassé. La requête historique exacte du mail reste indisponible. Le flux SIM distinct signalait aussi un échec relançable.

Le mail distingue désormais briefing, usage OpenAI, traitement éditorial, mode de l’archive et vérification publique. Le diagnostic de rejet détaillé reste dans le journal privé. Les horaires, mécanismes d’acquisition, verrouillage et watchdog existants restent en place. Le rejeu montre qu’un état dégradé du 24 n’a pas empêché la production du 25. La configuration active du watchdog, les verrous résiduels et le comportement de la prochaine exécution restent à vérifier en production.

| Contrôle | Résultat | Réserve |
|---|---|---|
| Journal du 25 | Révision calculée et carte reconstruite à partir du snapshot | Déploiement et écriture de la révision à effectuer. |
| Validation scientifique | Rejet lexical levé sur le vrai brouillon | Revue sémantique requise. |
| Erreur localisée | Récupération bornée au corps, repli sur erreur restante | Tests de rejeu et vérification finale en CI. |
| AGRO-06 | Indicateur qualifié dans les quatre briefs rejoués | L’usage rédactionnel par le nouveau prompt reste à observer. |
| Qualité rédactionnelle | Brouillon réel plus riche que le secours | Relecture éditoriale du jour. |
| Carrousel et navigation | Vignettes et filtres visibles, cartes dédiées | Recette navigateur et captures ci-après. |
| Mobile et transfert | Relevés ponctuels | Profil mobile de référence et mesures après déploiement à compléter. |
| OpenAI | 0 appel pour la recette | Coût réel du futur prompt à mesurer. |
| Supabase et Vercel | Lectures réutilisées à chaud, build vérifié | Facturation et stockage agrégé à relever dans les consoles. |
| Prochaine nuit | Contrats rejoués sur les données gelées | Contrôle d’exécution réel après fusion. |
| Quality et Security audits | Build, contrôles locaux et tests ciblés | Résultats GitHub à vérifier sur la PR. |

## Mesures navigateur

L’édition de secours du 25 a été mesurée dans Chromium, au premier chargement d’un contexte navigateur neuf pour chaque largeur, depuis la même machine. « Avant » correspond au déploiement Vercel. « Après » correspond à un build Next de production local avec les mêmes sources distantes. Le journal des mesures indique les requêtes vues avant la capture. Le cache serveur et le trajet réseau diffèrent, ce qui limite la comparaison des délais. Les valeurs ne constituent pas un benchmark mobile calibré.

| Métrique à 390 px | Avant | Après | Écart |
|---|---:|---:|---:|
| TTFB | 1 166 ms | 2 019 ms | +853 ms |
| LCP | 17 196 ms | 17 168 ms | −28 ms |
| Temps d’affichage du titre | Non instrumenté | Non instrumenté | — |
| Temps d’affichage de l’article | Non instrumenté | Non instrumenté | — |
| Poids transféré observé avant capture | 222 388 o | 207 573 o | −14 815 o |
| JavaScript transféré | 171 250 o | 151 044 o | −20 206 o |
| Requêtes observées | 14 | 12 | −2 |
| Appels Supabase depuis le serveur | Non instrumentés | Non instrumentés | — |
| Requêtes de géométrie détaillée | 1 | 0 | −1 |

À 768 px, le LCP observé passe de 14 840 à 2 600 ms. À 1 440 px, il passe de 15 788 à 5 748 ms. Les trois vues après changement ont deux vignettes, aucun canevas, aucune requête de géométrie détaillée et aucun débordement horizontal. [Mesures brutes](evidence/navigateur.json)

| Largeur | Avant | Après |
|---|---|---|
| 390 px | [Production](evidence/avant-390.png) | [Recette](evidence/apres-390.png) |
| 768 px | [Production](evidence/avant-768.png) | [Recette](evidence/apres-768.png) |
| 1 440 px | [Production](evidence/avant-1440.png) | [Recette](evidence/apres-1440.png) |

Contrôles locaux exécutés sur la branche. Les 309 tests ciblés couvrant validation, exploitation, rapports, indicateurs et cartes sont passés. Le build Next, le contrôle des contrats et le scanner du bundle client sont passés. Les workflows GitHub constituent les contrôles de livraison.
