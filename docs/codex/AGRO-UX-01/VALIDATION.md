# Recette et preuves

## Origine des données

L’exécution GitHub [43023425215](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43023425215) référence l’artefact `ops04-journal-43023425215-1`, ID `13855269707`, 11 643 961 octets, digest annoncé `sha256:09a6903fd6422449c1123dbf9516ea76f689e788e32a8027312ccf4ce78143e4`, expiration annoncée le 18 novembre à 13:49 Paris. Métadonnées lues via le connecteur GitHub. Le connecteur fournit une archive téléchargeable mais son URL retourne 403 ; `gh run download` échoue également à l’étape Blob. Diagnostic supplémentaire : tunnel CONNECT refusé 403. **Le ZIP exact n’a donc pas été lu ni vérifié ; ne pas revendiquer cette recette comme un test de son contenu.**

Récupération depuis un poste autorisé :

```sh
gh run download 43023425215 -R Mehdi-Sine/agriclimax \
  -n ops04-journal-43023425215-1 -D work/agro-ux-01/ops04
```

Ou Actions → exécution → Artifacts → télécharger le ZIP. Vérifier son SHA256 contre le digest ci-dessus, extraire dans `work/agro-ux-01/ops04`, lire `report.json`, vérifier mode dry-run, appels OpenAI=0, publication non demandée et les manifestes des cartes. Ne pas recréer des fichiers absents avec des valeurs manuelles. Après expiration, récupérer une copie conservée ; une nouvelle exécution dry-run serait une preuve distincte, jamais l’artefact original.

## Recette locale réelle distincte

Le pilote OPS-04 a été relancé en lecture seule, sans acquisition, avec archives existantes, clé OpenAI retirée du processus :

```sh
env -u OPENAI_API_KEY NODE_USE_ENV_PROXY=1 \
  MANUAL_EDITION_DATE=2026-11-11 MANUAL_MODE=dry-run \
  MANUAL_RECOMPUTE_INDICATORS=true MANUAL_REFRESH_SOURCES=false \
  MANUAL_REUSE_AI=true MANUAL_FORCE_AI_REGENERATION=false \
  AGRICLIMAX_MANUAL_OUTPUT=work/agro-ux-01/local-run \
  NODE_OPTIONS=--conditions=react-server \
  apps/web/node_modules/.bin/tsx scripts/manual_journal.ts
```

Le premier essai sans prise en charge du proxy Node a échoué à l’inspection, sans IA ni publication. `NODE_USE_ENV_PROXY=1` permet ensuite la lecture réelle. Résultat : 92 690 mesures, zéro erreur de calcul, deux groupes × 713 PRA, 40 cartes, réanalyse 29 octobre–4 novembre et prévisions 11–12 novembre. Snapshot isolé de test ; texte déterministe, contrôle sans erreur, revue sémantique requise. Zéro appel OpenAI, aucune publication demandée. Rapport nettoyé des chemins locaux dans `evidence/local-run.json`, comptes de support et NULL dans `evidence/maps.json`.

Deux rejeux des captures par `scripts/manual_replay.ts` ont produit des résultats strictement identiques, zéro réseau et IA ; empreintes dans `evidence/replay.json`.

Serveur local (après installation verrouillée pnpm 10 et build) :

```sh
NODE_USE_ENV_PROXY=1 \
AGRICLIMAX_AI_PREVIEW_ARCHIVE_DIR="$PWD/work/agro-ux-01/local-run/preview" \
AGRICLIMAX_MANUAL_RUN_DIR="$PWD/work/agro-ux-01/local-run" \
apps/web/node_modules/.bin/next start apps/web -p 3000
```

Ouvrir `preview.url` du rapport ; `/journal` lit les archives réelles existantes via le lecteur OPS-03. La consultation ne génère aucun texte. Les archives du 11 novembre sont expérimentales, non certifiées ; elles ne sont pas promues par cette recette.

## Résultats automatisés

- Suite web complète : **656 réussis, 8 ignorés**, 77 fichiers réussis, 8 suites réelles opt-in ignorées. Commande `pnpm --filter @agriclimax/web test` avec pnpm 10.0.0.
- Cas manuels des 14 règles, NULL, rupture de nature ; palettes physiques des extensions AGRO-02 ; séparation des liens preview/production ; contrats et lecture des archives, snapshots et garde-fous existants.
- Oracle Python indépendant exécuté par `multiproduction/pilot.test.ts` : 85 560 cas réels gelés, zéro écart. Ces archives CORE-01 sont distinctes du dry-run du 11 novembre. Le test ne réalise pas une validation agronomique externe.
- TypeScript, lint et build Next.js de production réussis. Contrats, migrations forward-only, secrets source/bundle et budget client contrôlés. Pas de modification Python, SQL, workflow ou lockfile ; la suite Python complète n’a pas été relancée.
- Chromium système via Playwright verrouillé : 1440/1280/768/390/360 px, preview et Journal réel du 11 novembre, carte prête et colorée, 713 lignes uniques, 714 options dont le choix vide, sélection native au clavier, PRA avec valeur et avec NULL, THI indisponible vérifié sur 713 PRA, absence de débordement et d’erreur JavaScript. Routes accueil, Climat, Productions, Veille, Analyse, Almanach, Cartes, Aide et 14 fiches, date d’archive absente : HTTP 200 et états attendus. `evidence/browser/results.json` et 15 captures.
- La première passe visuelle a révélé une collision entre les anciennes zones de grille et UX-01 ; correction puis recette répétée, avec assertion de non-superposition du titre et de l’état vide de carte. Une vérification d’URL a aussi été corrigée pour attendre la redirection Next.js avant assertion.
- Les captures montrent l’absence réelle de carte opérationnelle pour cette édition ; les cartes test n’y sont pas substituées. Le carrousel sur carte d’archive qualifiée est couvert par les tests existants et l’intégration UX-01 ; l’édition du 11 novembre ne permet pas de tester son interaction avec une carte opérationnelle présente.
- Main relue avant livraison : toujours `bd475ff`. CI distante de cette nouvelle PR à consulter séparément ; aucune réussite distante anticipée.

## Écarts avant mise en production

- ZIP Actions exact inaccessible : vérifier son intégrité et refaire le parcours avec cette copie.
- Pack original de référence UX absent du dépôt : comparaison de fidélité et validation humaine à effectuer.
- Revue éditoriale sémantique de l’édition encore requise ; consultation expérimentale distincte de certification.
- 68 PRA historiques sans support natif complet ; 67 portions descriptives et une indisponible conservées. Pas de couverture nationale complète revendiquée.
- Humidité qualifiée absente : THI et dérivés restent NULL. Aucun indicateur de bilan hydrique ou d’excès d’eau du sol n’est inventé.
- Pas de modèle numérique de terrain ajouté : silhouette/ombres et contours actuels conservés ; un véritable fond de relief nécessite une référence et une recette séparées. Les traits littoraux ne sont pas modifiés.
- L’édition opérationnelle du 11 novembre ne contient pas de carte compatible archivée ; les cartes recalculées ne sont visibles que dans l’espace de test. Pas de promotion automatique ni de miniatures fictives.

Statut global **PARTIAL**, même si les contrôles techniques passent.
