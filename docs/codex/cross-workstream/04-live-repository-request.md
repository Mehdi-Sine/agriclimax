# Task 04 — frontière d'intégration du repository réel

Task 01 définit `RiskRepository.getMapFeatures` avec un retour exclusivement
`DemoData<DemoMapCollection>` et `MapProperties.demo: true`. Une implémentation réelle
ne peut pas satisfaire cette interface sans étiqueter les données réelles comme fictives.

Task 04 laisse ces fichiers inchangés et fournit `SupabaseRiskRepository` sous
`apps/web/lib/server/`, ainsi que les routes `/api/risks/{map,series,territory}`.
Les payloads scientifiques/cartographiques consomment les JSON Schema V1 inchangés.
Le DTO HTTP GeoJSON expose `truncated`, `limit` et `properties.result` ; voir
`supabase/README.md` pour les filtres requis et erreurs. Aucun adaptateur UI n'est modifié.

Lors de l'intégration, prévoir une interface séparant explicitement demo/live, puis
un adaptateur cartographique consommant ces endpoints. Ce changement concerne une
frontière TypeScript du web core et ses consommateurs ; toute évolution des JSON
Schema gelés devra suivre la PR `contract-change/*` prévue. Les territoires actuels
sont des bbox sur les cellules existantes ; aucun référentiel administratif nouveau
n'est introduit. Les contrats WatchSignal restent inchangés.
