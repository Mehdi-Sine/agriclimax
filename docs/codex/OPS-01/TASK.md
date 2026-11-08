# TASK OPS-01 — AgriClimaX : qualification opérationnelle de la chaîne climatique quotidienne

## Contexte

Tu travailles sur `Mehdi-Sine/agriclimax`.

Partir du dernier `origin/main`, après fusion de DATA-01 (PR #65).

Créer la branche `codex/OPS-01-daily-operations`.

Les tâches précédentes ont livré les contrats climatiques, les 713 PRA, les indicateurs blé, les archives historiques et les mécanismes de reprise.

DATA-01 a rendu accessibles 30 journées historiques réelles du 1er au 30 octobre 2026, mais a démontré que l'exploitation automatique n'est pas encore validée.

**Objectif : passer d'une architecture techniquement prête à une chaîne quotidienne effectivement exploitable, surveillée et reprenable.**

Ne pas modifier les algorithmes scientifiques, le Journal ou ses composants graphiques.

## 1. Rétablir et qualifier les accès aux sources

Auditer tous les accès météorologiques nécessaires :

- Météo-France AROME.
- Météo-France ARPEGE.
- Météo-France climatologie quotidienne.
- Météo-France observations.
- Copernicus CDS / ERA5-Land.
- IFS Open Data, si utilisé.

DATA-01 rapporte notamment des erreurs HTTP 401 sur des API Météo-France, des bindings AROME/ARPEGE absents de l'environnement testé et des refus GitHub 403.

Distinguer rigoureusement :

- Secret absent.
- Secret présent mais non injecté dans le job.
- Mauvais nom de variable.
- Token expiré ou invalide.
- Produit non autorisé.
- Erreur de configuration.
- Limitation des permissions de l'environnement Codex.
- Indisponibilité du fournisseur.

Effectuer des sondes bornées, en lecture seule, lorsque les accès sont autorisés.

Ne jamais afficher de secret.

Ne pas interpréter un 401 obtenu dans un environnement de développement comme une preuve que la production GitHub est mal configurée.

Si une intervention utilisateur est indispensable, fournir une liste précise des actions à réaliser dans GitHub ou sur le portail fournisseur, sans demander de divulguer les clés.

## 2. Fiabiliser l'exécution quotidienne

Examiner `pra-climate.yml` et les autres workflows actifs.

Conserver un propriétaire clairement identifié pour chaque acquisition et publication.

Vérifier :

- Le déclenchement réel.
- Les prérequis de chaque étape.
- Les dates effectivement acquises.
- Les checkpoints.
- Les relances.
- L'idempotence.
- La cohérence des manifestes.
- La conservation des journées.
- Le maintien du dernier cycle valide.
- La propagation de la qualité CORE-01.
- L'intégrité des 713 identifiants PRA.

Éviter la création d'une seconde chaîne d'acquisition parallèle.

Ne jamais publier un nouveau pointeur courant avant validation complète des objets et métadonnées.

## 3. Valider la publication et les reprises en DEV

Préparer un pilote réaliste sur un environnement Supabase DEV isolé.

Ne pas supposer que les secrets disponibles autorisent l'écriture dans cet environnement.

Sans autorisation explicite, réaliser les tests locaux, les simulations de panne et toutes les sondes en lecture seule, puis documenter l'action précise nécessitant une autorisation.

Une fois l'environnement DEV explicitement autorisé, le protocole doit vérifier :

1. Nouvelle acquisition réelle bornée.
2. Agrégation PRA.
3. Qualification des données.
4. Écriture d'une archive immuable.
5. Vérification indépendante des empreintes.
6. Mise à jour du pointeur courant.
7. Interruption volontaire contrôlée.
8. Reprise sans doublons.
9. Conservation du dernier cycle valide en cas d'échec.
10. Restitution correcte par les API.

Ne jamais effectuer ce pilote en production.

## 4. Superviser la fraîcheur des données

Étendre les outils de DATA-01 et CORE-01.

Produire un diagnostic quotidien distinguant :

- Dernière journée historique disponible.
- Dernier cycle de prévisions valide.
- Date des données effectivement publiées par chaque fournisseur, lorsqu'elle est vérifiable.
- Dates manquantes.
- Nombre de PRA évaluables.
- Couverture partielle.
- État des calculs agroclimatiques.
- Identité de l'archive publiée.
- Durée réelle de traitement.
- Erreurs et tentatives de reprise.

Une réponse HTTP 200 ne suffit pas pour qualifier un traitement réussi.

Prévoir des alertes lisibles et un mode dégradé conservant les derniers résultats valides.

## 5. Préparer l'objectif 6 h 30 Europe/Paris

Le futur Journal doit être prêt à 6 h 30.

DATA-01 a mesuré des retards de lancement GitHub Actions dépassant six heures sur certaines exécutions.

Étudier une stratégie robuste et économique permettant de réduire ce risque.

Comparer :

- GitHub Actions avec déclenchements anticipés et contrôle de fraîcheur.
- Un déclencheur externe fiable et économique si nécessaire.
- Une architecture hybride avec supervision indépendante.

Ne pas promettre une publication garantie à la minute sans preuves opérationnelles.

Prévoir :

- Le fuseau Europe/Paris et les changements d'heure.
- Un cutoff éditorial.
- Une marge pour les calculs.
- Le gel des données validées.
- Le maintien de l'édition précédente si le traitement échoue.
- Une publication ultérieure distincte pour les données climatiques arrivées après le cutoff.

Préparer un protocole de mesure sur sept nuits, avec résultats exploitables et indicateurs de performance. Ne pas prétendre avoir exécuté sept nuits dans une seule session.

Ne pas activer de nouveaux crons ni de publication publique automatique sans autorisation.

## 6. Contrôler les ressources

DATA-01 a mesuré une réponse API approchant 4 Mio et un pic mémoire de recette d'environ 1,16 Gio.

Vérifier les budgets réels d'exécution et les limites de l'hébergement.

Les calculs lourds de trente jours doivent rester côté batch et ne pas être déclenchés à chaque visite.

Préparer la mutualisation des acquisitions et calculs pour les prochaines productions.

Définir un budget de ressources par cycle.

## 7. Livrables

Créer `docs/codex/OPS-01/` avec :

- `PROVIDER_ACCESS.md`
- `WORKFLOW_HEALTH.md`
- `DEV_PUBLICATION.md`
- `SCHEDULING_0630.md`
- `RESOURCE_BUDGET.md`
- `ACCEPTANCE.md`

Fournir un tableau distinguant clairement les fonctions :

- Opérationnelles et vérifiées.
- Testées uniquement localement.
- En attente d'autorisation.
- Bloquées par un accès fournisseur.
- Non encore implémentées.

Exécuter la CI complète.

Ouvrir une PR draft, sans merge.

## Critère final

Le résultat doit permettre de savoir précisément si AgriClimaX peut maintenir chaque jour un cycle climatique valide, quelles étapes fonctionnent réellement et quelles autorisations restent nécessaires.

La chaîne doit être prête pour une exploitation automatique contrôlée, sans régression scientifique ni augmentation injustifiée des coûts.

Ne pas annoncer une réussite opérationnelle complète si les tests distants ou les droits fournisseurs manquent.

Avancer de manière autonome sur toutes les opérations autorisées et livrer des preuves vérifiables.