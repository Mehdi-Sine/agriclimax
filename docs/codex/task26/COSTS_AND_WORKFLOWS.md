# Ressources et exploitation

Même `pra-climate.yml`, même concurrence globale ; modes batch/daily-pilot/national-daily/operational-pilot. Calendrier national toujours inactif, dispatch seul.22min ERA5,20min de programmeIFS, plafonds mémoire/disque/bytes inchangés. Aucune hausse de garde375Mo. Le pilote est limité à12PRA ; aucun téléchargement national AROME/IFS.

Rattrapage multi-jours :30emprises/7jours à froid plutôt que210, plus frontières mensuelles/reprises partielles. Ce rapport théorique de requêtes n'est pas un gain de temps mesuré. Le décodage NetCDF est partagé par emprise/plage, les sorties restent quotidiennes compatiblesSHA. Lots1–7jours, descriptionssources dédupliquées pour les seuls nouveaux lots.

IFS :240requêtes/96Mio/1200s/4GiB maximum par cycle. Le téléchargement partiel sélectionne les champs, pas les octets d'une région à l'intérieur du champ. Les métriques réelles comprennent les champs globaux sélectionnés avant sous-sélection. Pas de promesse de coût géographique proportionnel aux12PRA. Cycle compact7jours en artefacts ; récupération source après échec3jours. Une archive annuelle ne repose pas sur ces artefacts éphémères.

Probe Météo-France via l'ancien workflow d'ingestion, nouveau `probe_only=true` : sixrequêtes, six401,0octet source ; aucun lot stationnel/DB écrit. Run42089606819. L'exécution réussie du probe signifie preuve collectée, pas autorisation des sources.

Dépôt public/runners standard GitHub : calcul gratuit selon règles vérifiées Task26. SupabaseFree existant, aucun abonnement ou infrastructure ajouté. Les coûts Vercel/egress existants non mesurés ; pas de livraison ECMWF payante. Coût marginal attendu0 sous quotas, sans valider une exploitation annuelle illimitée. Projections stockage et archives dans STORAGE_OPTIMIZATION.md. Mesures quotidiennes/mensuelles/annuelles à recalculer à partir des runs réels, sans extrapoler une simple borne comme mesure.
