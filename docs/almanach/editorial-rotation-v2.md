# Almanach — Programmation éditoriale v2 (366 dates)

## Portée

Ce fichier `config/almanach/agriclimax-editorial-rotation.v2.json` est une **surcouche**, non un remplacement du référentiel canonique v1 : aucune entrée, source, fenêtre ou repère existant n'a été modifié. **Aucun branchement production** n'est réalisé dans cette PR. La clé de jointure est `date_mm_jj` (MM-DD).

Le nouveau calendrier couvre **365 jours usuels + le 29 février**, activable uniquement en année bissextile au sens grégorien : `(annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0`. En année ordinaire, filtrer `02-29`; les 365 autres associations date ↔ focus sont stables. Ne jamais recopier le 28 février ni décaler les dates suivantes.

## Structure

- `categories` : nomenclature fixe de 15 rubriques (6 F, 5 T, 4 P).
- `jours[].focus_principal` : une catégorie, un focus, une production/espèce précise si F, question éditoriale et ancrage événementiel éventuel.
- `jours[].region_du_jour` : une des 13 régions administratives, portrait indicatif à corroborer avec données géographiques et productions.
- `jours[].pistes_secondaires` : catégories complémentaires et références du fichier canonique, jamais preuve d'un événement réel.
- `jours[].signaux_a_interroger` : intentions de recherche des indicateurs disponibles, non identifiants de données garantis.
- `jours[].validation` : interdictions explicites d'inférer stade, dommage, rendement ou météo à partir d'une date.

## Contrôles de génération

- **366 dates uniques**, 365 actives les années ordinaires.
- **13 régions**, 28 à 29 apparitions par an avec le 29 février.
- **15/15 catégories présentes**, 212 focus filières, 83 transversaux et 71 patrimoniaux.
- Espèces/sous-productions distinctes : F01=13, F02=18, F03=18, F04=33, F05=21, F06=23.
- Répétitions immédiates de catégorie : 2; elles peuvent correspondre à des journées traditionnelles ou officielles consécutives et sont à distinguer des répétitions de sujet.

## Usage

Le moteur éditorial doit lire la v1 pour ses données historiques et scientifiques, et cette surcouche pour les propositions de sujet. Les focus T/P non attachés à une source datée doivent rester des **pistes de recherche**, non des dates historiques affirmées. Vérifier particulièrement dictons, manifestations et fêtes locales. Les repères fixes du référentiel v1 sont repris comme repères éditoriaux : ne pas transformer leur présence en constat météo. Les fêtes mobiles restent à résoudre et à vérifier pour l'année effective.

### Exemples

- **01-22** : P02 / Saint-Vincent, repère de la tradition vigneronne — Île-de-France
- **02-29** : F05 / Repos saisonnier et conduite des parcelles — Corse
- **03-01** : T01 / Début de printemps météorologique — Bretagne
- **05-11** : P02 / Saint Mamert — 1er Saint de glace — Hauts-de-France
- **11-16** : F02 / Ressources fourragères et transitions saisonnières — Bretagne

## Étape ultérieure, hors périmètre

Définir, tester puis intégrer une fonction de résolution `getEditorialCalendarFocus(date, region?)`, vérifier couverture 365/366 et différences année bissextile, lier les catégories aux indicateurs qualifiés, et contrôler diversité et fraîcheur des articles produits. Ne pas brancher cette surcouche sur l'IA sans évaluation de la qualité et de la taille du dossier éditorial.
