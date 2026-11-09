# T35B — Déclenchement volontaire du premier essai

Base : `origin/main` après la fusion de #71 (`7f03354`). Frontières : transport Responses et vérification GET, grille officielle et conversion, préflight financier, qualification du store DEV, autorisation manuelle et approbation de visibilité Preview. Aucun calcul scientifique, collecteur T34, Almanach, Journal public ou cron n'est modifié.

Le workflow `editorial-ai-manual.yml` ne répond qu'à `workflow_dispatch`. `verify-model` exige le propriétaire et la branche par défaut ; le secret n'est injecté que dans l'étape GET. `generate-once` est volontairement désactivé sur les runners éphémères : aucun checkout, secret, requête ou tentative de reconstruction du budget depuis un cache Actions. Une relance du workflow ne recrée donc jamais un budget de génération.

Le CLI `editorial-ai:live` opère sur un seul hôte Linux DEV persistant, avec ancre et répertoire fixes sous `/var/lib/agriclimax-ai`. L'initialisation est exclusive et distincte de la génération. Un store manquant ou une ancre différente ne sont jamais recréés implicitement. Les contextes CI/GitHub Actions, overlay/tmpfs et liens symboliques sont refusés. Seuls ext4, XFS et Btrfs sont qualifiés par le garde local ; le propriétaire doit garantir la persistance physique et les sauvegardes. Ce garde n'est pas un consensus distribué : un seul hôte et un seul volume font autorité, sans copies actives concurrentes.

T35 est réutilisé pour le verrou global, les écritures fsync/atomiques, l'identité quotidienne, la réservation avant POST, le validateur et l'archive immuable. L'ancien CLI T35 ne permet plus de payer via un `--store` nouvellement choisi. Un nouveau lancement sur le même hôte relit le même registre. Un registre incohérent ou un état ambigu bloque les dépenses.

Le profil réel force Standard, raisonnement low et cache explicite sans breakpoint. Il n'a aucun outil ni accès DB/web pendant la génération. La réponse entière reste soumise au schéma strict et au contrôle indépendant. Les métadonnées d'usage connues sont conservées même lors d'une sortie incomplète/refusée ; l'état ambigu ne déclenche jamais de retry.

La visibilité d'une vraie archive en Preview exige un reçu de revue séparé lié à son checksum. Ce reçu ne change ni le texte, ni le statut scientifique, ni une publication publique. Les simulations existantes restent étiquetées. La lecture ne charge ni clé ni générateur.
