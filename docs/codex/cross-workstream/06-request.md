# Task 06 — demandes aux workstreams 05 et 09

## Task 05 : nom accessible du lien de marque

L'audit axe 4.11 de la page intégrée signale `label-content-name-mismatch`
sur `.brand` dans `apps/web/components/shell/brand.tsx`.
Le libellé accessible « AgriclimaX — accueil » n'inclut pas la signature visible
« Observer. Comprendre. Anticiper. ». Ce composant préexiste à Task 06 et reste
inchangé, conformément aux frontières des workstreams.

Proposition pour Task 05 : inclure la signature dans `aria-label`, ou laisser le
contenu visible nommer le lien puis ajouter « accueil » avec `aria-describedby`.
Le test Task 06 audite son propre espace en clair et sombre ; cela ne vaut pas
validation WCAG complète du shell.

## Task 09 : adapter le smoke navigateur à l'Observation réelle

`tests/e2e/demo.mjs` attend encore l'emplacement Task 05 avec « Voir le diagnostic »
et « Replier la veille » sur tablette. La carte Task 06 remplace cet emplacement.
Le script reste inchangé dans le dossier primaire Task 09.

Proposition : remplacer ces interactions par sélection `demo-001`, vérification
du panneau local / bottom sheet et repli du détail, puis lancer également :

```sh
node tests/e2e/observation.mjs
```

Le nouveau script conserve la vérification offline, responsive, clavier,
accessibilité du nouvel espace et états live simulés ; il ne change pas les
gardes de sécurité, contrats ou workflows Task 09.
