# Interface batch et préparation T36

Simulation hors ligne, depuis la racine :

```sh
pnpm editorial-ai:generate --briefing docs/codex/task33/evidence/briefing-example.json --store work/task35/archive --output work/task35/edition.json
pnpm editorial-ai:typecheck
```

Le script n'expose pas de route de génération HTTP. Il écrit uniquement le chemin local/DEV demandé. Un appel réel exige une activation explicite : paramètres serveur documentés dans COST_BUDGET, clé présente puis `--live-authorized`. Vérifier séparément l'accès au modèle avec `--verify-model` ; cette vérification ne doit pas être répétée dans le batch normal. Aucun appel réel n'a été effectué dans cette livraison.

Le batch s'arrête avant transport en cas de configuration invalide, modèle/tarifs non vérifiés, budget dépassé ou run non réconcilié. Une sortie inutilisable produit un repli déterministe ; un ancien dossier valide peut toujours être relu. La Preview ne génère jamais une édition manquante.

T36 devra : acquisition → calcul qualifié → T33 → T34 déjà préparé → unique génération → contrôle → archive → approbation/publication. Définir un cutoff avant 06 h 30 Europe/Paris, gérer heure d'été/hiver et retards des observations J−1, puis tester plusieurs nuits. Ne pas supposer l'arrivée des observations la veille. Le dossier transporte cutoff, âge et périodes distinctes.

À raccorder : disque durable ou transaction/verrou distribué unique, secret OpenAI de projet restreint, tarifs entretenus, réconciliation opérateur des dépenses ambiguës, manifeste atomique des éditions approuvées, conservation/rétention, supervision et stratégie dernière édition publiée avec signal de fraîcheur. Aucun cron, workflow de production ni déploiement automatique modifié par T35.

`dailyPlan` expose la cible 06 h 30 Paris, le cutoff UTC fourni par le futur ordonnanceur, la fraîcheur séparée observation/prévision, l'état après cutoff/insuffisant/dégradé et l'identité de repli. Le plan conserve `publication_enabled:false`. Une révision locale peut être demandée avec `--revision N --supersedes SHA256` ; aucun écrasement de l'original.

T35B remplace la procédure d'appel réel : l'ancien `--live-authorized` est bloqué pour empêcher un nouveau chemin `--store` de réinitialiser le budget. Utiliser uniquement `editorial-ai:live` et le protocole de l'hôte DEV persistant dans `../task35B/RUNBOOK.md`. La simulation T35 reste disponible.
