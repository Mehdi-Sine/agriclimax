# Validation et budget

## Périmètre et méthode

Rejeu entièrement hors ligne des entrées opérationnelles gelées CORE-01, empreinte
`b9899f56b75bc9b1351a4d5da1ec5ecbbea63c8c4638e8d12ee09194a3fa60b5`.
Les archives et adaptateurs d'origine ne sont pas modifiés. Aucun accès à la base,
appel IA, acquisition météo, réédition, déploiement ou écriture distante.

Six fenêtres sur 713 PRA : réanalyse des 1/7/14/30 jours finissant le 1 novembre
2026 ; prévision du 8 novembre et du 8 au 14 novembre. Les 30 jours incomplets et
les sept jours de prévision hétérogènes sont volontairement conservés pour tester
le refus de calcul. Toutes les identités PRA restent présentes.

Résultat du [rapport](evidence/report.json) : **119 784 cas** PRA/recette/fenêtre
comparés à l'oracle Python indépendant, **zéro divergence** ; **278 070 résultats
préexistants** comparés intégralement (hors changement explicite de version dans
le catalogue AGRO-03), aucune différence. Le chemin par défaut garde AGRO-02,
20 recettes et six productions ; le catalogue opt-in possède 28 recettes et
onze contextes. Les tests vérifient que les calculs partagés restent immuables.

L'oracle Python réutilise les contrôles indépendants AGRO-02 sur les entrées,
puis applique ses propres réductions pour `>=` et maximum. Il ne lit pas les
résultats TypeScript pour déterminer une valeur attendue. Les cas intégralement
nuls ne sont pas retirés des comparaisons. Cette vérification numérique et
informatique ne constitue pas une validation biologique.

## Cas contrastés et seuils

[samples.json.gz](evidence/samples.json.gz) conserve les huit nouveautés sur cinq
PRA et les six fenêtres : Beauce dunoise (28341), Dévoluy (05236), presqu'île de
Crozon (29102), coteaux corses (2A259), bocage de Coutances et Saint-Lô (50086).
Les identités et régions viennent du référentiel courant, jamais de noms inventés.
Ces contrastes couvrent grande culture, montagne, littoral, Corse et bocage.

Les tests manuels synthétiques distincts utilisent Tmin 20/21/22 °C puis
−4/−3/−2 °C, Tmax 30/32/31 °C puis −1/−0,1/0 °C et P=1/10/0,999/0/15/1 mm.
Attendus calculés à la main : nuits chaudes 2 jours/séquence 2 ; jours humides 4,
séquence 2 et deux épisodes ; pluie ≥10 : 2 jours ; max : 15 mm ; sans dégel :
2 jours/séquence 2. Le compte humide et le compte sec se complètent exactement.
Ce jeu n'est jamais présenté comme météo archivée réelle.

Les contrôles incluent : valeurs aux bornes, pluie nulle/négative, températures
invalides, null/NaN/infini, jour absent, doublon, bissextile, origine/cycle/nature
incompatibles, support non identifié et fraction partielle. Les prévisions restent
distinctes des réanalyses. Une période absente ne vaut jamais zéro. Les séquences
et maxima intégrés restent nuls si la fenêtre n'est pas complète ; leurs séries
conservent les jours qualifiés sans inventer de continuité.

La Tmin quotidienne UTC ne mesure pas une nuit locale, et les extrêmes issus
d'échantillons horaires ne sont pas nécessairement les extrêmes instantanés. Les
références primaires ETCCDI ont été consultées le 14 novembre 2026 ; le
[relevé de définition](evidence/etccdi-source.json) conserve URL, extraits et empreinte.

## Données qui empêchent le calcul

- RH qualifiée absente : les trois THI sont nuls sur les 713 PRA en historique et
  J+1 (`humidity_missing`). Sur sept jours de prévision, l'incompatibilité des
  sources/cycles est le motif prioritaire. Aucun THI porcin/aviaire ou viande
  spécifique n'est implémenté.
- Réanalyse 1/7/14 jours : 645 supports complets, 67 portions observées et Crozon
  indisponible pour les recettes météo. Les portions conservent `observed_value`
  sans chiffre territorial ni généralisation à la PRA.
- Réanalyse 30 jours : 712 `incomplete_period`, Crozon `variable_unavailable`.
- Prévision J+1 : 713 supports complets pour les recettes météo ; sept jours :
  713 `incompatible_sources_or_runs`, état de qualité `unknown`.
- Phénologie, sols et pratiques absents : interdisent une interprétation de
  dommage/stress/stade/rendement, même si un descripteur météo vaut un nombre.

Les archives réelles examinées sont automnales. Les températures élevées et
épisodes de gel aux seuils sont validés numériquement sur cas synthétiques ;
une campagne saisonnière réelle et une revue experte restent à conduire avant
toute interprétation agronomique ou activation.

## Coûts mesurés et stockage

Chaque lot national produit 116 219 affectations mais seulement **19 251 calculs**
(27 signatures ×713), avec 96 968 réutilisations. L'ancien catalogue produit
13 547 calculs uniques (19×713) : ajout de 5 704 calculs, soit **+42,1 %**.
Le temps mesuré du calcul AGRO-03 seul varie de **2,11 à 5,46 s** sur cette machine.
Le rejeu entier, incluant deux sérialisations compressées, les comparaisons et
l'oracle, dure 170,67 s ; pic RSS global ~**1,40 Gio**, pas une mesure de mémoire
du seul noyau. Les mesures sont contextuelles, sans garantie de temps en production.

| Lot | JSONL complet AGRO-03 | Gzip complet AGRO-03 | Gzip ancien catalogue | Surcoût gzip |
|---|---:|---:|---:|---:|
| Réanalyse 1 jour | 254,48 Mo | 6,89 Mo | 2,21 Mo | 4,68 Mo |
| Réanalyse 7 jours | 490,42 Mo | 11,91 Mo | 5,54 Mo | 6,37 Mo |
| Réanalyse 14 jours | 751,50 Mo | 18,56 Mo | 8,04 Mo | 10,51 Mo |
| Réanalyse 30 jours, incomplète | 942,75 Mo | 18,37 Mo | 7,71 Mo | 10,66 Mo |
| Prévision J+1 | 289,09 Mo | 7,21 Mo | 2,60 Mo | 4,61 Mo |
| Prévision 7 jours, incompatible | 604,31 Mo | 12,17 Mo | 4,90 Mo | 7,27 Mo |

Mo décimaux. Ces volumes incluent les séries, provenances, qualités et répétitions
par production : scénario volontairement défavorable, **aucun de ces lots complets
n'est persisté**. Le cache en mémoire partage déjà les résultats ; sa sérialisation
naïve perd ce partage. Une chaîne JSON nationale de 14/30 jours peut dépasser la
limite de taille de chaîne V8 : le runner mesure donc un flux JSONL/gzip.

Stocker un nouveau lot de sept jours chaque jour pendant 730 jours ajouterait
environ **4,65 Go compressés** dans ce scénario répété, avant réplication/index.
Ce n'est pas le coût du catalogue livré, ni une rétention proposée. Une activation
devra dédupliquer par recette/PRA/paramètres/source/support et référencer les
archives au lieu de dupliquer leurs séries. Aucune nouvelle acquisition, aucun
stockage quotidien ni appel IA n'est activé ; surcoût opérationnel actuel nul.
Les preuves versionnées de cette tâche pèsent environ 270 Ko, hors logs.

## Vérifications techniques

- 141 tests web ciblés réussis, trois tests distants opt-in laissés désactivés :
  moteur existant, catalogue/contrats, archives gelées nationales, couverture,
  contributeurs existants, cartes et classement éditorial.
- 20 tests Python existants indicateurs/science réussis ; oracle Python nouveau
  contrôlé par Ruff et mypy.
- TypeScript strict web et runner : réussi. Lint des fichiers TypeScript modifiés :
  réussi. Contrats V1 et contrôle des secrets source : réussis.
- Vérification de conservation et résultat du build : voir `validation/`.

Les tests distants ne sont pas nécessaires au rejeu hors ligne et ne sont pas
présentés comme exécutés. Aucune recette responsive nouvelle : aucun composant,
route ou interface n'est modifié.
