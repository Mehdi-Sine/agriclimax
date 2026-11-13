# Pilote SAFRAN/SIM réel

## Acquisition et provenance

Le catalogue Météo-France/data.gouv a été relu, plutôt que de reconstruire une URL
historique. Ressource `aa3dac55-39e3-4308-b0ed-e03eec59cc6b`, licence `lov2`.
Source : https://www.data.gouv.fr/api/1/datasets/6569b27598256cc583c917a7/.
Le catalogue complet, les paramètres PDF, le modèle, le CSV de centres et la PRJ
figurent dans `evidence/source/`, avec les reçus SHA256 et dates de récupération.
La publication annonce des années historiques et une mise à jour quotidienne sur
60 jours glissants ; les quatre dernières années sont révisées bimensuellement.
L'existence d'une ressource annuelle ne prouve pas sa complétude réelle.

Le gzip Météo-France récent dépasse 16 Mio. Le Parquet data.gouv référencé dans
les métadonnées fait 10,64 Mio ; c'est une **conversion intermédiaire**, pas une
copie bit à bit du gzip. Empreinte acquise :
`d804569c7165c8dd31b045a2a89b9af310902679bc0d3fe0771a1e8530401064`.
Un GET Range de 65 536 octets sur le gzip officiel, réponse 206, fournit 1 922
lignes complètes. Les 11 532 comparaisons des six champs prioritaires à leur
équivalent Parquet sont exactes. Cela vérifie ce préfixe, pas les 593 520 lignes
contre une seconde lecture intégrale du brut. Un changement de transport ou de
révision doit rester visible dans la provenance.

## Variables et journées

| Sortie distincte | Champ natif | Unité | Période annoncée | Sens territorial |
|---|---|---|---|---|
| temperature_mean | T | °C | ]00UTC–00UTC] | Moyenne surfacique |
| precipitation | PRELIQ + PRENEI | mm | ]06UTC–06UTC] | Profondeur moyenne, pluie et neige |
| relative_humidity_mean | HU | % | ]00UTC–00UTC] | Moyenne surfacique |
| hourly_temperature_min_mean | TINF_H | °C | ]18UTC–18UTC] | Moyenne des minima des 24 températures horaires |
| hourly_temperature_max_mean | TSUP_H | °C | ]06UTC–06UTC] | Moyenne des maxima des 24 températures horaires |

Les extrema ne sont ni les extrema continus d'une station, ni le minimum/maximum
spatial sur la PRA, ni un remplacement transparent des champs `temperature_min`
et `temperature_max` existants. Aucun THI n'est fabriqué en combinant HU et une
autre source. Les intervalles restent des métadonnées de définition : une
convention de date commune n'autorise pas à décaler une pluie de six heures.

La nature est `analysis` : analyse atmosphérique SAFRAN issue d'observations et
d'une ébauche de modèle, forçant ISBA. « Native » désigne la valeur de ce produit
maillé, jamais une observation locale directe.

## Résultats

Les 60 dates 08/09–06/11/2026 contiennent exactement les 9 892 centres officiels.
Les cinq sorties ont 675 supports complets et 38 partiels à chaque date, soit
40 500 et 2 280 PRA-jours par variable. Les fenêtres de 7, 14 et 30 jours finissant
le 06/11 sont calculables pour 675 PRA ; elles restent nulles pour les 38 autres.
Aucun NULL n'est remplacé par une estimation.

Le fichier `evidence/daily-matrix.csv.gz` contient 213 900 lignes PRA/date/variable,
avec région, nature, source, modèle, support, couverture spatiale, couverture
temporelle, valeur complète ou valeur de portion, qualité et motif. Les 60
archives quotidiennes compactes et leur manifeste sont conservés dans
`evidence/snapshots/`. Le lecteur vérifie empreinte, taille, date, identité,
variables, source et support, et refuse une journée manquante.

La valeur de portion est explicitement séparée de `value`. Une couverture
spatiale de 96 % peut avoir toutes ses cellules existantes temporellement
complètes ; ces deux axes ne se confondent pas. `native_complete` reste un statut
de support et `scientific_validation=technical_checks_only` demeure indépendant.

## Comparaisons et validation indépendante

Sept PRA contrastées × trois dates × cinq variables : 105 références NumPy,
indépendantes du calculateur `aggregate`; erreur absolue maximale 4,27e-14.
Les sept PRA demandées et les résultats figurent dans `samples.json`.
Le réencodage à froid et la reprise produisent des archives et manifestes
identiques octet pour octet ; la reprise d'acquisition réalise zéro requête.

Sur les supports complets communs, 9 030 comparaisons Tmoy avec les quatorze jours
ERA5-Land, mêmes étiquettes de date et fenêtre UTC nominale : biais SIM−ERA
−0,6605 °C, MAE 0,8741 °C, P95 absolu 2,1765 °C ; extrêmes −4,3918 et +4,4725 °C.
La convention d'échantillonnage aux bornes des journées reste une limite : ceci
n'est pas une calibration ni une démonstration d'interchangeabilité.
Pas de métriques de pluie ou d'extrema sur des fenêtres incompatibles.

La tentative DPClim authentifiée pour Brest-Guipavas échoue avec
`MeteoFranceAccessError`. Une seconde voie officielle libre fonctionne : les
fichiers quotidiens départementaux Météo-France, catalogue
`6569b51ae64326786e4e8e1a`, dont les fichiers 2025–2026 actuels ont été réellement
acquis sous les mêmes plafonds. Les six départements/lots couvrent les sept PRA
(la Corse est dans le lot départemental 20, pas dans deux noms inventés).

Sélection fixée par géographie et complétude : station située dans la PRA,
la plus proche du centroïde en EPSG:3035 parmi celles possédant six Tmoy de
qualité 0 ou 1. Aucun choix sur les écarts observés. Période commune 31/10–05/11 :
42 comparaisons Tmoy et 42 pluie, QTM/QRR 0 ou 1 ; la pluie partage la fenêtre
annoncée 06UTC–06UTC. Les résultats par date, qualité, altitude, station et support
SIM figurent dans `station-comparison.json`, avec les lignes station gelées.

| PRA | Station | MAE Tmoy (°C) | MAE pluie (mm/j) |
|---|---|---:|---:|
| Crozon | 29120001 | 0,221 | 0,167 |
| La Hague | 50020001 | 1,167 | 1,328 |
| Camargue | 13004003 | 0,252 | 0,343 |
| Corse littorale 2A258 | 20004002 | 0,660 | 8,620 |
| Corse montagneuse 2B260 | 20096008 | 2,196 | 6,023 |
| Beauce dunoise | 28190002 | 0,105 | 0,116 |
| Montagne continentale | 05139006 | 1,014 | 0,220 |

Il s'agit de diagnostics externes point/surface, pas d'une vérité territoriale.
Les stations peuvent être assimilées par SAFRAN : ces mesures ne constituent pas
une validation indépendante avec témoins exclus. Les différences d'altitude et
les petits supports restent des limites. Pour Crozon et 2A258, la moyenne SIM
comparée décrit explicitement le support partiel, pas toute la PRA. Ces six jours
ne qualifient pas une reconstruction ni une incertitude nationale ou saisonnière.

## Reproduction bornée

Depuis la racine du dépôt, Python 3.12 :

```bash
python -m venv work/couv01-tools
work/couv01-tools/bin/pip install -r engine/requirements-dev.lock -r engine/requirements-geo.lock -r engine/requirements-safran.lock
PYTHONPATH=engine/src work/couv01-tools/bin/python scripts/safran_pilot.py --acquire --root work/couv01-source --output work/couv01-results
# Même commande : sources vérifiées en cache, archives immuables, pas de réacquisition.
```

Pour un nouveau millésime de récupération, employer un nouveau répertoire
source : les fichiers de la récupération précédente restent gelés. La commande
manuelle Actions équivalente est définie dans `safran-pilot.yml` ; aucun schedule,
secret ou droit de publication. Ce workflow n'a pas été lancé à distance dans
cette tâche : la validation réelle décrite ici est locale.

La preuve gelée est également vérifiable **hors réseau et sans dépendance** :

```bash
python scripts/verify_couv01_frozen.py
```

Ce programme n'importe ni calculateur ni décodeur de production. Il redécode les
archives compactes, vérifie les empreintes, identités et dates, recalcule les 105
valeurs à partir des cellules d'échantillon conservées et contrôle les fenêtres
et la restauration legacy. Les cellules d'échantillon proviennent du transport
Parquet ; leur conservation ne transforme pas ce contrôle en validation
observationnelle indépendante.

Le diagnostic stationnel public se reproduit sans clé API :

```bash
PYTHONPATH=engine/src:scripts python scripts/couv01_station_comparison.py --acquire
```

Ce diagnostic gelé cible volontairement les dates du pilote, pas un test perpétuel
de « dernière journée ». Les fichiers actuels et leur contrôle qualité peuvent
être révisés ; les reçus permettent de distinguer ces révisions.
