# TASK 35B — AgriClimaX : premier essai réel du comité de rédaction OpenAI

## 1. Contexte

Tu travailles sur `Mehdi-Sine/agriclimax`.

La Task 35 (PR #71) a livré un moteur complet de rédaction IA, actuellement validé uniquement avec des réponses simulées.

Partir du dernier `origin/main`, après fusion de la PR #71.

Créer une branche :

`codex/35B-live-ai-editorial-validation`

**Objectif : préparer et permettre un premier appel réel à l'API OpenAI, sous contrôle budgétaire strict, afin d'évaluer la qualité d'un véritable article agroclimatique.**

Ne pas activer la publication automatique.

Ne pas modifier le Journal public.

Ne pas programmer de nouveau cron quotidien.

## 2. Principe de sécurité

L'appel réel doit être entièrement volontaire.

La présence d'une clé API ne doit jamais déclencher automatiquement une génération.

Aucun appel payant pendant les tests CI, le build, le déploiement Preview ou la simple consultation du site.

Le premier essai doit être déclenché manuellement par le propriétaire du dépôt, avec une autorisation explicite.

Ne jamais afficher, enregistrer ou transmettre la clé OpenAI.

La clé sera fournie exclusivement au traitement serveur, par un secret GitHub Actions ou un environnement local sécurisé.

Ne pas demander à l'utilisateur de coller sa clé dans Codex.

## 3. Vérifier le fonctionnement réel de l'API

Examiner les composants T35 :

- `apps/web/features/editorial-ai/provider.ts`
- `apps/web/features/editorial-ai/config.ts`
- `apps/web/features/editorial-ai/generate.ts`
- `apps/web/features/editorial-ai/archive.ts`
- `scripts/task35_editorial.ts`
- `docs/codex/task35/COST_BUDGET.md`

Vérifier la compatibilité de l'appel Responses API avec les modèles actuels et le schéma JSON strict.

Prévoir comme premier candidat :

`gpt-6.1-terra`

Prévoir éventuellement `gpt-6-luna` comme modèle moins coûteux.

Vérifier les identifiants effectivement disponibles sur le projet OpenAI.

Ne pas supposer que tous les modèles sont accessibles avec la clé utilisée.

Contrôler les tarifs officiels, leur date de vérification et leur conversion conservatrice en euros.

Ne jamais réutiliser les tarifs fictifs des fixtures.

La vérification de disponibilité du modèle doit être distincte de la génération.

## 4. Permettre un test manuel sécurisé

Préparer une procédure simple pour déclencher le premier appel réel.

Privilégier un workflow GitHub Actions dédié, déclenché exclusivement par `workflow_dispatch`, sans aucun `schedule`, `push` ou `pull_request` provoquant un appel payant.

Le workflow doit être lisible, limité et documenté.

Prévoir deux modes :

- `verify-model` : vérification sans génération payante.
- `generate-once` : unique génération explicitement autorisée.

Attention : le workflow devra être présent sur la branche par défaut avant de pouvoir être déclenché normalement depuis l'interface GitHub Actions.

Ne pas déclencher l'appel payant pendant le développement de la PR.

Si les garanties de stockage durable, de réservation budgétaire ou d'idempotence ne permettent pas un appel sûr depuis un runner GitHub éphémère, ne pas activer ce mode. Proposer alors une solution locale persistante ou un environnement DEV isolé et qualifié.

Le registre des dépenses doit rester durable et partagé entre les tentatives autorisées, afin que la recréation d'un runner ne remette pas les compteurs à zéro.

Ne pas permettre qu'un simple nouveau lancement du workflow contourne les plafonds.

## 5. Budget du test

Conserver les limites T35 :

- 5 € maximum par mois pour l'application.
- 0,15 € maximum par édition.
- Un seul appel normal par édition.
- Aucun retry payant automatique après une issue ambiguë.

Pour le premier essai, utiliser une configuration plus restrictive si nécessaire.

Vérifier le budget avant d'autoriser l'appel.

En cas de refus budgétaire, produire un rapport précis : modèle, estimation d'entrée, borne de sortie, coût réservé, plafond disponible.

Ne pas augmenter automatiquement les limites.

Les éventuels essais comparatifs de modèles doivent disposer d'une autorisation spécifique et être comptabilisés dans le budget global.

## 6. Premier article à générer

Utiliser en priorité un dossier réel déjà vérifié de T33, par exemple le replay du 30 octobre 2026.

Il s'agit d'un historique réel, mais pas de l'actualité du jour.

Le Journal doit donc indiquer clairement qu'il s'agit d'une édition expérimentale reconstruite.

Conserver :

- Les faits climatiques réels.
- Les épisodes temporels qualifiés.
- Les indicateurs blé.
- Les questions saisonnières de l'Almanach.
- Les rapprochements T34 réellement autorisés.
- Les limites scientifiques.
- Les références des cartes disponibles.

Ne pas inventer de nouvelles données.

Le comité IA devra produire en une seule réponse :

- Son choix de sujet principal.
- Le titre de une.
- Le chapeau.
- Un véritable article.
- Les chiffres clés.
- Des éclairages régionaux.
- Des rubriques par production lorsque les données le justifient.
- Des illustrations référencées.
- Les sources et preuves associées.

## 7. Contrôle du résultat

Soumettre la sortie au validateur indépendant de T35.

Vérifier :

- Le respect du schéma JSON.
- Les chiffres, dates et unités.
- Les noms des régions et PRA.
- Les preuves scientifiques.
- Les limites de couverture.
- La distinction entre observations, réanalyses et prévisions.
- Le contexte agronomique.
- Les références documentaires.
- La correspondance des cartes.
- L'absence de causalités ou de dommages inventés.

Toute formulation nécessitant une expertise humaine doit rester signalée pour revue.

Ne pas transformer automatiquement une édition validée techniquement en édition approuvée pour publication publique.

## 8. Évaluer la véritable qualité rédactionnelle

Je souhaite surtout juger si l'IA apporte une valeur au lecteur.

Évaluer :

- La pertinence du sujet principal.
- La qualité journalistique du titre.
- La clarté du chapeau.
- La profondeur de l'article.
- La compréhension des phénomènes climatiques.
- L'intelligence de la contextualisation agronomique.
- La pertinence des régions et productions choisies.
- L'utilisation réelle de l'Almanach.
- L'intégration des publications techniques lorsqu'elles sont pertinentes.
- La gestion des incertitudes.
- Le niveau de répétition.
- La qualité des conclusions et perspectives.

Je veux une analyse intéressante pour un décideur agricole national, pas une accumulation de chiffres mis en phrases.

Comparer ce premier article avec la sortie déterministe de T31 et les textes simulés de T35.

Ne pas présenter ces simulations comme de véritables générations OpenAI.

## 9. Archive et Preview

Conserver l'édition expérimentale dans une archive immuable DEV.

Préparer son affichage dans la maquette actuelle :

`/journal/preview`

Ne pas remplacer le Journal public.

Conserver les mêmes composants graphiques et les cartes PRA correspondantes.

Le lecteur doit pouvoir retrouver l'article généré et ses références, sans nouvel appel OpenAI.

Fournir un mécanisme explicite pour rendre une archive approuvée visible dans la Preview, sans exposer le secret ni permettre de génération depuis le navigateur.

## 10. Documentation et livraison

Créer :

`docs/codex/task35B/`

Documenter :

- L'environnement requis.
- La configuration des secrets.
- Le modèle et les tarifs vérifiés.
- La procédure manuelle de déclenchement.
- Les protections budgétaires.
- La stratégie de stockage durable du registre financier.
- Les résultats des tests sans dépense.
- Le protocole de premier appel réel.
- Le coût réel et la consommation, si un appel a été explicitement autorisé.
- Le résultat éditorial et les limites.
- Les captures de l'article en Preview.

Exécuter la CI complète.

Ne pas appeler OpenAI pendant la CI.

Ouvrir une PR draft.

Ne pas merger automatiquement.

## 11. Résultat attendu

Je veux pouvoir, après validation et intégration des outils de test :

1. Vérifier que ma clé OpenAI est fonctionnelle.
2. Vérifier que le modèle choisi est accessible.
3. Autoriser manuellement une seule génération payante.
4. Voir le coût réel de cette génération.
5. Consulter le véritable article produit.
6. Examiner ses preuves et ses éventuelles erreurs.
7. Comparer son intérêt avec le Journal déterministe.
8. Décider de la suite avant toute automatisation.

**L'objectif n'est pas encore de publier quotidiennement, mais de démontrer qu'avec un appel IA très économique, AgriClimaX peut produire une édition journalistique réellement convaincante.**

Ne pas activer de cron.

Ne pas publier en production.

Ne pas déclencher de dépense payante sans autorisation explicite.

Livrer une PR draft complète, testée et documentée.