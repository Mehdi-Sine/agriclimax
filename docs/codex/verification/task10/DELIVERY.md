# Livraison V0.1

- Branche : `codex/10-integration-v01`, base `main c2b203a` (Tasks 01–09).
- [PR draft #26 vers main](https://github.com/Mehdi-Sine/agriclimax/pull/26).
- [Preview de branche](https://agriclimax-git-codex-10-integration-v01-mehdi-sines-projects.vercel.app).
- [Premier déploiement Vercel réussi du code livré](https://vercel.com/mehdi-sines-projects/agriclimax/89GZznmCokTL9Msjnsf6GwLZKnmd),
  commit `9fa6b2d9fa6466b9135a70643ef04ef18f8b1daa`.
- Aucun merge, push main, changement de contrat/science/RLS/migration ou seed DEV.

La Preview est créée par l’intégration GitHub/Vercel existante. Le statut Vercel
sur le commit applicatif est success (« Deployment has completed »). Chaque push redéclenche cette intégration ; l’alias de Preview suit la branche.
Les checks et le déploiement du dernier commit sont consultables dans la PR,
sans dépendre d’un SHA inscrit dans son propre contenu.

**Accessibilité HTTP non attestée depuis cet environnement.** La requête vers
l’URL exacte de Preview est refusée par le proxy avant d’atteindre Vercel :
`CONNECT tunnel failed, response 403`, code HTTP applicatif inconnu (`000`).
Ce refus ne prouve ni une erreur applicative ni l’accessibilité publique.
L’environnement n’autorise initialement ni vercel.com ni ce domaine vercel.app ;
une demande de configuration réseau a été transmise. Aucun contournement proxy,
login Vercel ou secret supplémentaire n’a été introduit.
La validation locale et le succès du déploiement ne remplacent pas une visite
HTTP/navigateur de la Preview. Cette dernière vérification reste à effectuer
après autorisation du domaine dans la configuration de l’environnement.

## Checks

Les suites locales complètes passent ; preuves dans VERIFICATION.md et les logs.
La PR exécute Quality (guards, Python/contrats, web-demo et SQL public/extensions)
et Security audits (secrets, dépendances JS/Python/navigateur).
Les SQL historiques utilisent exclusivement leurs conteneurs jetables ; aucun
seed de la base Supabase DEV ou donnée métier réelle n’est effectué par Task 10.
Le contrôle DEV est le SQL en lecture seule `integration-empty.sql`.

Le suivi final des checks est attaché à la PR et résumé dans la livraison au
lecteur. Les checks requis ne sont ni désactivés ni ignorés pour la draft.
