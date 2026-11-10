# Consultation expérimentale du 10 novembre 2026

Archive DEV lue sans écriture : `a75a9f16667b5df0d706f51259dfeceb0bdf1996801ef6dc4b1c17693f1f189d`.
Checksum original : `cfc7b9a6de8163eb57dd7f941a8fe41734ca7ce4a42bc853a9821c9cd5cf9492`.

La projection publique distincte contient le texte original, le checksum, les faits et les deux verdicts. Elle exclut reçu, consommation et paramètres internes. Le pack existant assure la lecture après déploiement même sans accès à DEV. Aucun contenu scientifique original n'est corrigé, aucun cron, paramètre d'acquisition ou appel OpenAI n'est exécuté.

`BLOCK_REFERENCE` ne bloque plus cette lecture expérimentale. Les contrôles d'intégrité, d'identité, de chiffres structurés et de cartes restent bloquants. La certification conserve tous les contrôles stricts, dont BLOCK_REFERENCE ; elle n'est pas accordée à cette édition. Les références inconnues sont montrées sans lien, explicitement non résolues. Les références connues seules donnent accès aux sources.

| Alerte originale | Examen du véritable texte |
| --- | --- |
| BLOCK_REFERENCE | Incompatibilité réelle dans article[4] et limitations[1] : `0e0bee7df8ae8508ac42265db0b908f4de832dbf8cb019cf245fdce92dd484fe` est une comparaison, absente de national.facts. Ne pas la convertir artificiellement en preuve. |
| TEXT_REGION | Article[4] nomme Auvergne-Rhône-Alpes, mais son seul fait résolu concerne Occitanie. Incompatibilité réelle de traçabilité, même si la comparaison pouvait motiver le propos. |
| DOCUMENTARY_CONFIRMATION | « un signal étendu à confirmer » n'affirme aucune confirmation scientifique documentaire. Faux positif lexical sur « confirme » dans « confirmer ». |
| REGIONAL_EXTRAPOLATION | « pas une température représentative de toute la région » nie précisément l'extrapolation détectée. Faux positif lexical. |
| UNPROVEN_AGRONOMY | « les dommages agricoles ne sont pas évalués » est une réserve, pas une assertion de dommages. Faux positif de portée de négation après le sujet. |

Ces alertes restent consultables ; les contrôles scientifiques ne sont pas assouplis pour obtenir une certification. Le prompt `editorial-board-fr-3` impose exclusivement national.facts pour evidence_ids, exclut comparaisons/temporal_ids, demande des faits régionaux pour chaque territoire cité et clarifie les formulations de réserve. Aucun test rédactionnel payant.

Reproduction locale : récupérer l'archive exacte avec le RPC existant archive_read (lecture seule), puis `NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/export-experimental-edition.ts work/nov10-archive.json` depuis la racine. Ne jamais reconstruire le JSON original à partir d'un JSONB réordonné.

## Vérifications

- Suite web : 576 tests réussis, 7 ignorés ; 153 tests ciblés IA/nightly réussis.
- Build de production, TypeScript et lint des modules modifiés réussis. Le build signale le traçage filesystem dynamique préexistant de archive.ts.
- Navigateur Chromium à 1440 et 390 pixels : véritable titre du 10 novembre, mention expérimentale, deux références non résolues, réserves consultables, navigation vers le 9 novembre, date absente, aucun débordement.
- Aucun appel OpenAI : parcours de lecture sans import du provider/générateur et zéro requête navigateur OpenAI. Aucun générateur exécuté pendant ce correctif.
- Seconde lecture du RPC archive_read : JSON original exactement identique octet pour octet.
- Recette reproductible : démarrer le web sur le port 3002 puis `node tests/task36/experimental-reading.mjs` (dépendance Playwright de tests/e2e). Captures et rapport locaux dans work/experimental-reading.
- La valeur numérique longue du chiffre clé conserve toute sa précision ; CSS adapté au mobile, sans réécriture du contenu.
