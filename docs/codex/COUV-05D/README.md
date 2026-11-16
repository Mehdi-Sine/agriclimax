# COUV-05D — qualification finale

**Livraison PARTIAL ; activation globale NO-GO.** Le reliquat numérique est terminé hors ligne ; un blocage précis de raccordement reste à lever. Aucun flag de production changé, aucune archive republiée, aucun appel OpenAI, aucune collecte nationale, aucune activation AGRO-03 ni fusion.

Base : fusion de #99, `10e6d86d66595e0e62c9725c1a2e6d47feac698b`. COUV-04, COUV-05 et COUV-05C restent les références pour les travaux déjà qualifiés. Les 730 387 valeurs antérieures et les géométries composites qualifiées ne sont pas recalculées.

## 1. Reliquat numérique terminé

| Groupe | Examiné | Nouvelles valeurs qualifiées | Portée scientifique |
| --- | ---: | ---: | --- |
| Pluie : 9 recettes × 105 cas | 945 | 945 | Valeurs descriptives sur la portion observée, jamais extrapolées |
| THI, jours THI et séquence THI : 3 × 80 cas | 240 | 240 | Support commun dans la tolérance de complétude existante |
| **Total** | **1 185** | **1 185** | Aucun recalcul non résolu sur ces cas |

**Total numérique : 731 572 / 758 632.** Les **26 400 THI partiels** restent inadmissibles et les **660 intersections absentes** restent NULL. Aucun zéro n'est inventé. Aucune modification de seuil, formule, tolérance ou règle d'admissibilité.

Les 945 valeurs de pluie gardent `value=NULL`, `observed_value` renseigné et `support_scope=observed_area`. La qualification supplémentaire ne signifie donc pas 945 valeurs territoriales entières. Le seuil cartographique de 90 % conduit à 645 peintures de contour entier et 540 peintures géographiques partielles pour ces 1 185 résultats, à condition de disposer de la pièce géométrique d'identité correspondante. Le test vérifie le refus gris quand cette identité manque.

Le checkpoint original est vérifié par SHA, puis relu avec les réducteurs existants, réseau interdit. Les 14 captures journalières doivent être strictement identiques aux preuves conservées, et les 49 910 réductions originales identiques. Seules les cellules valides communes à toutes les variables et dates alimentent les nouvelles moyennes, normalisées sur ce support. Les températures restent en °C, la pluie en mm, l'humidité en %. Le THI conserve la synthèse de Tmoy/RHmoy compatibles, puis l'opérateur temporel de la recette, sans changement scientifique.

Chaque résultat conserve modèle, cycle UTC, PRA, période, recette exacte, seuil, référence, poids, empreintes des entrées natives, empreinte des cellules communes, provenance et fraîcheur originales. Les cas couvrent cinq couples modèle/cycle ; cela ne constitue pas une preuve de persistance sur cinq exports successifs.

Pièces durables : [native-audit.json](evidence/native-audit.json), [common-inputs.json.gz](evidence/common-inputs.json.gz), [qualified-residuals.json.gz](evidence/qualified-residuals.json.gz), [numeric-report.json](evidence/numeric-report.json). Le test réexécute les 1 185 calculs depuis les entrées compactes versionnées, compare les formules existantes à un contrôle arithmétique indépendant et vérifie NULL après retrait d'une entrée temporelle.

**Limite explicite : ces pièces sont des preuves numériques locales.** Elles ne sont pas prétendues consommées par le lecteur web actuel, ni publiées dans Storage. Les lignes correspondantes restent refusées dans le parcours web tant que le raccordement décrit dans les blocages ci-dessous n'est pas réalisé.

## 2. Parcours réels

Les pages produit, leurs API et leurs miniatures sont utilisées avec les vraies archives conservées. Aucune réponse injectée, miniature remplacée ou page de composant isolée. Le navigateur attend la réponse de l'API avant de vérifier le rendu.

L'édition locale de recette du 15 novembre est reconstruite avec `int01_maps.ts prepare`, depuis son snapshot et ses entrées gelées exactes : bundle `eea4f1296aa03ca4a67eea7c16ff96addad975cd1a99a1e937d587a8ec075acb`. Le mode de prévisualisation existant affiche explicitement que les cartes sont candidates, non publiées. Le texte archivé est réutilisé sans génération.

| Interface / API réelle | Constat sur l'archive qualifiée |
| --- | --- |
| Explorer climat, température du 15 novembre | 713 contours et 713 valeurs peintes ; identités et valeurs comparées aux lignes exactes de l'archive |
| Explorer climat, humidité IFS du 15 novembre | 586 contours colorés, 127 gris conformément à l'admissibilité existante |
| Explorer climat, pluie IFS du 19 novembre | 706 colorés, 7 gris : les agrégats d'origine ne donnent pas de valeur exploitable pour ces supports partiels |
| Explorer analyse, pluie homogène du 16 au 17 novembre | 713 valeurs qualifiées et colorées |
| Explorer analyse, THI homogène du 19 au 21 novembre | 389 colorés, 324 gris ; aucune admission des THI partiels |
| Explorer analyse, fenêtre multi-modèles du 15 au 21 novembre | 713 gris ; les changements de source/cycle ne sont pas rendus artificiellement compatibles |
| Cartes du jour, aperçu pluie réel | 713 valeurs acceptées par la pièce de rendu ; entrée gelée et valeur archivée inchangées |
| Journal | Carrousel réel → lien vers la carte interactive réelle ; aucune carte intégrée n'est inventée quand la page présente le carrousel |
| Miniatures / carrousel | Cinq images réelles de l'édition, contrôle du chargement et navigation clavier ; pas de substitution d'image |

Les contrôles HTTP imposent 713 identités distinctes, dont les six corses. Les contrôles navigateur vérifient les 713 contours effectivement rendus, l'absence de débordement et d'erreur JS ; palettes et textes des légendes sont conservés dans les rapports. Les classes et légendes existantes ne sont pas modifiées.

**La coloration géographique sous 90 % n'est pas déclarée validée de bout en bout pour les 540 nouveaux résultats** : son calcul est contrôlé hors ligne, mais le lecteur produit ne dispose pas encore des nouvelles pièces numériques. Ce refus explicite est le premier blocage du GO, pas un succès de coloration partielle.

Trois corrections minimales issues de la recette :

- Un SHA d'archive gelée est résolu dans le catalogue conservé, même après avancement de `current.json`. Un pin absent ne se replie jamais sur le cycle courant.
- La distribution de classes agroclimatiques utilise le même `classIndex` que la carte : une condition erronée limitait tous les compteurs à la première classe. Palettes et bornes restent inchangées ; la somme des classes doit correspondre aux valeurs territoriales affichées.
- L'horloge de consultation d'Explorer est initialisée après hydratation, pour éviter le désaccord serveur/navigateur observé pendant les parcours.

## 3. Persistance, reprise, volumes et cycles

[storage-audit.json](evidence/storage-audit.json) : 267 GET, zéro écriture ; **260 objets / 172 331 262 octets** relus et vérifiés par SHA et taille en 28,72 s. Trois archives distinctes sont relues : exports du 13, 14 et 15 novembre à 18 UTC. Les pointeurs `catalogue.json` et `current.json` sont identiques au début et à la fin de cette relecture.

[resume.json](evidence/resume.json) : le producteur existant reprend les 70 manifestes natifs conservés, vérifie les appartenances des 49 910 lignes et retrouve exactement l'index `df8d1c4…9145`. Les 260 objets et leur volume restent identiques ; cache de nouvelles géométries = 0, aucun rejet. Mesure locale : 308,80 s, pic RSS 1 067 756 Kio ; cette reprise inclut lecture/validation et réécriture locale de la matrice d'audit, sans acquisition ni écriture distante.

L'[inventaire initial](evidence/storage-inventory.json) ne contenait qu'un index. Le checkpoint suivant existait déjà : il a été repris sans collecte, et ses 49 910 réductions sont identiques aux réductions d'origine. Ses 70 manifestes natifs couvrent 713 PRA, dont les six corses, avec zéro inconnu et zéro rejet géométrique : 48 793 supports démontrés, 1 097 partiels, 20 absents. Ces états natifs ne sont pas confondus avec les 660 absences composites de la matrice COUV-05C.

La génération a été interrompue après quatre manifestes, avant création d'index, puis reprise dans le même répertoire : les quatre SHA sont conservés et l'index final est complet. Le second candidat comporte **267 objets / 180 137 728 octets** ; 48 objets sont partagés avec le premier cycle. L'insertion par le mécanisme immuable existant a ajouté **219 objets / 139 096 302 octets**, sans upsert, avec l'index écrit en dernier et relecture des insertions. `catalogue.json`, `current.json` et le premier index sont inchangés.

L'[inventaire final](evidence/storage-inventory-after.json) confirme **deux index / 479 objets / 311 427 564 octets de masques**. La [relecture indépendante du second index](evidence/next-storage-readback.json) vérifie ses 267 objets / 180 137 728 octets en 28,31 s, sans écriture. Le bucket complet occupe 377 064 475 octets, sous la garde inchangée de 943 718 400 octets. Les deux index restent liés à leurs archives distinctes : `df8d…9145` → `ed93…a398`, `e1da…5347` → `884d…c7fd`. La prévision du 13 novembre est aussi contrôlée en refus de pin incompatible ; un masque d'un autre cycle n'est pas réutilisé.

Mesures du cycle suivant : rejeu natif 79,12 s ; reprise/génération/validation des masques 824,73 s, pic RSS 1 046 012 Kio ; plan, insertion et contrôles de pointeurs 662,13 s. Ces opérations sont des lots hors ligne, pas une latence de requête web. La garde n'a pas été relevée.

Les preuves durables du second cycle conservent captures et index, en réutilisant les poids déjà versionnés : [provenance](evidence/next-cycle/provenance.json), [matrice native](evidence/next-cycle/native-matrix.csv.gz), [interruption/reprise](evidence/next-interruption.json), [publication privée du candidat](evidence/next-storage-publication.json). Une reconstruction bornée depuis ces preuves, sans grilles de valeurs ni checkpoint, retrouve le premier manifeste à l'identique : [next-rebuild.json](evidence/next-rebuild.json). Ce contrôle borné ne prétend pas reconstruire les 70 manifestes.

La garde Storage existante de 900 Mio reste inchangée. Les objets sont immuables, sans upsert ; aucun nettoyage ni suppression n'est ajouté. Les limites de lecture du moteur commun ne sont pas relevées. Le build local de production passe aussi sur le second cycle : 713 températures colorées, 694 pluies IFS exploitables le 18 novembre, 494 humidités IFS le 16, 713 pluies sur la fenêtre homogène du 17 au 18 et 474 THI du 20 au 22. Les autres résultats restent gris ; [routes-next-cycle.json](evidence/routes-next-cycle.json) compare chaque ligne météo à la seconde archive exacte. Les contrôles desktop/mobile de ce second cycle rendent les 713 contours. Les mesures HTTP de [routes.json](evidence/routes.json) utilisent les vraies lectures Storage ; les mesures navigateur incluent Next de développement, compilation et calculs concurrents, et ne certifient pas un SLO serverless de production.

## 4. Seul blocage restant et correction minimale

**Raccordement des 1 185 recalculs au lecteur existant.** Conserver les entrées/résultats bornés comme pièce immuable du mécanisme de sidecars déjà en place, liée à l'archive, recette/seuil, modèle/cycle, période, PRA et cellules communes. Le lecteur doit accepter exclusivement cette identité, sa version de règle et sa géométrie commune, puis les APIs/miniatures existantes doivent transporter la même qualification, sans élargir le catalogue actif ni activer AGRO-03. Les nouvelles valeurs alimentent des résultats dynamiques ou de nouveaux candidats non publiés ; une valeur différente ne peut pas être attachée à une carte déjà gelée. Rejouer les 540 cas sous 90 % dans les vrais parcours. Ne pas charger les grilles natives dans une requête web, ne pas réutiliser un agrégat d'un autre support et ne pas modifier une édition publiée. La preuve numérique est maintenant disponible ; aucun nouveau moteur scientifique n'est nécessaire.


Ce raccordement bloque l'activation globale. Les refus scientifiques des 26 400 THI et les 660 absences ne sont pas des blocages à corriger. Le rendu historique et les éditions déjà publiées restent sous leurs contrats existants. La persistance multi-cycles, initialement bloquante, a été levée dans cette tâche ; elle ne constitue plus un reliquat.

Flags exacts, périmètre, retour arrière et proposition de progression conditionnelle : [ACTIVATION.md](ACTIVATION.md). Commandes de reproduction : [REPRODUCTION.md](REPRODUCTION.md). Les résultats de validation et captures sont référencés dans [VALIDATION.md](VALIDATION.md).
