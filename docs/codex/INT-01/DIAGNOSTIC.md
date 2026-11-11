# INT-01 — Diagnostic de la chaîne, 11 novembre 2026

**PARTIAL.** L’édition réelle est consultable en production mais reste expérimentale,
non certifiée et sans carte. Les acquisitions, les cartes de recette et la publication
éditoriale sont des étapes distinctes. Aucun déploiement, appel OpenAI, changement de
secret ou écriture distante n’a été effectué pendant INT-01.

Base vérifiée : `main` **4c538492c63868d70ea79fb5c57c1bf93de82cd2**, fusion #80.
Le checkout initial était au merge #71 ; il n’a pas servi de base à l’implémentation.
Branche : `codex/int-01-journal-maps-operational`.

## Sources de preuve

- Lectures SQL du projet `agriclimax-dev`, `yyfbpecxvxglzxopsmel`, tables privées et
  inventaire Storage : [audit-before.json](evidence/audit-before.json).
- Lecture HTTP anonyme de l’application déployée : [production-before.json](evidence/production-before.json).
  L’ID et le checksum de l’édition concordent avec Supabase. La configuration interne
  Vercel n’a pas été modifiée ni présumée identique à celle du workspace.
- [Archive publique réelle, révision 2](evidence/consultable-edition.json), sans reçu fournisseur privé.
- [Rapport OPS-04 effectivement téléchargé](evidence/ops04-report.json).
- [Dernier contrôle Météo-France effectivement téléchargé](evidence/station-health.json).
- [Lot candidat exact](evidence/real-map-bundle.json.gz) et [catalogue](evidence/candidate-report.json).
  Ce sont des sorties de recette INT-01, **pas des objets publiés dans Supabase**.

## Chaîne avant INT-01

| Étape | Responsable et contrat | Observation effective / rupture |
|---|---|---|
| Stations quotidiennes | `scripts/ingest_weather.py`, `agriclimax.ingestion.meteofrance`, `agriclimax.daily` ; workflows stations/T36 ; `station_weather_batches` | 250 lots DPClim, dernière validité **24 octobre**, dernière acquisition 25 octobre. Tentative 4–10 novembre en échec de validation, `ValueError`. Un catalogue accessible ne rajeunit pas ces lots. |
| Échantillons récents | même ingestion, produit DPObs distinct | 15 lots, dernier échantillon **11 novembre**, acquis à 04:00:59 UTC. Drapeau `recent_sample_not_daily_aggregate`. Ne constitue pas une observation quotidienne nationale J-1. |
| ERA5-Land | `scripts/era5_archive_daily.py`, moteur territoires ; T36 acquire/era5 ; bucket privé `pra-climate-archives` | Dernière archive réelle **4 novembre**, 713 enveloppes, 231 265 octets, SHA `38767b02…88e078`, persistée le 11 à 03:21 UTC. Limite opérationnelle J-7 conservée. La table historique `pra_daily` s’arrête au 30 octobre : elle ne représente pas l’état du circuit Storage. |
| AROME/ARPEGE/IFS | `national_weather.py`, `national_weather_run.py`, `operational_weather_pilot.py`, `national_weather_sources.py` ; T36 acquire/forecast ; archive `pra-weather-1` | Dernier objet persistant `weather/6d8255cb…cc1e43.json.gz`, acquis **9 novembre à 19:01:50 UTC**. Archive conservée après l’échec suivant. |
| Sélection des prévisions | `weather-archives.ts`, `national-watch.ts`, `nightly_prepare.ts` | Snapshot du 11 : ARPEGE émis le 9 à 12Z pour les 11–12 ; IFS du 9 à 00Z pour les 13–16. `fallback_valid`. Pas de nouvel objet national du 11 dans le bucket audité. |
| Calculs descriptifs | `multiproduction/registry.ts`, `engine.ts`, adaptateurs `archives.ts`, règles de couverture CORE-01 | Réutilisables, mais les sorties OPS-04 sont locales. Pas de table ou manifeste opérationnel associant ces cartes à l’édition déployée. |
| Carte historique de veille | `journalMapData`, `Illustration`, `JournalPraMap`, `NationalMap` | Chemin existant pour cinq phénomènes de prévision. Les candidats du dossier courant sont historiques ; les cartes génériques AGRO ne peuvent pas être glissées dans ce contrat de prévision. |
| Gel des entrées | `nightly_prepare.ts`, `immutable-inputs.ts`, RPC `agriclimax_editorial`, `editorial_snapshots` | Snapshot `2e9ed6d0…d8446e`, gelé le 11 à 08:33:39 UTC, historique 19 octobre–4 novembre. Entrées exactes `editorial-inputs/d2c7f1cd…f3892.json.gz`, 5 390 367 octets. |
| Génération éditoriale | `generate-operational.ts`, `archiveOperationalResult`, T36 editorial | `editorialPayload(b)` reçoit zéro carte ; validation avec `[]` puis **`illustrations: []` systématique**. La génération ne peut donc fournir de cartes sélectionnables. Réparer l’affichage seul ne suffit pas. |
| Persistance de l’édition | `SupabaseEditorialStore`, `editorial_archives`, `editorial_runs` | Cinq archives auditées, toutes à **zéro illustration**. Révision 2 du 11 : `bdde45c6…497af5`, checksum `c6c253b5…60af3c1`, `needs_editorial_review`. Aucune réécriture nécessaire pour lui ajouter un complément cartographique indépendant. |
| Revue et publication | `editorial_reviews`, `editorial_publications`, `promoteEdition` | **Zéro publication certifiée**, `publication_enabled=false`, `emergency_stop=false`. Une édition consultable n’est pas une édition approuvée. |
| Lecture Next.js | `operationalEditions`, archive publique de secours, `/api/journal/edition`, `/api/journal/edition-map` | Le Journal expose des archives expérimentales compatibles, y compris via copie publique contrôlée. Son API renvoie le 11 novembre avec la vraie ancienneté, `scientifically_validated=false`, zéro carte. |
| Journal / Cartes du jour | `EditorialPreview`, `DailyMapsCarousel`, routes `/journal` et `/cartes-du-jour` | Filtrent `illustrations` par `draft.illustration_ids`, deux listes vides. L’absence affichée est correcte ; aucune carte de test ne doit être substituée automatiquement. |

## Runs et artefacts examinés

| Run | Résultat vérifié | Ce qu’il ne prouve pas |
|---|---|---|
| [T36 43027346462](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43027346462), 13:14 UTC | Artefact `13858695081`, ZIP 215 octets, téléchargé : `command=report`, `status=fallback_valid`. | Ni acquisition, ni carte, ni publication nouvelle. |
| [T36 manuel 42991464483](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42991464483), 09:00 UTC | Logs du job `130425256093` : `STAGE: report`, même reçu. | Le succès manuel ne signifie pas un rafraîchissement météo. |
| [Acquisition 42956329780](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42956329780), 04:00 UTC | Forecast et stations échouent ; observations réussissent. ZIP forecast `13826474377` téléchargé : HTTP **404 d’index IFS** dans `operational_weather_pilot.py`, puis `CalledProcessError`. Ancienne publication préservée. | Ce n’est pas une preuve de 403 Météo-France. |
| [Stations 43036193886](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43036193886), branche MF-01 | Artefact `13863172650` téléchargé : DPClim v1, DPObs v1, catalogues AROME/ARPEGE accessibles ; DPObs v2 403/900908. `database_writes=0`, `data_freshness_verified=false`. | Aucune persistance nationale fraîche. |
| [MF-01 national 43033573529](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43033573529) | Rapport #81 et ses preuves versionnées : cycle du 11 à 06Z, acquisitions locales, dont IFS J+7. | Données non publiées ; elles ne remplacent pas le gel du Journal courant. |
| [OPS-04 43023425215](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43023425215) | ZIP `13855269707`, SHA ZIP `09a6903f…143e4`, téléchargé et ouvert : **92 690 mesures, 40 cartes**, réanalyse 29 octobre–4 novembre, prévision 11–12 novembre, `dry-run`, `openai.calls=0`, `publication=not_requested`. | Une présence dans Actions n’est pas une publication accessible par Vercel. |

Les artefacts autrefois signalés 403 dans #80 ont été accessibles dans cette session.
Cette nouvelle lecture est une preuve distincte ; l’historique de #80 n’est pas réécrit.

## Correction INT-01

Un complément cartographique **descriptif** est lié à l’ID **et au checksum** de
l’édition, au snapshot et à l’empreinte des entrées. Il réutilise cinq recettes
existantes, sans changer les formules, seuils, fenêtres scientifiques ou critères
de couverture. Les cartes historiques reposent uniquement sur les lignes natives
gelées ; aucune restauration côtière publiée ultérieurement n’est consultée.
Les cinq autres cartes utilisent la fenêtre prévisionnelle homogène de deux jours
déjà disponible. La différence entre période de carte et période d’article est affichée.

Les cartes ne modifient ni le texte, ni `draft.illustration_ids`, ni les checksums
historiques. Elles disposent de leur propre publication contrôlée. Le Journal et
les Cartes du jour lisent le même catalogue et les mêmes octets via `/api/journal/maps`.
Le fichier géographique officiel simplifié existant est partagé, sans duplication
par carte ou édition. Les anciens `Illustration` restent lisibles.

Dans le bucket privé existant, la procédure future insère un blob gzip adressé par
son SHA, puis un petit manifeste immuable `edition-maps/ID/CHECKSUM/publication.json`
portant l’approbation du lot exact. Pas d’upsert, de DELETE, de migration ou de bucket
public. La visibilité est la dernière insertion atomique ; reprise après interruption
et concurrence vérifiées avec un stockage isolé. Un lot différent nécessite une
nouvelle révision d’édition, jamais l’écrasement d’un manifeste déjà publié.

**Aucun de ces objets n’a été écrit à distance par INT-01.** Le lot réel de recette
occupe environ 1,5 Mo gzip pour dix cartes. Il conserve les 68 NULL historiques,
dont les PRA corses et le littoral mal couvert ; 713 valeurs prévisionnelles selon
les règles actuelles ne signifient pas qualification terrestre indépendante.

## Limites restantes

Observations nationales J-1, prévision homogène qualifiée J+5/J+7, couverture côtière
et revue éditoriale ne sont pas acquises par cette PR. Les sources plus fraîches
de #81 nécessitent leur intégration et une acquisition persistée, puis **une nouvelle
édition ou révision explicitement préparée**, sans remplacement silencieux du gel.
Le succès de la CI ne peut lever ces réserves. Voir [RELEASE.md](RELEASE.md).
