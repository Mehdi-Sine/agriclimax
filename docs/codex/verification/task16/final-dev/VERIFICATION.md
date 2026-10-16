# Validation finale DEV — 16 octobre 2026

**NON CONFORME sur la minimisation client. Fonctionnement réel validé.**
Code testé : `8cc6c61`. Portée de cette reprise : validation et documentation
uniquement, aucune nouvelle implémentation ni correction scientifique.

## Source et parcours réels

La RPC installée est exécutée en lecture seule. Ses métadonnées et les seuls
agrégats utiles sont consignés dans `rpc-metadata.json` : dernière publication
réussie = sélection par défaut, cinq stations blé/bovins, fenêtre 11–13 octobre,
calcul du 16 octobre à 13:48 UTC. Les rôles anon et authenticated n'ont pas
EXECUTE. Aucun export du snapshot quotidien complet effectué.

`real-e2e.json` contient 16 contrôles réels : deux productions × quatre vues ×
desktop/mobile. Le serveur Next de production utilise les credentials DEV côté
serveur ; les données et le réseau ne sont pas interceptés ou remplacés.
Indicateurs changés dans le formulaire, station conservée, liens carte/diagnostic/
historique/veille, période, source, fraîcheur et statut scientifique vérifiés.
Toutes les réponses des parcours sont HTTP 200 ; zéro violation WCAG AA,
pas de débordement horizontal, pas d'erreur navigateur.

`real-boundaries.json` ajoute les contrôles suivants aux deux tailles :

- Brest `29075001` : 22,4 mm et 0 jour THI > 72, cohérents avec les agrégats DEV,
  sur les quatre vues. Un zéro publié est distinct d'une absence.
- Empreinte de la dernière publication identique dans les quatre vues ; fenêtre
  antérieure à hier et fraîcheur ancienne visibles.
- Fenêtres 1–3 septembre et 15 octobre : aucun calcul ni point, métadonnées de
  dernière publication conservées. `WHEAT_STORAGE=snapshots` était explicitement
  activé sur le serveur de ce contrôle : aucune substitution par le bundle.
- Aucun run DEV déclenché ni volontairement mis en échec. La DB réelle ne contient
  qu'une publication ; pas de seconde publication inventée pour prétendre avoir
  testé une succession réelle de runs. La conservation après échec reste couverte
  par les tests isolés relancés (`isolated-lifecycle-e2e.json`, SQL public/extensions).

La source déconnectée est testée sur un autre serveur local sans clé serveur :
`disconnected-e2e.json`, erreur explicite et zéro marqueur pour les deux productions.

## Audit navigateur — échec bloquant

[Source du constat, ligne 91](https://github.com/Mehdi-Sine/agriclimax/blob/8cc6c61c06cdd7389ee9dd566bb190a9da50e000/apps/web/features/live/workspace.tsx#L91) :

```tsx
<pre>{JSON.stringify(isWheat?portfolio:cattle,null,2)}</pre>
```

Le résultat sélectionné complet est rendu dans le diagnostic et déjà transmis
au navigateur lorsque le panneau de détails est fermé. Inspection du DOM et
de la réponse HTML en mémoire, sans sauvegarde des données :

| Contrôle | Desktop et mobile |
| --- | --- |
| Blé : objet de portefeuille complet | FAIL : 10 indicateurs, paramètres, 30 reçus de provenance |
| Bovins : résultat complet | FAIL : série THI de 3 points, 3 lignes quotidiennes, 3 reçus |
| Seuls les agrégats nécessaires transmis | **FAIL** |
| Clés serveur dans la réponse HTML | Non détectées |
| Requêtes navigateur directes vers Supabase | 0 |
| Bloc JSON structuré dans les autres vues | 0 bloc `<pre>` constaté |

Les champs et compteurs, jamais leurs contenus privés, sont dans `privacy.json`.
L'audit dédié termine avec le code **1** (`privacy.log`). Le passage des E2E
fonctionnels et des audits de secrets ne constitue donc pas une validation du
critère de minimisation. Le constat ne démontre pas une exposition du snapshot
quotidien global de toutes les stations ou de credentials ; il démontre la
transmission excessive du résultat sélectionné persisté dans la DB privée.
La conformité demandée ne peut pas être affirmée. Aucun correctif réalisé,
conformément à la consigne de validation seule.

## Contrôles relancés

| Contrôle | Résultat / preuve |
| --- | --- |
| `make check` (inclut build) | PASS, `make-check.log` |
| Tests Python | 144 PASS, 23 avertissements préexistants |
| Tests web | 198 PASS |
| Lint, typage, contrats, qualité | PASS dans `make-check.log` |
| E2E réels desktop/mobile | PASS, `live-e2e.log`, `real-e2e.json` |
| Fenêtres, agrégats et publication précédente en réel | PASS, `real-boundaries.log/json` |
| E2E isolés du cycle de publication | PASS, `daily-lifecycle-e2e.log` |
| SQL local public/extensions | PASS, `sql-public.log`, `sql-extensions.log` |
| Audit minimisation client | **FAIL**, `privacy.log/json` |
| Audit JS | PASS avec l'exception dev préexistante GHSA-vfj7-8cjw-p6xm, `js-audit.log` |
| Audit navigateur | Aucune vulnérabilité, `browser-audit.log` |
| Audit Python, trois lockfiles | Aucune vulnérabilité connue, `python-audit.log` |
| Gitleaks historique | PASS, `gitleaks.log` |
| Bundle et clés client | PASS, `bundle-security.log`, `client-secrets.log` |
| Budget JS/CSS | PASS : 568827 octets gzip / 2097152, `budget.log` |
| Migrations forward-only, actionlint | PASS, `migrations.log`, `actionlint.log` |

Les preuves ne contiennent pas de payloads complets, de dumps HTML/RSC ou de HAR.
Les logs copiés sont uniquement normalisés pour les fins de ligne et espaces de
fin. Aucun changement d'application, de test versionné, de migration ou de règle.
