# Task 21 — Climatologies PRA 1991–2020 et anomalies

Construire les références Tmin, Tmax, Tmean, pluie ERA5-Land 1991–2020 sur les
supports PRA officiels existants. Pilote unique de 73/713 PRA (10,24 %), puis
préparation nationale si science et budgets passent. Priorité aux jours et à la
fenêtre homologues des données nationales disponibles (19/09–18/10).

Frontières : acquisition CDS/cache externe à Supabase ; réduction native UTC ;
agrégation spatiale PRA ; statistique interannuelle ; comparaison des réanalyses
actuelles ; stockage des seuls agrégats ; mesure et preuves. Aucun changement UI,
contour, poids, observation actuelle ou règle agronomique ; aucun THI.

Une référence absente produit une anomalie NULL, jamais zéro. Source, méthode,
couverture, période, version, fraîcheur et qualité sont explicites. Ne pas prétendre
que les données de réanalyse sont des mesures de station. Résultat final :
READY_FOR_NATIONAL_CLIMATOLOGY ou BLOCKED pour impossibilité réelle, science,
sécurité ou stockage non soutenable. Aucune valeur mesurée simulée.
