# EDIT-06 · Journal du 20 novembre 2026

## Reproduction

Le [run GitHub 44679759184](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44679759184) a gelé le snapshot `c5cf689c48eed4f19e21ea8e497f98b60cd0c0990ce5c7d2661748e34e8e9e79`, de qualité `fallback_valid`, à 06 h 16 min 14 s à Paris. Le registre contenait une seule tentative `running`, sans archive ni diagnostic de requête ou de réponse OpenAI.

Depuis la racine du dépôt, avec les accès habituels au stockage privé, rejouer la sélection sur les octets référencés par ce snapshot. Le script vérifie l’identité du dossier, contrôle les octets lus et ne fait que des lectures.

```bash
node --conditions=react-server --import ./apps/web/node_modules/tsx/dist/loader.mjs - <<'JS'
const {editorialRPC} = require("./apps/web/features/editorial-ai/supabase-store.ts");
const {verifySnapshot} = require("./apps/web/features/nightly/snapshot.ts");
const {prepareDailySelection} = require("./scripts/edit04_selection.ts");
(async () => {
  const snapshot = await editorialRPC("snapshot_read", {edition_date:"2026-11-20"});
  verifySnapshot(snapshot);
  const selection = await prepareDailySelection(snapshot,
    "55dd747d83ce5e242c5c10b867bb2572b66e8075f850196a42dac3b8d36d5e31");
  console.log({candidates: selection.ranking.ranked.length});
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
JS
```

Pile relevée sur le code du run lors du rejeu local, sous Node 24, avec les chemins ramenés à la racine du dépôt.

```text
RangeError [ERR_BUFFER_TOO_LARGE]: Cannot create a Buffer larger than 100663296 bytes
    at processChunkSync (node:zlib:463:15)
    at zlibBufferSync (node:zlib:180:12)
    at syncBufferWrapper (node:zlib:809:14)
    at readFrozenMapInputs (scripts/edit04_frozen.ts:18:27)
    at async prepareDailySelection (scripts/edit04_selection.ts:19:17)
```

Le SHA-256 de l’objet est `9206ccb881c805c4fb8b5863aab2922c6d1e0fa14b134e5705e4189b3efa9400`. Le gzip pèse 7 603 288 octets et restitue 101 155 160 octets, soit 491 864 au-delà de l’ancien plafond du lecteur. Le producteur vérifiait seulement la taille comprimée lors de l’écriture. Le retrait du support cartographique facultatif avait ramené le dossier à sa forme de base, encore trop grande pour le lecteur. L’erreur intervient dans zlib avant `JSON.parse` et avant l’appel fournisseur. Avec le correctif, le même objet donne dix cartes candidates.

Le lecteur et l’écrivain partagent désormais les plafonds de 8 Mio comprimés et 128 Mio décodés. Le seuil de conservation du support facultatif et les méthodes cartographiques existantes restent en vigueur. Le test reconstruit un gzip de la taille décodée exacte, vérifie le même `ERR_BUFFER_TOO_LARGE` avec l’ancienne limite, puis passe par le lecteur corrigé. La tentative existante porte le secours si la préparation des cartes ou le chemin fournisseur échoue. En cas d’écriture incertaine, le Journal relit d’abord l’archive immuable.

## Récupération et vérification

Exécuter depuis la version corrigée, avec les accès habituels au stockage privé. L’identifiant exact exige un snapshot déjà gelé. Le processus peut rejouer une réponse déjà persistée ou constituer un secours factuel sous la réservation au registre. Cette commande locale ne passe pas par le workflow d’envoi du rapport.

```bash
env -u OPENAI_API_KEY AGRICLIMAX_EDITION_DATE=2026-11-20 \
  pnpm editorial:nightly run --authorize-snapshot \
  c5cf689c48eed4f19e21ea8e497f98b60cd0c0990ce5c7d2661748e34e8e9e79
```

Le 20 novembre, cette commande a donné `archive_recovered` et `paid_calls: 0`. La tentative `55dd747d83ce5e242c5c10b867bb2572b66e8075f850196a42dac3b8d36d5e31` est passée à `completed` avec `PROVIDER_INTERRUPTED` et un coût réel laissé inconnu. Une seule tentative figure au registre de la date. Son archive factuelle a pour checksum `9f98cda7b6c57fd6aa1efc6eabb4464cde6de732079e872b85d11309e3fe8a92` et pour validation `needs_editorial_review`. Le manifeste expérimental et ses dix cartes ont été relus et vérifiés. La route publique a confirmé `available`, date `2026-11-20`, source `shared_archive` et le même checksum. La certification éditoriale reste soumise au circuit habituel. Le rapport Gmail déjà accepté à 07 h 30 a été laissé intact. [Disponibilité publique](https://agriclimax.vercel.app/api/journal/availability)

## Observations récentes

Les trois artefacts ont chacun un checksum de téléchargement distinct et journalisent `stage=persist`, `error_type=ValueError`. La persistance Python rejette un lot normalisé `invalid` avant le RPC et utilise aussi `ValueError` pour un reçu de forme inattendue. Les artefacts ne contiennent ni le lot brut, ni les anomalies de normalisation, ni le motif de l’exception. Une sonde sans persistance avec la clé de l’environnement de travail a répondu HTTP 401 dès l’authentification. Les trois tentatives historiques avaient franchi cette étape. Pour distinguer les causes au prochain incident, consigner au point de rejet le statut normalisé et les codes d’anomalie sûrs, avec un code distinct pour un reçu RPC invalide. Conserver la quarantaine et les règles physiques. [01 h 15 UTC](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44652198021/artifacts/14590378889) · [02 h 30 UTC](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44661228309/artifacts/14594863883) · [03 h 45 UTC](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44669811343/artifacts/14598374873)
