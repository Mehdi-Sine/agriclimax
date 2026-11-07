# Acceptation AGRO-01

## Décision et périmètre

Les dix indicateurs nationaux blé sont techniquement qualifiés pour une **publication climatique descriptive conditionnelle** sous `wheat-descriptive-2.0.0`. Ils restent tous exploratoires, sans interprétation agronomique validée. Les noyaux et anciennes versions ne sont pas remplacés. Le Journal reçoit réellement des faits blé par le registre T31 ; aucun composant UI, fichier réservé T32, contrat public, workflow ou schéma Supabase modifié. Aucun merge ni déploiement de production.

## Résultats réels

Recette : 2026-11-07T22:23:24.461Z. Dernière réanalyse accessible : 2026-11-01. Cycle prévisionnel : 2026-11-07T00:00:00+00:00.

- Historique 1 et 7 jours : **645/713 complètes**, 67 partielles, une indisponible (Crozon), pour chacune des dix règles.
- Historique 30 jours : **0/713 complètes** ; 712 partielles, une indisponible. Archives seulement du 19 octobre au 1er novembre ; aucune valeur de cumul de trente jours publiée.
- Prévision J+1 (8 novembre) : **713/713 complètes** pour les dix règles. Les réserves terre/mer et d'échantillonnage restent explicites.
- Prévision 8–14 novembre : **0/713 intégrables**, refus de raccorder des modèles/supports différents. Les archives quotidiennes existent mais leur présence ne suffit pas à autoriser un cumul.
- Anomalies, modèles phénologiques, dommages, stress hydrique et rendement : **non qualifiés**, exclus. Supports observés partiels/reconstructions : exclus de cette liste blanche, préservés dans leurs voies historiques.

Matrice des cinquante combinaisons indicateur/période/source et répartition des treize régions : [NATIONAL_COVERAGE.md](NATIONAL_COVERAGE.md).

## Exemple régional et contribution réelle

> Auvergne-Rhône-Alpes — 82 PRA avec au moins un jour franchissant le seuil descriptif (112/112 PRA complètes). Jours de gel : maximum parmi les PRA évaluables, 1.00 jours dans VALLEE DE LA SAONE - 01 (pra:01195), du 2026-11-08 au 2026-11-08 ; prévision. Descriptif exploratoire ; aucun stade, dommage ou rendement déduit. Représentativité littorale non garantie.

Fait `wheat-9c386068b5603f500e75de80` ; valeur numérique 1 jours ; période 2026-11-08 au 2026-11-08 ; règle `wheat-descriptive-2.0.0` ; source `f6ea69aa15b7dffc1e5c19156bd2dcd3c39f0f6e1c2740c16cb68b87747760e3`. Il s'agit d'un maximum dans une PRA nommée et d'un compte de PRA avec dénominateur, jamais d'une moyenne climatique régionale ou d'hectares affectés. Les 82 PRA au critère de gel en Auvergne-Rhône-Alpes ne prouvent pas un dommage au blé.

La réponse locale `/api/journal` contient dix indicateurs blé et 18 faits, injectés par le contributeur ; les sept jours refusés restent dans l'inventaire. Voir [evidence/journal.json](evidence/journal.json), [evidence/api.json](evidence/api.json) et [EDITORIAL_CONTRIBUTOR.md](EDITORIAL_CONTRIBUTOR.md).

## Vérifications

| Vérification | Résultat |
|---|---|
| TypeScript/Vitest, suite complète | 353 réussis ; 3 tests réels opt-in ignorés dans l'exécution standard |
| Recette réelle AGRO01 et oracle Python | 35,890 cas, dont 35 650 réels et 240 synthétiques ; aucun écart hors tolérance |
| Écart absolu maximal de l'oracle | 2.842170943040401e-14 ; tolérance abs. 1e−9 ou rel. 1e−12 |
| Mesure réelle isolée des ressources | Réussie ; cache de cycle vérifié |
| Python moteur complet | 341 réussis, 63 avertissements de dépendances existants (xarray/netCDF4/NumPy) |
| `pnpm typecheck`, lint, build | Réussis ; build de production Next 16.4.1 |
| Sécurité sources et bundle client | Réussies ; aucun secret serveur exposé |
| `pnpm audit --prod --audit-level high` | Aucune vulnérabilité connue remontée (politique d'ignorance préexistante du dépôt conservée) |
| Contrats et migrations forward-only | Réussis ; aucune migration ajoutée |
| HTTP build de production, données réelles | Cycle courant et ancien 200 ; répétition identité stable ; ETag 304 ; date invalide 400 |
| Non-régression autres productions / T31 | Suite complète et tests de registre ; inventaire bovins toujours non qualifié |
| Budget | Vérification du dépôt et payload Journal <250 000 octets sur les cycles testés |

Les premiers essais ont révélé le proxy Node non activé et des dépendances Python de recette absentes : configuration de processus et installation des fichiers lock existants, sans modification des dépendances du dépôt. Les exécutions finales ci-dessus sont réussies.

## Performance et coût

Mesure isolée dans [runtime.json](evidence/runtime.json), distincte du lourd banc de comparaison indépendant : lecture/décodage/validation de l'archive 1790 ms ; calcul des deux fenêtres et dix indicateurs **546 ms** ; reprise mémoire **0.010 ms**. Synthèse nationale et treize régions : **133,861 octets** ; pic RSS du processus Vitest isolé **378.9 Mio**, incluant le décodage des 49 910 lignes météo.

Réponse HTTP Journal courant : **246,199 octets**, première réponse 2370 ms et répétition 12.2 ms. Le plafond d'enrichissement blé est de 1 500 ms après préparation de la veille nationale, pas une promesse de latence totale HTTP. Une indisponibilité ne bloque pas la veille.

Le banc indépendant complet atteint **1495 Mio RSS** et 20.2 s : il conserve les dizaines de milliers de cas et sérialise l'oracle Python, et n'est **jamais** exécuté dans Vercel. Le chemin de production n'importe pas ces cas et ne conserve que trois synthèses en mémoire, avec Next Data Cache persistant indexé par cycle/règles. Ce profil reste à surveiller sur le vrai plan Vercel ; aucun quota ou coût cloud réel n'est présenté comme mesuré.

## Validation API / Preview

Validation locale de production réussie : `http://127.0.0.1:3000/api/journal` (adresse de session, pas une URL publique pérenne). [evidence/api.json](evidence/api.json) conserve les statuts, tailles, latences, identités, empreinte de réponse et exemple factuel. Preview distante validée : https://agriclimax-git-codex-agro-01-wheat-8f23a1-mehdi-sines-projects.vercel.app/api/journal. Cycles courant/ancien 200, ETag 304, date invalide 400 ; mêmes identités que le build local, 18 faits blé. Voir [evidence/preview.json](evidence/preview.json). Première requête distante ~7 s, répétition ~0,98 s ; cela inclut démarrage et réseau de la veille nationale. Aucun déploiement de production.

La première CI Gitleaks a pris 440 empreintes SHA-256 `support_key` du fichier de preuve pour des clés API. Le champ sérialisé a été renommé `support_fingerprint`, avec correspondance documentée ; aucun secret trouvé et aucune règle de sécurité désactivée. L’historique de la branche propre à cette tâche a été corrigé avant livraison pour ne pas conserver ces faux positifs dans le scan intégral.

## Prochaines priorités

Compléter une profondeur historique homogène de trente jours ; qualifier les supports littoraux et les références climatiques homologues ; documenter des fenêtres et paramètres calibrés avec observations de stades avant toute interprétation agronomique. Voir [FUTURE_WHEAT_INDICATORS.md](FUTURE_WHEAT_INDICATORS.md).

Le modèle réutilisable pour les autres productions est : règle métier versionnée → validation indépendante → disponibilité réelle → liste blanche explicite → synthèse compacte → contributeur synchrone → composition serveur asynchrone bornée. Il ne transmet aucune qualification scientifique automatiquement d'une production à l'autre.
