# Résultats — 73 PRA ×30 jours

Du **19 septembre au 18 octobre 2026 UTC**, sur DEV uniquement.
Même sélection, contours, poids et méthode Task19B ; aucun audit géographique rouvert.
**511 journées réutilisées + 1 679 nouvelles = 2 190 journées**, 365 lots au total.
Aucune migration ni modification de RLS/privilèges. Aucun nouveau diagnostic systématique.
Contrôles locaux : 227 tests Python et 225 tests web, lint, typage, build et gardes passent.

## Acquisition et continuité

54 requêtes logiques CDS, 54 réussies, 0 échec(s), 17.42 Mo reçus. Durée écoulée instrumentée 137.5 min (attente CDS incluse), RSS parent maximale 339.8 MiB.
Concurrence 1, plafond 60 conservé. Le groupement des 23 jours par emprise évite
les requêtes répétées entre lots : 54 attendues contre 135 dans le plan initial.
Les éventuels polls/retries HTTP internes du SDK restent opaques ; maximum configuré 3,
aucun compteur zéro inventé. La mémoire est celle du parent, pas du cumul simultané des processus.
Rejeu du cache : **27 groupes sur 27 en cache hit, 344 tuiles vérifiées, aucun nouvel appel CDS**. Les sept jours Task19B ne sont pas recalculés
ni repersistés ; leurs sorties et empreintes restent identiques. Le 12 octobre reçu en
borne source sert au calcul de pluie du 11, pas à remplacer l’ancienne semaine.

Le validateur indépendant vérifie les reçus par identité dataset/requête, SHA256,
unités, grille, heures exactes, absence de doubles/heures manquantes, et pluie au
00 UTC suivant. Les fichiers mensuels sont joints sur la même grille, jamais interpolés.
**41 584 cellules-jours /166 336 comparaisons nouvelles**, écarts maximaux natif 0, spatial 0 ; tolérance numérique indépendante inchangée 1e-6.
Frontière des éditions : 27 emprises, 571536 valeurs horaires t2m/tp communes le 12 octobre, identiques y compris masques manquants.
Deux éditions sources restent distinctes, avec filiation explicite et 30 dates uniques
par PRA ; aucun identifiant de source ni lot antérieur n’est réécrit.

## Disponibilité et rejeu

Journées-PRA observées : **1 680 complètes, 480 partielles, 30 indisponibles**. Soit 56 PRA complètes, 16 partielles et Crozon indisponible sur toute la période.
Les fractions et les nombres de cellules de chaque PRA sont dans measurements.json.
Les variables incomplètes gardent NULL, valid_counts et coverage ; la fraîcheur
est historique/stale. Une indisponibilité signalée ne devient ni zéro ni absence de risque.
Les états sont observés sur 30 jours, sans certification d’un masque permanent.

Persistance/rejeu : **365 lots, 2 190 journées, 584 diagnostics anciens** ; comptes et
empreintes identiques après rejeu. Les snapshots daily v0.2.0 restent inchangés.
Aucun nouveau diagnostic stocké, aucune purge.

## Performances réelles

| Lecture du 30 septembre | Médiane | Pages HTTP | JSON reçu |
|---|---:|---:|---:|
| 1 PRA | 182.3 ms | 1 | 1090 octets |
| 10 PRA | 190.8 ms | 1 | 63009 octets |
| 73 PRA | 339.5 ms | 2 | 73001 octets |

Historique réel d’une PRA sur 30 jours : médiane 4424.9 ms, 30 requêtes existantes par essai.
Endpoint territorial carte, 73 PRA ×30 dates : 9.35 s au total, 2 190 journées comparées aux sorties réelles.
Les scalaires respectent la sérialisation PostgreSQL float4 ; NULL, compteurs, flags et provenance sont contrôlés exactement.
Les lectures utilisent le serveur local en build production et Supabase DEV distant,
sans mocks ; pagination existante et filtrage explicite de la sélection. Les deux
éditions sont résolues par date, sans nouvelle API agrégée ni promesse de SLA.

Diagnostics descriptifs à la demande : calcul natif sur les 30 jours continus,
puis pondération, pas somme des diagnostics hebdomadaires. Zéro persistance.
La lecture API sparse reste vide en l’absence de diagnostic enregistré : elle ne
prétend pas effectuer ce calcul. Mesures de calcul à la demande depuis cache vérifié :

| PRA demandées | Médiane de calcul |
|---:|---:|
| 1 | 3.76 ms |
| 10 | 23.68 ms |
| 73 | 118.71 ms |

Chargement initial du cache natif : 1.22 s. Ces durées ne sont pas une mesure Vercel.
Les métriques blé restent exploratoires ; aucun nouveau risque ni THI bovin introduit.

## Reproduction

```sh
PYTHONPATH=engine/src python scripts/pra_30day_run.py --phase plan
# acquire → aggregate → validation indépendante → revue → persist → snapshot → replay
PYTHONPATH=engine/src python scripts/pra_validate_pilot.py --root work/task19c/real --expected-windows 4 --require-no-diagnostics --weights config/coverage/ofb-masa-pra-2017-snapshot-20261017/weights.json --reference config/coverage/ofb-masa-pra-2017-snapshot-20261017/reference.json --parameters config/wheat-mvp.json --sample config/pilots/pra73-v1.json --destination local --output work/task19c/independent.json
PYTHONPATH=engine/src python scripts/pra_30day_review.py --diagnostics
# Après persistance, même revue avec --destination supabase ; application locale DEV :
PYTHONPATH=engine/src python scripts/pra_30day_http.py
```

Les gardes d’écriture exigent la validation indépendante et la composition ; destination DEV fixe.
Les archives/SQL volumineux restent dans work/, hors Git. Trois documents et un JSON de mesures seulement.
