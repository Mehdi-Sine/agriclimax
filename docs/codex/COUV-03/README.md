# COUV-03 — Collecte littorale incrémentale et raccordement candidat

**Verdict : PARTIAL pour l'activation. Production non activée.**
Le gain récent est confirmé ; le raccordement de collecte et le lecteur candidat
sont développés. Une activation publique ne peut pas encore être autorisée par
ce dossier : disponibilité observée sur un instant, suivi de plusieurs cycles
manquant, conventions de pluie distinctes, extrema et indicateurs non équivalents.
Le flag livré permet uniquement un canari sans publication, après revue/fusion
manuelles. Aucun paramètre distant n'a été changé et aucun workflow déclenché.

Base vérifiée : `main` **60ff41a**, merge EDIT-04 **#91**. COUV-01/02, leurs
archives, géométries et règles sont réutilisés sans modification. Voir
[TASK](TASK.md), [activation/retour arrière](ACTIVATION.md) et [validation](VALIDATION.md).

## Couverture récente réellement calculée

Même fenêtre pour ERA et SIM : **1er–7 novembre 2026**, sept dates complètes.
Pas de projection de la couverture d'octobre sur novembre. Les archives ERA
récentes et les restitutions de support sont relues dans le Storage existant,
avec `ArchiveStore(read_only=True)`, puis gelées localement avec leurs SHA256.
Les checksums des enveloppes, records et supports sont contrôlés au rejeu.

| Variable / support | ERA seul | Candidat ERA prioritaire + SIM |
|---|---:|---:|
| Tmoy, PRA exploitables à ≥90 % | 681 | **713 : 681 ERA + 32 SIM** |
| Pluie, PRA exploitables à ≥90 % | 681 | **713 : 681 ERA + 32 SIM** |
| Tmin / Tmax sous les noms ERA existants | 681 | **681**, 32 indisponibles |
| PRA corses, Tmoy et pluie | 2/6 | **6/6** |
| Supports intégraux retenus Tmoy/pluie | 645 | **658** |
| Supports partiels retenus Tmoy/pluie | 36 | **55** |

Les **19 068 valeurs ERA sélectionnées** (681 × 7 × 4 variables) sont comparées
exactement aux sorties ERA seules : valeurs, qualité et provenance préservées.
Cela inclut les 645 PRA intégrales. Le support SIM minimal reste celui de COUV-02,
96,50 %, mais son exploitabilité récente est contrôlée avec les valeurs réellement
présentes, variable par variable. Aucune valeur n'est attribuée à la surface absente.

Preuves consultables : [résumé](evidence/summary.json),
[matrice sélectionnée PRA/date/variable](evidence/selected-daily.csv.gz),
[matrice SIM séparée](evidence/sim-daily.csv.gz). Les JSON comprimés conservent
les objets qualité complets, périodes, définitions, fraîcheur et provenance.
Les quatre variables standard incluent des lignes explicites d'indisponibilité.
Les cinq variables natives SIM sont présentes et techniquement exploitables sur
713 PRA chacune des sept dates ; ce diagnostic national ponctuel ne généralise
pas leur ingestion quotidienne ni leur éligibilité agronomique.

## Accès, fraîcheur, disponibilité

Catalogue officiel : https://www.data.gouv.fr/fr/datasets/6569b27598256cc583c917a7/
Licence annoncée **Licence Ouverte 2.0**, fréquence `daily`. Accès GET anonyme,
sans abonnement ni nouvelle clé. Le catalogue et les documents Météo-France sont
acquis avec le transport borné COUV-01. Les coordonnées officielles et le
référentiel doivent conserver leurs SHA256 avant de réutiliser les poids.

Le 14 novembre, le Parquet médié contient **593 520 lignes**, 60 journées du
**15 septembre au 13 novembre**. Retard observé : **un jour**. Le catalogue annonce
une modification amont à **09:03 heure de Paris**, le Parquet est daté **10:31**.
Ces heures, postérieures au créneau matinal du Journal, interdisent de promettre
SIM J−1 avant sa publication. À chaque collecte, dates réellement présentes,
retard et dates demandées manquantes sont enregistrés. Aucun report d'une valeur
ancienne sous une date nouvelle. Les archives ERA accessibles vont au 7 novembre ;
aucune disponibilité ERA du 8 au 13 n'est supposée dans le résultat 713.

Le transport est le Parquet data.gouv, distinct du gzip officiel. Un préfixe
borné de **65 536 octets** du gzip est comparé indépendamment : **1 912 lignes**,
six champs météo, toutes égales, incluant des dates jusqu'au 13 novembre.
[Contrôle](evidence/prefix-verification.json). Ce contrôle n'affirme pas une
équivalence exhaustive des deux fichiers. Aucun endpoint officiel ciblé par PRA
n'est établi. L'ingestion nationale de scalaires n'est pas nécessaire, mais le
transport national reste nécessaire. Si le Parquet manque, la collecte échoue
sans basculer sur le gzip de ~20 Mo au-delà du plafond de 16 Mio/fichier.

**Limite opérationnelle :** deux acquisitions le même jour et un rejeu ne
constituent pas une observation indépendante de plusieurs mises à jour quotidiennes.
Pas de SLA démontré ni de garantie de révision. Le producteur peut corriger les
60 journées : les changements hors fenêtre de révision nécessitent une campagne
manuelle et ne réécrivent jamais les archives publiées.

## Variables et conséquences scientifiques

| Champ SIM | Convention native | Usage livré |
|---|---|---|
| T | °C, ]00UTC–00UTC], moyenne surfacique | Descriptif candidat Tmoy |
| PRELIQ + PRENEI | mm, ]06UTC–06UTC], pluie + neige | Descriptif candidat, période explicite |
| TINF_H | °C, ]18UTC–18UTC], moyenne des minima horaires des cellules | Identifiant distinct `hourly_temperature_min_mean` |
| TSUP_H | °C, ]06UTC–06UTC], moyenne des maxima horaires des cellules | Identifiant distinct `hourly_temperature_max_mean` |
| HU | %, ]00UTC–00UTC], moyenne surfacique | Diagnostic séparé, pas de THI hybride |

SIM reste une **analyse SAFRAN-ISBA**, ERA une **réanalyse ERA5-Land**. Ni observation
locale ni prévision. Aucune équivalence des extrema ou des journées de pluie n'est
ajoutée. Les réserves COUV-02 sur datum et représentativité littorale demeurent.
La règle produit 90 % n'est ni une validation par station ni une certification de
la moyenne territoriale. Une série sélectionne ERA sur toute sa fenêtre, sinon
SIM sur toute sa fenêtre ; pas de mosaïque temporelle ou spatiale de sources.

GDD, gel, chaleur, séquences sèches, pluies fortes, normales, anomalies et THI ne
sont pas promus sur SIM. Les sorties héritent des barrières COUV-02
`indicator_eligible=false`, `journal_eligible=false`, `reference_compatible=false`.
Les cartes et le catalogue EDIT-03/04 restent donc inchangés ; aucune carte
agroclimatique SIM ne rejoint la sélection IA. Aucune légende, aucun prompt,
aucun classement éditorial modifié. La couverture 713 est une preuve descriptive
récente, **pas une extension publique des cartes déjà publiées**.

## Implémentation et coûts mesurés

- `safran_incremental.py` : blobs SHA256, index commis en dernier, au plus deux
  révisions/jour, révisions automatiques limitées aux trois derniers jours,
  730 journées uniques maximum, budget candidat de 16 Mio. Purge exclusivement
  des blobs candidats non référencés ; aucun effacement d'archive publiée.
- `couv03_collect.py` : reprend acquisition, poids et calcul COUV-01/02 ; conserve
  uniquement les **32 PRA / 807 cellules** nécessaires. Une seule copie source
  temporaire, supprimée après collecte. Un checksum amont inchangé évite de
  retélécharger le Parquet ; les blobs existants restent vérifiés.
- `complement_window` : lecteur opt-in raccordé à `select_window` COUV-02 ;
  priorité ERA, indisponibilité sur lacune/corruption SIM, désactivation par défaut.
- Workflow existant : étape facultative dans la branche ERA, aucun nouveau cron,
  aucune nouvelle entrée de matrice, deux minutes maximum, `continue-on-error`.
  Le plafond du job ERA passe de 26 à 28 minutes seulement si le canari est activé,
  pour réserver ces deux minutes sans
  prendre sur le budget ERA existant ; les délais internes ERA restent inchangés.
  Checkpoint candidat inclus dans l'export ERA existant et repris par son restore.
  Une erreur SIM ne bloque pas l'export ERA ni le job éditorial indépendant.

| Mesure locale | Durée | Appels / octets réseau | Écritures candidates |
|---|---:|---:|---:|
| Acquisition complète + 7–13 novembre ciblés | **10,299 s** | **6 / 12 207 830** | 7 journées |
| Source inchangée, même demande | **0,899 s** | **1 / 118 735** | 0 |
| Source inchangée, 14 novembre absent | **0,819 s** | **1 / 118 735** | 0, date manquante signalée |
| Premier calcul local 1–7 novembre | 2,712 s | 0, source déjà acquise | 7 journées |
| Rejeu local identique | 2,603 s | 0 | 0 |
| Incrément 7–13 novembre | 2,548 s | 0 | **6**, le 7 est réutilisé |
| Diagnostic national ponctuel 1–7 novembre | 4,954 s | 0 | 7 journées de qualification |

Pic RSS acquisition ciblée **141 984 Kio** (~139 Mio), diagnostic national
172 900 Kio. Payloads ciblés de 13 jours : environ **58 Ko**, index compris,
hors petit rapport mutable. Environ 4,4 Ko/jour, soit **3,2 Mo/730 jours** pour
une version, ~6,4 Mo pour deux, plus index et réserve ; plafond dur 16 Mio.
Une source changeant chaque jour représente ~366 Mo de transport/mois ; ne pas
annoncer une réduction réseau proportionnelle à 32/713. Aucun prix monétaire
n'est inventé. Aucun service payant ni appel IA ajouté. Plafonds conservés :
16 Mio/fichier, 128 Mio/acquisition, 4 Gio mémoire ; délai candidat de 115 s.
Le chemin opérationnel réserve aussi 16 Mio de marge dans les 448 Mio du workspace
ERA, sinon il abandonne le candidat et préserve ERA.

Le checkpoint Actions conserve sa rétention existante de **trois jours** : ce
transport de canari ne constitue pas une garantie de stockage durable 730 jours
si tout le cycle reste arrêté au-delà. Une absence de checkpoint doit être
signalée avant activation publique ; les snapshots du dossier restent gelés ici.
