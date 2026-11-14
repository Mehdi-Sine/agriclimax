# Inventaire de l'existant

Audit de `origin/main 167adec` (14 novembre 2026). Sources de vérité :
`apps/web/features/agroclimatic/{catalogue,calculate}.ts`,
`climate-quality/{calculate,policy}.ts`, `multiproduction/{registry,engine,archives}.ts`,
`scripts/manual_indicators.ts` et `scripts/int01_map_builder.ts`.

**Le catalogue historique possède 14 entrées : les 13 annoncées plus
`temperature_mean`. AGRO-02 a déjà ajouté six recettes hors de ce catalogue.**
Ces vingt recettes ne sont pas recréées. Le Journal utilise les lots du moteur
multi-productions ; les cartes publiées sélectionnent actuellement cinq recettes
(`temperature_min`, `temperature_mean`, `rain`, `frost`, `gdd`). L'existence d'une
recette ne signifie donc pas qu'elle est affichée ou sélectionnée chaque jour.

## Les treize historiques et la quatorzième entrée

Notation : T = Tmoy quotidienne archivée ; Tx = Tmax ; Tn = Tmin ; P = pluie
quotidienne ; H = humidité relative moyenne en %. Les comparaisons sont strictes.
Les seuils ci-dessous sont les défauts du catalogue ; les paramètres du résultat
font foi. « Séquence » = longueur maximale calendaire **dans la fenêtre**.

| ID stable | Formule et paramètres | Unité | Dépendance | Affectation du catalogue historique |
|---|---|---|---|---|
| `gdd` | Σ max(0,T−b), b=0 °C ; sans plafond | °C·j | T | blé |
| `hot` | Σ 1(Tx>25 °C) | jours | Tx | blé |
| `hot_sequence` | séquence Tx>25 °C | jours | Tx | blé |
| `frost` | Σ 1(Tn<0 °C) | jours | Tn | blé |
| `frost_sequence` | séquence Tn<0 °C | jours | Tn | blé |
| `rain` | Σ P, sans seuil | mm | P | blé |
| `heavy_rain` | Σ 1(P>20 mm) | jours | P | blé |
| `dry` | Σ 1(P<1 mm) | jours | P | blé |
| `dry_sequence` | séquence P<1 mm | jours | P | blé |
| `thi` | max des THI synthétiques quotidiens, sans seuil | THI, sans dimension | T et H compatibles | bovins |
| `thi_days` | Σ 1(THI>72) | jours | T et H compatibles | bovins |
| `thi_sequence` | séquence THI>72 | jours | T et H compatibles | bovins |
| `cattle_heat` | Σ 1(Tx>25 °C) | jours | Tx | bovins |
| `temperature_mean` (ajout ultérieur) | moyenne des T, sans seuil | °C | T | blé |

Formule THI héritée : `(1,8T+32) − (0,55−0,0055H)×(1,8T−26)`.
Ce calcul sur des moyennes journalières n'est ni la moyenne des THI horaires ni
leur maximum. La non-linéarité et l'absence des couples horaires interdisent de
les assimiler. Le seuil 72 est exploratoire et non universel.

## Les six ajouts AGRO-02 déjà présents

| ID | Formule | Paramètres/unité | Affectation AGRO-02 |
|---|---|---|---|
| `gdd_base6` | Σ max(0,T−6) | base 6 °C ; °C·j | maïs |
| `gdd_base10` | Σ max(0,T−10) | base 10 °C ; °C·j | maïs et vigne |
| `hot30` | Σ 1(Tx>30) | 30 °C ; jours | maïs |
| `hot30_sequence` | séquence Tx>30 | 30 °C ; jours | maïs |
| `temperature_min` | min(Tn) | sans seuil ; °C | maïs, vigne, prairies et vergers |
| `rain_frequency` | Σ 1(P>0,1) | 0,1 mm ; jours | maïs, vigne, prairies et vergers |

AGRO-02 réutilise les autres recettes météo pour ces quatre productions ; le blé
conserve ses dix affectations, les bovins cinq (dont `temperature_mean`). Le champ
`kernel.production` désigne l'origine du calculateur ; seule la liste
`Production.indicators` établit l'applicabilité. Ce champ n'est pas une preuve de
présence agricole dans une PRA.

## Disponibilité et couverture réelle

Contrat commun : 1 à 30 jours UTC, calendrier complet, source/nature/cycle et
support homogènes. ERA5-Land est une **réanalyse** ; AROME/ARPEGE/IFS des
**prévisions**, y compris les estimations récentes fondées sur ces modèles.
J+1…J+7 est un horizon possible, pas une garantie de série homogène sur sept jours.
Une nouvelle fenêtre ou production n'acquiert aucune donnée supplémentaire.

La [matrice rejouée](evidence/matrix.json) donne les effectifs par recette et
période pour les vingt anciennes et huit nouvelles, sur les **713 PRA** :

- Réanalyse des 1, 7 et 14 jours finissant le 1 novembre 2026 : recettes météo
  et sommes, 645 supports complets / 67 portions observées / 1 indisponible.
  Crozon (`pra:29102`) reste nul. Les THI restent indisponibles sur les 713 PRA.
- Fenêtre de 30 jours du 3 octobre au 1 novembre : couverture temporelle
  insuffisante ; aucun résultat intégré. Des journées restent inspectables.
- Prévision du 8 novembre (J+1 du cycle gelé) : recettes sans humidité,
  713 supports complets ; THI 713 indisponibles.
- Prévision du 8 au 14 novembre : rupture de source/modèle/support dans les
  archives gelées, aucun cumul ni séquence intégrée admissible.

Ce sont des résultats **d'archives identifiées**, pas un état des services en
temps réel. L'empreinte d'entrée est dans [report.json](evidence/report.json).
Le contrôle antérieur AGRO-UX-01 sur 29 octobre–4 novembre et 11–12 novembre
confirme aussi 645/67/1 en réanalyse et 713 complets sans RH en prévision.
Il reste une preuve antérieure, non une nouvelle acquisition AGRO-03.

CORE-01 reste inchangé : `observed_value` pour portion renseignée, `value` pour
territoire qualifié ; les portions n'entrent pas dans les chiffres du Journal.
Le registre des certificats reste vide. Ni un seuil de 90 %, ni SAFRAN/SIM encore
désactivé ne permettent de promouvoir ces portions dans cette livraison.

## Limites et incohérences constatées

- L'annonce de 13 indicateurs masque `temperature_mean` et les six ajouts AGRO-02.
  L'inventaire distingue calcul, affectation et publication effective.
- `cattle_heat` et `hot` calculent le même phénomène au même seuil : le cache
  les mutualise ; ils ne constituent pas deux preuves indépendantes.
- Les libellés chaleur/pluie importante n'ont pas valeur de seuil biologique.
  Les conventions >20 mm, >0,1 mm et >25/30 °C personnalisées ne sont pas les
  indices ETCCDI standard. Les huit nouveautés ne changent aucun de ces seuils.
- Les extrêmes quotidiens échantillonnés ne prouvent pas les extrêmes instantanés
  au niveau d'une parcelle, ni la fraction d'une PRA ayant franchi un seuil.
  Appliquer un seuil après moyenne spatiale diffère d'agréger les franchissements.
- `engine/src/agriclimax/indicators.py` calcule un GDD depuis `(Tmin+Tmax)/2` ;
  le moteur PRA utilise Tmoy archivée. Ces conventions ne sont pas interchangeables.
  AGRO-03 conserve le calcul PRA et utilise un oracle indépendant sur **Tmoy**.
- Les modules Python station/blé et bovins horaires ne sont pas des substituts
  aux séries nationales PRA ; leur portée et leurs unités restent distinctes.
- Les anciens descripteurs héritent parfois d'une description générique. Le
  catalogue AGRO-03 ajoute paramètres, références, usages et limites structurés
  sans modifier le registre actif ni réinterpréter ses anciennes archives.
- THI exige T/RH de mêmes unité, source, cycle, support et intervalle. L'humidité
  nationale qualifiée manque ; ni température seule ni humidité de station distante
  ne la remplacent. L'absence demeure explicite, y compris pour les bovins lait.
- Pluie et séquences sèches ne démontrent ni disponibilité en eau du sol,
  sécheresse agricole, inondation, praticabilité ou maladie. Gel météo ne démontre
  aucun gel dommageable. Somme thermique ne démontre aucun stade.
