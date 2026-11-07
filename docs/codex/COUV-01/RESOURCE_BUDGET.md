# Budget mesuré et limites

Plafonds conservés : 16 Mio/fichier source, 128 Mio/campagne bornée d'acquisition,
128 appels par étape, 448 Mio de données de travail, 4 Gio de mémoire, 1 320 s de
traitement. Aucun quota de fournisseur, cadence opérationnelle ou budget payant
n'a été changé.

| Opération réelle | Volume / durée |
|---|---:|
| Acquisition reproductible catalogue + Parquet + quatre métadonnées | 6 GET, 12 196 093 octets |
| Reprise des mêmes sources | 0 GET, 0 octet |
| Préfixe gzip officiel indépendant | 1 GET Range, 65 536 octets |
| Stations publiques : catalogue, six CSV gzip, descriptif | 8 GET, 5 457 548 octets |
| Traitement national initial | 25,167 s ; RSS max 840 028 Kio (~820 Mio) |
| Second traitement à froid | 24,278 s ; RSS max 838 788 Kio |
| Archives SIM : 60 jours × 713 PRA × 5 sorties | 4 116 872 octets compressés |
| Anciennes lectures PRA : trente jours | 2 204 860 octets compressés |
| Conservation legacy par étapes | 14/14/2 jours ; bornes 113/113/17 RPC lecture |

Les bornes RPC sont conservatrices (huit pages de 100 PRA par jour) ; le trafic
HTTP total de ces lectures n'est pas instrumenté. Chaque réponse est bornée à
300 001 octets, le catalogue à 12 001 ; une étape de quatorze jours reste sous
33,7 Mo de corps possibles. Les polls/retries fournisseur ne sont pas présentés
comme des compteurs mesurés. L'installation des outils de développement est
séparée du volume de données traité et n'est pas un téléchargement climatique.

Le gzip SIM récent fait 19 936 780 octets ; l'annuel 2026 fait 114 689 299 octets
d'après les métadonnées observées. Ils n'ont pas été téléchargés intégralement.
Le Parquet annuel 2026 annoncé (~70,4 Mo) dépasse aussi la garde de fichier :
aucun backfill de plusieurs années n'est autorisé par cette implémentation.
Pour une extension, préférer un sous-ensemble officiel ou un transport réellement
plus compact ; sinon une décision de budget explicite est nécessaire.

Projection indicative à partir du pilote : ~68,6 ko/jour SIM, soit ~50,1 Mo pour
730 journées uniques, hors index, poids, révisions et ancien historique. C'est
compatible en ordre de grandeur avec le plafond Storage actuel de 900 Mio, mais
aucune écriture Storage n'est réalisée et son solde n'est pas certifié ici.
En revanche, conserver chaque jour un nouvel instantané complet de 60 jours
coûterait ~3 Go sur 730 exécutions : ce mode **ne doit pas** être activé.
Il faut dédupliquer les journées inchangées et borner les révisions conservées.

La voie Actions est manuelle, verrouillée sur `pra-climate-batches`, sans secrets,
sans base et sans publication ; elle garde les petits résultats sept jours.
Les résultats du pilote sont aussi versionnés dans Git. Aucun cron concurrent,
service ou abonnement ajouté. La gratuité des runners standards publics ne
constitue pas une garantie sur le quota d'artefacts ou d'egress du compte.

Plan de qualification restant, découpé : 38 résidus géographiques à examiner
hors météo ; puis validation indépendante sur sept territoires et plusieurs
saisons. Acquisition annuelle et séries stationnelles seront chiffrées à partir
de vrais sous-ensembles avant lancement. Les sept territoires × trente jours ×
cinq sorties représentent seulement 1 050 résultats agrégés ; cela ne borne pas
le coût brut des sources annuelles, qui reste le principal obstacle de budget.

Campagne suivante proposée : sept stations × trente dates, jusqu'à sept lectures
de catalogue, sept commandes et douze polls par commande (98 appels au maximum),
avec arrêt aux limites existantes de 128 Mio et 22 minutes. Cette borne ne garantit
pas une réponse du fournisseur. Une validation hors assimilation nécessite en
plus de documenter l'indépendance réelle des témoins ; elle ne peut pas être
remplacée par le seul ajout de jours dans le diagnostic public.
