# OPS-02 — état de livraison

| Critère | Résultat constaté |
|---|---|
| Stages indépendants de l’heure réelle | OUI, testé |
| Acquisition automatique opérationnelle | Code corrigé ; nuit réelle à observer après fusion |
| Reprises sans doublons | OUI, tests SQL/concurrence et acquisitions simulées |
| Watchdog Supabase testé réellement | NON : jeton Vault absent ; déployé inactif |
| Génération IA quotidienne prête | Code prêt ; activation DB après fusion/recette |
| Article automatiquement consultable | OUI : archive réelle reconnue sans IA ; navigateur desktop/mobile |
| Anciens crons concurrents neutralisés | OUI dans la branche ; effectif après fusion |
| Aucune nouvelle infrastructure | OUI |
| Tests et CI complets | Voir résultats ci-dessous ; CI distante à terminer |

Branche unique `fix/ops02-reliable-daily-journal`, base `origin/main` 0e19643
(après PR #74). Aucune fusion automatique, aucun nouvel appel OpenAI.

## Développé et simulé

Cron → stage explicite ; date et créneau transmis aux jobs ; états réels et no-op
explicites ; leases persistantes pour la préparation et les stages éditoriaux ;
fin des acquisitions en erreur signalée au runner. Cutoff et archives immuables.
Succès déjà acquis non téléchargés à nouveau ; cooldown et blocage des erreurs
d’authentification conservés. Même moteur scientifique et fallback prévisionnel.
Les réponses OpenAI persistées peuvent être réarchivées sans appel fournisseur.
Le watchdog n’appelle que le workflow existant pour un manque réel ; il distingue
HTTP accepté/refusé et début/fin/résultat observés dans Supabase.

Tests locaux : 417 tests Python ; 578 tests TypeScript passés et 7 ignorés par les
suites existantes ; tests de récupération supplémentaires ; 12 tests acquisition/
ordonnancement ; SQL ledger, validation, transports watchdog simulés et véritables
connexions concurrentes. Lint, typechecks web/CLI/Python, build, contrats, contrôle
des migrations, sécurité et scans de secrets exécutés. Audits Python des sept
lockfiles sans vulnérabilité ; audit JS sans high/critical (low/moderate existants).
Les huit parcours navigateur de CI ont passé, plus le Journal réel et sa preview.

La suite PostGIS complète locale n’a pas pu démarrer : l’image officielle épuise
le disque de 8 Go du runtime lors de l’extraction Docker. Les tests PostgreSQL T36
ont bien tourné. La matrice SQL existante doit donc être vérifiée dans la CI GitHub ;
aucun succès PostGIS local n’est revendiqué.

## Testé à distance / activé

Migration OPS-02 déployée sur Supabase DEV `yyfbpecxvxglzxopsmel`.
Lecture des contrôles et de l’état réel après déploiement effectuée.
`run` exécuté contre Supabase avec clé OpenAI absente : `no_op`,
`already_consultable`, `paid_calls=0`, édition
`a75a9f16667b5df0d706f51259dfeceb0bdf1996801ef6dc4b1c17693f1f189d`.
Le nombre de tentatives du 10 novembre reste un ; la fin du stage et le checksum
sont effectivement persistés. Ce test ne prouve pas un dispatch du watchdog.

État conservé : acquisitions autorisées, IA désactivée, cron inactif, jeton absent.
Les étapes indispensables pour le propriétaire sont dans [RUNBOOK.md](RUNBOOK.md).
L’heure de disponibilité de la première nuit reste à mesurer après activation.

Les advisors Supabase signalent des constats préexistants liés à PostGIS et aux
RPC publiques historiques ; aucune nouvelle fonction definer/publication anonyme.
Les tables privées T36 restent fermées au public avec RLS sans politique publique.
https://supabase.com/docs/guides/database/database-linter
