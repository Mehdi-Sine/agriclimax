# Reproduction bornée, sans acquisition ni publication

## Recalcul natif

Le checkpoint GitHub conservé est l'artefact `14142890041` du run `43665661543` de `Mehdi-Sine/agriclimax` : SHA `6967d31fac70d5345d6e74a4801def795e23b5d3673872a04fbb3935cbabb6b2`, 90 641 402 octets. Ne pas déclencher de workflow ni de collecte.

```bash
PYTHONPATH=engine/src:scripts python scripts/couv05d_native.py \
  --checkpoint work/couv05-checkpoint.zip --output work/couv05d-numeric
cd apps/web
COUV05D_NUMERIC_DIR=/chemin/absolu/work/couv05d-numeric \
  node_modules/.bin/vitest run lib/server/forecast-residuals.real.test.ts
```

Le rejeu réutilise `couv05_replay`, observe `capture_native` avant agrégation et impose zéro connexion réseau. Chaque capture doit être strictement identique à sa preuve COUV-05. Les réductions originales sont comparées exactement. Seuls les 1 185 cas résiduels alimentent les nouvelles valeurs : intersections des cellules valides de toutes les variables et dates, poids certifiés inchangés, moyennes normalisées sur ce seul support, unités des réducteurs conservées. Les entrées manquantes produisent NULL.

Les THI conservent la synthèse existante de Tmoy et RHmoy territoriales compatibles, puis l'opérateur temporel de la recette ; aucune moyenne spatiale de THI cellulaire n'est substituée. Les formules et seuils sont contrôlés par le catalogue exact et une vérification arithmétique indépendante.

Le test lit par défaut les entrées compactes conservées dans `docs/codex/COUV-05D/evidence`, sans checkpoint ni réseau. L'option d'environnement sert à écrire un nouveau rapport local. Il vérifie aussi le refus NULL après retrait d'une entrée temporelle, et le refus de peinture partielle sans géométrie d'identité correspondante.

## Persistance existante en lecture seule

```bash
PYTHONPATH=engine/src:scripts python scripts/couv05d_storage.py --output work/couv05d-store
```

Nécessite les variables Storage existantes côté serveur. Le transport est construit avec `read_only=True` : GET uniquement, aucun upsert ni DELETE. Il relit trois archives successives et tous les objets de l'index COUV-05, vérifie tailles et SHA, conserve les copies localement et compare `catalogue.json` et `current.json` avant/après. Le décompte des index a aussi été vérifié par SELECT sur `storage.objects`.

## Parcours produit réels

Préparer la recette avec le script existant, qui ne génère aucun texte et n'effectue aucune publication :

```bash
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/int01_maps.ts \
  prepare 6e625f034fc43ff35021c71722766a768af71566be3edd7db58af6715ed0a2b0 \
  --out work/couv05d-preview
```

Lancer Next localement avec les flags de [ACTIVATION.md](ACTIVATION.md), puis :

```bash
node tests/e2e/couv05d.mjs
# Après redémarrage du serveur local avec COUV05_RENDER_ENABLED=false :
COUV05D_MODE=off node tests/e2e/couv05d.mjs
```

Le navigateur attend explicitement la réponse réelle de l'API puis l'application des couleurs et des 713 contours. Aucun `route.fulfill`, aucune substitution d'image et aucune route de composant isolée. Les fichiers restent sous `work/couv05d-browser`. Les copies de recette ne sont pas des publications.

Les mesures de latence sont celles d'un serveur Next de développement local et de lectures réelles Storage, avec compilation et calculs hors ligne concurrents ; elles ne constituent pas un SLO serverless de production.

## Deuxième cycle et reprise

Checkpoint conservé `14191415161`, run `43786617246`, ZIP SHA `7f69386dca5d4d38f093f7573a0ccd2dd8ff52b1d2fcee0593fb9b52f4a1f7d3`. Le digest GitHub et les 49 910 réductions originales sont vérifiés.

```bash
PYTHONPATH=engine/src:scripts python scripts/couv05_replay.py \
  --checkpoint work/couv05d-next-checkpoint.zip --output work/couv05d-next-replay
PYTHONPATH=engine/src:scripts python scripts/couv05_masks.py \
  --root work/couv05d-next-replay/replayed --run-date 2026-11-15 --geometry \
  --archive-sha256 884df12701c810cc39ed73b8fd1a21b1980d72e444e6e6185564bf6f001bc7fd \
  --output work/couv05d-next-masks
```

Interrompre après des manifestes terminés puis relancer la même commande vérifie la reprise locale ; ne pas interrompre une publication d'archive. La recette COUV-05D conserve quatre SHA avant reprise, zéro index avant reprise et le même contenu après reprise.

La conservation privée a utilisé `couv05_store.plan` puis `couv05_store.upload` existants, avec budget explicite de 209 715 200 octets, inventaire initial de masques à 172 331 262 octets et garde physique totale de 943 718 400 octets. Les contrôles de pointeurs sont effectués avant/après. 219 objets ont été insérés sans upsert ; l'index est inséré en dernier. Aucune archive météo ou édition n'a été publiée. Pour une autre insertion, refaire l'inventaire physique, objets orphelins et anciens index inclus ; ne pas réutiliser un ancien comptage.

Relecture sans mutation :

```bash
PYTHONPATH=engine/src:scripts python scripts/couv05d_storage.py \
  --index-sha256 e1da3cfb5e17a85cd6193661ed01d119421796a34a664c79c98e167cdd935347 \
  --output work/couv05d-store-next
```

Les captures et index durables sont conservés sous `evidence/next-cycle`, avec références aux poids inchangés de COUV-05. Une reconstruction bornée a été exécutée sans grilles numériques ni checkpoint :

```bash
PYTHONPATH=engine/src:scripts python scripts/couv05_rebuild.py \
  --evidence docs/codex/COUV-05D/evidence/next-cycle \
  --archive work/couv05d-store/884df12701c810cc39ed73b8fd1a21b1980d72e444e6e6185564bf6f001bc7fd.json.gz \
  --output work/couv05d-next-rebuilt --limit 1
```

Pour le contrôle navigateur du cycle suivant, redémarrer uniquement le serveur local avec le second pin et `COUV05_RENDER_ENABLED=true`, puis :

```bash
COUV05D_MODE=next-cycle COUV05D_RUN=2026-11-15T18:00:00+00:00 \
  COUV05D_WIDTHS=1440,390 COUV05D_CASE='^climat-temperature$' node tests/e2e/couv05d.mjs
```

Le pin est propre à une archive : un seul pin est actif dans un processus. Les cycles d'autres archives restent refusés. Les contrôles HTTP du script `couv05d_routes.ts` acceptent aussi `COUV05D_RUN`, `COUV05D_ARCHIVE_SHA` et `COUV05D_RAIN_LEAD`, uniquement pour la recette.
