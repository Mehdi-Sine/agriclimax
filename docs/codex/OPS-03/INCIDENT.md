# Incident du 11 novembre — constats vérifiés

Base examinée : `origin/main` b61ce89, après PR #71 (T35), #74 (T36), #75 (OPS-02), #76 (AGRO-02). Branche `codex/ops-03-journal-recovery`.

## Causes et limites des preuves

1. Préparation : défaut de projection T34 → T33 **reproduit réellement**. Les publications documentaires complètes contiennent `summary`, `revision`, etc. `buildBriefing` les conservait telles quelles dans `documentary.publications`, malgré `additionalProperties:false` dans le contrat. L'échec à `/documentary/publications/0` précédait le gel ; le catch réduisait le message détaillé à `NIGHTLY_FAILED`. Le watchdog relançait donc à juste titre un snapshot toujours absent, sans pouvoir corriger le contrat.
2. Stations : le checkpoint réel pointe sur la validation de la partition du **10 novembre**, fenêtre 4–10 novembre, `ValueError`. La politique exigeait les cinq variables de chaque station avant toute écriture et rejetait toutes les stations pour une seule fenêtre incomplète. Le reçu ne permet pas de distinguer a posteriori variable absente, station absente ou incohérence physique. La reproduction locale bornée est bloquée avant validation par **HTTP 401 DPClim** avec les accès de cet environnement. Ne pas confondre ce 401 local avec la cause historique du ValueError GitHub. La correction isole les fenêtres valides et consigne les raisons/variables manquantes ; l'ancienne publication agrégée et les anciennes stations rejetées sont conservées.
3. Prévisions : le reçu réel montre un `CalledProcessError` après seize requêtes comptabilisées, sans échec WCS enregistré, `consumption_complete:false`. L'assemblage exige aussi un sous-processus IFS et son audit indépendant. La découverte ne vérifiait que les catalogues WCS, pas la disponibilité du support IFS. Désormais cette disponibilité est vérifiée explicitement, avec repli borné sur un cycle précédent. La cause exacte du sous-processus nocturne reste **non prouvée** : GitHub refuse le téléchargement des artefacts/logs via les URLs Blob signées dans cet environnement (403). Une exécution IFS nationale bornée du 11 novembre a réussi vers 08:32 UTC : 227 requêtes, 67 965 725 octets, environ 133 s. Cela exclut un défaut permanent reproduit mais ne prouve pas la disponibilité nocturne. Les prochaines erreurs conservent sous-processus, code retour, opération, statut HTTP et compteurs sans URL ni secret.
4. Admission : `cutoff_or_frozen_snapshot` mélangeait deux conditions indépendantes. Le temps écoulé suffit à refuser l'acquisition, même sans snapshot. La migration distingue absence, cutoff nécessitant reprise explicite, snapshot gelé et archive existante. Un nouveau dossier insuffisant est diagnostiqué sans devenir définitivement immuable.

## Rattrapage réel

Snapshot partagé créé puis relu le 11 novembre :
`2e9ed6d01173cb0851505863ecd28c3e916fe0a10de3a92f2fb5769987d8446e`, qualité `fallback_valid`.
ERA5-Land : référence 4 novembre, âge sept jours, **645/713 PRA** avec quatre descripteurs complets ; les 68 autres PRA ne reçoivent aucune valeur imputée. Cycles prévisionnels antérieurs conservés avec émission, validité et provenance réelles. Aucun appel OpenAI local, clé absente de cet environnement.

La migration est testée localement mais **non déployée** : l'examen automatique d'autorisation a refusé cette modification persistante des RPC et des contrôles de reprise/appels payants sur le projet partagé. Ne pas l'appliquer indirectement. L'autorisation explicite du propriétaire reste nécessaire. Le snapshot valide et une première génération peuvent utiliser les RPC OPS-02 déjà déployées.

## Validation

- Web : 616 tests réussis, huit ignorés par les suites existantes.
- Python : 453 tests réussis dans la suite globale ; deux tests HTTP locaux bloqués par le sandbox, puis suite d'authentification réexécutée avec sockets locaux : 24/24 réussis. Les tests OPS-03 et les sous-tests d'ordonnancement/retry sont inclus.
- PostgreSQL jetable : suites ledger/review/operational/OPS-02/watchdog/OPS-03 réussies ; deux connexions simultanées produisent un snapshot immuable unique et une seule admission payante.
- TypeScript web/CLI, mypy strict des Python modifiés, lint, contrats, contrôles automation/migrations/secrets, tests de qualité exécutés. Build Next.js réussi.

Voir RUNBOOK.md pour les commandes datées et l'exigence de contrôle `/api/journal/availability` + `/journal`. Une réussite Actions ou un snapshot ne prouve jamais une publication.

## Premier appel réel et faux positif de validation

Run GitHub `42989775337` : un seul appel OpenAI, réponse enregistrée et archive
`2445b514d5acad3e75627c2091ae7f50a80216a2b4cfc13f37cab9d55c0ebcd0`.
Le validateur rejetait la phrase prudente « aucune moyenne régionale ne peut être déduite » comme une extrapolation régionale. Correction par le même qualificateur de négation déjà utilisé pour l'agronomie ; les assertions affirmatives, y compris après « mais », restent rejetées et sont testées.

La même réponse est **revalidée localement**, sans génération : erreurs `[]`, statut `needs_editorial_review`, révision proposée
`bdde45c62dc8d0df6e87687c6dfe81d4c392b9dea721158dc9e0751482497af5`.
Une entrée de registre de portée `revalidation`, à coût nul, est nécessaire à la clé étrangère existante des archives ; elle ne déclenche aucun fournisseur. La nouvelle révision n'est pas enregistrée à distance tant que la migration n'est pas autorisée. Le premier reçu, son texte et son coût restent inchangés.

Chromium a constaté HTTP 200 et l'édition du 11 novembre dans le Journal de production. Ce lecteur encore sur l'ancien code admet l'archive expérimentale rejetée : **cet affichage ne prouve pas une publication validée**. Aucun enregistrement `editorial_publications` pour le 11 novembre ; la certification reste désactivée par le contrôle existant. Il faut appliquer la migration autorisée, exécuter la revalidation, déployer le code et relire la disponibilité. Aucun second appel OpenAI n'est nécessaire.

Validation Python finale : **455 tests réussis**, 35 sous-tests. La première CI distante a montré deux échecs SQL : les fixtures OPS-02/ledger supposaient encore le refus unique des dates futures et le gel définitif de l'insuffisance. Elles sont adaptées aux nouveaux états ; aucune règle scientifique n'est déduite de ces fixtures purement techniques.

La matrice PostGIS complète locale n’a pas terminé : extraction de l’image interrompue par le disque de 8 Go. Les tests PostgreSQL légers, y compris la nouvelle révision, ses clés étrangères, le texte immuable et la concurrence, passent. Le code doit être revérifié par la CI PostGIS distante avant fusion.
