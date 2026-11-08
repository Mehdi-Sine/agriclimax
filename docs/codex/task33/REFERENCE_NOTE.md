# AgriClimaX — Almanach unique v1.0 : arbitrages et mode d’emploi T33

**Référence canonique unique :** `agriclimax_almanach_unique_v1_0.json` (version `almanach-unique-1.0.0`, datée du 8 novembre 2026). Le classeur est uniquement une vue de consultation dérivée. **Statut :** référentiel documentaire destiné à proposer des angles éditoriaux, non à prescrire des travaux ni à attester des stades, de dommages ou de faits climatiques.

## Comparaison des deux propositions

- **Premier référentiel** : 365 jours et 121 fenêtres saisonnières, avec productions, 13 régions, signaux, sources, 24 repères fixes, six événements mobiles et règles éditoriales. Points forts : ouverture nationale, élevage/fourrages, qualification des sources, vigilance sur les risques d'inférer des dommages.
- **Second JSON (autre IA)** : 365 jours, cinq colonnes thématiques quotidiennes ; en pratique 12 motifs mensuels de grandes cultures, 36 séquences d'environ dix jours pour le maraîchage/horticulture, plusieurs dictons et une rubrique réglementaire. Points forts : détail des semis sous abri/plein champ, travaux potagers, fêtes agricoles ; limites : répétitions, hétérogénéité régionale insuffisante, dates présentées parfois comme certaines, aucune citation par ligne, réglementations généralisées.
- **Version unique** : 365 jours, 157 fenêtres (121 conservées + 36 complémentaires), 38 repères fixes (24 + 14 dates nouvelles ; d'autres traditions ont enrichi les repères existants), sept types d'événements mobiles, 47 sources indexées et dix arbitrages. Les 12 descriptions mensuelles de la seconde IA sont conservées comme **contexte non publiable en tant que fait**. Trois thèmes réglementaires sont conservés à part, avec vérification obligatoire.

## Principaux arbitrages

| Sujet | Décision pour le référentiel | Vérification / limite |
|---|---|---|
| Blé, stade épi 1 cm en mars | Fenêtre de vigilance, jamais stade certain par jour fixe | ARVALIS : dépend des variétés, semis et températures ; observation ou modèle qualifié nécessaire |
| Floraison de la vigne en mai | Fenêtre variable mai–juin, selon bassins et année | Documentation viticole : dates indicatives et variables |
| Saints de glace | Repère culturel du 11 au 13 mai | Météo-France : une gelée reste possible après le 13 mai |
| Lune rousse | Événement **mobile**, pas un fait du 1er avril | Première lunaison suivant Pâques ; utiliser des éphémérides annuelles ; aucune causalité météo attribuée à la Lune |
| PAC / taille des haies | Période nationale de vigilance BCAE8, non « autorisation générale » hors période | Arrêté national 16 mars–15 août, champ de conditionnalité et dérogations locales à revérifier ; exemples Finistère et Cantal en 2026 |
| Couverture CIPAN / directive Nitrates | Aucune obligation unique au 15 septembre | Réglementations et dérogations territorialisées, vérification des textes en vigueur indispensable |
| Canicule, sécheresse, gel, orages | **Questions** de veille saisonnière, non événements constatés | À démontrer par données qualifiées et sources de terrain |
| Semis / taille / irrigation maraîchère | 36 suggestions complémentaires conservées, mais relecture professionnelle nécessaire | Différencier cultures sous abri et plein champ, bassin, variétés, système ; les sources pédagogiques ne constituent pas une recommandation pour un agriculteur professionnel |
| Étoiles filantes, astrologie et prétendue prévision par dicton | Non prioritaires ou exclus | Lien agricole/agroclimatique non établi ; les dictons peuvent figurer en patrimoine uniquement |

## Structure et règles techniques pour T33

Le JSON de référence comprend les collections :

- `jours` : 365 dates MM-DD et angle principal de la première version, enrichies des références `fenetres_complementaires_ids`, `contexte_mensuel_id`, `reperes_fixes_ids`, `vigilances_reglementaires_ids`, `statut_enrichissement`, `alertes_revision`. `fenetre_id` peut pointer vers `MARR-MM-DD`, un ancien alias de **repère fixe**, et non vers une fenêtre agronomique ; T33 doit résoudre cet alias sur `reperes_fixes`.
- `fenetres` : 157 fenêtres avec identifiants stables `ALM-*` et `VEG-MM-N`. Le contenu `VEG-*` est **exploratoire** et non une prescription.
- `reperes_fixes` : culture, journées officielles et fête de calendrier ; les mentions traditionnelles provenant de l’autre IA sont assorties d’une exigence de vérification de citation.
- `evenements_mobiles` : fêtes et repères annuels à dater **pour l’année cible** (Pâques, fêtes lunaires, foires, équinoxes, Lune rousse).
- `contextes_mensuels_complementaires` : 12 textes de l’autre IA, isolés pour éviter des assertions non vérifiées.
- `vigilances_reglementaires` : **hors flux de faits permanents**, à valider avec les sources officielles et les dérogations locales.
- `sources`, `profils_regionaux`, `dictionnaire_signaux`, `regles_editoriales`, `modele_qualite`, `corrections_et_arbitrages` : métadonnées et garde-fous.

**Calendrier** : version perpétuelle de 365 jours. Les années bissextiles comportent le 29 février, absent du référentiel : la politique de T33 devra être explicite (par exemple, utiliser les fenêtres 28 février–1er mars, sans attribuer un jour inexistant à un repère fixe). Les jours et fêtes mobiles doivent être calculés pour l'année de publication, en `Europe/Paris`.

**Rôle de l'almanach** : fournir des *candidatures de sujets* et des *questions agronomiques*, à croiser avec : (i) les preuves climatiques du cycle disponible, (ii) les indicateurs qualifiés par production, (iii) la mémoire temporelle des épisodes, (iv) les sources techniques/BSV et publications T34. Aucune simple date ne peut produire une alerte, une conséquence agricole ou un titre de une.

**Proposition d'interface T33** : un résolveur `getSeasonalEditorialContext(date, region?, production?)` retournant au plus un nombre borné de candidats avec `{id, category, region_scope, production, question, signal_ids, origin, source_ids, confidence, requires_verification, publication_eligible:false}`. Une source n'est jamais « éligible à publication » sur son seul statut calendaire : l'éligibilité appartient au fait vérifié que le journal peut éventuellement lui associer. Les `VEG-*` doivent rester en `review_required` tant qu'ils ne sont pas expertisés par une filière.

**Critères de recette** : 365 journées présentes, aucune collision de dates/IDs, tous les liens de fenêtres et de sources valides, 29 février explicitement géré, événements mobiles non figés, sources réglementaires jamais injectées comme prescriptions automatiques, exemples d'épisodes climatiques concordants/non concordants et d'une journée sans événement.

## Sources vérifiées pour les corrections sensibles

- ARVALIS : https://www.arvalis.fr/infos-techniques/stade-epi-1-cm-un-marqueur-determinant-savoir-reperer
- ARVALIS (2026) : https://www.arvalis.fr/infos-techniques/stade-epi-1-cm-en-approche-et-absence-de-pluie-privilegier-le-fractionnement-de
- Météo-France : https://meteofrance.com/meteo-a-z/de-la-fraicheur-aux-saints-de-glace-est-ce-toujours-dactualite
- Légifrance, BCAE 8 : https://www.legifrance.gouv.fr/loda/id/JORFTEXT000047318882/2026-02-12
- Dérogation Finistère 2026 : https://www.finistere.gouv.fr/Actualites/Report-de-la-periode-d-interdiction-de-la-taille-des-haies-et-des-arbres
- Dérogation Cantal 2026 : https://www.cantal.gouv.fr/Actualites/Espace-presse/2026/Mars/Interdiction-de-taille-des-haies-et-des-arbres-pendant-la-periode-de-nidification
- Cycle viticole indicatif : https://www.irsn.fr/sites/default/files/documents/expertise/rapports_expertise/Guide-ACTA_Partie-2_Informations-generales.pdf
- Semis potagers, source pédagogique : https://old-ecolotheque.montpellier3m.fr/sites/ecolotheque/files/Calendrier%20simplifi%C3%A9%20des%20cultures%20des%20plantes%20potag%C3%A8res.pdf
- Calendrier fruits/légumes de saison (UE) : https://agriculture.ec.europa.eu/farming/crops/fruit-and-vegetables/calendar_fr

**Limite méthodologique :** les fenêtres générales du premier almanach et les 36 ajouts ne sont pas tous validés séparément par les instituts techniques ; les sources de section et les références thématiques appuient une orientation, non chaque date précise. Cette étape constitue une consolidation documentaire, non une expertise agronomique achevée.
