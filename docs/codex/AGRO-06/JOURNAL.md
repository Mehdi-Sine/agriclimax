# Export pour le comité éditorial et suite EDIT-09

Chaque carte donne accès à une synthèse JSON en lecture seule. L’export contient des distributions non pondérées nationales et régionales, le dénominateur des PRA évaluables, les motifs d’abstention, les extrêmes avec leurs ex æquo et au plus trois exemples par extrême. Les productions documentées proviennent du RPG 2025. Lorsque la vue concerne les bovins, l’export peut signaler des orientations OTEX 2020 échantillonnées. Il fournit également période, support, version de formule, provenance, fraîcheur, saison, confiance, réserves et lien vers la carte. Une valeur uniforme ne désigne aucun territoire remarquable. [Contrat JSON](../../../contracts/jsonschema/agro-field-summary-1.schema.json)

Exemple de requête à partir de l’application.

```
/api/agroclimatic?indicator=wet_intensity1&start=2026-11-10&end=2026-11-16&summary=1&compare=previous
```

Les dix exports du 10 au 16 novembre 2026 décrivent 645 PRA évaluables sur 713, sur des supports intégraux. Les valeurs sur portion et Crozon sont exclues des statistiques. Quelques faits que le comité pourrait retenir, en associant un titre et une carte à une seule question.

- **Apports répétés.** La plus longue séquence atteint 7 jours dans plusieurs PRA. Le Dévoluy figure parmi les exemples documentés. Le compte des jours humides et leur plus longue séquence portent sur le même épisode et demandent un arbitrage éditorial.
- **Quantité sur une journée.** En Montagne de Haute-Provence, le maximum quotidien atteint **51,3 mm**. Il s’agit d’une lame d’eau moyenne territoriale sur une journée UTC. L’intensité horaire et l’état du sol restent inconnus.
- **Pluie des jours humides.** Les Alpes niçoises atteignent **84,0 mm**. La médiane des écarts appariés avec la semaine précédente est de **+27,0 mm** sur 645 PRA. La statistique porte sur cette comparaison et les PRA appariées. Une anomalie climatique exige une référence homologue.
- **Moyenne des jours humides.** Le Laragnais atteint **15,6 mm par jour humide**. La comparaison exclut les PRA où l’une des semaines ne compte aucun jour humide et porte sur 622 PRA.
- **Chaleur estivale et froid hivernal.** Cette fenêtre donne zéro pour les quatre règles thermiques sur les PRA évaluables. Les exports établissent ce zéro météorologique. Les fenêtres de publication et une éventuelle pertinence par production restent du ressort du comité.

[Exports complets et exemples RPG](evidence/syntheses.json)

## EDIT-09

Consommer uniquement la synthèse versionnée. Choisir les faits sur la base de la couverture, de la période, du contexte de production documenté et des contrastes. Regrouper les recettes qui décrivent le même épisode avant de classer les cartes. Le contrat actuel établit le dénominateur, les limites et les motifs de non-calcul. Un comité peut filtrer les valeurs uniformes ou hors saison avant de préparer le prompt. Tester le repli factuel et la vérification du lien avec les sessions existantes, puis rejouer des éditions gelées et mesurer la diversité des faits, les abstentions et le volume final. La simulation AGRO-06 est un export manuel et aucun appel OpenAI ne lui est associé.
