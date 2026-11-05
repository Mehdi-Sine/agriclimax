# Stockage et budget

Mesure DEV initiale (octets, pas MiB) : base 145520307 ; pra_daily 12083200 table + 9043968 index = 21127168 ; pra_batches 9207808 + 491520 = 9699328 ; climatologie compacte (deux éditions conservées) 35282944 + 16457728 = 51740672. 23580 journées avec pilotes et 3930 lots.

Une ingestion nationale quotidienne ajoute 713 lignes et, avec les contrats actuels, jusqu'à 713 métadonnées de lot. Projection grossière à partir des empreintes initiales : ~0,639 Mo de journées + ~1,760 Mo de lots/jour, soit ~72 Mo sur 30 jours et ~876 Mo/an. Ce n'est pas une mesure de Task26 ; les anciennes lignes/lots ont des profils et des index différents. Il faut remplacer cette projection par le delta SQL d'une vraie journée.

La garde existante à 375000000 octets reste active, sans purge ni upgrade payant. À ce rythme estimé, la marge initiale couvre environ 95 jours, pas une année. Une exploitation continue exige une politique de conservation/archivage vérifiée et revue ; aucune suppression historique automatique n'est implémentée. Ce point fait obstacle à un service annuel soutenable tant qu'il n'est pas résolu.

Coût financier : aucune infrastructure créée, aucun abonnement changé. CDS ne facture pas ces téléchargements mais impose ses files/quotas. Actions doit être mesuré sur les runs réels ; le plafond d'un job est 30 min, donc 900 min/mois pour un seul run quotidien et 10950 min/an, multipliés par les reprises. À un prix hypothétique de 0,008 USD/min hors quota, cela représenterait au maximum 7,20 USD/mois / 87,60 USD/an pour ce scénario de plafond (estimation, pas facture ni tarif vérifié). Ne pas déclencher d'achat. Les lectures API, egress et cache mémoire restent ceux du socle existant ; une lecture de catalogue remplace les sondages de dates.

Les mesures finales et le delta après ingestion réelle seront consignés avec les reçus d'exécution. Aucun delta nul sans ingestion ne sera présenté comme coût journalier mesuré.
