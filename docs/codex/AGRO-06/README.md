# AGRO-06 · Indicateurs agroclimatiques multi-filières

Analyse → Situations agricoles propose dix vues opérationnelles sur la réanalyse. Huit reprennent sous leur identifiant les recettes AGRO-03. Le cumul et la moyenne de pluie des jours humides ajoutent deux calculs. Le menu Filière filtre les vues documentées pour les grandes cultures, les prairies et fourrages, la vigne, les vergers et les bovins. Les cumuls de pluie antécédente et séquences sèches existants restent disponibles, avec des raccourcis de 3, 7, 14 et 30 jours pour les fenêtres compatibles.

- [Inventaire au dernier main après #115](INVENTAIRE.md)
- [Référentiel, formules, validation et motifs de report](SCIENCE.md)
- [Catalogue typé et versionné](../../../apps/web/features/agroclimatic/analysis-catalogue.ts)
- [Recette réelle, couverture par vue, temps et volume](evidence/rejeu.json)
- [Recette navigateur et captures ordinateur/mobile](evidence/browser)
- [Synthèses pour le comité éditorial](evidence/syntheses.json) et [exploitation envisagée](JOURNAL.md)
- [Contrôles, ressources et périmètre](VALIDATION.md)

La couverture suit `climate-coverage-1`. Les 713 contours demeurent sélectionnables, dont les six PRA corses. Les portions vérifiées restent descriptives sur la carte. Les faits nationaux et régionaux agrègent les seules valeurs admissibles par PRA. Les dates, la source, les unités, la formule, le seuil météorologique, les références et les limites sont consultables depuis Analyse.

## Suites AGRO-07

- Introduire des observations de stade datées, par espèce et variété lorsque disponible. Associer l’origine, le support géographique et la période de validité à chaque observation. Documenter séparément les repères calendaires et les stades modélisés.
- Évaluer les fenêtres et seuils avec des observations indépendantes, sur plusieurs régions et campagnes, y compris montagne, littoraux et Corse. Conserver une abstention si la source de stade, le support ou la date est incomplet.
- Rattacher ces informations au catalogue par identifiant et version. Les règles météo fournissent l’aléa, le RPG ou l’élevage documente l’exposition, et les observations de stade et les références renseignent la sensibilité. Un dommage nécessite une source de constat.

## Frontières modifiées

Le catalogue compose les règles existantes et prépare leurs métadonnées scientifiques. Le moteur commun traite deux agrégats conditionnels. Le lecteur de masques mutualise les blobs vérifiés entre recettes. Analyse, l’aide et l’export manuel exposent les résultats. Le parcours éditorial de production, les acquisitions, les schémas Supabase et les workflows restent ceux de la base.
