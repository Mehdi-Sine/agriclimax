# Task 06 — GitHub et Vercel

Vérification effectuée le 2026-10-11 après le push du commit applicatif
`2b7946e393dd2ac1c7cddd11c6992398fd1f4273`.

- Branche : `codex/06-observation-map`, poussée sur origin.
- Auteur : `Mehdi-Sine <mehdi.sine@cta.asso.fr>` configuré avant commit.
- PR **draft** : https://github.com/Mehdi-Sine/agriclimax/pull/25, base `main`.
- `origin/main` vérifié à nouveau : `be3711e47e0272d48fb663eb1a8f205858035927`.
- Aucun merge ni push direct sur main.

## Vercel Preview : bloquée

Le status GitHub du commit est **failure**, contexte **Vercel**,
description exacte **Deployment was blocked**.
URL cible fournie par le check :
https://vercel.com/mehdi-sines-projects/agriclimax/5g8LndrY4V4swdV4AKtJwwoK2SX3

Cette URL de tableau de déploiement n'est pas une URL de Preview réussie.
Sa consultation depuis l'environnement est refusée par le proxy réseau :
`CONNECT tunnel failed, response 403` ; `vercel.com` n'est pas une destination
autorisée. La raison précise du blocage Vercel ne peut donc pas être confirmée.
Il n'y a ni validation visuelle de Preview ni build Vercel réussi attesté.
La configuration Vercel n'a pas été modifiée et aucune restriction réseau
n'a été contournée. Le build de production local et les captures sont validés.

## CI GitHub — résultat sur le commit applicatif

Quality : **failure**, run 38124934727.
- guards, python-contracts, SQL public et SQL extensions : **success**.
- web-demo : installation, lint, typecheck, tests, build, bundle secrets et budget
  **success** ; smoke navigateur **failure**, timeout sur l'ancien bouton
  `Voir le diagnostic` absent du nouveau slot Observation.
- Le nouveau script `tests/e2e/observation.mjs` passe localement ; son raccord au
  workflow et l'adaptation du smoke existant sont demandés à Task 09.

Security audits : **failure**, run 38124934670.
- Gitleaks et audit dépendances navigateur : **success**.
- Audit JS : exit 1 ; détail dans l'artifact `javascript-audit` du run.
- Audit Python : une vulnérabilité connue dans un package ; audit des dépendances
  qualité sans vulnérabilité. Détail dans l'artifact `python-audits`.
- Aucun fichier de dépendances ou lockfile n'a changé dans Task 06 : ces audits
  portent sur les dépendances déjà présentes dans main. Correction à traiter
  dans le workstream qualité/sécurité, sans contourner les gates.

Le commit documentaire suivant `660b2625848bd802d5a9c5b4496a2d9ebb0cf4e9`
porte également un status Vercel **failure** ; l'URL cible est cette fois
https://vercel.com/docs/deployments/troubleshoot-project-collaboration?utm_source=notifications
Ce lien oriente vers un problème de collaboration projet ; il ne donne pas à
lui seul le détail de l'autorisation manquante.

La PR reste draft. Aucun résultat distant rouge n'est présenté comme vert.
