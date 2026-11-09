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
