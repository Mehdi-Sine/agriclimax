# Décision courante : édition expérimentale consultable sur /journal

Voir [ACCEPTANCE.md](ACCEPTANCE.md) et [SCIENTIFIC_ALERT_REVIEW.md](SCIENTIFIC_ALERT_REVIEW.md).
L’affichage normal ne requiert plus d’approbation scientifique ou éditoriale.
Les alertes sont conservées ; aucune certification n’est revendiquée. L’archive
existante est réutilisée sans génération et la projection publique exclut les
métadonnées confidentielles. La mise en ligne sur le domaine normal nécessite la
promotion Vercel Production du commit préparé, sans fusion automatique.

<details><summary>Historique antérieur à cette décision produit</summary>

# État courant — premier texte OpenAI reçu

Voir [FIRST_REAL_AI_EDITION.md](FIRST_REAL_AI_EDITION.md) et [ACCEPTANCE.md](ACCEPTANCE.md).
Les contrôles comptables antérieurs ne s’appliquent plus à T36. Le texte réel du
9 novembre est archivé pour inspection privée, avec rejet scientifique visible et
publication interdite. Aucune activation quotidienne ni fusion effectuée.

<details><summary>Conception et constats antérieurs (supplantés par l’état courant)</summary>

# État actualisé — recette DEV du 9 novembre

La disponibilité privée, l'approbation éditoriale et la promotion publique sont séparées. `/journal/personnel` protégé affiche les archives live avec reçu, run completed et validation sans erreur, y compris needs_editorial_review, avec statut visible. Le fallback est exclu. `approve ID --review-checksum SHA --reviewer NAME` enregistre une décision indépendante ; `promote ID` est une opération distincte, refusée tant que publication_enabled=false. Ne jamais approuver automatiquement des affirmations non vérifiées. La dernière publication reste intacte. Aucun article réel ni publication créé pendant la recette ; aucune disponibilité à 06:30 démontrée.

Voir [ACCEPTANCE.md](ACCEPTANCE.md) pour les blocages et preuves actuels.

<details>
<summary>Conception et constat historique avant déploiement (supplantés par l’état ci-dessus)</summary>

# Publication et disponibilité

Le candidat est d’abord validé, archivé et relu par empreinte. Le pointeur logique
courant = dernière ligne datée du manifeste transactionnel. Une panne de génération
ou promotion ne supprime ni ne remplace la dernière édition validée.

`promoteEdition` revérifie contrat, empreinte et bindings des cartes avant RPC.
Un rejected/fallback/simulation n’est jamais publiable. Un texte
needs_editorial_review demande le nom du relecteur et le checksum exact :

```sh
pnpm editorial:nightly promote EDITION_ID --review-checksum SHA256 --reviewer NOM
```

Double interrupteur : env `AGRICLIMAX_PUBLICATION_ENABLED` pour le traitement
automatique, et `editorial_control.publication_enabled` en DB. Le validateur T35
exige une relecture sémantique des nouvelles phrases : publication matinale sans
intervention **non démontrée**. Ne pas prétendre que cette PR résout cette limite.

Lecture `/journal?date=AAAA-MM-JJ` opt-in serveur
`AGRICLIMAX_JOURNAL_PUBLISHED_READ=true`, maquette existante réutilisée. Dates réelles,
message discret de retard, cartes immuables à `/api/journal/edition-map`, jamais de
carte actuelle substituée. Aucun appel OpenAI à la lecture. Cache de dernier
manifeste en mémoire en secours ; une panne totale DB après cold start reste une
limite explicite (page d’indisponibilité).

À 06:30/06:45/07:00 : intégrité du candidat/manifeste, fraîcheur, cycle, coût, état,
reconciliation et `/api/journal/availability` + GET `/journal`. Configurer
`AGRICLIMAX_JOURNAL_HEALTH_URL` (origine HTTPS exacte) et bypass Vercel côté serveur.
Le watchdog SQL indépendant détecte une édition absente même sans lancement Actions.
Après 07h : dernier article daté et diagnostics ; aucun retry payant. Promotion
manuelle d’une archive prête possible sans génération supplémentaire.

Aucune disponibilité 06:30–07:00 n’a été mesurée durant cette exécution.

</details>

</details>

</details>
