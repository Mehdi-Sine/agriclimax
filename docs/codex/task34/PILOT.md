# Recette pilote réelle T34

Acquisition réelle : 2026-11-08T17:49:51.820496+00:00 (UTC). Branche de départ `c837fcd`, DATA-01 inclus. Commande :

```sh
python scripts/task34_news.py --output work/task34/archive-final \
  --events docs/codex/agro01/evidence/journal.json \
  --bundle work/task34/pilot-bundle.json
```

Le bundle réel est conservé sous `evidence/pilot-bundle.json.gz` (JSON UTF-8 gzip). Aucune fixture dans ces résultats. Les URL originales, auteurs disponibles, dates, preuves lexicales et limitations figurent dans le bundle. Le JSON Schema est fourni dans ce dossier. `evidence/source-verification.json` conserve URL, statut, taille, empreinte et extraits courts des vérifications d’accès et de droits.

## Volumes et disponibilité

| Source | État | Publications | Contexte utile | Rejet lexical | Octets (robots inclus) | Secondes |
|---|---|---:|---:|---:|---:|---:|
| draaf-auvergne-rhone-alpes | ok | 20 | 1 | 19 | 18157 | 6.453 |
| draaf-grand-est | ok | 20 | 3 | 17 | 18644 | 3.101 |
| draaf-paca | ok | 20 | 1 | 19 | 15324 | 1.214 |
| draaf-hauts-de-france | ok | 20 | 2 | 18 | 17056 | 1.106 |
| draaf-bretagne | ok | 20 | 4 | 16 | 25348 | 2.074 |
| draaf-nouvelle-aquitaine | ok | 20 | 3 | 17 | 27257 | 3.062 |
| draaf-grand-est-bsv | ok | 10 | 3 | 7 | 30738 | 3.049 |
| ifv | disabled | 0 | 0 | 0 | 0 | 0.0 |
| terre-net | disabled | 0 | 0 | 0 | 0 | 0.0 |
| reussir | disabled | 0 | 0 | 0 | 0 | 0.0 |

130 publications uniques ; 17 de contexte, 0 de pertinence haute, 113 rejets lexicaux. « Utile » désigne un contexte documentaire à relire, pas un fait agricole confirmé. 6 doublons/republications potentielles. Les sources désactivées ne sont pas contactées par le batch ; leur accessibilité a été vérifiée séparément pendant l’inventaire.

## Exemples classés réellement acquis

- [Impacts forestiers du stress hydrique en cours dans le Grand Est](https://draaf.grand-est.agriculture.gouv.fr/impacts-forestiers-du-stress-hydrique-en-cours-dans-le-grand-est-a5028.html?mtm_campaign=rss-actus), publié 2026-08-13 : `context`, productions inconnues, régions ['Grand Est'], phénomènes ['heat', 'dry'].
- [Mois de la bio 2026 : des rencontres professionnelles pour adapter les fermes au dérèglement climatique](https://draaf.nouvelle-aquitaine.agriculture.gouv.fr/mois-de-la-bio-2026-des-rencontres-professionnelles-pour-adapter-les-fermes-au-a4462.html?mtm_campaign=rss-actus), publié 2026-10-28 : `context`, productions inconnues, régions ['Nouvelle-Aquitaine'], phénomènes inconnus.
- [Le Plan Climat • Adaptation • Sécheresse • Incendies présenté par le ministère en charge de l'agriculture](https://draaf.hauts-de-france.agriculture.gouv.fr/le-plan-climat-o-adaptation-o-secheresse-o-incendies-presente-par-le-ministere-a5301.html?mtm_campaign=rss-actus), publié 2026-09-10 : `context`, productions inconnues, régions inconnues, phénomènes ['dry'].
- [L'État renforce son soutien face à la canicule et aux incendies](https://draaf.paca.agriculture.gouv.fr/l-etat-renforce-son-soutien-face-a-la-canicule-et-aux-incendies-a4913.html?mtm_campaign=rss-actus), publié 2026-08-06 : `context`, productions inconnues, régions inconnues, phénomènes ['heat'].
- [Situation sanitaire de l'épicéa commun et du sapin en Grand Est : des attaques de scolytes à expertiser](https://draaf.grand-est.agriculture.gouv.fr/situation-sanitaire-de-l-epicea-commun-et-du-sapin-en-grand-est-des-attaques-de-a5054.html?mtm_campaign=rss-actus), publié 2026-10-03 : `context`, productions inconnues, régions ['Grand Est'], phénomènes ['heat', 'dry'].
- [BSV Horticulture-pépinières 2026](https://draaf.grand-est.agriculture.gouv.fr/bsv-horticulture-pepinieres-2026-a4850.html?mtm_campaign=rss), publié 2025-12-19 : `context`, productions inconnues, régions inconnues, phénomènes inconnus.
- [Productions fourragères 2025 - La production des prairies et du maïs diminue](https://draaf.bretagne.agriculture.gouv.fr/productions-fourrageres-2025-la-production-des-prairies-et-du-mais-diminue-a3942.html?mtm_campaign=rss-actus), publié 2026-06-18 : `context`, productions ['maize', 'grassland'], régions ['Bretagne'], phénomènes inconnus.
- [Écoute, soutien et accompagnement : les solutions qui existent](https://draaf.nouvelle-aquitaine.agriculture.gouv.fr/ecoute-soutien-et-accompagnement-les-solutions-qui-existent-a4453.html?mtm_campaign=rss-actus), publié 2026-10-20 : `context`, productions inconnues, régions inconnues, phénomènes ['heat', 'dry'].

Les publications BSV de la rubrique Grand Est sont datées par le flux parfois de décembre 2025 alors que leur titre porte 2026. Cette date est conservée, sans la remplacer par le millésime ou une date supposée de mise à jour du PDF. Les PDF ne sont pas téléchargés. Des actualités météorologiques forestières restent du contexte, sans production agricole inventée.

## Rapprochements avec les événements archivés

Archive réelle inchangée : `docs/codex/agro01/evidence/journal.json`, empreinte `3cebcc9ed9f01f7b01351344557ffda9529187b334f538cbb831808194ad68cc`. 27 événements du Journal/Veille, périodes du 8 au 14 novembre 2026, provenant d’un cycle prévisionnel. L’adaptateur conserve leurs identités et provenance ; il ne recalcule aucun signal.

**0 rapprochement dans la fenêtre de 14 jours.** Aucun résultat positif contemporain n’est fabriqué. Le corpus actuellement disponible ne démontre donc pas un cas réel de concordance complète des cinq axes. Les cas positifs et négatifs des cinq axes sont testés uniquement sur fixtures signalées comme telles.

**7 rapprochements de contexte à 15–30 jours**, dans `background_links`, séparés des rapprochements contemporains. Ce sont des candidats de contexte saisonnier, avec localisation et production souvent inconnues. La date de publication ne prouve pas la date d’un phénomène, et la publication évoque l’été : aucun même épisode ni lien causal avec novembre n’est établi.

| Publication réelle | Événement réel archivé | Distance en jours | Géographie | Production |
|---|---|---:|---|---|
| Écoute, soutien et accompagnement : les solutions qui existent | `event-0825ab20af66a3ebb5514223` | 19 | unknown | unknown |
| Écoute, soutien et accompagnement : les solutions qui existent | `event-0ef65de52960af113d1816ea` | 19 | unknown | unknown |
| Écoute, soutien et accompagnement : les solutions qui existent | `event-2a3977f16cf005a61c3c2614` | 19 | unknown | unknown |
| Écoute, soutien et accompagnement : les solutions qui existent | `event-65959635af8858461f446913` | 19 | unknown | unknown |
| Écoute, soutien et accompagnement : les solutions qui existent | `event-752943d875fe67407ea6ed36` | 19 | unknown | unknown |
| Écoute, soutien et accompagnement : les solutions qui existent | `event-8bcbe10100b157ad16630ad6` | 19 | unknown | unknown |
| Écoute, soutien et accompagnement : les solutions qui existent | `event-c0aa90a7aad8ba5aea5bbfb9` | 19 | unknown | unknown |

Chaque lien conserve `scientific_confirmation: false`. Aucun dommage n’est imputé aux PRA.

## Rejets réels et limites

- [Enquêtes Cheptels de novembre 2026](https://draaf.grand-est.agriculture.gouv.fr/enquetes-cheptels-de-novembre-2026-a5069.html?mtm_campaign=rss-actus) : aucun indice agroclimatique suffisant dans les métadonnées autorisées.
- [Mémento 2026](https://draaf.auvergne-rhone-alpes.agriculture.gouv.fr/memento-2026-a6741.html?mtm_campaign=rss-actus) : aucun indice agroclimatique suffisant dans les métadonnées autorisées.
- [La DRAAF PACA renforce son attractivité et ses recrutements](https://draaf.paca.agriculture.gouv.fr/la-draaf-paca-renforce-son-attractivite-et-ses-recrutements-a4903.html?mtm_campaign=rss-actus) : aucun indice agroclimatique suffisant dans les métadonnées autorisées.
- [Financer les collectifs agroécologiques (Groupes Écophyto 30 000 et Émergence, GIEE et Émergence)](https://draaf.bretagne.agriculture.gouv.fr/financer-les-collectifs-agroecologiques-groupes-ecophyto-30-000-et-emergence-a2645.html?mtm_campaign=rss-actus) : aucun indice agroclimatique suffisant dans les métadonnées autorisées.
- [Bilan provisoire des foyers de flavescence dorée de la vigne en région PACA](https://draaf.paca.agriculture.gouv.fr/bilan-provisoire-des-foyers-de-flavescence-doree-de-la-vigne-en-region-paca-a4945.html?mtm_campaign=rss-actus) : aucun indice agroclimatique suffisant dans les métadonnées autorisées.
- [VetsupAgri : 60 lycéens à la découverte des métiers d'ingénieur et de vétérinaire à Limoges](https://draaf.nouvelle-aquitaine.agriculture.gouv.fr/vetsupagri-60-lyceens-a-la-decouverte-des-metiers-d-ingenieur-et-de-veterinaire-a4458.html?mtm_campaign=rss-actus) : actualité d’orientation scolaire sous la pluie ; « mais » n’est pas le maïs. Ce faux positif découvert au pilote a été corrigé et testé.

Le rejet est lexical et réversible : il ne signifie pas que l’article complet serait dépourvu d’intérêt. Le moteur n’en dispose pas.

## Mesures

152524 octets reçus (flux et robots), 20.059 secondes cumulées de collecte ; 314571 octets JSON, 44585 octets gzip pour l’export de revue. Objets documentaires nouveaux : 118723 octets gzip ; reçu : 13933 octets. Rejeu local du même bundle : 0 nouvel octet documentaire, sans accès réseau et sans mutation des archives météo. Les métriques décrivent ce pilote, pas un engagement de performance des sites tiers.
