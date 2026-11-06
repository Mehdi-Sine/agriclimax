# Architecture

Source CDS ERA5-Land (blocs 2° Task19D, ou seules sous-tuiles 1° manquantes à la reprise) → validation/décodage existants (24 heures T et pluie D+1 00 UTC) → cache compact de tuiles → `run_batch` / agrégations scientifiques existantes → RPC immuable `agriclimax_persist_pra` → catalogue national → lecteurs jour/climatologie → agrégats période → carte et fiche communes.

La même édition nationale est prolongée par de nouvelles dates : son identifiant historique reste stable pour conserver les contrats et URL. Les dates déjà persistées ne sont jamais remplacées. Une correction scientifique/source exige une nouvelle édition explicitement revue. Aucune substitution stationnelle.

Chaque date comporte 713 identités, y compris les supports entièrement NULL. Les valeurs partielles restent NULL selon la règle spatiale existante. Les lecteurs distinguent unavailable des partielles lorsque tous les comptes natifs sont nuls. La publication du dernier jour exige 713 lignes persistées ; les contours seuls ne prouvent aucune acquisition. Une acquisition interrompue n'avance pas cette date.

La date système borne seulement les demandes (J−6 : latence minimale de cinq jours et pluie au 00 UTC du lendemain). Elle ne prouve jamais la publication CDS. Une source indisponible arrête le lot et conserve les checkpoints.

Le RPC `agriclimax_pra_daily_catalog` est la seule migration : lecture `SECURITY INVOKER`, délai 5s, fonctions réservées au serveur. Il réutilise les index et tables existants, n'en crée/modifie aucun et n'élargit aucun droit sur les données. Nécessité : aucun RPC existant n'exposait la dernière date nationale ni les dates d'acquisition des reçus. Les trois dates restent distinctes. Vérification DEV : source 18/10, acquisition 30/10 23:07:23 UTC, calcul 30/10 23:41:11 UTC avant tout nouveau lot.

Le navigateur reçoit seulement le catalogue, 713 agrégats et la série d'une PRA ; jamais les NetCDF ou secrets. Les jours et périodes sont bornés à 30 jours, les anciennes URL restent lisibles. Les anomalies exigent une série temporelle ET spatiale complète et des normales homologues complètes. NULL n'est jamais zéro.


Le catalogue est l'autorité de reprise même si un artefact a expiré. Les jours/PRA déjà persistés sont identifiés avant toute acquisition ; un rejeu complet n'appelle donc pas CDS, même en l'absence de cache source. Une révision de source qui modifierait une entrée déjà conservée est refusée.

`updated_at` décrit le dernier calcul de lot persisté (`pra_batches.computed_at`) ; ce n'est pas un horodatage de commit PostgreSQL inventé. L'heure de publication de CDS reste inconnue dans les reçus, distincte de leur acquisition connue. Le dernier jour est publié seulement après la présence de 713 lignes ; un arrêt intermédiaire laisse l'ancienne publication accessible.
