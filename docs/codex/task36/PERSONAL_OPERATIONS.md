# Décision propriétaire — budget géré dans OpenAI

Les réservations, plafonds applicatifs et rapprochements financiers ne conditionnent
plus T36. Le parcours actif utilise `generateOperational` et un verrou par date :
tentatives distinctes, reprise manuelle après erreur pour la même date, aucune
relance automatique, aucune régénération d’une édition techniquement validée.
L’ancien HTTP 400 et ses montants historiques restent inchangés. Les tokens et
coûts sont des métadonnées facultatives ; le coût calculé est une estimation,
jamais une facture prétendument retournée par Responses.

Migration ciblée `20261109152744_editorial_operational_attempts.sql` appliquée en DEV :
contrainte financière retirée, index unique sur les tentatives actives par date et
RPC invoker service-only dédiée. Aucun nouveau tableau, aucune activation quotidienne
ni publication publique. Tests : 558 tests locaux passés, recette SQL et deux vraies
connexions concurrentes locales (une seule admission), contrôle DEV avec rollback.
Le dossier réel du 9 novembre conserve son snapshot et sa date pour l’essai autorisé.

Les consignes comptables ci-dessous sont historiques et ne s’appliquent plus.

<details><summary>Historique antérieur à la décision propriétaire</summary>

# Mise en service contrôlée

État DEV et preuves : voir [ACCEPTANCE.md](ACCEPTANCE.md). Aucun merge automatique.

1. Réconcilier l'unique résultat OpenAI inconnu ; conserver sa provision et son historique. Ne pas demander une nouvelle clé.
2. Renseigner séparément dans Vault `agriclimax_t36_github_dispatch_token`, token propriétaire Actions:write limité à ce dépôt. Ne pas copier un jeton éphémère du runtime. Le cron installé reste inactif.
3. Réutiliser le secret Vercel existant comme `VERCEL_AUTOMATION_BYPASS_SECRET` dans `editorial-ai-dev`, configurer l'origine health. L'environnement n'a aucune règle d'approbation obligatoire. Les secrets sources et OpenAI sont présents dans le runner ; leur présence seule ne prouve pas chaque autorisation fournisseur.
4. Après revue/CI et fusion manuelle, activer `AGRICLIMAX_NIGHTLY_ENABLED` et acquisition DB seulement, IA/publication désactivées. Les anciens PRA/daily sont actuellement activés mais céderont la main à NIGHTLY. Activer séparément le job cron après disponibilité du workflow sur main et configuration Vault.
5. Mesurer une nuit sans IA, reprises à 30 minutes, gel 05:40 Paris, réutilisation des archives et contrôles 06:30/06:45/07:00. Après réconciliation, nouvelle autorisation explicite pour un cycle IA borné et archivé. Relecture puis publication indépendantes.

Accès propriétaire : `/journal/personnel`, authentification Basic utilisateur `owner` et secret Vercel existant comme mot de passe, ou en-tête serveur `x-vercel-protection-bypass`. Aucun secret dans l'URL. L'hébergement Vercel peut aussi demander son authentification de protection. Les brouillons réellement vérifiés sont privés même en attente de relecture ; les fallbacks et sorties rejetées n'y deviennent pas articles IA.

Arrêt DB :
```sql
update agriclimax_private.editorial_control
set acquisition_enabled=false, ai_enabled=false, publication_enabled=false
where singleton;
```
Arrêt serveur : `AGRICLIMAX_AI_ENABLED=false`, `AGRICLIMAX_PUBLICATION_ENABLED=false`, `AGRICLIMAX_NIGHTLY_KILL_SWITCH=true`. Désactiver aussi le cron pour arrêter les dispatchs. Zéro nuit de disponibilité mesurée ; recette 14–21 nuits à réaliser.

</details>
