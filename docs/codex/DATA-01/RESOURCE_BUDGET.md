# Capacité, mesures et coûts

## Mesures réelles du 8 novembre

Les reçus sont `history.json`, `calculators.json`, `independent.json`,
`weather-replay.json` et `capacity.json`. Unités décimales sauf mention Mio/Gio.
Le runner est Vitest/Node, dans cet environnement, sans isolation CPU ni GC forcé.
Les durées ne sont pas des garanties de service.

| Opération | Mesure |
|---|---:|
| Legacy, 30 jours × 713 PRA | 2 204 860 octets gzip dans les exports RPC |
| Bootstrap avec identités prouvées | 3 576 876 octets gzip, avant base64 de transport du module serveur |
| Audit intégrité / comparaison | 6 lectures Storage, ~13 s ; récupération RPC mesurée séparément |
| Stockage actuellement indexé | 4 304 053 octets ; ne certifie pas l'usage total du compte |
| ERA5, deux journées unitaires récentes | 284 028 et 232 333 octets, hors support |
| Support récent | 8 198 / 12 946 octets, géométrie partagée |
| Prévision nationale par run | 558 453–562 843 octets |
| Catalogue existant | 3 656 octets JSON compact, 990 octets gzip |
| Lot blé 30 jours, dix indicateurs détaillés | 77 663 580 octets JSON |
| Même lot, dictionnaire sans perte | 11 807 267 octets JSON, **2 068 733 octets gzip**, 203 203 nœuds |
| API agroclimatique Tmoy 30 jours | ~4 026 836 octets, ~1,21 s, 645 supports natifs complets |
| Pic RSS du runner de recette complet | **1 246 294 016 octets**, ~1,16 Gio |

Les fenêtres blé 1/7/14/30 jours ont pris environ 3,16 / 0,76 / 1,11 / 6,43 s.
La première comprend les lectures initiales ; la dernière comprend aussi la
factorisation, sa restitution et l'écriture du produit de preuve. Les relectures
mémoïsées des mêmes résultats prennent ~0,3–3,5 ms dans ce processus. Ce ne sont
pas des mesures à froid indépendantes. La limite du transport API existant est
4 Mio ; Tmoy trente jours laisse seulement ~168 ko de marge. Le lot national
détaillé des dix indicateurs ne doit jamais être envoyé comme une seule réponse.

Le nouveau codec `history-product.ts` factorise chaînes, tableaux, objets et
preuves identiques. Chaque scalaire et chaque champ est préservé ; le round-trip
complet est testé, puis 6 450 résultats sont contrôlés par un oracle Python
indépendant, erreur maximale 1,71e−13. Le produit gzip reste une archive interne
avec son hash, pas un nouveau contrat d'API ni un téléchargement client obligatoire.

## Mutualisation

Le cache de résultats historiques est borné à un lot par processus, indexé par
période, série, empreintes des jours, supports indexés et règles. Les entrées
legacy décodées sont bornées aux trente dates du bootstrap ; les archives modernes
réutilisent leur cache existant. Les quatre familles de variables alimentent les
dix indicateurs sans dix lectures nationales indépendantes. Aucun service national
ne recalcule ces dix indicateurs à chaque visite du Journal ; son cycle prévisionnel
et son cache restent inchangés.

Pour 50 ou 100 productions : conserver une seule chaîne météorologique, une seule
qualification des supports par variable/cycle, puis des règles propres aux
productions. Multiplier les preuves et séries de 77,7 Mo par 50/100 produirait
3,9/7,8 Go JSON par cycle : inacceptable. Le dictionnaire doit être partagé à
l'échelle du cycle, les vues utilisateurs compactes et les preuves détaillées
accessibles sur demande. Les temps pour 50/100 productions ne sont **pas mesurés** ;
les extrapolations linéaires des dix règles blé ne constituent pas une recette.
Les calculs futurs doivent être exécutés dans le batch, pas dans une requête de page.

## Projections de conservation, hors nouvelles révisions fournisseur

Hypothèses explicites : 0,30 Mo/jour ERA5 avec support, 0,56 Mo/run prévisionnel,
un seul run/jour conservé, croissance d'index gzip ~300 octets/jour, deux mises à
jour d'index par jour et réserve de 4 Kio par mise à jour. Les anciennes révisions
restent conservées ; la garde compte un majorant persistant des index futurs.
Les prévisions ne sont pas annoncées gratuites en stockage si on augmente le
nombre de runs. Les limites de source restent 128 Mo / campagne, 16 Mo / fichier,
4 Gio mémoire et ~22 min par stage existant.

| Horizon | Données météo | Réserve index | Total avec existant | Garde 900 Mio |
|---|---:|---:|---:|---|
| 3 mois / 91 jours | 78,26 Mo | 3,44 Mo | 82,02 Mio | sous garde |
| 12 mois / 365 jours | 313,90 Mo | 43,80 Mo | 345,23 Mio | sous garde |
| 24 mois / 730 jours | 627,80 Mo | 167,53 Mo | 762,59 Mio | sous garde, marge limitée |

Ce scénario n'inclut pas d'autres buckets, les objets orphelins, les archives
complètes de produits calculés ni les futures éditions du Journal. Conserver
chaque jour le lot détaillé de trente jours, même factorisé à 2,07 Mo, ajouterait
1,51 Go en deux ans : **ne pas activer ce mode**. Le fichier de recette est un
produit ponctuel. L'architecture quotidienne doit référencer les journées déjà
archivées et ne conserver que les résultats nouveaux et l'édition, avec un budget
mesuré avant activation. Un second run météo quotidien ajouterait ~409 Mo sur
24 mois et dépasserait le scénario : sharder/dédupliquer les index à terme et
revoir le budget, sans supprimer les données ni acheter automatiquement un service.

## Coût

Source relue le 08/11 :
https://supabase.com/docs/guides/platform/manage-your-usage/storage-size
Tarif publié : Free 1 Go ; Pro/Team 100 Go inclus ; dépassement payant annoncé
0,0213 USD/Go/mois. Les moyennes facturées sont calculées en Go-heures.
Le forfait réel et le solde de l'organisation n'ont pas été inspectés. Dans le
scénario isolé sous quota, coût marginal de stockage **0 USD** aux trois horizons.
À titre purement illustratif, les volumes seuls hors quota vaudraient environ
0,0018 / 0,0077 / 0,0170 USD/mois ; cela n'autorise aucun abonnement ni dépassement.
Egress, runners, autres projets et révisions doivent être comptés séparément.
Aucun nouveau service payant n'a été ajouté. Les artefacts Actions à rétention
courte ne sont jamais utilisés pour justifier une conservation pérenne.
