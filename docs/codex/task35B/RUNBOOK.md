# Procédure propriétaire — sans publication automatique

## Avant l'intégration

Cette PR n'autorise ni n'exécute une génération payante. Aucun secret n'est à coller dans Codex. Aucun workflow n'est déclenché par l'agent. Le workflow dispatch doit être fusionné sur la branche par défaut avant d'être normalement proposé dans GitHub Actions. Ne pas merger automatiquement.

## Vérifier la clé et le modèle via GitHub

Créer l'environnement GitHub `editorial-ai-dev`, lui appliquer une restriction à la branche par défaut et une approbation du propriétaire, puis y configurer le secret `OPENAI_API_KEY` dans les réglages sécurisés GitHub. Ne jamais le mettre dans une variable publique, un fichier versionné ou une entrée de workflow.

Après revue/intégration, le propriétaire ouvre **Actions → Manual editorial AI verification → Run workflow**, choisit la branche par défaut, `verify-model` et `gpt-6.1-terra` (ou explicitement Luna). L'opération fait un seul GET `/v1/models/{id}`, jamais de POST Responses. Un reçu sans clé est disponible comme artifact sept jours. Les erreurs 401/403/404 sont différenciées sans afficher le corps fournisseur.

Choisir `generate-once` sur GitHub produit volontairement `EPHEMERAL_CI_GENERATION_DISABLED`, sans secret ni requête. Ne pas remplacer ce blocage par un cache ou un téléchargement d'artifact financier : ils ne garantissent pas la réservation après interruption.

## Qualifier une fois l'hôte DEV persistant

Utiliser un unique hôte Linux administré par le propriétaire, sur disque réellement persistant ext4/XFS/Btrfs, hors conteneur overlay, tmpfs et runner Actions. Prévoir sauvegarde cohérente, droits privés et accès exclusif au store. Ne pas cloner le registre dans plusieurs hôtes actifs.

Le propriétaire provisionne `/var/lib/agriclimax-ai` (mode 0700, propriétaire du compte d'exécution) sur ce volume, puis exécute une seule fois :

```sh
pnpm editorial-ai:live init-store --ack-persistent-dev-store
```

Le store est `/var/lib/agriclimax-ai/store`, l'ancre `/var/lib/agriclimax-ai/anchor.json`. Aucun argument ou variable d'environnement ne peut les déplacer au prochain lancement. Une ancre ou un store incomplet bloque l'opération et exige une vérification humaine ; ne pas les effacer pour réessayer. Sauvegarder ancre, registre, archives et diagnostics ensemble. Le verrou laissé après crash ne doit jamais être supprimé pour forcer un nouveau paiement.

## Préparer l'essai réel

Récupérer le code revu et ses dépendances verrouillées. Fournir `OPENAI_API_KEY` uniquement au processus serveur, via le gestionnaire de secrets de l'hôte, hors dépôt ; désactiver toute trace shell `set -x`. Les exemples suivants supposent ce secret déjà chargé sans l'afficher.

```sh
pnpm editorial-ai:live estimate --model gpt-6.1-terra
pnpm editorial-ai:live verify-model --model gpt-6.1-terra --output work/task35B/model-access.json
pnpm editorial-ai:live preflight --model gpt-6.1-terra --output work/task35B/preflight.json
```

`estimate` n'utilise pas de clé, n'ouvre pas de store et n'autorise rien. `verify-model` est distinct de la génération, sans dépendance aux variables de tarifs fictifs. `preflight` lit sous verrou le registre partagé. Vérifier les tarifs officiels datés et la conversion ; la grille au-delà de sept jours ou un reçu d'accès au-delà de 24 heures sont refusés. Aucun plafond ne sera augmenté si le préflight refuse.

## Autoriser exactement une génération

Dossier par défaut : replay réel du **30 octobre 2026**, pas l'actualité du jour. Examiner son identité, ses faits, ses limites, les fenêtres théoriques de l'Almanach et les publications T34 autorisées. Il ne contient aucune carte qualifiée à inventer.

Après ces vérifications, le propriétaire choisit personnellement de dépenser au plus 0,15 € et lance :

```sh
AGRICLIMAX_AI_ENABLED=true pnpm editorial-ai:live generate-once \
  --model gpt-6.1-terra \
  --access-receipt work/task35B/model-access.json \
  --authorize-once 20dbb0cf1ead680f6f95ea86224907066efd63c27511915a4f707c1ce5fe1ac6 \
  --output work/task35B/result.json
```

L'autorisation porte sur le bundle exact. Une clé seule ne suffit pas. Le plafond global reste 5 €/mois, le plafond édition 0,15 €, la sortie 6 000 tokens au maximum (réductible avec `--max-output-tokens`, jamais relevée par ce protocole). Le budget est recontrôlé sous le verrou de génération avant le seul POST. La consultation et les commandes `report` ne génèrent rien.

Les expériences comparatives ne sont pas autorisées par cette procédure : aucune bascule vers Luna ni second appel correctif automatique. Choisir Luna pour le premier essai exige sa propre vérification GET et son choix explicite dans les commandes. Une comparaison ultérieure exige une autorisation et un budget spécifiques, compris dans le plafond global.

En cas d'échec ou d'issue ambiguë, conserver les fichiers et consulter le registre, les diagnostics et le compte OpenAI avant toute décision. Le code ne relance pas. Une sortie rejetée conserve son diagnostic et produit un repli, clairement distinct d'un article IA réussi. Aucune permission de nouvelle dépense n'est implicite.

## Revoir puis rendre visible en Preview

```sh
pnpm editorial-ai:live report --edition IDENTIFIANT_EDITION
pnpm editorial-ai:live approve-preview \
  --edition IDENTIFIANT_EDITION --checksum EMPREINTE_ARCHIVE \
  --reviewer IDENTIFIANT_PUBLIC_DU_RELECTEUR --ack-preview-only
```

Lire le véritable article et son dossier avant la seconde commande, appliquer la grille d'évaluation, puis approuver seulement sa visibilité expérimentale. Une simulation ou un repli ne peut pas devenir un « vrai article » par cette commande. Le reçu est immuable et lié au checksum. Le statut scientifique reste `needs_editorial_review` si nécessaire ; aucun `approved` ou `published` public n'est introduit.

Sur le serveur Next DEV uniquement, définir `AGRICLIMAX_AI_PREVIEW_ARCHIVE_DIR=/var/lib/agriclimax-ai/store`, puis ouvrir `/journal/preview`. Les vraies archives sans reçu de revue sont masquées. Le rendu emploie la maquette et les cartes existantes ; une carte absente reste absente. Ne jamais configurer la clé dans le navigateur. Aucun transfert automatique du DEV vers Vercel ou le Journal public n'est prévu ; un tel transfert nécessitera une revue séparée des seuls fichiers d'archive, sans secret.

Le coupe-circuit `AGRICLIMAX_AI_ENABLED` est requis uniquement pour `generate-once`. Les variables `AGRICLIMAX_AI_MONTHLY_BUDGET` et `AGRICLIMAX_AI_MAX_EDITION_COST` peuvent abaisser les plafonds ; toute valeur supérieure à 5 €/0,15 € est refusée. Les anciennes variables de tarifs fictifs ne remplacent jamais la grille officielle du protocole réel.
