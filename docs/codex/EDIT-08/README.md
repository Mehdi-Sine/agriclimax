# EDIT-08 · Le Journal agroclimatique de Climacta

## Diagnostic éditorial

| Axe | Éditions archivées des 22 et 23 novembre 2026 | Rejeu EDIT-08 |
| --- | --- | --- |
| Angle et titre | La pluie puis le gel en Auvergne-Rhône-Alpes ouvrent deux éditions successives. Les titres décrivent le phénomène et la fenêtre mais donnent peu de prise à un lecteur agricole. | Lecture par les travaux d’automne le 22 et par l’exposition au froid à la parcelle le 23. Les titres attribuent le signal aux prévisions. |
| Densité | Le chapeau, le récit, le choix de la rédaction et les focus recommencent plusieurs fois par le franchissement d’un seuil. Les ratios de PRA et les métriques d’interface dominent. Le 23, trois décomptes concernent la même région avant le premier contraste. | Trois enseignements distincts par édition. Le corps de la fixture passe de 275 à 104 mots le 22 et de 301 à 77 mots le 23, hors chapeau, régions et regard agricole. Les détails techniques restent accessibles. |
| Territoires | Deux focus le 22 et trois le 23. Le premier focus répète la une, les autres alignent surtout des seuils. | Trois focus chaque jour. Le 22 compare notamment deux intensités de pluie et le contraste avec le gel du Grand Est. Le 23 associe Auvergne-Rhône-Alpes, Occitanie et Nouvelle-Aquitaine avec des intensités localisées et un autre signal dans les enseignements. |
| Agriculture et saison | Aucune rubrique de production renseignée dans les deux brouillons. Les deux journées utilisent le même repère de portance. | Le 22 relie la réanalyse de pluie, les productions déclarées au RPG et la question du ressuyage. Le 23 privilégie le gel météorologique et les stades à vérifier, avec une question saisonnière distincte sur l’exposition des ruchers. Une question de l’Almanach ne documente aucune présence ou aucun stade effectif. |
| Cartographie | Six miniatures par édition et ouverture de la carte interactive sur une autre page. | La carte choisie apparaît sous le chapeau et ouvre la fiche PRA dans l’article. Deux cartes retenues par fixture et accès au fonds cartographique complet. Les cartes de une couvrent les 23–24 novembre pour la pluie et les 24–25 pour le gel. Leur validité propre figure à côté de celle de la prévision hebdomadaire. |
| Précautions | Mention expérimentale, réserves, répétition des qualifications dans le récit et les chiffres. | Attribution et période au voisinage des faits, limites de portée et contrôles dans « Pour aller plus loin ». L’indication d’assistance IA reste visible. |

## Intégration et preuves

- **Préparation éditoriale.** Uniquement les lignes ERA5 déjà sélectionnées avant le cutoff. Fenêtre continue de sept jours, règles AGRO-05 existantes, résultats admissibles par support, quatre résumés au plus. Le potentiel thermique du maïs reste hors du dossier opérationnel tant qu’une fenêtre de développement n’est pas qualifiée. En cas d’indisponibilité, le dossier standard reste exploitable. La limite de 96 Kio s’applique toujours au briefing.
- **Dénominateurs.** Les quatre résumés donnent chacun 645 PRA évaluables sur 713 dans les deux rejeux. Les 67 supports partiels et la PRA sans valeur utilisable sont exclus du calcul. Les occurrences sont des dénombrements de territoires. Le RPG 2025 est un historique de déclarations et ne sert à aucune pondération.
- **Conférence.** `editorial-board-fr-6` hiérarchise intensité, saison, contexte de production et contraste territorial. Le dossier AGRO-05 aide à arbitrer. Le serveur rend le contexte agricole structuré et conserve la traçabilité des blocs rédigés via les identifiants de preuves préexistants. Les extraits AGRO-05 ne créent aucun identifiant de preuve pour du texte libre.
- **Lecture et archives.** Le rendu consomme la projection publique de l’édition et la carte liée à son identifiant et à son empreinte. Les mêmes URLs et enveloppes archivées sont lues. Les ajouts au contrat sont facultatifs. Les versions antérieures restent reconnues par les contrôles de publication. Aucun workflow d’acquisition, transport d’archive, prix ou modèle n’a été modifié. Le rejeu a lu les deux snapshots et leurs entrées immuables par les lecteurs existants, sans publication ni écritures distantes.
- **Retour depuis les fiches.** Le lien du regard agricole ouvre l’indicateur et la période en conservant la PRA et un retour borné à l’édition. La carte de une permet de sélectionner une PRA, de lire sa valeur et sa provenance et de revenir aux enseignements.

## Recette et mesures

| Édition | Requête reconstituée avant, JSON / gzip | Requête simulée après, JSON / gzip | Coût archivé avant | Simulation |
| --- | ---: | ---: | ---: | ---: |
| 22 novembre | 118 294 / 16 580 octets | 135 748 / 20 766 octets | 0,078136 € · 39,6 s | 0 € · 0 appel |
| 23 novembre | 118 321 / 16 592 octets | 135 807 / 20 390 octets | 0,080845 € · 43,4 s | 0 € · 0 appel |

Les volumes JSON et gzip sont ceux du dossier envoyé comme contenu utilisateur, carte comprise. Le briefing après enrichissement fait environ 58,4 ko et reste sous le plafond de 96 Kio. Le calcul purement local des synthèses a pris environ 0,3 à 0,6 s après chargement des données. L’écart d’entrée, estimé avec la borne UTF‑8 du dépôt au tarif de diagnostic du modèle archivé, vaut environ **0,0204 €** pour les données ajoutées. Cette borne porte sur l’entrée supplémentaire avec le même gabarit comparatif. Le coût et le temps réels du nouveau prompt n’ont pas été mesurés puisque la sortie est une fixture rédigée à la main. Les reçus d’origine documentent 54 417 et 55 615 jetons d’entrée avant modification. [Mesures du 22](evidence/2026-11-22.json) · [Mesures du 23](evidence/2026-11-23.json)

Chromium local, 1 440 et 390 px. Après, la carte interactive ajoute environ 1 Mo de JSON et 2,55 Mo de contours décodés à froid. Avant, les miniatures représentaient environ 0,24 Mo. Le tableau navigateur distingue disponibilité du titre et rendu de la carte. La comparaison de ce dernier délai oppose une miniature à une carte WebGL déjà exploitable. C’est un relevé local avec les réponses archivées et sans cache navigateur partagé entre les vues. Les vérifications couvrent l’absence de débordement horizontal, la présence de trois enseignements et de trois focus, le rendu des contours, la sélection PRA et le retour à l’article. [Mesures navigateur](evidence/browser/mesures.json)

| Date | Bureau | Mobile |
| --- | --- | --- |
| 22 novembre | [Avant](evidence/browser/22-desktop-avant.png) · [Après](evidence/browser/22-desktop-apres.png) | [Avant](evidence/browser/22-mobile-avant.png) · [Après](evidence/browser/22-mobile-apres.png) |
| 23 novembre | [Avant](evidence/browser/23-desktop-avant.png) · [Après](evidence/browser/23-desktop-apres.png) | [Avant](evidence/browser/23-mobile-avant.png) · [Après](evidence/browser/23-mobile-apres.png) |

Les deux fixtures passent les contrôles éditoriaux automatiques et gardent le statut `needs_editorial_review`. Les archives sources et les reçus restent ceux des éditions originales. Aucun appel OpenAI et aucune promotion de publication en recette.

### Rejouer avec des accès de lecture aux archives

Depuis la racine, dans un environnement isolé avec les dépendances du dépôt. Le mode `prepare` du lecteur cartographique conserve les fichiers localement. L’accès en lecture aux objets ERA5 référencés reste nécessaire pour les archives avec manifeste de sources.

```sh
export NODE_OPTIONS=--conditions=react-server
apps/web/node_modules/.bin/tsx scripts/int01_maps.ts prepare 7422369546f55e1ef5c33563a18f7b9da4bfdbc09bc88522f71d78fb56f50271 --out work/edit08/22
apps/web/node_modules/.bin/tsx scripts/int01_maps.ts prepare fb5216ce23a36b9804824d8c998d4a4d20c0ae5d02db611cb18fe3f430368b48 --out work/edit08/23
apps/web/node_modules/.bin/tsx scripts/edit08_replay.ts work/edit08 work/edit08/mesures
```
