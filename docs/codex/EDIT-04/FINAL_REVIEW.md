# EDIT-04 — Vérification finale avant fusion de la PR #91

**GO pour fusion et activation logicielle après déploiement**, sans appel OpenAI de validation, sans modification manuelle supplémentaire. Le dépassement de 0,15 € affiché dans l’estimation précédente n’est pas un motif de rejet du cycle opérationnel. Le crédit et la facture du projet OpenAI restent extérieurs à cette vérification ; aucune marge financière disponible sur le compte n’est inventée.

Périmètre de cette reprise : vérifications ciblées, ajout d’un test de non-régression et correction du vocabulaire financier. Aucun changement de code de production, de modèle, de dossier transmis, de sélection, de contrôle financier, de workflow ou de donnée publiée.

## Budget réellement appliqué

Le chemin effectif est `operational-journal.yml` → `pnpm editorial:nightly` → `task36_editorial.ts` → `generateOperational` → fournisseur. Il ne passe ni par `generate` historique, ni par `budgetReport`, `checkConfig`, `reserveAtomic` ou la RPC `reserve`. La RPC d’admission quotidienne demande une réservation égale à zéro, et ne compare aucun montant à 0,15 € ou à 5 €.

| Élément | Constat vérifié |
|---|---|
| Modèle réellement utilisé le 14 novembre | `gpt-6.1-terra`, confirmé par le reçu de l’archive et la variable résolue du [job existant](https://github.com/Mehdi-Sine/agriclimax/actions/runs/43560610803/job/132343288224) |
| Choix du modèle dans le workflow inchangé | `inputs.model`, sinon `vars.AGRICLIMAX_EDITORIAL_MODEL`, sinon `gpt-6.1-terra` ; aucune bascule vers Luna |
| Plafond actif dans la requête | **6000 tokens de sortie**, raisonnement compris ; délai existant de 120 s |
| Plafond monétaire applicatif effectif | **Aucun** dans le chemin quotidien ; 0,15 €/édition et 5 €/mois sont les références du calculateur historique, sans effet bloquant ici |
| Borne conservatrice enrichie, archive du 14 | **0,186008 €**, dont sortie maximale ; calcul au tarif diagnostique, sans cache, avec un token par octet et réserve de 4096 tokens |
| Écart à la référence historique de 0,15 € | **−0,036008 €** ; comparaison théorique, pas une marge de compte ni un rejet opérationnel |
| Usage retourné le 14 novembre | **17 583 tokens d’entrée, 1743 de sortie**, dont 37 de raisonnement |
| Montant calculé pour cet usage passé | **0,028928 €**, `diagnostic-estimate-2026-11-09` ; **ce montant n’est pas une facture** |
| Montant réellement facturé / crédit OpenAI restant / marge de compte | **Inconnus** : non fournis par ces archives et aucun accès de facturation utilisé |

La réussite du 14 confirme l’accès récent à ce modèle ; elle ne prouve pas le solde futur du compte. La lecture des variables GitHub de dépôt/environnement est refusée par l’intégration (403) : le modèle observé est corroboré par le job exécuté et son reçu, sans prétendre avoir audité d’éventuelles modifications ultérieures de ces variables. Les rejets fournisseur éventuels pour crédit épuisé restent une dépendance préexistante du compte OpenAI, traitée par le secours ; aucune garantie de crédit fournisseur n’est déduite du drapeau d’activation.

Le test ajouté transmet le dossier enrichi réel du 14 à un **fournisseur simulé**, avec les plafonds historiques ramenés à zéro. `budgetReport` refuse alors ce même dossier, tandis que `generateOperational` effectue exactement un appel simulé, sans réservation, et conserve `usage`/coût à `null` lorsque le fournisseur ne les retourne pas. Cela vérifie que l’enrichissement n’introduit aucun rejet financier applicatif, sans nouveau garde ni appel réseau OpenAI.

## Volume et sélection

**Pas de réduction supplémentaire nécessaire pour lever un plafond opérationnel : ce plafond monétaire local n’existe pas.** Le dossier est déjà compacté par partage des réserves et références saisonnières. Le modifier pour rendre vert un calculateur non utilisé ajouterait un changement sans nécessité démontrée. Scores, phénomènes, seuils, territoires, sources, dates, limites, schéma de réponse et nombre de choix restent exactement ceux validés dans EDIT-04.

Les mesures d’octets et les bornes tarifées existantes sont conservées comme estimations. Aucun coût de la future édition n’est présenté comme déjà facturé. Les termes ambigus dans README/VERIFICATION et la description de PR sont corrigés : `receipt.usage` est un relevé de tokens retournés, `receipt.cost_eur` une estimation calculée côté serveur. Seul le compte/facture OpenAI permet de connaître la dépense réelle et la marge financière restante.

## Activation à la prochaine édition

Le contrôle partagé relu le 14 novembre indique `ai_enabled=true`, `emergency_stop=false`. `publication_enabled=false` est conservé : il concerne la promotion certifiée, pas l’archivage et la mise à disposition du Journal expérimental ni `publish-experimental`.

Le job planifié effectue le checkout de la branche par défaut, sans révision ancienne épinglée. Après fusion dans `main` et déploiement du lecteur web, le prochain cycle normal utilisera donc ce raccordement. La sélection est activée lorsque `AGRICLIMAX_EDITORIAL_MAP_SELECTION` est absent ; le workflow actuel ne transmet pas de valeur `false`. **Aucune migration, nouvelle variable, approbation scientifique, commande d’activation ou republication n’est nécessaire.** Prochaine édition attendue : 15 novembre 2026, sous les conditions ordinaires de disponibilité des entrées et du fournisseur.

## Secours et archives

OPS-07 conserve ses contrôles : sélection invalide → classement déterministe ; texte rejeté → nouvelle révision factuelle ; panne fournisseur → archive factuelle sans deuxième appel ; reprise et liaison au bundle inchangées. Les tests concernés couvrent aussi les transitions autorisées du registre et la publication d’un secours dont le coût fournisseur est inconnu.

Les trois archives et bundles des 12, 13 et 14 novembre sont relus à distance : empreintes identiques aux copies initiales. Aucun endpoint d’écriture, génération, acquisition ou republication n’a été appelé. Les éditions précédentes n’ont aucun champ de sélection ajouté ; elles gardent leur ordre historique.

## Validation ciblée et contrôles GitHub

- **31 tests réussis dans cinq fichiers** : sélection quotidienne et budget historique, génération opérationnelle, OPS-07, schéma fournisseur, lecture du secours.
- TypeScript strict et lint du fichier touché : succès. Aucun nouveau build ou test navigateur local requis : le code de production et l’UI restent inchangés.
- Les contrôles GitHub du head précédemment revu `d12bd9f` sont verts : **Quality**, **Security audits**, **Vercel**. Les contrôles automatiques du dernier commit de vérification sont relus avant clôture ; aucune nouvelle exécution nocturne n’est déclenchée.

Preuves : [budget et activation](evidence/final-review/budget-and-activation.json), [tests ciblés](evidence/final-review/targeted-tests.log), [préservation distante](evidence/final-review/remote-preservation.json), [contrôles GitHub](evidence/final-review/github-checks.json).

La PR #91 reste en draft, sans fusion automatique. Le GO porte sur la fusion du raccordement et son activation par le déploiement normal ; il ne constitue pas une certification du solde du compte OpenAI.
