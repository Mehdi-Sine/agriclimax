# Recette nationale réelle

Lecture du 8 novembre 2026 : archives ERA5-Land du 19 octobre au 1er novembre,
14 journées ; cycle prévisionnel 7 novembre 00 UTC, empreinte
`f6ea69aa15b7dffc1e5c19156bd2dcd3c39f0f6e1c2740c16cb68b87747760e3`.
Aucune acquisition fournisseur ni écriture distante. Les lecteurs vérifient
empreintes et identités officielles avant calcul.

## Avant / après par usage

| Usage / fenêtre | Avant | Après CORE-01 |
|---|---|---|
| Blé, dix indicateurs, historique 1 et 7 jours | 645 complets, 67 partiels sans valeur intégrée, 1 absent | 645 complets inchangés, **67 valeurs descriptives**, 0 estimation certifiée, 1 absent |
| Climat, Tmoy/pluie, historique 1 et 7 jours | 645 complets + 36 anciens estimés automatiques ≥90 %, 31 portions, 1 absent | 645 complets, **67 portions explicites**, 0 estimation certifiée, 1 absent |
| Climat, jours chauds, 1 et 7 jours | 645 complets, 67 portions, 1 absent | mêmes disponibilités, qualification et présentation communes |
| Analyse, Tmoy 1 et 7 jours | voie 1.2 avec 36 anciens estimés et 31 portions | même contrat que Climat/blé : 645 + 67 descriptifs + 1 absent |
| Blé, historique 30 jours, 3 octobre–1er novembre | 0 résultat intégré | 712 non évaluables (données présentes mais lacune temporelle), 1 réellement absent ; aucune fenêtre complète inventée |
| Blé, prévision J+1, dix indicateurs | 713 supports numériques complets | 713, valeurs inchangées ; représentativité terrestre toujours réservée |
| Blé, prévision J+1–J+7 | 0 résultat intégré homogène | 0 ; changements AROME/ARPEGE/IFS refusés pour cette intégration |
| Veille, J+1–J+7, chaleur/gel/pluie/sec | 713 évaluables pour chaque phénomène | 713, mêmes valeurs/détections ; qualifications par segment homogène |
| Veille, J+1–J+7, THI | 77 évaluables, 636 insuffisantes | 77 ; humidité non remplacée |
| Carte Journal, cycle réel | mêmes valeurs que la veille | mêmes valeurs ; nouveau contrat et preuves de segments ; pas de gain de couverture fictif |

Les 36 candidats ≥90 % restent visibles comme descriptifs ; le changement de
portée est volontaire et versionné. Aucun certificat de représentativité n'est
inscrit au registre. Cela évite de présenter un simple seuil comme une preuve.
Les effectifs de publication blé restent 645 sur les fenêtres historiques
complètes ; les 67 nouveaux descriptifs ne deviennent pas des faits territoriaux.
La veille conserve son opérateur de maximum sur segments : il ne s'agit pas de
la même intégration homogène que le blé, donc leurs effectifs diffèrent légitimement.

## Territoires contrastés : Tmoy du 1er novembre

| PRA | Couverture native | Valeur | Portée |
|---|---:|---:|---|
| Crozon 29102 | 0 % | NULL | absence réelle native |
| La Hague 50081 | 43,926989 % | 12,176083 °C | portion observée |
| Camargue 13244 | 78,880921 % | 12,309737 °C | portion observée |
| Corse littorale 2A258 | 46,922158 % | 12,572695 °C | portion observée |
| Corse montagneuse 2B260 | 99,983911 % | 8,227118 °C | portion observée, malgré fraction élevée |
| Beauce dunoise 28341 | 100 % | 8,173658 °C | support complet, inchangé |
| Montagne continentale 05236 | 100 % | 3,998847 °C | support complet, inchangé |

Les six PRA corses sont dans la matrice ; toutes restent partielles sous ERA5.
Les 68 PRA historiquement problématiques sont donc 67 descriptifs + Crozon absent.
Les contours des 713 PRA sont conservés ; aucune exception par identifiant.

## Preuves et contrôle indépendant

- `matrix.json.gz` : 35 650 lignes blé PRA/indicateur/période/usage, valeurs
  avant/après, fraction, temporalité, motif, catégorie et éligibilité Journal.
- `integration.json.gz` : véritables sorties de lecture Climat/Analyse pour les
  fenêtres 1/7 jours ; `forecast-explorer.json.gz` : prévisions quotidiennes J+1–J+7,
  variables et qualifications du même adaptateur que l'API opérationnelle.
- `watch.json.gz` : veille avant/après J+1 et 7 jours et valeurs des cinq cartes Journal.
- `frozen-inputs.json.gz` : entrées réelles dédupliquées, règles et résultats ;
  `verify_core01_frozen.py` recalcule 71 300 scalaires sans importer le calculateur.
  Aucun écart >1e-9 ; maximum observé 2,84e-14. Zéro régression sur les valeurs
  natives complètes comparables. Une donnée manquante ne devient jamais zéro.
- Sensibilité à 80/85/90/95/99 % : 55/47/36/22/9 candidats partiels, **0 certificat**
  dans chaque cas. Aucune conclusion de représentativité tirée de ces effectifs.
- Captures Climat/Analyse avant 1.2 et après 1.3, ordinateur et mobile, Journal
  responsive ; le rapport navigateur vérifie géométries, absence de débordement,
  valeurs des PRA contrastées et disponibilité de Crozon.

Limite explicite : l'oracle indépendant contrôle les valeurs **après adaptation**,
les calendriers et les formules ; il ne réagrège pas de nouveaux NetCDF cellulaires
et ne certifie pas le microclimat côtier. Les contrôles géométriques/pondérations
Task26/29 sont réutilisés via les archives vérifiées, pas présentés comme une
nouvelle validation stationnelle indépendante. Ce manque de preuve bloque les
nouvelles estimations, pas la restitution descriptive de la portion mesurée.
