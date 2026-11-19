# Activer le rapport quotidien Climacta

1. Valider les quatre [aperçus HTML](apercus/), puis appliquer la migration
   `20261119055621_ops08_admin_report.sql` selon la procédure Supabase habituelle
   et déployer la version fusionnée sur Vercel.
2. Dans Resend, vérifier le domaine expéditeur et créer une clé limitée à
   l’envoi. Renseigner **uniquement sur Vercel Production**
   `RESEND_API_KEY`, `AGRICLIMAX_ADMIN_FROM` (une adresse du domaine vérifié)
   et `AGRICLIMAX_ADMIN_EMAIL` (une adresse administrateur).
3. Créer un jeton aléatoire d’au moins 32 caractères. Le renseigner sous
   `AGRICLIMAX_ADMIN_REPORT_TOKEN` sur Vercel Production et dans l’environnement
   GitHub Actions `editorial-ai-dev`. Ajouter la même valeur dans Supabase Vault
   sous `agriclimax_admin_report_token`. Redéployer Vercel si les variables
   viennent d’être ajoutées.
4. Vérifier que le job Supabase existant `agriclimax-t36-watchdog` est actif,
   à cadence `*/15 * * * *`, et que sa commande appelle
   `agriclimax_private.editorial_watchdog()`. Cette fonction prend en charge
   l’envoi à 07 h 30 Paris et le retente au quart d’heure jusqu’à midi tant que
   Resend n’a pas accusé réception. Si le job est inactif, son activation
   réactive également les rattrapages existants du Journal.

Le watchdog appelle la même route que l’étape finale du workflow. La date
Europe/Paris sert de clé dans Supabase et chez Resend. En cas de réponse
incertaine, le message exact est réutilisé. Les tentatives dont le reçu reste
inconnu s’arrêtent avant l’expiration de la clé Resend. Le registre distingue
l’acceptation par Resend de la réception dans la boîte mail.

Pour couper le rapport, retirer le secret GitHub et l’entrée Vault, puis
retirer le jeton côté Vercel Production et redéployer. Conserver le registre
privé d’envoi.

## Lire les indicateurs

- L’heure vient du commit du manifeste des cartes ou du registre de
  publication certifiée pour les éditions historiques. En l’absence de ces
  métadonnées, le rapport indique « Heure inconnue ».
- Le nombre de sources compte les traitements terminés avec succès sur les six
  familles suivies. L’horizon peut provenir du dossier éditorial ou du dernier
  relevé qualifié de l’acquisition prévisionnelle de la date.
- Le temps runner additionne les traitements chronométrés dans les diagnostics.
  Le temps d’attente GitHub et l’installation des dépendances en sont exclus.
- Le registre opérationnel fournit une estimation en euros calculée sur l’usage
  OpenAI mesuré. Le montant facturé par appel y est indisponible. Un secours
  factuel peut donc afficher un coût, car la tentative IA qui l’a précédé
  reste comptabilisée.
- La miniature apparaît si une copie exacte de la carte principale publiée est
  déjà présente dans le cache du serveur qui traite la demande. Une éviction
  ou un démarrage à froid conduit à un mail sans miniature.
- 07 h 30 est l’heure de déclenchement Supabase. Un incident Supabase, Vercel ou
  Resend peut retarder l’acceptation. Les diagnostics du watchdog conservent les
  identifiants de requête et les statuts HTTP observés, et le mail signale les
  interventions fondées sur les traitements qu’il a pu lire.

## Notifications GitHub

Dans les [préférences personnelles GitHub](https://github.com/settings/notifications),
section **Actions**, garder les notifications **Web** et, après avoir vérifié le
rapport, désactiver **Email** pour éviter le doublon. Ce réglage concerne tous les
dépôts de ce compte. Pour limiter le changement à Climacta, garder les
préférences GitHub et classer côté messagerie les notifications Actions de ce
dépôt. Conserver la réception des alertes de sécurité et les notifications des
workflows critiques. Les échecs restent visibles dans les journaux Actions.
