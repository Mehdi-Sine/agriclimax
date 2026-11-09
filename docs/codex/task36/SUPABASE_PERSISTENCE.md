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

Les archives JSON restent immuables en Postgres (limite 2 Mio), avec vérification
T35 et lecture retour ; Storage porte les entrées scientifiques compressées.
Le manifeste de publication est séparé du texte original et promu atomiquement.
Une édition par date, sans révision payante automatique ; les révisions distantes
multi-versions restent une limite de cette première implémentation.

Déploiement DEV **non effectué** : revue automatique refusée. Les tests PostgreSQL
17 sont locaux et jetables ; ils ne démontrent pas PostgREST/Vault/Cron distants.
Aucun seed synthétique n’a été exécuté sur DEV. Les RPC de contrôle et les tables
financières restent à qualifier à distance après accord sur la migration.
