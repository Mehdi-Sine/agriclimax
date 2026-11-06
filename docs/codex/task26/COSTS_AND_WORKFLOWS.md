# Ressources et exploitation

Même `pra-climate.yml`, même concurrence globale ; modes batch/daily-pilot/national-daily/operational-pilot. Calendrier national toujours inactif, dispatch seul.22min ERA5,20min de programmeIFS, plafonds mémoire/disque/bytes inchangés. Aucune hausse de garde375Mo. Le pilote est limité à12PRA ; aucun téléchargement national AROME/IFS.

Rattrapage multi-jours :30emprises/7jours à froid plutôt que210, plus frontières mensuelles/reprises partielles. Ce rapport théorique de requêtes n'est pas un gain de temps mesuré. Le décodage NetCDF est partagé par emprise/plage, les sorties restent quotidiennes compatiblesSHA. Lots1–7jours, descriptionssources dédupliquées pour les seuls nouveaux lots.

IFS :240requêtes/96Mio/1200s/4GiB maximum par cycle. Le téléchargement partiel sélectionne les champs, pas les octets d'une région à l'intérieur du champ. Les métriques réelles comprennent les champs globaux sélectionnés avant sous-sélection. Pas de promesse de coût géographique proportionnel aux12PRA. Cycle compact7jours en artefacts ; récupération source après échec3jours. Une archive annuelle ne repose pas sur ces artefacts éphémères.

Probe Météo-France via l'ancien workflow d'ingestion, nouveau `probe_only=true` : sixrequêtes, six401,0octet source ; aucun lot stationnel/DB écrit. Run42089606819. L'exécution réussie du probe signifie preuve collectée, pas autorisation des sources.

Dépôt public/runners standard GitHub : calcul gratuit selon règles vérifiées Task26. SupabaseFree existant, aucun abonnement ou infrastructure ajouté. Les coûts Vercel/egress existants non mesurés ; pas de livraison ECMWF payante. Coût marginal attendu0 sous quotas, sans valider une exploitation annuelle illimitée. Projections stockage et archives dans STORAGE_OPTIMIZATION.md. Mesures quotidiennes/mensuelles/annuelles à recalculer à partir des runs réels, sans extrapoler une simple borne comme mesure.

## IFS mesuré et scénario de capture pilote

227requêtes réussies d'origine (57index+170champs),66259061octetsGRIB, horsindex/en-têtes/retransmissions. Programme froid GitHub237,37s jusqu'au rejet scientifique ; ce temps inclut acquisition/décodage et ne mesure pas isolément le réseau. Les sources ont été réutilisées sans réseau, puis compactées à61310octets natifs +manifeste. Rejeu local≈0,8s, RSS188408Kio ; RSS froid non mesuré, borne4GiB. API publique agrégée604778octets, aucun champ natif ou secret dans la restitution.

Scénario **pilote**, un cycle00UTC par jour (non activé) :227requêtes/66,26MoGRIB/jour ;6810requêtes/1,99GoGRIB sur30jours ;82855requêtes/24,18GoGRIB sur365jours, horsindex/transport. Temps indicatif237,37s/cycle :≈3,96min/jour,118,7min/30jours,1444min/an, sans garantie de latence future. Quatrecycles/jour multiplieraient ces valeurs par4 ; ils ne sont pas activés. L'ajout des713PRA n'a pas été testé : les champs restent globaux sélectionnés, mais calcul/poids/contrôles et stockage national ne sont pas extrapolés comme gratuits ou validés.

Les521916normales,23580lignes historiques≤18octobre et données agricoles restent protégées par empreintes et absence de modifications. Les métriques ERA5 de conservation à long terme doivent distinguer le **rattrapage groupé** de l'exploitation **quotidienne singleton** : on ne déduit pas une année quotidienne depuis un lot de7jours artificiellement amorti. Le scénario Task26≈735Mo/an reste la garde prudente tant qu'une conservation opérationnelle n'est pas validée.

## Mesures finales ERA5 et consommation des runners

Les quatre passages source utiles totalisent68invocations CDS,12,313Mo de fichiers,76,30min de programme (63,32min acquisition,5,58min persistance,1,72min lecture). Le premier échec de lecture de manifestes est comptabilisé séparément, sans lui attribuer de nouvelles sources. Détails par passage dans ERA5_BACKFILL.md et `backfill-campaign.json`.

Les sept jobs de rattrapage, captureIFS et probeMF ont consommé **6430secondes de runner,111minutes arrondies par job**, installations et échecs inclus. Preuve `workflow-consumption.json`. Ce total exclut CI, Vercel et usages antérieurs ; ce n’est pas une facture générale. CaptureIFS :269s de runner, programme237,37s jusqu’au rejet initial ; les reprises scientifiques ultérieures étaient hors réseau.

Projections quotidiennes ERA5 prudentes Task26 :≈2,015Mo/jour,60,45Mo/30jours,735,46Mo/an de relations, avant le socle déjà présent. La mesure groupée Task26B≈1,109Mo/jour serait33,26Mo/30jours et404,63Mo/an, **scénario amorti de backfill uniquement**, non un résultat singleton. Ne pas extrapoler les76,30min sur11jours groupés en délai garanti d’acquisition quotidienne. RSS froid ERA5/IFS non mesuré : les plafonds sont des protections, pas des mesures.

Prochaine opération source : aucune pour la cible30octobre. Les acquisitions nationales et opérationnelles régulières restent désactivées. Les seules validations encore nécessaires concernent conservation12–24mois, droits/chaîne MF J−1, comparaisons scientifiques et dimensionnement national ; aucun abonnement nouveau n’a été créé.

Contrôle d’accès modèles du6novembre, run42179450077 : dixrequêtes logiques, 118003octets de réponses modèles avant décompression, dont414octets de champs T2m, aucune acquisition nationale. Le workflow hérité Task12 avait toutefois lancé cinqsmokes ERA5 non demandés pendant les mises à jour de PR du5novembre :300révisions legacy ajoutées, valeurs scientifiques identiques aux antérieures, puis garde-fou automatique spécifique à cette branche. Cet incident et sa vérification sont détaillés dans METEOFRANCE_MODEL_ACCESS.md ; il ne doit pas être masqué par la mention « probe sans DB ».
