# OPTI-01 · Runbook

## D’ici au 29 novembre

1. Relever et conserver les chiffres d’Acta dans Usage/Billing, avec début et fin de période, unités, cached, uncached, par projet, service et jour. Demander à Supabase le périmètre de la restriction, l’état actuel, l’heure de remise à zéro et la possibilité d’un maintien temporaire du service dans le plan courant. L’ouverture d’un ticket fournisseur relève du propriétaire du compte.
2. Réserver les lectures massives et la copie initiale au créneau validé. Suspendre les scans et benchmarks répétés en preview sur les données vivantes. Utiliser les packs existants et l’inventaire pour la recette. Laisser la production et le watchdog aux horaires actuels.
3. Contrôler le rapport du Journal et une lecture ciblée de `/api/journal/availability`, de `/api/journal/edition?date=AAAA-MM-JJ` et du Journal daté, puis une carte de cette édition. Conserver codes HTTP, dates réelles, IDs, durées et mode. Éviter les parcours globaux répétés et les relances d’acquisition provoquées par une panne du lecteur.
4. Si HTTP 402 apparaît, consigner projet, service et première heure. Préserver toute édition déjà servie et sa date, notamment la copie d’amorçage prévue par EDIT-09. Surveiller indépendamment registre, production et restitution. Si le ledger devient indisponible, rétablir son accès et confirmer état des verrous, budget et reçu avant reprise. Une rédaction de secours manuelle suit le runbook existant et exige les entrées effectivement vérifiées. Le flux de rattrapage s’appuie sur le dossier et les reçus déjà archivés.
5. Intégrer le code après revue, avec le drapeau désactivé dans les environnements existants. Exécuter l’essai de restauration et la projection sur un environnement isolé. Choisir ensuite les éditions à rétroalimenter, sans appel IA. Une activation Vercel/Actions requiert la validation distincte du propriétaire.

## Déployer et tester la projection

En local ou sur la recette de copie, `AGRICLIMAX_JOURNAL_STORE=local` et `AGRICLIMAX_JOURNAL_LOCAL_DIRECTORY` pointent sur un dossier privé absolu. Sans `--execute`, la commande indique tailles et nombres et n’écrit aucun objet. Avec `--execute`, elle écrit sur le backend configuré, après lecture des contrôles d’exploitation. Le dossier de travail doit être la racine du dépôt.

```bash
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx scripts/int01_maps.ts \
  journal-projection '<edition-id-hex>'
```

Activer `AGRICLIMAX_JOURNAL_PROJECTION_ENABLED=true` sur la recette web après préparation des objets, puis vérifier le contenu, l’ordre des cartes, l’URL avec SHA, la navigation et l’ETag. La production quotidienne peut ensuite écrire sur Supabase en activant la variable Actions du même nom, ce qui ajoute uniquement une étape après la publication cartographique existante. Le drapeau de Vercel active indépendamment la lecture. Le secours historique reste disponible. `JOURNAL_PROJECTION_PENDING` dans la sortie d’INT-01 signale une projection à reprendre. Les deux commandes de reprise relisent le contenu exact et l’empreinte.

Séquence après activation autorisée. Vérifier le catalogue compact des éditions fréquentes, suivre la première production du matin, puis relever deux fenêtres comparables de 24 h et une période mensuelle complète. En cas de divergence de date, de checksum, de règle, de couverture, d’ETag ou d’ordre des cartes, désactiver le drapeau web et conserver la dernière représentation cohérente. Voir [Retour R2](MIGRATION-R2.md).

## Incident prévision, 26 novembre 18 UTC

Le registre du 27 confirme trois tentatives et l’état final `retryable_failure` à 03:31:54 UTC. Le dernier checkpoint est lié au [run 45934517357](https://github.com/Mehdi-Sine/agriclimax/actions/runs/45934517357) et indique `failed_previous_publication_preserved`, exit 1 et `WcsAcquisitionError`. Pour ce dernier essai, il déclare 7 requêtes, 271 056 octets source et le transfert complet de son relevé d’usage. Le `GetCoverage` ARPEGE de température à 2 m pour le 29 novembre à 21 UTC renvoie HTTP 404, classé `resource_or_endpoint_unavailable`. Le checkpoint final ne contient pas de champ `result` ni de reçu numérique exploitable. Le contrat exige le résultat validé avant rafraîchissement du catalogue. La disponibilité réelle chez le fournisseur pour chacune des autres tentatives reste à vérifier dans leurs logs. Le dernier essai montre un échec d’acquisition et préserve l’ancienne publication.

ERA5 a réussi après deux tentatives. Observations, stations et actualités sont en succès. Le snapshot est `fallback_valid`, la génération `completed` et l’archive `live`, révision 1. Le coût inscrit au ledger est de 0,087014 €. Ne pas déclarer le cycle actuel disponible tant que son reçu vérifié manque. Reprendre l’incident séparément avec les reçus et étapes de couverture. Aucun changement de l’acquisition des prévisions ni des contrôles.

## Politique de rétention proposée

| Surface | Règle et ordre d’application |
|---|---|
| Vercel | Mesurer par déploiement et distinguer Deployment Storage, Functions Storage, transfert et exécution. Préserver le déploiement actif, les deux derniers jalons validés, leur provenance Git et les étapes de rollback. Tester une fenêtre de previews de 7 à 14 jours et limiter les previews sans impact web, selon les possibilités de l’offre. |
| Artifacts Actions | Conserver les checkpoints de reprise 3 jours tant que les durées de reprise sont couvertes. Les nouveaux rapports navigateur passent à 14 jours. Exporter les références utiles des régressions. Garder rapports scientifiques séparés, dans la sauvegarde vérifiée. |
| Externalisation | Transporter un seul checkpoint par contenu pour les étapes compatibles, après mesure des téléchargements et validation du replay à partir des reçus. Préserver provenance, couverture et liens durables. |
| Veille | Surveiller les Go de l’organisation à 2 et 3 Go cached, les Go non cachés, les erreurs 4xx/5xx, la date du Journal, le taux de projections valides, les temps de build et le volume cumulé des artifacts. Viser ≤ 3 Go cached sur des cohortes comparables. |

[Vercel, rétention Hobby](https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage) · [GitHub, rétention](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository)
