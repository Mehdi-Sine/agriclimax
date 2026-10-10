# Design system AgriclimaX

Le design system est une couche d'infrastructure produit. Aucun composant métier ne contient de valeur hexadécimale.

## Primitives
`Button`, `IconButton`, `Select`, `Combobox`, `Sheet`, `Drawer`, `Tabs`, `Tooltip`, `Badge`, `Callout`, `Skeleton`, `DataState`, `Metric`, `SourceChip`.

## Composants métier
`RiskBadge`, `ConfidenceBadge`, `FreshnessBadge`, `EvidenceList`, `SignalCard`, `RiskLegend`, `TerritorySummary`, `IndicatorSparkline`, `ScientificMethodCard`, `MapLayerControl`.

## Sémantique
- Risk != Confidence.
- Forecast != Observation.
- AI narrative != measured/calculated fact.
- Stale != Missing.
- No risk identified != No data.

## Thèmes
Les tokens CSS sont exposés dans `apps/web/styles/tokens.css`. Une implémentation dark conserve la sémantique, pas nécessairement les mêmes valeurs brutes.
