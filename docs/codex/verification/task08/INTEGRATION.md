# Actualisation sur main — Tasks 06, 08 et 09

Base actuelle : `9159764dbf1dded6c26e3f6e16b988bbc4a86bd2` (Task 06 mergée).
La branche `codex/08-scientific-diagnostic` est rebasée sur cette base ; le commit
initial `531e7c0` est conservé par réapplication. L’ancien état est sauvegardé
localement sous `backup/task08-before-main-rebase`. Le head distant avant mise à
jour (`4459d59`) était un merge GitHub de main ; sa comparaison avec la
réapplication propre diffère seulement par l’import ObservationSpace omis. Cet
état est aussi sauvegardé sous `backup/task08-remote-before-update`.
Auteur/committer locaux :
Mehdi-Sine <mehdi.sine@acta.asso.fr>.

## Corrections d’intégration

Le seul conflit de rebase était le groupe d’imports de `product-shell.tsx`.
`ObservationSpace`, `ScientificDiagnostic` et `diagnosticHref` sont tous conservés.
L’espace Observation utilise toujours la carte MapLibre de Task 06. Le diagnostic
scientifique conserve ses composantes, explications, états, provenance, qualité,
fenêtre/série et route `/diagnostic` ; le drawer reste disponible depuis Veille.

Le mélange des deux tâches introduisait aussi un accès à `location` au rendu
serveur : Task 08 construit des liens pendant ce rendu alors que Task 06 utilisait
la fonction dans les événements clients. Le contexte serveur est maintenant lu
via les props, puis complété par l’URL courante uniquement côté navigateur.
Bbox, zoom, production, indicateur, territoire et comparaison sont préservés.

Une cellule sélectionnée dans la carte propose « Voir le diagnostic scientifique »
avec son identité et sa version de règle exactes. Le lien est disponible dans le
panneau desktop, le détail mobile et le résumé mobile compact. Sans preuve de
règle fournie, aucun lien trompeur n’est fabriqué. `diagnosticHref` consomme
seulement les champs d’identité nécessaires ; aucun faux résultat complet créé.
Le retour conserve la sélection et l’emprise.

Les tests d’intégration ont été adaptés à la carte désormais chargée côté client :
le test serveur vérifie les résultats validés et leurs identités ; le navigateur
vérifie réellement sélection puis lien carte → diagnostic. Le test Task 09 ouvre
le drawer depuis Veille, avec le même contrôle de focus et le même audit axe.
L’attente explicite du canvas respecte le chargement différé de Task 06.

## Audits examinés et corrections limitées

| Dépendance | Avis | Avant | Action / état final |
| --- | --- | --- | --- |
| AJV | GHSA-2g4f-4pwh-qvx6 / CVE-2025-69873, moderate | 8.17.1 | 8.18.0, correctif de même major ; plus d’avis AJV |
| braces | GHSA-vfj7-8cjw-p6xm / CVE-2026-93687, high | 3.0.3 | Aucun correctif publié ; avis demeure bloquant |
| pytest | PYSEC-2026-1845 / GHSA-6w46-j5rx-g56g / CVE-2025-71176 | 8.4.2 | 9.0.3, première version sûre annoncée ; audit sans vulnérabilité |

`braces` vient de `eslint-config-next → @next/eslint-plugin-next → fast-glob →
micromatch`. L’audit indique `patched_versions: <0.0.0`, recommendation None.
Le registre npm confirme que la dernière version publiée est 3.0.3. Il n’existe
pas de mise à jour sûre compatible à appliquer : aucune substitution non maîtrisée
de la chaîne ESLint, patch local fictif ou exclusion d’avis n’est ajouté.
`pnpm audit --audit-level high` reste donc **en échec, code 1**, avec 1 high et
0 moderate/critical après correction AJV. La PR reste draft.

Pytest 9.0.3 nécessite Python >=3.10 (projet/CI : Python >=3.12), et fonctionne
avec les dépendances de test déjà épinglées. Seule la ligne pytest du lock Python
change ; la borne dev du pyproject devient `pytest>=9.0.3,<10` pour rester
cohérente avec le lock. Ce passage de major de l’outil de test est contrôlé par
les 44 tests existants, sans changement de moteur, de plugin ou de test science.
`pytest-compatibility.json` conserve les exigences du paquet installé.

Les lockfiles JS ne changent que pour AJV et la résolution peer de ajv-formats.
Aucun audit désactivé, seuil baissé, vulnérabilité ignorée ni workflow modifié.
Aucune règle scientifique, configuration, contrat, migration ou fonction moteur
modifiée.

## Vérification finale

Preuves actualisées sous `integration/` ; les preuves de première livraison
restent historiques dans les autres dossiers.

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` : succès.
- Tests web : 86 réussis, dont ceux de la carte Task 06 et du diagnostic Task 08.
- `python -m pytest engine/tests` sous pytest 9.0.3 : 44 réussis.
- `make check` : succès, incluant guards qualité/contrats, Python, lint, typage,
  tests web et build. L’audit des dépendances est un gate indépendant et son
  échec high ci-dessus n’est pas masqué par ce résultat.
- Audits Python stricts engine et outillage qualité : zéro vulnérabilité, code 0.
- Audit npm de l’outillage navigateur au seuil high : code 0.
- E2E Task 06 : carte rendue, clic géographique/tableau, navigation/historique,
  zoom/emprise, couches, panneaux, contextes live disponibles/vides/en erreur,
  responsive et accessibilité : succès.
- E2E diagnostic : carte → diagnostic, deep-link/rechargement, fenêtre consultée,
  retour au contexte, historique, clavier, absence et live invalide : succès.
- E2E Task 09 : shell/catalogue, drawer, focus, responsive, clair/sombre et axe :
  succès. Aucun filtre ou règle d’audit supprimé.
- Guard bundle client : succès ; 28 fichiers statiques vérifiés, zéro occurrence
  des valeurs de secrets configurées (`bundle-value-scan.json`).

Captures actualisées desktop 1440×900, tablette 1024×768 et mobile 390×844 dans
`integration/observation`, `integration/diagnostic`, `integration/shell`.
Les commandes et codes de retour exacts sont dans `commands.json` et
`audit-commands.json`. Audits avant/après conservés en JSON.

Les essais intermédiaires ont révélé une ancienne assertion serveur incompatible
avec la carte cliente, puis une attente trop précoce du canvas. Les vérifications
finales utilisent l’identité validée et un vrai parcours navigateur. Un essai navigateur lancé pendant une reconstruction Next a été invalidé par
des erreurs de chargement ; le contrôle final a été relancé après tous les builds
et redémarrage du serveur production. Les captures finales correspondent à ce
contrôle réussi. Aucun déploiement ou seed distant.
Axe ne certifie pas WCAG complet. Les états live non vides de Task 06 sont vérifiés
avec les réponses API validées du harness navigateur, pas une écriture distante.

## Suivi sécurité du 11 octobre 2026

Le blocage braces décrit ci-dessus est désormais traité par l’exception ciblée
[SECURITY_EXCEPTION.md](SECURITY_EXCEPTION.md), autorisée dans la demande de suivi.
Aucun fichier métier modifié. Résultats actualisés dans `security-exception/`.
