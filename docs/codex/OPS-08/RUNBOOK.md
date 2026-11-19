# Rapport quotidien Climacta

L’activation et le test passent par le [runbook Gmail OPS-08C](../OPS-08C/RUNBOOK.md).

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
  Gmail peut retarder l’acceptation. Les diagnostics du watchdog conservent les
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
