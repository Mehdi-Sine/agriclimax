# UX-02B — validation

[Preview Vercel](https://agriclimax-git-codex-ux-02b-climact-64c310-mehdi-sines-projects.vercel.app/)
· [PR #86](https://github.com/Mehdi-Sine/agriclimax/pull/86)
· [Comparaison maquette / avant / après](COMPARAISON.md)

La Preview du commit applicatif `1dc2694` a été contrôlée avec les véritables
archives publiées. Les captures `after-*` proviennent de Vercel ; les `before-*`
du build UX-02 précédent, dans le même environnement et aux mêmes dimensions.
Le HTML original et ses captures de référence sont conservés dans ce dossier.

## Résultats

Build de production, typecheck strict et lint : réussis. Suite complète :
685 tests réussis, 8 ignorés. Après les ajustements d’accessibilité, 22 tests
ciblés de rendu, publication et cartographie réussis.

Journal et Cartes vérifiés sur Vercel en 1440×1000, 768×1024 et 390×844 :
identité et couleurs de référence, bandeau PNG original 10 px, logo Georgia
36 px et point corail. Aucune violation WCAG 2/2.1 A/AA détectée par axe sur les
six vues ; aucun débordement horizontal ni erreur JavaScript. Les intitulés
accessibles du logo et des liens de sources reprennent désormais le texte visible.

L’accueil `/` répond directement en HTTP 200, sans redirection ni layout
d’exploration. Il affiche l’édition réelle du 12 novembre. Les anciennes
destinations paramétrées sont préservées et les archives restent navigables.

Les dix cartes ont été ouvertes sur desktop et mobile. Chaque réponse contient
713 PRA distinctes. Le texte public, le catalogue et les dix réponses de données
ont été comparés intégralement à la production : identiques. Cinq cartes de
réanalyse du 30 octobre au 5 novembre et cinq cartes de prévision du 13 au
14 novembre ; dates réelles et légendes conservées. Les liens directs vers une
carte et l’état d’une date absente passent dans les deux formats. Aucune requête
OpenAI observée dans le navigateur ; aucun appel de génération exécuté.

Édition : `650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee`.
Bundle : `71f9fa54c213f6d776a2ed23050d3c6b79ca9ca468459917387be564ecd08261`.

## Protection du périmètre

Main `4892c1a` relu avant toute modification (PR #83/#84 incluses). UX-02 (#85)
est conservée comme base fonctionnelle ; elle n’est pas fusionnée par cette tâche.
Les workflows OPS-06, le moteur scientifique, Supabase, les sources et les calculs,
prompts, archives, publication et identifiants techniques sont inchangés. Les
composants cartographiques et les palettes restent inchangés ; les tokens
scientifiques sont identiques octet pour octet à main.

Les écarts fonctionnels conservés sont détaillés dans [COMPARAISON.md](COMPARAISON.md).
En particulier, aucun avertissement ni contrôle PRA n’a été supprimé pour imiter
la maquette statique ; ses chiffres d’exemple ne deviennent pas des données réelles.

## Preuves et reproduction

- [Résumé des contrôles](evidence/checks.json)
- [Rapport visuel et accessibilité](evidence/visual-report.json)
- [Édition et dix cartes réelles](evidence/edition-maps-report.json)
- [Périmètre protégé et empreinte des tokens scientifiques](evidence/protected-scope.json)
- [Build](evidence/build.log), [tests](evidence/unit-tests.log), [tests ciblés](evidence/targeted-tests.log)

`tests/e2e/ux02b.mjs` contrôle l’accueil direct et les six vues, en acceptant
`BASE_URL`, `EVIDENCE_DIR` et `CHROMIUM_EXECUTABLE`. `tests/e2e/climacta.mjs`
complète la comparaison des archives avec `REFERENCE_URL`, les vingt ouvertures
de cartes et la navigation historique. Les secrets de bypass configurés ne sont
pas inscrits dans les preuves.

PR en brouillon pour validation visuelle du propriétaire. Aucune fusion ou
activation d’auto-merge.
