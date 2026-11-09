# Premier article réel — non produit

Autorisation du propriétaire : un véritable appel, plafond 0,15 €. Cet appel n’a
pas eu lieu : OPENAI_API_KEY absent de l’environnement et migration DEV refusée par
la revue automatique. Aucun coût OpenAI engagé par T36. La présence éventuelle
d’un secret GitHub ne peut être vérifiée : endpoint secrets/variables HTTP 403.

Un vrai dossier T33 a été préparé en lecture seule : voir snapshot compressé et
metrics dans evidence. Il contient 12 faits, les vraies dates d’émission et les
limites historiques. Ce dossier est une preuve de sélection, **pas** un article IA.

Après déploiement DEV autorisé, depuis la branche déployée et un environnement
serveur configuré (ne jamais coller de clé dans le chat) :

```sh
pnpm editorial:nightly prepare
pnpm editorial:nightly preflight
# Vérifier le snapshot et le plafond ; activer AI dans le contrôle SQL et l’environnement.
AGRICLIMAX_AI_ENABLED=true pnpm editorial:nightly run
pnpm editorial:nightly report
```

Modèle initial qualifié : gpt-6-luna, registre de prix T35B à revalider après 7 jours.
Le preflight donne borne de tokens/coût ; la réservation SQL est l’autorité finale.
L’accès modèle est vérifié avant la réservation. Une seule requête Responses, aucun
retry payant. Relever response_id, usage, coût provisionnel EUR, durée, checksum,
validation et état run. Réconcilier avec facture avant de parler de coût facturé.

Un texte nouveau obtient normalement needs_editorial_review avec le validateur
conservateur T35. Le propriétaire relit avant promotion explicite par checksum.
Ne pas assouplir le validateur pour forcer une publication automatique.
