# Décision Task20

**READY_FOR_V0.3**

Parcours national fonctionnel validé sur DEV réel : carte de 713 PRA, recherche/sélection, diagnostic descriptif et historique de 30 jours. Les trois états et les NULL sont explicites ; absence de date, réseau et reprise testés. Les contours, poids, règles et éditions Task19D restent inchangés. Pas de nouveaux diagnostics systématiques. Non-régression locale et SQL réussie ; contrôles CI/Vercel du commit final dans la PR draft.

La réserve PostGIS ne provoque pas BLOCKED conformément à l’instruction explicite de l’utilisateur du 31 octobre 2026. Correctif prêt et testé localement, sans accès propriétaire supplémentaire ni application distante. [SECURITY.md](SECURITY.md) décrit les droits encore présents et l’action d’administration restante. L’activation publique n’est pas automatique ; le nouveau parcours reste derrière `PRA_NATIONAL_ENABLED=1`.

Imperfections admises : téléchargement initial des contours exacts (~9,66 Mo compressés, pas de rechargement aux changements de date, cache persistant non confirmé), tableau historique horizontal sur mobile, lectures historiques via 30 RPC bornées. Les mesures réelles sont exploitables ; aucun SLA ou couverture climatique complète revendiqué. [Résultats et reproduction](RESULTS.md).

Aucun merge, backfill, service payant ou migration distante. Préserver les parcours v0.2 et décider explicitement de l’ouverture publique après prise en compte de la réserve d’administration.
