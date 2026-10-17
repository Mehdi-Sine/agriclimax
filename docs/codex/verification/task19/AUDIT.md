# Audit préalable — Task 19

Base distante/tag v0.2.0 : 8cb47998178cb68e244cadf456c5d57ebae9da53.
Branche : codex/19-national-coverage. Audit du 17 octobre 2026.

## Réutilisation

- Provider ERA5-Land (`climate/era5_land.py`) : CDS natif 0,1°, fichiers vérifiés
  par SHA256, requêtes bornées à 2° et 31 jours, timeout subprocess 1200 s.
  Réduction UTC exigeant 24 températures horaires ; pluie au prochain 00 UTC.
- Pipeline Task 15 : tuiles, checkpoints et archives gzip, à adapter car le masque
  de centres Natural Earth n’est pas une intersection surfacique des PRA.
- Modèles blé et THI : conservés sans changer règles/seuils. Le provider ERA5
  actuel n’acquiert pas l’humidité : diagnostics THI ERA5 non pris en charge.
- Task 17 et vues live station Task 18 : inchangées, aucune spatialisation MF.
- RPC SECURITY INVOKER, tables privées RLS/grants explicites, migration forward-only.
- CI existante, tests PostGIS public/extensions, Python, Vitest, E2E et Vercel.

## Modifications nécessaires / composants nouveaux

Référentiel versionné PRA et hiérarchie département/région ; intersections des
cellules géographiques natives projetées en EPSG:3035 ; moteur d’agrégation
explicite et indicateurs supportés ; statistiques climatiques compactes communes
par PRA/jour ; sorties diagnostics sélectives ; orchestration reprise/retry,
rapports de couverture et budget, rétention dry-run. API territoriale distincte
sans casser les routes station/grille existantes, recherche PRA/département.
Ne pas réutiliser `grid_cells` comme si une PRA était une maille climatique.

## Infrastructure observée, lecture seule

Projet Supabase agriclimax-dev yyfbpecxvxglzxopsmel, PostgreSQL 17.11.
pg_database_size : **24 598 195 octets**, mesure MCP SQL du 17 octobre.
Storage : 0 objet, 0 octet selon métadonnées storage.objects.
15 tables agriclimax_private, RLS activée ; aucun grant table à PUBLIC/anon/
authenticated. Plus gros objets : spatial_ref_sys 7 315 456 octets,
climate_references 3 358 720, station_weather_batches 466 944. Préserver tous
les enregistrements v0.2 (stations, observations, portefeuilles, snapshots,
références, manifests). Aucun nettoyage des tables antérieures.

Les workflows bulk restent manuels/bornés, concurrency 1, timeout explicite ;
aucun téléchargement national sur événement PR. La CI Task12 existante checkout
une branche historique et persiste un petit test réel : comportement préexistant
à documenter, ne pas l’étendre au national. Pas d’ingestion dans Vercel.
Dépôt GitHub privé, plan et consommation mensuelle du compte non mesurés.
Next config conserve useTypeScriptCli=false ; aucune autre configuration Vercel
locale ajoutée. Configuration environnement Vercel secrète non extraite ; build/routage existants
préservés. Aucun changement de configuration distante.

## Hypothèses scientifiques / ruptures à éviter

Poids de surface totale, pas de masque agricole disponible validé. La PRA n’est
pas une précision source : plusieurs cellules, extrema/conditions calculés avant
agrégation, couverture manquante explicite sans renormalisation silencieuse.
Ne pas dériver THI d’une température seule ni de moyennes journalières inédites.
Ne pas transformer moyennes de diagnostics en risque territorial validé.
Règles blé réutilisables par cellule puis agrégation descriptive, statut exploratoire.
Pluie : cumul temporel par cellule puis moyenne spatiale, jamais somme spatiale.
Référence 1991–2020 préparée structurellement, aucun calcul 30 ans.

## Stockage / limitations initiales

Limite Free 500 MB confirmée via page tarifaire officielle le 17 octobre ; cible
375 MB (75%), alertes 300/375/450 MB. Projection à affiner après import géométrique
et mesures PostgreSQL locales : environ 64 170 lignes PRA/jour à 90 jours,
260 245 à un an, quatre variables par ligne partagée plutôt que par production.
Ne pas déclarer un budget mesuré à partir de cette estimation.

Le proxy refuse actuellement data.gouv.fr et supabase.com HTTP CONNECT 403.
Métadonnées PRA et documentation Supabase consultables via outil web, mais
polygones officiels pas encore acquis. Extension réseau demandée, sans contournement.
713 est le compte attendu officiel, pas un résultat d’import. Aucune géométrie
communautaire non vérifiée ne le remplace.
