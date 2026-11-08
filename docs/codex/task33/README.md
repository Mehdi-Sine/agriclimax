# T33 — Replay et lecture des résultats

Depuis la racine, avec pnpm 10, Node >= 20.9 et les dépendances Python du moteur :

```sh
pnpm install --frozen-lockfile
pnpm editorial:generate --date 2026-10-30 --wheat docs/codex/DATA-01/evidence/wheat-30d.json.gz --news docs/codex/task34/evidence/pilot-bundle.json.gz --output work/task33/replay
pnpm editorial:validate docs/codex/task33/evidence/briefing-example.json
python scripts/task33_validate.py docs/codex/task33/evidence/briefing-example.json
pnpm editorial:typecheck
```

Le CLI prend aussi --cutoff, --generated-at, --edition (JournalEdition archivée qualifiée), --python et --output. Sans --wheat/--news/--edition il n'invente pas ces données. L'absence complète d'historique compatible produit un diagnostic bloquant, pas un dossier factuel fabriqué. Les sorties sont locales, immuables et adressées par empreinte ; le fichier metrics.json est une mesure réexécutable distincte de leur identité. Aucune écriture de production.

L'adaptateur actuel lit la série locale restaurée DATA-01 (octobre). Le moteur pur accepte des journées qualifiées mais l'ajout d'autres périodes de transport doit se faire dans le lecteur existant, sans mélanger séries exactes et legacy. Un replay ancien reste explicitement ancien pour une date éditoriale actuelle.

`/almanach` : consultation légère des fenêtres. `/api/editorial-briefing/example` : dossier réel figé du 30 octobre, jamais une édition actuelle automatique.

Vérification optionnelle des prévisions en lecture seule (variables Storage existantes requises, aucun secret en arguments) :

```sh
NODE_USE_ENV_PROXY=1 NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/task33_verify_forecast.ts
```

Les six familles mobiles nécessitant des sources annuelles restent non résolues. Voir ACCEPTANCE.md pour les limites et la préparation de T35.
