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

## Implémentation Task 05

Le catalogue `/design-system` présente les primitives et tous les états. Il est
accessible dans la démo, sans Storybook ni second framework UI. Aucun composant
n'utilise de couleur littérale. `styles/tokens.css` contient les couleurs source,
les alias sémantiques, les espaces, rayons, familles et durée. Les styles partagés
sont dans `styles/globals.css`. Les composants utilisent les classes sémantiques.
Les palettes de risque ne sont pas des règles de classification.

### API de composition

| Composant | Entrées / comportement |
| --- | --- |
| `Button`, `IconButton` | Attributs natifs ; variante primary/secondary/quiet ; libellé explicite pour les icônes |
| `Select`, `Combobox` | Libellé lié à un ID unique ; select/datalist natifs, utilisables au clavier ; la saisie libre du combobox doit être validée par le consommateur |
| `Tabs` | Groupe de boutons avec `aria-pressed`, valeur/options/onChange ; pas de promesse ARIA tabpanel |
| `Tooltip` | Affichage au focus/survol, contenu survolable, fermeture par Échap |
| `Sheet`, `Drawer`, `Dialog` | Dialogue modal natif, fond inerte, focus contenu, Échap et retour au déclencheur |
| `Panel`, `Callout`, `Badge`, `Skeleton` | Surfaces et informations réutilisables |
| `DataState` | loading, processing, missing, insufficient, no-risk, risk, stale, calculation-error, source-error, demo ; erreurs en alert, autres états en status |
| `RiskBadge`, `ConfidenceBadge`, `FreshnessBadge` | Entrées typées indépendantes ; niveaux fournis par le domaine, jamais calculés par le composant |
| `Metric` | Valeur et unité explicites ; `null` devient « — », zéro reste zéro ; nature de la donnée configurable |
| `SourceChip`, `EvidenceList` | Sources et preuves fournies, aucun enrichissement inventé |
| `ScientificMethodCard`, `TerritorySummary`, `SignalCard` | Composition de faits/limites/actions ; `SignalCard` est actuellement une carte de démonstration explicitement fictive |
| `IndicatorSparkline` | Illustration d'une série fictive fournie ; tableau trop court/non fini → insufficient ; pas de seuil ou prévision |
| `RiskLegend`, `MapLayerControl` | Légende de présentation et cases à cocher génériques ; aucune carte ni couche métier |

Exemple :

```tsx
<RiskBadge level={result.risk.level} />
<ConfidenceBadge level={result.confidence.level} />
<Metric label="Aléa" value={result.hazard.value} unit={result.hazard.unit} />
```

`Metric.kind` doit distinguer observation, indicateur calculé et prévision.
Les futurs consommateurs doivent fournir leurs dates, statuts IA, fraîcheur,
provenance et version de règle. Les labels temporels de `SignalCard` et ses
marqueurs demo doivent être généralisés lors de son intégration métier ; ils sont
intentionnellement fictifs dans ce catalogue.

### Thèmes et accessibilité

Thème clair initial, bascule persistée sous `agriclimax-theme` avec tolérance au
stockage désactivé. Initialisation avant le contenu pour éviter le flash au
rechargement. Les alias adaptent surfaces, texte, bordures et actions en sombre.
Le script statique d'initialisation nécessitera un nonce/hash si une CSP stricte
est ajoutée dans le workstream sécurité.

Manrope et Inter variables sont servies localement en latin/latin-ext avec leurs
licences SIL OFL dans `public/fonts/`. `font-display: swap` et fallback système.
Les métriques utilisent `tabular-nums`.

Les badges de risque portent un libellé. Le texte du badge critique est noir :
le blanc sur la couleur source atteint seulement 4,39:1. Le noir atteint 4,78:1.
Le focus est un contour de 3 px. Contrôles tactiles de 44 px minimum. Les liens
textuels suivent les règles de texte, et ne remplacent pas les commandes tactiles.
`prefers-reduced-motion` désactive animations et transitions, dont le skeleton.
Les résultats axe et les contrôles clavier sont conservés dans
`docs/codex/verification/task05/` ; ils ne constituent pas une certification WCAG.

### Frontière de données du shell

`ShellData` (`lib/shell-data.ts`) sépare demo/collection locale, live/missing,
live/available et live/source-error. Le loader server-only du shell consomme les
lectures validées de Task 04. Cette union UI n'étend aucun JSON Schema ou repository
partagé. Le mode live vide ne porte ni marqueur demo, ni badge de risque inventé.
Le live non vide expose seulement un compte en attendant l'intégration Task 06.

### Consommateur Diagnostic Task 08

`ScientificDiagnostic` compose les badges indépendants, `Metric`, `Callout`,
`EvidenceList`, `DataState` et la légende. Il n’utilise pas
`ScientificMethodCard` (statut exploratoire fixe) ni `TerritorySummary` (libellé
fictif fixe) pour les données live. Tableau accessible de valeurs reçues, fenêtre
fournie par le moteur, composantes absentes explicitement non disponibles.
Les styles `diagnostic-*` réutilisent les tokens de surfaces/texte/bordures en
clair et sombre ; le drawer existant conserve focus trap, Échap et restitution
du focus. La route dédiée utilise un lien d’évitement et des ancres de sections.
