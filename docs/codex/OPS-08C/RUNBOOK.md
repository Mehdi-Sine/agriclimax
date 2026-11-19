# OPS-08C — Activer le rapport quotidien via Gmail

Le rapport part dès la publication vérifiée ou au tick Supabase de 07 h 30
Europe/Paris. GitHub Actions et Supabase utilisent la même route et le même
registre privé. Les [aperçus du rapport](../OPS-08/apercus/) permettent de
contrôler le rendu.

## Paramètres du rapport

| Nom | Emplacement | Valeur |
| --- | --- | --- |
| `SMTP_HOST` | Vercel Production | `smtp.gmail.com` |
| `SMTP_PORT` | Vercel Production | `587` |
| `SMTP_USER` | Vercel Production | Adresse Gmail complète du compte expéditeur |
| `SMTP_PASS` | Vercel Production, secret | Mot de passe d’application de ce compte Google, avec validation en deux étapes activée |
| `AGRICLIMAX_ADMIN_EMAIL` | Vercel Production | Adresse unique du destinataire |
| `AGRICLIMAX_ADMIN_REPORT_TOKEN` | Vercel Production, secret, et GitHub Actions, secret de l’environnement `editorial-ai-dev` | Même jeton aléatoire d’au moins 32 caractères |
| `agriclimax_admin_report_token` | Supabase Vault, projet `agriclimax-dev` | Même jeton, sous ce nom |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel Production | URL HTTPS du projet, déjà utilisée par le Journal |
| `SUPABASE_SECRET_KEY` | Vercel Production, secret serveur | Clé Supabase existante qui donne accès au RPC privé via le rôle `service_role` |
| `AGRICLIMAX_JOURNAL_HEALTH_URL` | Vercel Production, facultatif | Origine HTTPS du Journal, `https://agriclimax.vercel.app` par défaut |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Vercel Production, facultatif et secret | Bypass existant pour les lectures du Journal si elles sont protégées. Pour sonder une Preview protégée, passer son bypass dans l’en-tête HTTP `x-vercel-protection-bypass`. |

Pour qualifier le SMTP sur une Preview, renseigner ses cinq paramètres
d’envoi et un jeton de route spécifique à la Preview dans Vercel. La sonde
SMTP fonctionne sans accès à Supabase. En production, le watchdog cible
`https://agriclimax.vercel.app` et le workflow GitHub utilise la même URL.

[Créer un mot de passe d’application Google](https://support.google.com/accounts/answer/185833) · [SMTP sortant sur Vercel](https://vercel.com/kb/guide/serverless-functions-and-smtp)

## Bascule et vérification sans envoi

1. Si le rapport est déjà activé, retirer son jeton de GitHub et de Vault puis
   laisser finir les appels en cours et les requêtes pg_net déjà en file.
   Intervenir hors de la fenêtre opérationnelle du matin. Préparer un
   nouveau jeton Vercel pour la bascule.
2. Après revue et fusion manuelle, appliquer les migrations en attente dans
   l’ordre `20261119055621`, `20261119073437`,
   `20261119164136_ops08c_gmail_smtp.sql`. Conserver les réservations et
   réceptions existantes. Retirer `RESEND_API_KEY` et
   `AGRICLIMAX_ADMIN_FROM` de Vercel dans chaque environnement où ils étaient
   définis. Définir les paramètres Gmail et le jeton côté Vercel, puis
   déployer la version fusionnée.
3. Vérifier le déploiement visé depuis un terminal privé. Charger le jeton
   depuis le gestionnaire de secrets dans la variable shell
   `AGRICLIMAX_ADMIN_REPORT_TOKEN`. La sonde ouvre une session vers Gmail,
   impose STARTTLS et authentifie le compte. Elle se termine avant toute
   commande d’envoi et laisse le registre intact.

   ```bash
   curl --silent --show-error --fail-with-body --max-time 48 \
     --header "Authorization: Bearer ${AGRICLIMAX_ADMIN_REPORT_TOKEN:?}" \
     --request POST 'https://agriclimax.vercel.app/api/internal/admin-report?verify=smtp'
   ```

   Attendre HTTP 200 et `{"status":"smtp_verified"}`. Vercel autorise le
   port 587 sortant. Cette sonde confirme DNS, TCP, TLS et l’authentification
   depuis la fonction Node.js du déploiement ciblé. En cas de 503, vérifier
   la configuration et le mot de passe d’application côté Vercel.

## Envoi réel de test, après autorisation explicite

1. Laisser les deux déclencheurs d’envoi désarmés pendant le test. Choisir
   la date Paris du jour, après publication vérifiée ou après 07 h 30.
   Vérifier dans le registre privé que cette date est libre. Le test utilise
   le rapport du jour et compte comme son envoi quotidien. Le destinataire
   doit avoir été approuvé.
2. Exécuter une seule fois la commande suivante, sans option de relance ni
   paramètre de date.

   ```bash
   curl --silent --show-error --fail-with-body --max-time 48 \
     --header "Authorization: Bearer ${AGRICLIMAX_ADMIN_REPORT_TOKEN:?}" \
     --request POST 'https://agriclimax.vercel.app/api/internal/admin-report'
   ```

3. Vérifier `{"status":"sent"}`, `accepted_at` dans le registre, puis la
   réception dans la boîte. Si le résultat est incertain, suivre la
   procédure ci-dessous. En cas de `waiting`, vérifier la publication ou
   l’heure Paris avant toute nouvelle invocation.
4. Activer les déclencheurs après validation du test. Déposer le même jeton
   dans GitHub et Vault. Vérifier que le cron existant
   `agriclimax-t36-watchdog` est actif à la cadence `*/15 * * * *` et
   appelle `agriclimax_private.editorial_watchdog()`. Le tick de 07 h 30
   déclenche le rapport si la date est encore libre. Les ticks suivants
   peuvent rappeler la route jusqu’à 12 h tant qu’aucune tentative n’a
   été enregistrée.

## Réconciliation et arrêt

Dans l’éditeur SQL de Supabase réservé aux administrateurs, consulter uniquement
les métadonnées du jour.

```sql
select edition_date, reserved_at, smtp_claim_id, accepted_at
from agriclimax_private.editorial_admin_mail
where edition_date = (now() at time zone 'Europe/Paris')::date;
```

- Une ligne avec `accepted_at` signifie que le serveur SMTP a accepté le
  message. La réception en boîte se vérifie séparément.
- Une ligne sans `accepted_at` bloque tout nouvel envoi automatique pour
  cette date, y compris après interruption, perte du reçu SQL ou erreur
  SMTP. Chercher dans les messages envoyés Gmail et dans la boîte du
  destinataire avec le Message-ID
  `<climacta-AAAA-MM-JJ-UUID@agriclimax.vercel.app>` (UUID =
  `smtp_claim_id`). L’absence de résultat ne prouve pas que le message a
  été refusé. Conserver la ligne. Une réservation antérieure à la bascule
  a un UUID vide et bloque également la date.
- Pour suspendre le rapport, retirer le jeton de GitHub et Vault, puis
  retirer le jeton et les identifiants SMTP côté Vercel et redéployer.
  Conserver le registre. Le cron continue d’assurer les rattrapages du Journal.
