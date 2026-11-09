# État actualisé — recette DEV du 9 novembre

Migration initiale appliquée séparément en DEV, version distante 20261109110405 ; fichier source 20261109085400_operational_ai_journal.sql inchangé. Migration de relecture source 20261109111202_editorial_personal_review.sql, version distante 20261109111836. Huit tables privées RLS forcée, aucun SELECT anon/authenticated ; wrapper public invoker exécutable uniquement par service_role, coeur déplacé en schéma privé. Archives texte exact relues et SHA vérifiés ; réserve/doublon testés avec rollback et contention réelle observée. Ne pas rejouer aveuglément db push : conserver la correspondance des versions distantes. Tous les interrupteurs restent faux.

Voir [ACCEPTANCE.md](ACCEPTANCE.md) pour les blocages et preuves actuels.

<details>
<summary>Conception et constat historique avant déploiement (supplantés par l’état ci-dessus)</summary>

# Autorité transactionnelle

Migration forward-only `20261109085400_operational_ai_journal.sql`, créée avec CLI
2.81.2. Tables privées : control, snapshots, runs, archives, publications,
acquisitions, diagnostics. RLS forcée ; aucun droit anon/authenticated ; RPC
SECURITY INVOKER réservée service_role, search_path vide et timeout 8 secondes.
Clé moderne uniquement dans apikey, côté serveur ; aucun nouveau secret client.

Le générateur T35 conserve ses validations et accepte désormais un store asynchrone.
`SupabaseEditorialStore` n’utilise ni hôte Linux persistant ni verrou filesystem.
`reserve` sérialise le budget par advisory transactionnel, bloque une édition déjà
réservée et les résultats incertains, impose 0,15 €/édition et 5 €/mois. La transaction
se termine **avant** HTTP. Un coût inconnu conserve toute la réservation. Les
incohérences d’usage et interruptions nécessitent réconciliation manuelle, jamais
un second appel automatique. Aucun remboursement supposé après timeout.

Snapshots et archives conservent le **texte JSON exact**, vérifié contre la colonne
jsonb utilisée pour les requêtes. jsonb réordonne les clés : recalculer directement
les empreintes T33/T35 sur sa restitution serait incorrect. Les RPC rendent le
texte exact, parsé et revérifié côté serveur (tests SQL et TypeScript dédiés).

Les archives JSON restent immuables en Postgres (limite 2 Mio), avec vérification
T35 et lecture retour ; Storage porte les entrées scientifiques compressées.
Le manifeste de publication est séparé du texte original et promu atomiquement.
Une édition par date, sans révision payante automatique ; les révisions distantes
multi-versions restent une limite de cette première implémentation.

Déploiement DEV **non effectué** : revue automatique refusée. Les tests PostgreSQL
17 sont locaux et jetables ; ils ne démontrent pas PostgREST/Vault/Cron distants.
Aucun seed synthétique n’a été exécuté sur DEV. Les RPC de contrôle et les tables
financières restent à qualifier à distance après accord sur la migration.

</details>
