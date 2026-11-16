# Validation et captures réelles

## Contrôles terminés

| Vérification | Résultat |
| --- | --- |
| 1 185 recalculs depuis les entrées communes versionnées | 1 185 qualifiés ; retrait d'une entrée → NULL ; formules et seuils inchangés |
| Suite web | 785 tests réussis, 15 tests facultatifs ignorés ; 100 fichiers réussis |
| Rejeux réels avec archive et masques conservés | 3 tests supplémentaires réussis : API, édition immuable, recettes et miniatures serveur |
| Python ciblé masques / modèle national | 21 tests réussis |
| TypeScript application et script HTTP | Réussite |
| ESLint ciblé, Ruff et mypy des scripts Python | Réussite |
| Contrats et garde des migrations | Réussite ; aucune migration |
| Build de production local | Réussite, sans déploiement |
| Sécurité source et bundle | Réussite |
| Budget client JS/CSS | 698 078 octets gzip / 2 097 152 autorisés |
| Reprise du premier cycle | Même matrice et même index ; 260 objets inchangés |
| Rejeu du checkpoint suivant | 49 910 réductions identiques ; zéro requête fournisseur |
| Reprise interrompue du cycle suivant | Quatre manifestes terminés conservés, aucun index avant reprise ; 49 910 preuves après reprise |
| Persistance / rétention multi-cycles | Deux index, 479 objets ; premier index et pointeurs publiés inchangés |
| Relecture du second cycle | 267 objets et 180 137 728 octets vérifiés ; zéro écriture |
| Reconstruction sans checkpoint | Premier manifeste du second cycle strictement identique depuis les preuves durables |

Les journaux sont sous [evidence/tests](evidence/tests). Les rejeux exhaustifs de COUV-05C ne sont pas relancés : les 730 387 valeurs antérieures restent acquises. Les réductions natives sont relues uniquement pour accéder aux champs nécessaires et contrôler la fidélité des preuves.

## Navigateur et HTTP

**52 contrôles complets réussis** dans les campagnes finales, avec recouvrements volontaires : 8 parcours desktop, 2 parcours Journal dédiés, 24 parcours responsive, 6 parcours sur le build de production 10 parcours de retour arrière et 2 parcours du cycle suivant. Aucun `route.fulfill`, aucune miniature remplacée. Les réponses API sont reçues avant contrôle du rendu. Les cinq miniatures de chaque parcours Journal sont chargées réellement ; le carrousel est testé au clavier, puis le lien vers la carte interactive est suivi.

Rapports : [desktop](evidence/browser/on-desktop.json), [Journal](evidence/browser/on-journal.json), [responsive](evidence/browser/on-responsive.json), [production](evidence/browser/on-production.json), [retour arrière](evidence/browser/off.json) [comparaison](evidence/browser/comparison.json) et [cycle suivant](evidence/browser/next-cycle.json). Les contrôles imposent 713 contours rendus, absence de débordement et d'erreur JS. Les contrôles HTTP comparant les lignes météo exactes à l'archive vérifient aussi les six PRA corses, sources, cycles, dates, unités et valeurs. Les dix comparaisons de légendes on/off sont identiques.

La correction des compteurs est vérifiée sur les trois tailles : la pluie homogène se répartit en **94 + 343 + 252 + 19 + 5 = 713 PRA** ; les 389 THI admissibles restent dans la première classe de cette fenêtre. Les classes reprennent le même `classIndex` que la carte, sans déplacement des bornes ni changement de palette.

Un premier passage à froid du build local, pendant les calculs natifs concurrents, a dépassé le délai de 90 s avant la fin du rendu ; cette [observation est conservée](evidence/browser/production-cold-observation.json). Les six passages de production finaux ont ensuite réussi sur les trois tailles, sans changement du moteur cartographique. Les lectures distantes peuvent aussi rendre un refus explicite en cas de délai dépassé ; aucune fraction ou valeur de repli n'est inventée. Ces mesures ne constituent pas un SLO de production serverless.

Le second cycle est également vérifié par ses [cinq contrôles HTTP](evidence/routes-next-cycle.json) et ses captures [desktop](evidence/browser/on/1440-next-cycle-temperature.png) / [mobile](evidence/browser/on/390-next-cycle-temperature.png), avec son propre pin. Les deux index restent simultanément conservés en privé ; aucun pin distant n'est modifié.

Les [contrôles HTTP avec le rendu actif](evidence/routes.json) et [désactivé](evidence/routes-off.json) portent sur les vraies API. Le retour arrière restaure le chemin antérieur ; les lignes météo restent strictement égales à l'archive. Le test unitaire du lecteur vérifie que le flag inactif ne lit aucun sidecar.

## Captures comparatives

| Parcours | Rendu actif | Retour arrière |
| --- | --- | --- |
| Climat, humidité IFS, desktop | [Actif](evidence/browser/on/1440-climat-humidite-ifs.png) | [Inactif](evidence/browser/off/1440-climat-humidite-ifs.png) |
| Climat, humidité IFS, mobile | [Actif](evidence/browser/on/390-climat-humidite-ifs.png) | [Inactif](evidence/browser/off/390-climat-humidite-ifs.png) |
| Cartes du jour, desktop | [Actif](evidence/browser/on/1440-cartes-du-jour.png) | [Inactif](evidence/browser/off/1440-cartes-du-jour.png) |
| Cartes du jour, mobile | [Actif](evidence/browser/on/390-cartes-du-jour.png) | [Inactif](evidence/browser/off/390-cartes-du-jour.png) |
| Journal et miniatures, desktop | [Actif](evidence/browser/on/1440-journal.png) | [Inactif](evidence/browser/off/1440-journal.png) |
| Journal et miniatures, mobile | [Actif](evidence/browser/on/390-journal.png) | [Inactif](evidence/browser/off/390-journal.png) |

Analyse réelle après correction des compteurs : pluie [1440](evidence/browser/on/1440-analyse-pluie-homogene.png), [768](evidence/browser/on/768-analyse-pluie-homogene.png), [390](evidence/browser/on/390-analyse-pluie-homogene.png) ; THI [1440](evidence/browser/on/1440-analyse-thi-homogene.png), [768](evidence/browser/on/768-analyse-thi-homogene.png), [390](evidence/browser/on/390-analyse-thi-homogene.png).

Ces captures qualifient les parcours et refus disponibles. Elles ne prétendent pas montrer la peinture partielle des 540 nouvelles valeurs encore absentes du lecteur web. Cette limite reste explicite dans la décision PARTIAL.
