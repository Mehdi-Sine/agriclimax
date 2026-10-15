# Task 14 — intégration après merge Task 13

Branche `codex/14-cattle-heat-stress` rebasée sur
`231d173` (SHA exact dans base.txt), merge PR #31 Task 13.
Identité locale `Mehdi-Sine <mehdi.sine@acta.asso.fr>` réappliquée.
Le head distant avant réécriture est `86dd7ce9fc25feb273fccc625fbb43874f13942c`.
La publication utilise un lease sur ce SHA, sans écraser un changement tiers.

## Conflits résolus

Les trois entrées Observation/Diagnostic/Watch conservent les imports et les
conditions de dispatch des deux espaces : `mode=wheat` et
`mode=live_meteofrance&production=cattle`. Le workflow qualité conserve les checks
Ruff et mypy des deux modules. Aucun contrat, paramètre scientifique, migration,
calcul ou composant bovins modifié. Comparaison des arbres cattle contre le commit
publié initialement : identiques. Les fonctionnalités Task 13 sont conservées.

## Correction E2E et accessibilité

L'ancien test attendait « Aller au contenu » après un unique Tab. Le lien bovins
précède désormais ce lien dans le DOM ; sa position n'est pas un contrat
fonctionnel. `demo.mjs` sélectionne maintenant le lien par rôle et nom exact,
vérifie son unicité et `href=#main`, le rejoint par Tab, exige son focus clavier
visible, l'active par Entrée et vérifie le focus sur `main#main`.

La recherche ne présume pas un rang fixe : son budget suit les contrôles DOM,
les segments clavier natifs des champs date/heure et les contrôles de carte
ajoutés pendant l'hydratation. Le test échoue si le contrôle reste inaccessible.
Aucun focus programmatique n'est utilisé pour atteindre le lien d'évitement.
Les contenus cibles sont attendus explicitement après navigation.

Le test vérifie aussi au clavier l'entrée blé, ses cinq stations, le retour à la
démo puis l'entrée bovins et ses trois vues. Les audits axe complets de document
sont conservés, avec les mêmes tags A/AA/2.1 A/AA, et étendus aux vues bovins.
Les contrôles existants de modal mobile, focus trap, retour du focus, contraste,
thèmes, reduced-motion, erreurs navigateur, absence de dépendance externe démo,
budget HTML et délai de navigation restent inchangés. Aucun test supprimé, seuil
baissé ou violation ignorée.

## Correction de la course de navigation

Le parcours ajouté a reproduit un problème d'intégration : une mise à jour de
caméra différée pouvait restaurer l'URL démo alors que l'ouverture des bovins
était déjà engagée. Le callback `moveend` ne remplace plus l'URL si son chemin,
mode ou production a changé. Le debounce, la sélection et la caméra dans un même
espace restent inchangés ; leur régression existante est exécutée.

## Contrôles

- `make check` final : PASS, exécutant lint, typecheck, tests web, build,
  tests Python, contrats et guards qualité/sécurité/migrations.
- Python : **103 PASS** ; web : **160 PASS**. Ruff et mypy strict sur blé et
  bovins : PASS. Warnings climatologiques NumPy/netCDF4 hérités : 23, non masqués.
- Démo E2E : **24 audits sans violation**, desktop 1440, tablette 1024,
  mobile 390 ; liens d'évitement, navigation blé/bovins, carte/diagnostic/watch,
  thèmes et contrôles clavier conservés.
- Blé E2E : **18 audits** responsive/thèmes/vues, zéro violation AA,
  cinq stations et API réelle, diagnostic et filtres/stade explicite.
- Bovins E2E : trois vues réelles × desktop/mobile, zéro violation AA,
  contexte station/période conservé, état horaire absent explicite.
- Intégration générale : **30 états responsive/AA PASS**, exécution avec `INTEGRATION_LIVE=real` car le serveur
  dispose des accès Supabase ; ce mode attend l'absence de risques publiés plutôt
  qu'un service non configuré. Le mode CI sans credentials n'est pas modifié.
- Audits Python moteur/climatologie/outillage, JS production et navigateur :
  zéro vulnérabilité connue. JS global : seule exception héritée
  GHSA-vfj7-8cjw-p6xm (braces/ESLint), sans chemin de production selon le guard.
- Bundle, valeurs de secrets client, budget et Gitleaks : rapports joints.

Les rapports de cette reprise sont distincts des preuves historiques Task 14.
Aucune écriture DB, activation d'automatisation, modification scientifique ou
exécution d'une autre Task. PR #30 conservée en draft, aucun merge.
