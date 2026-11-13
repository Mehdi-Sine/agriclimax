# Moteur expérimental EDIT-03

## Frontière d'exécution

Les nouveaux modules `apps/web/features/editorial-map-selection/` et les scripts
`edit03_*` sont indépendants du cycle quotidien. Aucun module de production,
workflow, contrat, publication, migration, indicateur ou référentiel n'est modifié.
Aucun import entrant n'est ajouté au Journal ou à OPS-07. Les dates admises sont
exclusivement les **12 et 13 novembre 2026**. Ce verrou devra être revu dans une
tâche ultérieure avant toute extension du pilote.

Le catalogue relit les copies des archives et de leurs bundles publiés. Les
copies gzip sont vérifiées par taille et SHA-256 ; `verifyArchive`,
`verifyPublication` et `verifyBundle` réutilisent les contrôles actuels. Il ne
réexécute aucun calcul météo ou indicateur. Les statistiques décrivent seulement
les valeurs déjà calculées. Aucun snapshot gelé ni archive distante n'est écrit.

Chaque fiche contient indicateur, unité, nature, période, référence/fraîcheur,
cycles/sources, version des règles, empreinte d'entrée, compte et proportion de
PRA qualifiées/partielles/absentes, extrema locaux, médiane, amplitude, distribution
selon la palette existante, incidence d'un seuil démontrable, ventilation des
13 régions, possibilité de comparaison, productions du référentiel, questions
saisonnières et leurs sources archivées, réserves et deux références exactes :
URL interactive `cartes-du-jour?id=…&map=…` et API du payload correspondant.
Les valeurs partielles et les valeurs non éligibles au Journal sont exclues des
statistiques, de la corrélation et du score. Zéro est une valeur ; NULL reste absent.

## Score et règles provisoires

Pour chaque carte admissible :

`score pondéré = 0,30 I + 0,25 A + 0,15 E + 0,15 T + 0,10 Q + 0,05 D`

Chaque composante est comprise entre 0 et 100. Ces coefficients **et les
barèmes ci-dessous** sont des hypothèses éditoriales versionnées, pas des règles
scientifiques. Ils ne mesurent ni anomalie à la normale ni dommage agricole.

| Axe | Barème initial et source |
|---|---|
| Importance I | 50 × incidence du critère documenté + 50 × contraste spatial. Sans critère démontrable : 100 × contraste. Contraste = 1 − part de la classe cartographique dominante, sur les seules PRA qualifiées. Les classes viennent de `semanticPalette` ; leur contraste n'est pas une intensité agronomique. |
| Pertinence agricole A | 25 si une applicabilité figure au registre multiproduction + 50 si une question saisonnière liée au sujet dispose de toutes ses sources dans le briefing archivé. Maximum 75 ici : aucun crédit pour exposition ou stade réel absents. Pas de prime au nombre de productions. |
| Étendue E | 100 × PRA franchissant le critère / univers archivé si un critère existe ; sinon 100 × couverture qualifiée, explicitement décrite comme couverture documentaire, sans affirmer que toutes ces PRA sont affectées. |
| Actualité et évolution T | Prévision encore valide : 80 ; sinon référence âgée de ≤1 jour : 80, ≤7 jours : 40, davantage : 20. +20 uniquement pour une comparaison historique admissible. Aucun bonus d'évolution sur ces deux archives. Le délai de publication source reste inconnu. |
| Qualité Q | 100 × proportion de PRA qualifiées, avec facteur 0,9 si `publication_time_unknown` figure dans les réserves. Les avertissements ne disparaissent jamais, même avec un score élevé. |
| Diversité D | 100 pour la première carte ou une nouvelle famille éditoriale ; 50 pour une nouvelle nature dans une famille déjà traitée ; 0 sinon. Familles ici : froid (Tmin/gel), thermique (moyenne/somme), précipitations. La dimension géographique est décrite séparément : toutes les cartes sont nationales. |

Pour Tmin, le franchissement `Tmin < 0 °C` provient de la règle `frost` existante.
Pour les comptes de jours, résultat >0 prouve au moins une occurrence du critère
calculé en amont. Un cumul de pluie ne prouve aucun franchissement d'un seuil
quotidien ; la base GDD n'est pas un seuil d'alerte. Ces deux cartes ont donc
`threshold: null`. Les seuils des palettes restent des conventions descriptives.

Le classement glouton recalcule la diversité et la redondance après chaque choix.
Il retire jusqu'à **20 points**, en supplément de la pondération, pour une carte
de même famille et même nature :

`pénalité = 20 × |corrélation Pearson| × durée intersection / max(durées) × PRA communes / max(PRA qualifiées)`

Cette règle éditoriale ne prétend pas établir une redondance scientifique.
Moins de trois valeurs communes : aucune corrélation. Cartes constantes et
identiques : redondance maximale ; cartes constantes différentes : aucune
corrélation supposée. Pas de pénalité entre réanalyse et prévision.

Le plancher initial vaut **45 points**, avec un plafond de **10 cartes** et aucun
quota de remplissage. Les égalités sont départagées par indicateur, nature, puis
identifiant. Le score des cartes retenues est marginal au moment de leur choix ;
celui des cartes écartées est calculé face à toute la sélection finale. Cela
explique que les scores ne soient pas une liste statique triée une seule fois.

Le dénominateur vient des lignes du bundle, jamais d'une constante 645. Les
proportions, les distributions et les corrélations normalisées restent valables
quand davantage de PRA deviennent qualifiées. Le contrat de lecture actuel reste
celui des 713 identités officielles ; il n'est pas changé pour COUV-02. Des tests
font passer le compte qualifié de 645 à 713 et vérifient aussi l'invariance du
classement sur un univers synthétique doublé, sans en faire une donnée réelle.

## Comparaisons temporelles

Une comparaison numérique exige des réanalyses de même indicateur/unité/source,
fenêtres adjacentes de même durée, mêmes PRA qualifiées, mêmes règles et supports.
Elle retourne seulement la médiane des différences entre valeurs archivées.
Fenêtres chevauchantes, source/couverture/supports différents et prévisions
retournent un motif explicite sans delta. Les tests de branche comparable utilisent
une période synthétique, jamais exportée dans les preuves réelles.

## Comité IA sans invention de valeurs

`committeeRequest` transmet les dix fiches admissibles, les six scores, la
pénalité, les motifs calculés, les régions et contextes sourcés. Les tableaux bruts
par PRA sont retirés du prompt. Les alternatives sous le plancher restent visibles
pour expliquer les exclusions. La sélection proposée pour ce pilote compte six
cartes, dont cinq prioritaires et une complémentaire.

Le nouveau prompt demande une une, trois à cinq priorités si la matière existe,
des compléments et des rejets argumentés. Une édition courte ou vide est admise.
Le modèle renvoie exclusivement des identifiants de cartes, de motifs et de
fenêtres saisonnières déjà fournis. Les titres et légendes sont assemblés par le
serveur depuis les métadonnées vérifiées. Il ne peut fournir de nouveau score,
chiffre, phénomène ou texte factuel libre. La validation refuse champs ajoutés,
preuves d'une autre carte, doublons, omissions d'alternatives, une hors priorités
et sélection d'une carte sous le plancher. Les contextes restent des hypothèses
saisonnières, sans stade, présence de culture, conséquence ou causalité déduite.

`simulateCommittee` offre une frontière injectable sans fournisseur par défaut,
sans accès DB et sans publication. Un seul appel, aucun retry implicite ; réponse
invalide ou >64 Kio rejetée. Aucun appel si aucune carte n'est sélectionnable.
Le résultat conserve le dossier factuel, son empreinte, la réponse, le modèle,
le prompt versionné, le timestamp et le marquage d'assistance IA.

Les comparaisons livrées utilisent **le contrôle déterministe**, clairement
identifié ; elles ne sont pas une évaluation qualitative du modèle. Aucun appel
OpenAI réel, aucune nouvelle archive IA. L'activation d'un fournisseur et son
intégration éventuelle dans l'appel éditorial unique restent à valider séparément,
avec les gardes de budget, traçabilité et contrôle scientifique existants.
Les estimations de coût utilisent le tarif archivé versionné et la borne
conservatrice d'un token par octet, avec réserve de 4096 tokens pour l'enveloppe.
Ce sont des scénarios, sans promesse de prix ni de gain de qualité.

## Données UX-03

`SelectionView` fournit `hero_map_id` et `cards[]` avec `map_id`, `order`, `role`,
`title`, `caption`, `interactive_url`. L'identifiant de une est indépendant de
l'ordre renvoyé par le comité et doit être utilisé explicitement par UX-03.
Toutes les structures portent `mode: simulation` et `publication_enabled: false`.
Aucune route, modification de page, activation ou développement du carrousel.

## Reproduire hors ligne

Depuis la racine, avec les dépendances du lockfile installées (pnpm 10) :

```sh
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/edit03_simulate.ts
apps/web/node_modules/.bin/tsc --project scripts/tsconfig.edit03.json
cd apps/web
node_modules/.bin/vitest run features/editorial-map-selection
node_modules/.bin/eslint features/editorial-map-selection/*.ts
```

Le script ne lit que les fixtures locales et n'écrit que dans
`work/edit-03/results/`. Les fichiers de `evidence/` sont les résultats copiés pour
revue ; le script ne les modifie pas. Aucune connexion ni clé API nécessaire.
