# Décision finale — Task26C nationale, DEV

État de référence du6novembre2026, heures des opérateurs Europe/Paris, périodes scientifiques UTC. Branche `codex/26-national-daily-climate`, PR55 conservée en draft, aucun merge ni déploiement production.

| Volet | Verdict | Portée |
|---|---|---|
|READY_FOR_NATIONAL_RECENT_WEATHER|READY en DEV exploratoire|713PRA,5novembre J−1 : estimation issue de prévisions antérieures, aucune observation/analyse revendiquée|
|READY_FOR_NATIONAL_J7_FORECAST|READY en DEV exploratoire|713PRA référencées et valeurs qualifiées jusqu'au13novembre ; carte/API/fiche réelles, NULL explicites|
|READY_FOR_ERA5_DAILY_AUTOMATION|NOT_READY|writer incrémental archive-only et nouvelle journée non validés ; cron sur main incompatible avec maintien draft|
|READY_FOR_COASTAL_COVERAGE|NOT_READY pour qualification terrestre validée|toutes PRA traitées et limites exposées, masque physique MF et validation terrestre manquants|
|READY_FOR_PRODUCTION_REVIEW|NOT_READY|limites scientifiques, exploitation quotidienne et consommations partagées à fermer|

« READY » sur les deux premiers volets signifie fonctionnalité nationale DEV vérifiée, pas qualité statistique de prévision, autorisation de production, ni automatisation active.

## Disponibilités et exploitabilité

Dernière journée ERA5-Land nationale :**30octobre2026**, sans réacquisition des jours déjà terminés. Dernière météo récente :**5novembre**, ancien run AROME5novembre00UTC. Cycle prévisionnel :**6novembre00UTC**, échéances J+1 à J+7 (7–13novembre), dernière validité**13novembre**. Cinq variables réelles :Tmoy,Tmin/Tmax échantillonnés, pluie, RH ; vent10m non acquis dans ce budget.

713PRA/jour,49910 lignes sources,32085 sélectionnées. Températures :713/713(100%) chaque journée5–13novembre. Pluie :713/713 sauf11novembre519/713(72,79%). RH exploitable par journée5–13novembre :350,178,261,521,573,456,556,499,478 sur713(24,96–80,36%). NULL et motifs conservés ; aucune couverture scientifique complète annoncée sur la seule présence d'un identifiant.

Crozon/LaHague/Méditerranée/Corse sont explicitement audités. AROMEproxy territorial Crozon83,03%, LaHague94,41% ; ARPEGE Crozon0%, LaHague79,77%. Ce ne sont pas des masques terre/mer. VraiLSM IFS Crozon63,46%,LaHague37,28%,Méditerranée88,16%,Corse littorale70,97%,Corse montagne96,05%. Aucun renormalisage terrestre implicite ; voir COASTAL_COVERAGE.md.

## Acquisition, archives et exploitation

Cycle réel :413 appels mutualisés,95,18Mo,11min35,RSS889516KiB ; aucune requête parPRA. Archive nationale562843octets, SHA25662ab191f162a076003ffba79994858fcef0692b3e1f52e1abef1652f2d3c6066. Rejeu dédié :0acquisition/0écriture,49910 lignes identiques. Archive froide lue dans l'API et restaurationDEV complète2852lignes/713PRA×4jours sans différence ; historiques, normales, RPG/SAA conservés.

Projection24mois :599426360octets d'agrégats météo+ERA, sous garde900MiB et enveloppe théorique1Go d'objets. Le stockage n'a pas24mois d'ancienneté : projection chiffrée et lecteur testés, purge non activée. Le writerERA archive-only reste à valider. Les quotas egress, artefacts partagés et Vercel ne sont pas garantis à trafic illimité.

Planification météo nationale/ERA :**désactivée**. DispatchDEV protégé, checkpoints/reprise, catalogue après validation et supervision read-only fonctionnent. HealthDEV préparé et testé, flag non activé. GitHub exécute les crons sur la branche par défaut ; main n'est pas modifiée dans cette PRdraft. De plus95,62Mo×7 artefacts quotidiens≈669Mo dépasseraient une enveloppe500Mo : revoir la rétention future ou compacter avant activation, sans supprimer l'existant. Aucun abonnement payant ajouté.

## Seules opérations restant avant production

1. Valider scientifiquement RH/accumulations source, représentativité littorale terrestreMF, scores par échéance sur une référence réelle et plusieurs cycles ; comparaison ERA récente/stations seulement sur dates/accessibles communes.
2. Valider le writerERA incrémental archive-only sur une nouvelle journée et sa restitution ; ne pas retraiter20–30octobre. La règle90% reste une expérience de moyenne observée, pas une nouvelle normale/extrema/anomalie.
3. Confirmer les quotas et compteurs Actions/Storage/egress du compte, limiter les futurs checkpoints et préparer le suivi de consommation serverless. Aucune suppression existante autorisée.
4. Après revue séparée, rendre le workflow approuvé disponible sur la branche par défaut, activer DEV uniquement et contrôler la première journée automatique/fraîcheur/reprise. Aucune activation ni publication production dans cette tâche.
5. Obtenir la campagne finale verte et la revue finale dePR55 ; garder cette PRdraft jusque-là.

Preuves et validations : NATIONAL_ACCEPTANCE.md et répertoires national-evidence/, national-local/, national-preview/, operational-evidence/task26c-*.json. Les verdicts fonctionnels reposent sur ces rapports réels ; aucune acquisition nationale nouvelle pour finaliser la recette.
