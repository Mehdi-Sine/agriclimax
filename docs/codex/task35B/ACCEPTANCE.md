# T35B — Réception technique

Statut : **READY_FOR_OWNER_MANUAL_TEST**. Appels OpenAI authentifiés effectués par l'agent : 0 ; générations payantes : 0 ; coût réel : 0 €. Aucun workflow n'est dispatché pendant la PR. L'accès effectif aux deux modèles dans le projet du propriétaire reste à vérifier manuellement.

Livraison : grille officielle datée et bornée en euros ; profil Responses Standard/cache explicite ; vérification GET distincte ; workflow exclusivement manuel ; génération Actions bloquée ; protocole local persistant à ancre fixe ; diagnostics budgétaires chiffrés ; refus de contournement par l'ancien CLI ; reçu explicite de visibilité Preview lié à l'archive. Ni Journal public, ni cron, ni publication automatique modifiés.

Estimations du dossier réel T33 : `evidence/terra-estimate.json` et `evidence/luna-estimate.json`. Elles n'ont ni interrogé le projet OpenAI ni lu son registre financier ; elles ne constituent donc pas une autorisation. Le budget disponible sera établi sur l'hôte DEV qualifié au préflight.

Les tests sans dépense vérifient : GET unique et erreurs assainies ; schéma strict ; prix officiels, expiration, conversion et seuil contextuel ; paramètres sans cache implicite/Fast ; réservation, insuffisance de budget, limites non relevables, registre durable et corruption ; refus CI/overlay/tmpfs/symlinks ; ancien CLI bloqué ; autorisation Preview et rejet des simulations ; conservation des tokens lors d'une sortie incomplète et absence de retry. Les tests structurels du workflow interdisent tout trigger automatique et toute clé dans le mode de génération bloqué.

Les résultats locaux, la CI complète et l'URL de Preview sont consignés dans la PR. Les parcours desktop/mobile T35 sont conservés dans la CI pour vérifier la présentation existante. Aucun résultat ni capture de véritable article n'est disponible avant la décision explicite du propriétaire. Consulter RUNBOOK.md et EDITORIAL_EVALUATION.md pour cette étape.

## Résultats locaux sans dépense

- 515 tests TypeScript passent, 7 cas préexistants ignorés ; 92 contrôles éditoriaux ciblés dont 29 nouveaux T35B.
- 417 tests Python moteur et 24 tests de qualité passent.
- Lint, typecheck web et CLI, build Next de production, contrats, Ruff et actionlint : passés.
- Secrets sources/bundle, migrations et budget client : passés ; 651 318 octets gzip JS/CSS sur 2 097 152 autorisés.
- 28 contrôles Chromium desktop/mobile sur les replays **simulés T35** : passés, zéro requête OpenAI et zéro erreur JS. Captures de non-régression dans `evidence/browser/`, pas des captures d'un article réel.
- Le refus CI a été exécuté sans secret : `EPHEMERAL_CI_GENERATION_DISABLED`, zéro appel ; reçu dans `evidence/ci-generation-blocked.json`.

Les compteurs d'estimation ne remplacent jamais le registre réel. Le store qualifié n'a pas été initialisé sur cet environnement cloud : il n'est pas l'hôte DEV persistant autoritaire. Les commandes avec clé, l'initialisation de l'hôte, le premier article et sa revue restent des actions du propriétaire après validation des outils.
