# Exploitation personnelle 14–21 jours

Aucune ouverture bêta ni nouveau dashboard. `pnpm editorial:nightly report`
produit un rapport privé sous work/task36 et un diagnostic Supabase. Historique
21 jours : acquisitions, tentatives, checkpoints, fraîcheur/cycles, T33, émission IA,
coût réservé/réel, publication, contrôle page et alertes. Le snapshot garde les
qualifications et les limites PRA, les indicateurs et le lot documentaire T34.

Actions de mise en service regroupées, **après relecture de la PR** :

1. Autoriser/appliquer la migration DEV puis `supabase/ops/task36_watchdog.sql` ;
   vérifier RLS/advisors, extensions, cron et limites Free. Configurer dans Vault le
   token Actions:write, et dans l’environnement serveur OpenAI (aucune clé en chat).
2. Exécuter preflight puis un seul run réel borné ; relire/archiver/promouvoir en DEV
   avec l’empreinte. Vérifier le rendu date/carte et le reçu financier avant toute
   publication publique. La publication publique requiert un accord séparé.
3. Après validation : activer `AGRICLIMAX_NIGHTLY_ENABLED` et les contrôles DB adaptés ;
   renseigner l’origine health ; vérifier les variables/secrets GitHub non lisibles
   ici. Tester une nuit sans IA puis les contrôles 06:30, 06:45, 07:00.

Arrêt immédiat serveur : `AGRICLIMAX_AI_ENABLED=false`,
`AGRICLIMAX_PUBLICATION_ENABLED=false`, `AGRICLIMAX_NIGHTLY_KILL_SWITCH=true`.
Arrêt DB (autorité indépendante) :

```sql
update agriclimax_private.editorial_control
set acquisition_enabled=false, ai_enabled=false, publication_enabled=false
where singleton;
```

Pour une réservation bloquée : rapprocher response_id/usage OpenAI et archive ; ne
jamais effacer le run ni réduire une provision inconnue sans preuve et note privée.
Une réservation ambiguous/outcome_unknown n’est jamais reprise automatiquement.

Chaque matin : noter heure de disponibilité, qualité du sujet, exactitude des
chiffres/sources et mentions de repli, couverture littorale/Crozon, coût et alertes.
J7 : ajuster plafonds scientifiques après examen. J14 : décider de poursuivre jusqu’à
J21. Conserver les diagnostics et les archives ; aucune purge automatique livrée.
**Zéro jour de recette nocturne observé dans cette tâche ; 14–21 jours à réaliser.**
