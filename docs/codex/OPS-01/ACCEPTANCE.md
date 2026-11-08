# Recette OPS-01

**Exploitation automatique complète non qualifiée.** Le dépôt fournit les mécanismes et des preuves de lecture ; le pilote distant d'écriture et sept nuits restent à réaliser. Base `c837fcd`, branche `codex/OPS-01-daily-operations`, aucun merge.

| Fonction | Statut | Preuve / limite |
|---|---|---|
| Métadonnées Actions et étapes réelles | Opérationnelle et vérifiée en lecture | evidence/pra-runs.json, pra-jobs.json, daily-runs.json |
| Lecture archives / hash / 713 identités | Voir nouvelles preuves health ; DATA-01 reste une preuve antérieure | Aucun droit d'écriture déduit |
| Supervision enrichie, détection chaîne sautée et trous historiques | Testée localement | Tests ciblés et CI ; pas encore déployée |
| Contrôles publication et reprise avec pannes | Testés uniquement localement | Transport mémoire existant ; aucun pilote distant inventé |
| AROME/ARPEGE depuis Codex | Bloquées par accès/configuration fournisseur | Binding absent ; GitHub peut fonctionner différemment |
| MF observations/climatologie | Accès à qualifier par sondes | Un 401 ne distingue pas expiration/abonnement |
| Secrets/variables GitHub | Bloqués par permissions du client | 403 dans evidence/ ; pas preuve d'absence |
| Pilote écriture DEV isolé | En attente d'autorisation | DEV_PUBLICATION.md |
| Nouveaux horaires / timer externe / publication automatique | En attente d'autorisation | Aucun changement actif |
| Observateur externe et gel éditorial | Non encore implémentés | Proposition SCHEDULING_0630.md, Journal hors périmètre |
| Qualification 06:30 et sept nuits | Non encore exécutée | Retards observés incompatibles avec garantie |
| Quotas réels hébergement et RSS du nouveau cycle | Non encore vérifiés | Consoles / pilote requis |

Frontières modifiées : supervision en lecture seule et documentation/tests. Aucune règle scientifique, référence PRA, donnée météo, Journal, graphique, migration ou calendrier actif modifié. Aucun message externe envoyé hors PR demandée.

## Résultats nouveaux

350 tests Python passent (27,77 s), ruff des fichiers modifiés et mypy strict des deux scripts passent. La lecture Storage nouvelle valide le cycle **08/11 06 UTC**, le pointeur correspondant et **713 identités**, avec couverture variable partielle signalée. ERA5 atteint **02/11**, retard six jours et aucun trou interne. Taille indexée **6 093 686 octets**, pas usage total du compte. Ces résultats remplacent les dates DATA-01 pour cette session.

CDS métadonnées : HTTP 200, JSON validé ; IFS index : HTTP 200, 194 entrées JSON validées. Cela ne valide pas une nouvelle récupération de champs ni leur livraison complète. MF : quatre catalogues 401, modèles binding_absent. Aucun diagnostic non prouvé de token expiré. Téléchargement de l'artefact daily-monitoring du run 42494057685 refusé 403 ; le détail interne de l'alerte distante n'est pas inventé.

Les résultats CI distants sont consignés après exécution. Une CI verte valide le code, pas les permissions fournisseurs, la publication distante ni l'objectif horaire.
