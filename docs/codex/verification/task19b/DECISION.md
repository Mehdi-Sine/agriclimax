# Décision Task 19B

**READY_WITH_LIMITS — pilote réel DEV de 73 PRA ×7 jours validé.**
Cette décision permet de préparer l’extension ; elle ne lance pas les 30 jours
et n’autorise aucune publication climatique nationale ni ouverture publique nouvelle.

## Preuves et périmètre

- PR40 mergée dans main `ee92399c94156cf89d0ad6316c84c9af5e4b4a5e` ; branche
  `codex/19b-national-pilot` créée depuis cette base, sans nouvelle branche Supabase.
- Sélection reproductible de 73 PRA dans 13 régions, 1 892 poids source inchangés.
  Géométries identiques par WKB ; 713 contours et 14 541 poids source restent intacts.
- 27 acquisitions CDS réelles, 6,51 Mo ; sept jours UTC du 12 au 18 octobre,
  50 624 comparaisons natives indépendantes sans écart et 584 diagnostics vérifiés.
- Sur DEV : 73 lots, 511 journées et 584 diagnostics persistés, relus puis rejoués ;
  comptes et empreintes strictement inchangés. Aucun climat des 640 autres PRA.
- Les dix anciens snapshots daily gardent leur empreinte ; aucun DDL daily rejoué.
  Historique régularisé par métadonnées seulement, migration Task19 existante
  appliquée sans modification, alias distant documenté dans REAL_RUN.md.
- Contrôles locaux : **205 tests Python, 225 tests web**, lint, typage, build,
  garde secrets/migrations. Contrôles navigateur réels desktop/tablette/mobile,
  zéro violation AA détectée, disponibilité absente explicite. Le contrôle CI
  distant et Vercel doivent porter sur le SHA final de la PR draft.

## Limites scientifiques et géographiques conservées

56 PRA complètes, 16 partielles, Crozon indisponible sur les sept jours.
NULL et couverture/compteurs restent explicites ; aucune interpolation,
renormalisation trompeuse ou substitution par station. Le masque structurel
permanent n’est pas établi. Ces fréquences ne sont pas extrapolables aux 713 PRA
à partir d’un échantillon raisonné favorisant les cas difficiles.

Les omissions Marseille/Lyon restent des réserves d’emprise ; aucune exclusion
officielle supplémentaire n’est déduite ici. Millésime géométrique inconnu,
nomenclature Agreste 2017 distincte. Pas de contours réparés ou synthétiques.
L’acceptation limitée de ce pilote ne ferme pas par déduction la qualification
nationale de ces omissions.

Blé : métriques exploratoires existantes, pas un risque agronomique validé.
Bovins : THI territorial non supporté sans humidité/modèle grille validé.
ERA5-Land, stations Météo-France et démonstration restent distincts.
Fraîcheur historique stale, aucune prétention au live.

## Sécurité : portée précise du verdict

Les dix tables Task19 ont RLS activées et forcées ; anon/authenticated n’ont
aucun SELECT/INSERT et service_role n’a pas DELETE. Les quatre RPC sont
SECURITY INVOKER, réservés à service_role. Le driver refuse toute destination
Supabase autre que DEV pour persist/replay. Aucune clé serveur dans le client.

**L’audit global Supabase n’est pas entièrement vert.** L’extension PostGIS
préexistante dans public laisse `public.spatial_ref_sys` sans RLS et avec INSERT
accordé aux rôles clients. Ce constat de privilèges est réel, aucune écriture de
preuve n’a été tentée. Il exige un durcissement séparé avant une ouverture publique
supplémentaire ; aucune migration ni modification de droits hors Task19 n’a été
appliquée. Les RPC historiques SECURITY DEFINER publiques et les fonctions PostGIS
sont aussi signalées par le linter, sans modification dans cette PR.

Ce problème antérieur ne rend pas fausses les sorties du pilote (poids fixes,
contrôlés, aucune transformation SQL de ces calculs), ni ne donne accès aux tables
Task19. Il reste une réserve de sécurité **bloquante pour une nouvelle activation
publique**, pas une certification générale de la sécurité de DEV.
Références : [RLS désactivée](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public),
[extension publique](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[fonctions SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

Les FK sans index couvrant (dont certaines Task19) sont des avis de performance ;
aucun DELETE ni mise à jour des références n’est exécuté. La lecture date/variable
utilise l’index prévu. Aucun index ni migration ajoutés pour masquer un avis.

## Coûts et plateforme

DB DEV finale **31,18 Mo**, delta météo/diagnostics 1,10 Mo. Projection prudente
713×90 : **258,16 Mo** avec diagnostics hebdomadaires, **182,59 Mo** en conservant
les diagnostics pilotes sans en ajouter systématiquement ; sous cible 375 Mo,
avec réserves explicites. Ce n’est pas une charge nationale mesurée ni un SLA.
Recommandation Free : scalaires + provenance et diagnostics à la demande.
La fenêtre 90 jours n’installe aucune purge automatique.

Vercel : lectures bornées, mode pilote optionnel ; aucun calcul/acquisition CDS dans
les routes. GitHub Actions : CI uniquement, aucun nouveau cron ni backfill national.
Supabase : DEV uniquement, plan Free, aucun service payant ou branche payante créé.
Les quotas restants Vercel/Actions/egress du compte demeurent à vérifier avant
extension. Les 40 contours hors sélection issus de l’import arrêté restent sans
poids ni météo ; aucune purge destinée à présenter une base artificiellement propre.

## Suite préparée

[Plan 73 PRA ×30 jours](EXTENSION_30_DAYS.md) et
`config/pilots/pra73-30day-plan-v1.json` : quatre nouvelles fenêtres totalisant
23 jours, lot initial conservé. Contrôle indépendant multi-mois à compléter pour
la fin septembre avant exécution ; autorisation nouvelle période et revue des
quotas requises. Conditions d’arrêt, cas littoraux et retour arrière documentés.
713×30 reste une projection (180 jobs logiques avec ces fenêtres), non exécutée.

Aucun merge, aucune mutation production, aucun backfill national, aucune purge.
