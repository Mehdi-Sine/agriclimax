# AGRO-04 · Territorialisation des situations agroclimatiques

La prévisualisation croise les preuves météo qualifiées avec les profils agricoles par PRA et une fenêtre de l’Almanach. Le Journal reçoit jusqu’à trois situations structurées. La priorité est donnée aux groupes régionaux comptant le plus de PRA admissibles, avec une PRA représentative par groupe météo, date et nature. Ce classement porte sur la diffusion géographique du signal, sans pondération par les surfaces ou les effectifs. La carte ouvre directement la PRA, le jour UTC et, pour la prévision, le bulletin archivé par son empreinte.

## Référentiels réutilisés

| Référentiel | Millésime et échelle | Usage et qualité |
| --- | --- | --- |
| RPG IGN, intersection géométrique existante en EPSG:3035 | 2025, PRA | Sommes de surfaces déclarées de céréales, oléagineux et légumineuses (groupes 1–8, 14, 15), vigne (21), vergers (20), prairies et fourrages (16, 18, 19). Les groupes positifs sont ordonnés par hectares dans le périmètre présenté. L’ordre est indicatif si la couverture est incomplète. Les surfaces gelées, estives et landes, fruits à coque, oliviers et groupes hétérogènes sont hors de ce classement. |
| Agreste RA OTEX et BPA élevage expérimental, Supabase | 2020, grille de 10 km rapportée aux PRA | Présence de codes distincts associés à des points échantillonnés dans 675 PRA. L/V/B pour bovins lait/viande/mixtes, O pour ovins/caprins, P pour granivores. Les 38 PRA sans point restent non renseignées. Les orientations ne représentent ni la taille ni la localisation actuelle des cheptels. |
| BPS systèmes expérimentaux, Supabase | RPG 2025 et OTEX 2020, bassins de PRA | Empreinte et identifiant de bassin conservés pour le rapprochement avec le référentiel. La typologie expérimentale et les imputations ne servent pas à attribuer une production à une PRA. |
| OFB–MASA | PRA 2017, version du 17 octobre 2026 | Référentiel territorial identique aux 713 identifiants de la veille nationale, dont six corses. |
| Archives climatiques vérifiées | Jour UTC, ERA5-Land et prévisions sélectionnées | Adaptateur temporel pour la réanalyse et détecteur qualifié de la veille pour les prévisions. Provenance, nature, version de règle et fraîcheur sont transmises. |
| Almanach | Fenêtres et références techniques versionnées | Le contexte saisonnier sert à décider si la question mérite d’être posée. Le stade reste à vérifier localement. |

La SAA du dépôt est auditée comme référentiel départemental et régional. Les surfaces et effectifs SAA restent consultables à ces échelles. La table Supabase `public.productions` était vide lors de l’audit. Les données BPA/BPS sont versionnées dans le schéma privé `agriclimax_private`. L’export dérivé conserve les codes observés et le bassin BPS, issus de la requête de lecture suivante.

```sql
with points as (
  select pra_code, string_agg(distinct otex, '' order by otex) as codes
  from agriclimax_private.bpa_elevage_experimental_grid
  where release_id = 'bpa-elevage-otex2020-rpg2025-exp-01'
  group by pra_code
)
select b.pra_code, coalesce(p.codes, ''), b.bassin_id
from agriclimax_private.bps_systems_experimental_pra b
left join points p using (pra_code)
where b.release_id = 'bps-vegetal-animal-rpg2025-otex2020-v0-20261121'
order by b.pra_code;
```

L’export est figé dans `apps/web/data/agriculture/agro04-otex.json`. Sa provenance est aussi dans le [rapport du rejeu](evidence/report.json). Le calcul ne requiert aucune collecte agricole supplémentaire ni accès direct du navigateur aux tables privées.

## Matrice de première réalisation

| Phénomène et critère météo | Production | Fenêtre indicative, conditions et limites |
| --- | --- | --- |
| Précipitations strictement supérieures à 20 mm sur un jour UTC | Céréales, oléagineux et légumineuses | Toute l’année, si une intervention est prévue. Le ressuyage dépend notamment du sol et du drainage. Le seuil météo est descriptif. [Almanach ALM-005, ARVALIS](https://www.arvalis.fr/infos-techniques/risque-graminees-en-cereales-paille-mieux-vaut-attendre-pour-semer) |
| Tmin strictement inférieure à 0 °C | Vigne | 10 mars–30 avril. Vérifier le débourrement, le relief et la température au niveau de la végétation. [Almanach ALM-021, IRQUALIM](https://www.irqualim.fr/wp-content/uploads/2025/05/250407_guide_vins_IRQUALIM_A4_Web-1.pdf) |
| Tmin strictement inférieure à 0 °C | Vergers | 15 mars–31 mai. Sensibilité variable selon l’espèce, le microclimat et le stade des bourgeons et fleurs. [Almanach ALM-025, CTIFL](https://www.ctifl.fr/prevoir-les-dates-d-apparition-des-stades-phenologiques-du-pommier-infos-ctifl-360) |
| Tmax strictement supérieure à 25 °C | Bovins, orientation échantillonnée | 15 mai–15 septembre. Repérage thermique à confiance indicative, à interpréter avec l’humidité, la durée, la ventilation, l’accès à l’ombre et les conditions d’élevage. [Almanach ALM-039, Idele](https://idele.fr/aclimel/publications/detail-article?cHash=445d520b64229ec667742381f922cd7c&tx_atolidelecontenus_publicationdetail%5Baction%5D=showArticle&tx_atolidelecontenus_publicationdetail%5Bcontroller%5D=Detail&tx_atolidelecontenus_publicationdetail%5Bpublication%5D=25794) |

Les fenêtres sont des repères saisonniers. Une cellule climatique qualifiée à l’échelle PRA reste distincte des conditions dans la parcelle ou le bâtiment. Les règles produisent des sensibilités potentielles et des motifs d’abstention. La mesure des dommages nécessite des observations spécifiques.

## Rejeu, exemples et interface

Le [fichier national](evidence/territoires.json.gz) contient les profils des 713 PRA, les **5 704 évaluations** correspondant à deux dates/natures et quatre règles, les situations et leur sélection éditoriale. Le [rapport](evidence/report.json) publie les identifiants, empreintes et mesures. La [simulation avant](evidence/edition-avant.json) et la [simulation après](evidence/edition-apres.json) utilisent la même rédaction déterministe et le même dossier climatique. Le titre, le chapeau et la structure éditoriale existante restent disponibles. La rubrique s’affiche uniquement quand une sélection admissible existe.

| Cas | Résultat du rejeu |
| --- | --- |
| Grandes cultures, Beauce Dunoise (`pra:28341`) | 27,0 mm prévus le 22 novembre, avec surfaces RPG déclarées. Vérification du ressuyage à envisager si une intervention est prévue. |
| Élevage, Plateau de Millevaches (`pra:87430`) | Orientation bovins viande dans l’échantillon OTEX et profil RPG dominé par prairies et fourrages parmi les groupes étudiés. La situation retenue concerne les interventions sur les parcelles de grandes cultures, avec 43,5 mm prévus. |
| Gel, `pra:04460` | Tmin de −4,3 °C en réanalyse le 15 novembre. Hors fenêtre de sensibilité de la vigne et des vergers, aucune situation agricole associée. |
| Vigne et Corse, Coteaux corses (`pra:2A259`) | 720,5 ha de vigne déclarés au RPG. Couverture de réanalyse insuffisante le 15 novembre. Tmin prévue de 4,8 °C le 22 novembre. |
| Littoral, Presqu’île de Crozon (`pra:29102`) | Réanalyse insuffisante et aucun point OTEX. Le code BPS est conservé sans attribution d’élevage. |
| Chaleur estivale | Mécanisme et abstention testés sur un scénario contrôlé à 31 °C avec contexte bovin, ainsi que sur un scénario sans point OTEX. Les dates opérationnelles rejouées ne franchissent pas le seuil bovin. |

Le rejeu utilise le bulletin du 21 novembre 2026 à 18 h UTC. En prévision du 22 novembre, le seuil de pluie est franchi sur 303 PRA et 299 donnent une situation potentielle avec contexte RPG. La réanalyse du 15 novembre compte 645 PRA qualifiées par règle et 68 insuffisantes. Les sorties de novembre ne justifient aucune rubrique gel ou chaleur.

## Coût, archivage et activation

```bash
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/agro04_replay.ts 2026-11-22
```

Le rejeu lit le Storage existant avec les variables de connexion habituelles et écrit dans `work/agro04/<date>/`. En environnement avec proxy, transmettre également `--use-env-proxy` dans `NODE_OPTIONS`. Le rapport mesure le croisement à index agricole chargé et compare les tailles du dossier. La réservation EUR est une simulation avec les tarifs de configuration par défaut, avec une borne prudente en octets et sans facture OpenAI. Le chemin de génération réutilise le dossier de l’appel unique. Les plafonds d’archive EDIT-07 restent à 8 Mio gzip et 128 Mio décodés. Le champ de surveillance reste borné à trois entrées et figure uniquement dans le dossier éditorial de prévisualisation.

`AGRICLIMAX_AGRO04_PREVIEW=true` active le croisement dans une préparation **en lecture seule**. Le snapshot produit porte `test_only` et la génération opérationnelle rejette ce champ. Pour visualiser les simulations, indiquer le dossier `avant` ou `apres` via `AGRICLIMAX_AI_PREVIEW_ARCHIVE_DIR` et ouvrir `/journal/preview`. Aucune migration ou écriture Supabase. Le manifeste des sources EDIT-07 et les archives déjà publiées sont conservés.

## Données manquantes pour élargir la couverture

- OTEX observées dans 38 PRA non échantillonnées et inventaires récents d’effectifs par PRA pour les filières animales, avec anonymisation adaptée.
- Cultures maraîchères et spécialisées détaillées par PRA. Les agrégats hétérogènes du RPG et la SAA ne suffisent pas à une attribution précise.
- Stade réel, variété, calendrier de travaux, irrigation, humidité et réserve utile des sols, drainage, pratique de pâturage, ventilation et ombre, selon la production.
- Séries T/RH compatibles et représentatives pour un THI qualifié, références de sécheresse fourragère contextualisées et observations de dégâts pour valider un diagnostic.
- Rejeu printemps/été sur des archives homogènes qualifiées pour documenter des cas positifs réels de gel en fenêtre sensible et de chaleur bovine.

## Vérifications

- Scénarios contrôlés Vitest pour l’exclusion du support côtier incomplet, le gel de printemps et hors fenêtre, le repérage thermique bovin estival et l’abstention sans échantillon OTEX.
- Test de l’API de veille pour la sélection d’un seul jour d’archive, avec empreinte de bulletin et validation des paramètres.
- Vérification des deux dossiers et des deux archives éditoriales avec les validateurs applicatifs. Le rejeu n’a effectué aucun appel OpenAI. Le dossier envoyé au comité passe de **40 424 à 45 191 octets**, soit environ **575 octets gzip** supplémentaires lors du rejeu. Réservation indicative **0,089944 € → 0,095465 €**, sous le plafond de simulation de 0,15 €.
- Chromium, carte et profil de Millevaches, sélection exacte du jour, retour à l’identifiant de l’édition et contrôle de débordement à 390 px. [Journal avant](evidence/journal-avant.png) · [Rubrique après](evidence/journal-apres.png) · [Carte et fiche PRA](evidence/carte-profil.png) · [Mobile](evidence/journal-mobile.png)

Le croisement national à chaud a pris environ **0,53 s** pendant la recette. Sur le serveur de développement, la première lecture de la carte archivée a pris environ **7 s** avec téléchargement et qualification du bulletin depuis Storage. Deux lectures avec cache chargé ont pris **0,13 s** et **0,05 s**. Le profil agricole de Millevaches a répondu en **0,11 s** pour **777 octets**. Ces mesures locales ne représentent pas un engagement de latence en production.
