# Performances mesurées

Essai local Next.js **build production**, serveur utilisant Supabase DEV distant,
sans mocks ; trois lectures séquentielles par taille, caches chauds possibles.
Mesures du 29 octobre UTC, aucune garantie Vercel ni test de charge.

| PRA renvoyées | Médiane HTTP | JSON | Sérialisation Python médiane* |
|---:|---:|---:|---:|
| 1 | 233.44 ms | 1481 octets | 0.0070 ms |
| 10 | 201.27 ms | 8171 octets | 0.0375 ms |
| 73 | 365.13 ms | 54874 octets | 0.2574 ms |

*Micro-mesure de json.dumps (100 répétitions), pas un profileur du serveur Node.
Les durées détaillées sont dans evidence.json. API pilote : limite 73, filtrage
de la sélection exacte, au plus huit pages amont de 100 ; deux pages amont sont
nécessaires ici pour les 113 références DEV. Les 40 contours hors pilote ne sont
pas présentés comme une publication climatique.

Sept dates complètes lues, pagination par dix : huit pages, **73 identifiants
uniques et exactement ceux de la sélection**, aucun doublon. Sources/version/UTC,
fraîcheur historique stale, NULL, valid_counts et coverage explicites.

Requête SQL d’une variable (temperature) sur l’intervalle de dates, limit 73 :
Index Scan pra_daily_date_idx, **0,244 ms d’exécution, 0,436 ms de planification**,
34 blocs partagés en cache. Une seule observation sur petite table ; l’API HTTP
continue de renvoyer les quatre scalaires, sans nouveau filtre variable implicite.

Diagnostics : 73 RPC réels (8 résultats chacun), médiane 174.81 ms, maximum 383.19 ms.
Endpoint HTTP diagnostics : médiane 183.92 ms, 6473 octets, trois réponses 200.
Diagnostics descriptifs, risk_computed=false, pas un risque agronomique validé.

Agrégation depuis cache : 0,903 s au total, médiane 10,18 ms/PRA, plage 5,64–33,28 ms.
Persistance : 20,53 s, médiane 214,18 ms/PRA ; rejeu 18,98 s, médiane 197,00 ms/PRA.
RSS agrégation/persistance environ 259 MiB sur le runner, pas RAM PostgreSQL.

## Carte et revue responsive

La carte de contrôle locale produite par pra_pilot_review.py conserve les 73
contours source ; les chemins SVG ne sont pas des polygones de remplacement.
Elle expose météo et disponibilité réelle, tandis que /territories?pilot=73
permet la lecture distante. Les listes et la carte n’affirment aucune exhaustivité
nationale. Le prototype de revue reste un artefact local ; pas un nouveau dashboard.

Contrôle Chromium + axe : 1440/768/390 px, 73 chemins et fiches, aucun débordement,
zéro violation WCAG A/AA détectée sur les deux surfaces, Crozon explicitement
unavailable dans l’application. Un audit automatisé ne certifie pas toute l’accessibilité.

| Largeur | Carte : setContent + deux frames | Application : navigation puis audit |
|---:|---:|---:|
| 1440 | 358.3 ms | 1626.5 ms |
| 768 | 153.8 ms | 1287.8 ms |
| 390 | 167.9 ms | 1334.2 ms |

L’application inclut networkidle et axe dans ce dernier chronométrage ; ce n’est
pas un LCP ni une comparaison directe de moteurs graphiques. Reproduction :
générer la revue, démarrer le build local avec les seules clés serveur DEV, puis
node tests/e2e/pra-pilot73.mjs. Lecture HTTP type :

```text
/api/territories?action=read&pilot=73&reference=ofb-masa-pra-2017-snapshot-20261017&dataset=era5land-pilot73-20261012-20261018-v1&date=2026-10-18&scope=france&limit=73
```
