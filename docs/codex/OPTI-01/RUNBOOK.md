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

## OPTI-01B · Activation sur Supabase

Cette procédure s’applique après fusion manuelle d’OPTI-01B et accord explicite du propriétaire. Le bucket privé reste `pra-climate-archives`. La lecture et l’écriture ont chacune un drapeau du même nom dans leur console respective.

| Ordre | Console et chemin | Paramètre, opération et contrôle |
|---:|---|---|
| 1 | GitHub → Pull requests → Checks, puis Supabase → Storage → `pra-climate-archives` → Edit bucket | Après Quality, Security audits et Preview Vercel, fusionner manuellement. Pour le bucket, conserver son accès privé, sa limite de 8 Mio, `application/gzip` et `application/json`. Ajouter uniquement `image/webp` à la liste des types MIME autorisés. Relire les paramètres enregistrés. |
| 2 | GitHub → Settings → Secrets and variables → Actions → Variables | Vérifier que `AGRICLIMAX_JOURNAL_PROJECTION_ENABLED` vaut `true`, ou la définir à cette valeur. Vérifier aussi la valeur effective pour le job nocturne dans l’environnement `editorial-ai-dev`. |
| 3 | GitHub → Actions → INT-01 edition maps and Journal projection → Run workflow | Sur `main`, choisir `verify-projection` et l’identifiant du 28 ci-dessous. Le job relit l’archive et son manifeste existant. Comparer `edition_checksum`, `bundle_sha256`, la révision et les SHA des deux rendus. |
| 4 | Même écran, puis Supabase Storage | Lancer `publish-projection` avec le même identifiant sur `main`. Exiger `published` ou `already_published`, puis relancer `verify-projection` et exiger `already_published`. Vérifier la présence de l’index et des deux WebP sous `journal/v1/<id>`. La vérification relit les WebP et valide leurs tailles et empreintes contre l’index. |
| 5 | Vercel → Project Settings → Environment Variables | Définir `AGRICLIMAX_JOURNAL_PROJECTION_ENABLED=true` pour **Production** et laisser `AGRICLIMAX_JOURNAL_STORE` absent, ou le fixer à `supabase`. Vercel → Deployments → dernier déploiement Production → Redeploy. Ce redéploiement applique la configuration. Les éditions suivantes sont publiées sans déploiement. |
| 6 | Navigateur → Journal | Vérifier le 28, une archive historique, l’ordre du carrousel, les URLs avec `sha=` et les liens Cartes de la même révision. Dans Réseau, relever TTFB, octets, `Cache-Control`, ETag, `Age` et `x-vercel-cache` pour une première visite et une visite répétée. Comparer les lectures et l’egress Storage sur deux fenêtres comparables. Vérifier le rapport de la prochaine nuit. Reprendre ensuite le 27 avec les étapes 3 et 4, puis vérifier son Journal daté. |
| 7 | Vercel puis GitHub | En cas d’incident, mettre le drapeau Vercel à `false` ou le retirer et redéployer. Si le producteur est en cause, mettre le drapeau Actions à `false` ou le retirer. Vérifier le Journal daté et sa carte avec la voie historique. Les URLs de WebP déjà émises peuvent rester en cache selon leur durée. Conserver les objets et les versions. |

Ces actions conservent les contrôles existants. Le workflow ciblé exige une édition admise au registre et un manifeste cartographique public valide. L’écriture nécessite la branche `main`, la variable GitHub active et un arrêt d’urgence inactif. Le workflow nocturne est inchangé, hormis la projection additive déjà prévue. Aucun secret S3, R2 ou Blob n’est requis.

### Éditions prêtes à vérifier

| Date | Mode et révision réellement référencés | Identifiant |
|---|---|---|
| 28 novembre | IA expérimentale, révision 1 | `585cd3fb02c5c63f3d2cf857bf74f88401e0a99f9b512775d22c1299b88680a7` |
| 27 novembre | IA expérimentale, révision 1 | `0912d90a018f2bea5e890dd31ec0b86f9b09ff5675f32d14eb470a32ef699a6d` |
| 26 novembre | Secours, révision 2 | `8adbcac300a37cdee31052cf5b5d1bddc16eb2ab962d55b46ba38626a433ae45` |
| 25 novembre | Secours, révision 2 | `f45f14d6670f16332b62ca26ae6f63700543d31b59e19700fa44fdcbf976fa26` |

Le 28 est prioritaire, puis le 27. Les éditions des 25 et 26 sont des références de recette. Reprendre la projection directement à partir des archives et des manifestes publiés. L’état du 27 est `fallback_valid` pour le dossier et `live` pour l’archive éditoriale. Le checksum de l’archive est `0848418f2336cee07cee5974fcb031f75e2198d0b274ceb39bddd9d1e986b200`.

### Veille de production et sonde de six secondes

À 12 h 30 le 27 novembre, heure de Paris, le watchdog `*/15 * * * *` a réussi. Les secours planifiés Actions restent à 05 h 50 et 06 h 45, heure de Paris, selon les deux créneaux du workflow. Acquisition et génération sont activées. La promotion certifiée est désactivée et l’arrêt d’urgence inactif. Le registre du 27 garde le cycle du 26 à 18 UTC en échec après trois essais. À ce relevé, le dernier objet météo validable date du 26 à 02 h 25, heure de Paris, et le dernier manifeste natif du 26 à 02 h 32. Aucun reçu suivant n’a été trouvé. Le 404 atteste une indisponibilité pour une requête précise. L’origine fournisseur, produit, cycle ou requête demeure indéterminée. Garder le mécanisme de reprise et les règles de qualification existants.

`checkJournal` lance en parallèle la disponibilité et le Journal daté, en exigeant une réponse HTTP valide puis la date et l’identité attendues. Son budget de six secondes est conservé. Un succès de génération, validation ou archivage demeure distinct du résultat de cette sonde et du mail. Rejouer ce contrôle sur les premières nuits actives en notant le délai jusqu’aux en-têtes et le premier affichage. L’essai local ne prouve pas son délai à froid sur Vercel.

### Jours 1 à 7 après activation

Chaque matin, noter les acquisitions et relances, le dossier, le coût OpenAI, la révision, l’index, les cartes, le rapport et les éventuelles réponses 402 ou 503. Relever dans Supabase → organisation Acta → Usage et Billing, période et fuseau de facturation, cached et uncached egress, Storage, DB et contribution de chaque projet. Relever dans Vercel → Usage les invocations, le transfert CDN/origine et Function Storage séparément. Dans GitHub → Actions, conserver volumes et minutes des jobs et vérifier les checkpoints de reprise.

Sur cinq à sept jours, faire une courte série de visites, courante et historique, avec reload, une ouverture Cartes et un contrôle Analyse. Comparer des plages de même durée à charge similaire, isoler les copies et les tests, puis noter les lectures de masques. Utiliser les métriques existantes. Le jour de passage à Pro et le jour de fin de cycle se vérifient dans Billing. La date du 18 décembre communiquée pour le quota Free peut différer. Suspendre la décision de rétrogradation en cas de projection de dépassement, de perte de marge ou de sauvegarde intégrale non restaurée. [Conditions et seuils](COUTS.md)

Pour la reprise du 27, la relecture des trois objets locaux a confirmé l’index SHA-256 `25bc4530dbf71183be894ffa57031d3b0ce12fce7ee55ce4df14f22b6b75ce9a`, le bundle `c49c3530dbb3763b080a82b4a37805b0596e49a540e92e794f82ffa7f4dd32af` et les vignettes suivantes, dans l’ordre éditorial.

| Carte | SHA-256 WebP | Octets |
|---|---|---:|
| `aa761c92dd61ae088e3c3d3ad23332aac8b12f28cf79d79258cb6e3c7848fd5d` | `0a9989655b1d8a462c83a11ff64f8dbfca6578e7bec5a4acbe8ebfb8bf685554` | 40 048 |
| `3bde54b594d80bf82c028367931ad638b0a17b3914fe8735a22765a894563c8d` | `c8531b6a8631fd9e07ebe4aba3cde0f3c8209a6a5ef80e0fda753c1380e44bc5` | 35 868 |

Comparer la première simulation Supabase à ces octets de recette. Si une version de runtime ou de Sharp produit un encodage différent, vérifier l’image, les masques, la légende, la palette et les cartes avant de retenir le nouveau SHA. Une réexécution contre une projection déjà créée doit retrouver ses empreintes.

Les simulations des éditions de secours ont également réussi en lecture seule avec les bundles hébergés, deux cartes chacune, sans publication ni appel OpenAI.

| Date | Index simulé | WebP cumulés | SHA-256 de l’index simulé |
|---|---:|---:|---|
| 25 novembre | 39 616 o | 76 138 o | `78b13d4f741765877c30963862acad2a1fd619f84134a86db0c65f46454288cf` |
| 26 novembre | 39 780 o | 75 916 o | `7a404958f24385c10befb89ffc4e155d098e2cfa7ca85877043cb13b57df17b2` |
