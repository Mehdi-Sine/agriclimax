# INT-01 — Publication contrôlée et retour arrière

**PARTIAL. Aucun déploiement ni objet cartographique distant publié par cette tâche.**
Le déploiement du code ne publie ni carte candidate, ni article. Une revue du lot
cartographique n’approuve pas le texte IA. L’édition du 11 novembre reste expérimentale.

## 1. Examiner la PR et reproduire la recette sans services externes

Prérequis : Node ≥20.9, pnpm **10.x**, Chromium et les dépendances verrouillées du dépôt.
Depuis la racine :

```bash
pnpm install --frozen-lockfile --ignore-scripts
npm ci --prefix tests/e2e --ignore-scripts
mkdir -p work/int-01/preview
python - <<'PY'
import gzip, json, pathlib
root=pathlib.Path('work/int-01/preview')
data=gzip.decompress(pathlib.Path('docs/codex/INT-01/evidence/real-map-bundle.json.gz').read_bytes())
bundle=json.loads(data)
(root/(bundle['edition_id']+'.json')).write_bytes(data)
(root/'consultable-edition.json').write_bytes(pathlib.Path('docs/codex/INT-01/evidence/consultable-edition.json').read_bytes())
PY
NEXT_PUBLIC_SUPABASE_URL= SUPABASE_SECRET_KEY= \
AGRICLIMAX_MAP_PREVIEW_ENABLED=true \
AGRICLIMAX_MAP_PREVIEW_DIR="$PWD/work/int-01/preview" pnpm dev
```

Le chemin absolu est nécessaire car Next démarre dans `apps/web`. Les deux bindings
Supabase sont vides **pour ce processus local seulement**, afin d’établir une recette
sans réseau. Aucun secret n’est modifié. Ouvrir `http://localhost:3000/`, puis
`/cartes-du-jour`. Le bandeau **RECETTE / non publiées** doit être visible.
Les données et le texte sont ceux de l’édition réelle, pas une fixture inventée.
La date 10 novembre doit conserver son état sans carte, sans emprunter le lot du 11.

```bash
INT01_ORIGIN=http://localhost:3000 node tests/e2e/int01.mjs
```

Retirer les deux variables `AGRICLIMAX_MAP_PREVIEW_*` du processus pour tester l’état
normal sans publication. **Ne pas les définir sur Vercel en production.** Aucun lot
de `work/` n’est embarqué automatiquement dans un déploiement.

## 2. Préparer le lot à partir du stockage réel, en lecture seule

Utiliser les bindings Supabase existants dans un environnement serveur autorisé.
Ne pas mettre leur valeur dans une commande, un fichier versionné ou le navigateur.

```bash
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx \
  scripts/int01_maps.ts prepare \
  bdde45c62dc8d0df6e87687c6dfe81d4c392b9dea721158dc9e0751482497af5 \
  --out work/int-01/candidates
```

Sur l’environnement cloud, ajouter `NODE_USE_ENV_PROXY=1` avec Node qui le prend
en charge pour utiliser les bindings du proxy. Ne jamais désactiver TLS.
Le workflow manuel **INT-01 prepare edition maps (read-only)** exécute la même
commande, sans secret OpenAI ni étape de publication. Il produit seulement
`maps.json.gz` et le rapport dans Actions ; un artefact Actions ne vaut pas publication.

Vérifier les IDs, le checksum d’édition, le snapshot et les entrées gelées, les périodes,
les unités, les cycles, les couvertures et les raisons de NULL. La commande ne consulte
pas les API météo et ne recharge pas une couverture côtière plus récente. Le lot doit
se reproduire avec le même SHA :

`80245fade38bc42251720aa9ec602a092600fdbcd14c53605c05b8d7d5ae8cd6`

Ce SHA correspond à la recette du 11 novembre, pas à une autorisation de publication.

## 3. Revues humaines et déploiement du code

1. Reviewer la PR, la CI, les captures et les limites de [VALIDATION.md](VALIDATION.md).
   Fusion et déploiement Vercel nécessitent une décision humaine ; ils ne sont pas exécutés ici.
2. Vérifier les bindings serveur existants de la Preview puis de la production et
   l’accès **privé** au bucket `pra-climate-archives`. Aucune migration, nouveau bucket,
   clé publique élargie ou modification de RLS n’est requise.
3. Déployer le code revu. Avant toute publication de carte, l’API `/api/journal/maps?id=ID`
   doit indiquer `MAP_NOT_PUBLISHED` avec une liste vide. L’ancien article reste consultable.
4. Un reviewer nommé examine le lot exact. Les cartes sont des descriptions exploratoires,
   pas des risques de dommages. Il doit accepter explicitement les dates anciennes,
   les 68 NULL historiques, les six PRA corses partielles/non évaluables en historique,
   les réserves de masque prévisionnel et la fenêtre courte de deux jours.
5. Écrire **après cette revue** un fichier local `work/int-01/approval.json` contenant
   `bundle_sha256` exact, `reviewer` (identité humaine), `reviewed_at` (ISO UTC) et
   `scope: "descriptive_maps"`. Aucun fichier d’approbation prêt à publier n’est fourni.

Le contrôle existant `editorial_control.publication_enabled` est actuellement **false**.
Le publisher le respecte et respecte `emergency_stop`. Ne pas contourner ce contrôle.
L’administrateur décide séparément d’une fenêtre de publication supervisée, après
examen des autres traitements utilisant ce même commutateur. Ne pas l’activer juste
pour rendre une recette verte. La commande INT-01 ne modifie jamais ce contrôle.

## 4. Publication explicite des cartes uniquement — non exécutée ici

Seulement après autorisation humaine, contrôles précédents et code déployé :

```bash
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx \
  scripts/int01_maps.ts publish \
  bdde45c62dc8d0df6e87687c6dfe81d4c392b9dea721158dc9e0751482497af5 \
  --bundle work/int-01/candidates/bdde45c62dc8d0df6e87687c6dfe81d4c392b9dea721158dc9e0751482497af5.json \
  --approval work/int-01/approval.json \
  --expected-bundle 80245fade38bc42251720aa9ec602a092600fdbcd14c53605c05b8d7d5ae8cd6 \
  --execute
```

Le publisher relit l’édition et les entrées gelées vérifiées, **recalcule** le lot,
compare son empreinte au fichier revu et à l’argument, vérifie l’approbation et les
contrôles, puis insère le blob immuable et le manifeste. Il relit et vérifie le résultat.
Pas d’upsert, de nouveau texte, de promotion éditoriale, d’appel OpenAI ou de réécriture SQL.

Après un échec de transport, rejouer **la même commande et le même fichier de revue**.
Un blob sans manifeste n’est jamais visible. Les octets identiques ne sont pas réinsérés.
Un conflit refuse toute écriture de remplacement. Pour corriger un lot déjà publié,
préparer une nouvelle révision d’édition avec son propre identifiant.

## 5. Vérifications de visibilité

```text
GET /api/journal/maps?id=ID
GET /api/journal/maps?id=ID&map=MAP_ID
GET /journal?id=ID
GET /cartes-du-jour?id=ID&map=MAP_ID
```

Vérifier `status=published` dans le catalogue, `publication_state=published` dans les
données, même checksum d’édition et même SHA de lot sur les deux pages, ETag de la
carte, 713 contours, six PRA corses, 645 valeurs historiques et 68 NULL, légendes,
sources/cycles, sélection PRA et indicateur sur desktop/mobile. Les deux pages doivent
quitter le bandeau de recette. La certification éditoriale reste inchangée et visible.

Comparer l’inventaire des objets et tous les checksums d’archives avant/après : seuls
le blob et le manifeste du lot autorisé doivent être nouveaux. Aucun remplacement
de `catalogue.json`, `current.json`, `editorial-inputs/` ou ancienne édition.

## 6. Fraîcheur et exploitation des jours suivants

INT-01 ne rafraîchit pas une édition gelée avec des données acquises après coup.
Pour voir des observations J-1 ou des prévisions J+5/J+7 plus fraîches : revue et
actualisation #81, acquisition T36 persistée, contrôle des dates et de couverture,
puis préparation d’une **nouvelle** édition/révision. Conserver la précédente en cas d’échec.
Après chaque édition quotidienne existante, lancer `prepare ID` pour son lot, vérifier
la recette, puis approuver/publier séparément. Le nouveau workflow n’a aucun cron
et aucune publication automatique. L’autonomie de publication quotidienne reste
une dépendance d’exploitation tant que la politique de revue humaine est nécessaire.

Le lot actuel représente environ 1,5 Mo par édition, soit environ 0,55 Go/an à une
édition par jour, hors sources météo. Vérifier le quota avant d’activer cette cadence.
Les géométries et les entrées météo gelées ne sont pas recopiées dans les lots.

Une carte froide issue du 9 novembre peut être publiée comme carte **d’archive datée**
si la revue l’accepte ; elle ne remplit pas l’objectif de données nationales J-1.

## 7. Retour arrière

Avant la publication : retirer le déploiement INT-01 / revenir au déploiement Vercel
précédent, puis préparer une PR de revert du commit de code. Les candidats locaux
n’ont aucune visibilité de production.

Après publication : revenir au code précédent masque le complément nouveau, tout
en conservant les objets privés immuables et les éditions historiques. Ne supprimer
ni blob, manifeste, entrée de catalogue, revue, snapshot ou archive. Ne restaurer
aucune migration SQL. Une correction des données passe par une nouvelle révision,
pas par un rollback destructeur. Restaurer le contrôle de publication à l’état convenu
par l’administrateur après la fenêtre supervisée.

**Prochaine action pour voir une carte réelle en production :** revue de cette PR et
du lot réel, déploiement contrôlé, puis publication manuelle du manifeste exact selon
les étapes 3–5. Pour obtenir une carte **fraîche**, traiter d’abord #81 et la nouvelle édition.
