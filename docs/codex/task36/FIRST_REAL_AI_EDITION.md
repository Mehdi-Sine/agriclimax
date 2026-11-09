# Premier vrai texte OpenAI — 9 novembre 2026

**L’appel OpenAI a réussi. Le texte est archivé et consultable en privé avec un
rejet scientifique visible ; il n’est ni approuvé ni publiable.** Aucun fallback
n’est présenté comme article. Aucun deuxième appel n’a été fait après cette réponse.

- [Workflow manuel 42646091222](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42646091222), commit 5e42ebf, modèle gpt-6.1-terra.
- Tentative distincte `dc7d8613160ff4eb03533d49a17c52911c39d60cf268b68a2d8f9f14b2c0ea08`, même date éditoriale **2026-11-09**, même dossier réel T33 (12 faits) et snapshot `9a80aa650e29356b01095854d6ae4d546d1c7ad70ee42325805af3178c1f01c7`.
- Réponse `resp_08b02fb3b0d429b7016af1e83df37487d1ac9933f11573aacd` : **14 845 tokens entrée, 1 689 sortie, dont 44 de raisonnement**.
- Estimation diagnostique conservatrice : **0,025619 €** ; Responses ne retourne aucun montant facturé. Le suivi financier appartient exclusivement au projet OpenAI du propriétaire.
- Requête envoyée à **16:35:24 Europe/Paris**, réponse reçue environ 22 secondes plus tard. Ce n’est pas une mesure de disponibilité matinale.
- Archive JSON privée relue et SHA vérifié : `e1f6d85baaa74237ff9d94be5b97dd4f2234f4969f2773ecc63e6f4a03cfa4da`. Texte intégral, références, dossier, reçu, tokens et paramètres sont conservés en Supabase DEV ; aucune prose privée dans Git ou les artefacts CI publics.

## Résultat scientifique conservé

Le workflow est rouge avec `DRAFT_REJECTED`, **après une réponse OpenAI réussie**.
Les contrôles ont signalé : SEASON_AS_OBSERVATION, TEXT_NUMBER_OR_DATE,
UNPROVEN_AGRONOMY, TEXT_UNIT, FORECAST_AS_OBSERVATION. Le validateur n’a pas été
assoupli pour cette réponse. Son statut reste validation_failed/rejected.

La réponse complète était déjà persistée avant validation. Elle a été transférée
sans nouvel appel vers l’archive immuable, avec contrôle SHA et rattachement au
même run. L’archivage des futures sorties conformes au schéma mais rejetées
scientifiquement intervient désormais directement avant le signalement d’échec.
L’espace `/journal/personnel` permet cette inspection propriétaire, avec codes
bloquants affichés et mention « approbation et publication interdites ». Le RPC
privé d’éditions validées et le Journal public continuent à exclure ces sorties.
Un essai réel du RPC de revue en DEV a confirmé EDITORIAL_REVIEW_REJECTED ; zéro
approbation et zéro publication. Aucun chiffre ou affirmation n’est approuvé automatiquement.

## Fin des blocages comptables

Décision propriétaire : aucune consommation visible dans son dashboard pour
l’ancien HTTP400. Cette déclaration n’a entraîné aucune réécriture de l’historique.
L’ancien run `9da626c533c6e928ee5d768a21b79a4d1fe290e6356345a2faac3f8e73a0e671`
reste inchangé avec son état et ses anciennes métadonnées. Aucun justificatif ni
rapprochement ne conditionne un nouvel appel T36.

Le parcours actif utilise `generateOperational` et la RPC service-only
`agriclimax_editorial_attempt`. Les réservations, sommes mensuelles, plafonds et
blocages outcome_unknown ont quitté ce parcours. Le champ historique reserved_eur
vaut zéro pour les nouvelles tentatives ; il n’est pas une réservation financière.
Une tentative active par date est garantie par verrou transactionnel et index
unique partiel. Une édition live techniquement validée est réutilisée sans appel.
Une erreur autorise une nouvelle tentative **manuelle** distincte pour la même date ;
une reprise automatique est refusée. Les outils financiers T35 historiques ne sont
pas utilisés par T36 ; `reconcile-plan` a été retiré du CLI actif.

## Requête qualifiée

Le schéma Responses normalisé a été effectivement accepté pour cette requête :
racine object, objets fermés, champs tous requis, types explicites des const/enum,
nullable explicite et text.format json_schema strict. Reasoning low, service tier
default, cache explicit/30m sans breakpoint et 6 000 tokens sortie. L’ancien rejet
HTTP400 reste sans cause précise connue ; il n’a pas été reproduit.
Les diagnostics assainis code/type/param/request_id et UUID client restent actifs.
Les tokens et coûts facultatifs ne bloquent pas la génération ni les appels futurs.

## Suite quotidienne

Le gel, l’archive des entrées, la réutilisation de prévisions encore valables et le
passage `run` avec IA désactivée ont été réexercés sur le vrai dossier. Ce test ne
représente pas une nouvelle acquisition nocturne. Planning Europe/Paris : première
acquisition 02:15, reprises 30 minutes jusqu’à 05:15, gel/rédaction 05:40, contrôles
06:30/06:45/07:00. Les baux/cooldowns et la concurrence sont testés ; zéro nuit réelle
complète mesurée.

Avant exploitation : revue scientifique du texte, fusion manuelle de la PR #73,
activation du propriétaire nocturne NIGHTLY pour faire céder les anciens writers,
configuration de l’origine health et réutilisation du secret Vercel existant dans
editorial-ai-dev. Les secrets Supabase/OpenAI/MF/CDS sont présents ; l’environnement
n’a pas d’approbation humaine obligatoire. Le watchdog installé reste inactif ; son
jeton Vault Actions:write est requis uniquement pour son dispatch indépendant.
Activation acquisition, IA quotidienne et cron à effectuer séparément après fusion
et qualification d’une nuit. Publication publique désactivée ; la dernière édition
publique reste inchangée. Aucune garantie 06:30–07:00 avant mesures réelles.
