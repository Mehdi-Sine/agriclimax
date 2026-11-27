# Reprise expérimentale des 25 et 26 novembre 2026

## Rejeu sur les archives réelles

Le 26, la deuxième limite méthodologique dit « Les dénombrements portent sur les PRA évaluables, pas sur les hectares agricoles. » La règle `REGIONAL_EXTRAPOLATION` détectait « hectares » après la virgule sans reconnaître « pas sur ». Le fait cité `fact-3f5958a7b0889e2209e90c27` établit une prévision de gel dans 110 PRA sur 112 évaluables. Il n’établit aucune mesure de surface. Le contrôle reconnaît désormais cette réserve précise en fin de phrase. Une assertion distincte sur des hectares continue de déclencher le rejet. Le correctif du 25 portait sur une autre formulation.

Les deux snapshots et les briefings concordent avec les archives. Les textes et les identifiants de réponse ont été comparés aux réponses OpenAI archivées. Le reçu du 26 indique 61 472 jetons d’entrée, 3 436 de sortie et 0,086518 €. Les deux revalidations intégrales conservent le brouillon à l’identique et donnent `needs_editorial_review`, zéro erreur et `SEMANTIC_REVIEW_REQUIRED`. Le rejeu reproduit à l’identique les deux révisions et leurs bundles à partir des entrées gelées. Chaque sélection comporte deux cartes.

| Date | Archive originale IA | Checksum original | Révision IA attendue |
|---|---|---|---|
| 25 novembre | `be7b0dc1e9d9c33b71ab5695cb77f9e50df5bd38efaf68c1341bf4b482041a79` | `6243200dd3902d2ff434f2108380a724b62448e94a9e3bf258954b9c73f92a14` | `d00c32fbb96087fcaac8dc7796abebc467c87d3f9ce3bd59543d8e0130ef07e6` |
| 26 novembre | `3a2d733371d04d4f89a2f0eaf79ef0545e00d6710c68f3f552a044510efa16c6` | `fa33290617ffe52deb269f9b4663f8d1edcd398414e6123678b0a7186956060b` | `4609d6db8cd4b7871fbaf9062caad310af0d622d3dd5505d50a66ed91ed909b2` |

## Commandes

Simulation, depuis le code de la PR avec accès éditorial. Chaque commande écrit seulement dans le dossier local de recette. Les reçus doivent indiquer `revalidation_ready` et `paid_calls: 0`.

```bash
AGRICLIMAX_EDITORIAL_OUTPUT=work/reprise-25 AGRICLIMAX_EDITION_DATE=2026-11-25 \
  pnpm editorial:nightly revalidate be7b0dc1e9d9c33b71ab5695cb77f9e50df5bd38efaf68c1341bf4b482041a79 \
  --source-checksum 6243200dd3902d2ff434f2108380a724b62448e94a9e3bf258954b9c73f92a14

AGRICLIMAX_EDITORIAL_OUTPUT=work/reprise-26 AGRICLIMAX_EDITION_DATE=2026-11-26 \
  pnpm editorial:nightly revalidate 3a2d733371d04d4f89a2f0eaf79ef0545e00d6710c68f3f552a044510efa16c6 \
  --source-checksum fa33290617ffe52deb269f9b4663f8d1edcd398414e6123678b0a7186956060b
```

Exécution après déploiement du lecteur EDIT-09, depuis le même commit dans l’environnement éditorial autorisé.

```bash
AGRICLIMAX_EDITORIAL_OUTPUT=work/reprise-25 AGRICLIMAX_EDITION_DATE=2026-11-25 \
  pnpm editorial:nightly revalidate be7b0dc1e9d9c33b71ab5695cb77f9e50df5bd38efaf68c1341bf4b482041a79 \
  --source-checksum 6243200dd3902d2ff434f2108380a724b62448e94a9e3bf258954b9c73f92a14 \
  --execute-revalidation --publish-experimental-maps

AGRICLIMAX_EDITORIAL_OUTPUT=work/reprise-26 AGRICLIMAX_EDITION_DATE=2026-11-26 \
  pnpm editorial:nightly revalidate 3a2d733371d04d4f89a2f0eaf79ef0545e00d6710c68f3f552a044510efa16c6 \
  --source-checksum fa33290617ffe52deb269f9b4663f8d1edcd398414e6123678b0a7186956060b \
  --execute-revalidation --publish-experimental-maps
```

Les révisions et les bundles sont déterministes. L’écriture SQL est protégée par un verrou par date et réutilise l’identifiant existant en vérifiant son contenu. La publication cartographique vérifie l’empreinte du bundle déjà publié et réutilise un résultat identique. Après une interruption, rejouer la commande de la date concernée. Les archives originales, les éditions de secours et leurs reçus restent conservés. La procédure ne lance ni acquisition ni appel OpenAI et utilise exclusivement le circuit expérimental.

Pour chaque date, après expiration éventuelle du cache de catalogue de 15 s :

1. Ouvrir `/api/journal/edition?date=AAAA-MM-JJ`. Vérifier l’identifiant attendu ci-dessus, `mode: live`, `revision: 2`, `status: needs_editorial_review` et `scientifically_validated: false`.
2. Ouvrir `/journal?date=AAAA-MM-JJ` et vérifier le titre et le chapeau IA. Ouvrir une vignette et suivre le lien de retour. L’identifiant de révision doit être conservé.
3. Vérifier que les éditions de secours restent accessibles via `/journal?date=2026-11-25&id=f45f14d6670f16332b62ca26ae6f63700543d31b59e19700fa44fdcbf976fa26` et `/journal?date=2026-11-26&id=8adbcac300a37cdee31052cf5b5d1bddc16eb2ab962d55b46ba38626a433ae45`.

## Rapport du 26

Cinq acquisitions ont fini en succès, le snapshot a été gelé à 05:15:59 UTC et l’appel OpenAI a abouti. Le contrôle éditorial a rejeté le brouillon et une archive de secours a pris le relais. Le contrôle indépendant de consultation a enregistré `PAGE_UNAVAILABLE` à 15:46:55 UTC, bien qu’il ait identifié l’archive de secours côté serveur. Le dispatch du mail a répondu HTTP 200 sans timeout du dispatch. Cette réponse ne renseigne pas le délai de la vérification publique interne. Les diagnostics archivés ne permettent pas d’attribuer ce second échec à un délai de six secondes plutôt qu’à une identité différente ou à une autre erreur HTTP. L’état d’alerte est conservé.

## Périmètre de livraison et OPTI-01

Le carrousel statique, la séparation Journal/Cartes, la navigation directe, les filtres d’Analyse, AGRO-06 et la gouvernance UX restent en place. La lecture cartographique de qualification avant visibilité garantit encore la liaison au commit cartographique immuable. Sa suppression nécessite une preuve légère équivalente.

OPTI-01 pourra archiver durablement les octets WebP avec une clé immuable, introduire un index éditorial et une preuve de sélection cartographique légers, sortir la lecture des bundles de l’affichage de l’article, puis mesurer la latence froide, le cached egress de Supabase et la taille des fonctions Vercel. Le seuil LCP de 2,5 s reste une cible de performance.
