# Édition à 06:30 Europe/Paris — plan sans activation

## Dates vraies et échéance

06:30 Paris correspond à **05:30 UTC en hiver**, **04:30 UTC en été**. Le helper
`publication_deadline` utilise la base IANA `Europe/Paris` ; les deux transitions
2026 sont testées. Les écritures et validités restent UTC. Une édition stocke sa
date éditoriale Paris, le cutoff UTC, la date réelle de chaque réanalyse, les runs
prévisionnels et les dates/horaires de collecte des preuves.

Au 08/11, le dernier ERA5 Storage vérifié est le **01/11** ; le cycle prévisionnel
archivé vérifié est le **07/11 00 UTC**. Cela ne démontre aucune observation J−1
publiée à 06:30. Les modèles récents J−1/J0 restent des estimations fondées sur
prévision, explicitement séparées des observations et réanalyses différées.
Le preflight actuel ne peut confirmer de nouvelle livraison AROME sans la liaison
de clé propre à ce produit. Aucune fraîcheur fournisseur n'est inventée.

## Déroulement proposé, heures de Paris

| Plage cible | Travail / dépendance |
|---|---|
| 00:30–03:30 | découvertes périodiques bornées, acquisition incrémentale ERA5 et runs réellement disponibles ; checkpoints |
| 03:30–04:15 | reprises et validation nationale, intégrité, dates, 713 supports et contrôles de régression |
| 04:15–04:45 | calculs mutualisés par cycle ; produits compacts versionnés |
| 04:45 | gel d'un cycle valide et de son inventaire daté ; nouvelle donnée tardive réservée à la prochaine édition |
| 04:45–05:15 | dossier EvidenceBundle ; future collecte d'actualités agricoles avec preuves et dates |
| 05:15–05:45 | future rédaction IA, sans accès libre à la DB ; non exécutée par DATA-01 |
| 05:45–06:00 | futures vérifications factuelles, liens, chiffres, portée scientifique et mentions IA |
| 06:00–06:15 | édition candidate immuable et relecture ; marge de publication |
| 06:15–06:30 | pointeur atomique, supervision indépendante et archivage de l'édition |

Les fenêtres ne sont pas des durées mesurées de génération IA. Les retards réels
Actions du 07/11 dépassent six heures : déplacer seulement le cron ne suffirait pas.
La cible nécessite une mesure nocturne et une supervision capable de conserver le
dernier résultat valide. Le plan conserve une marge de plusieurs heures pour
l'acquisition ; il ne force pas un run modèle avant sa disponibilité.

## Déclenchement et supervision futurs

Pilote DEV manuel et observé au moins sept nuits, dont simulations des transitions
hiver/été. Si un calendrier GitHub est ensuite proposé, déclencher avec des marges
en UTC couvrant les deux saisons, puis filtrer l'échéance en Europe/Paris avec une
clé idempotente `edition_date/cycle/rules`. Ne pas supposer que GitHub garantit la
minute ; mesurer lancement, fin de chaque stage, fraîcheur et marge restante.
La recette doit enregistrer séparément retard de scheduler, livraison fournisseur
et panne applicative. Aucun de ces horaires n'est activé dans DATA-01.

À 04:45, figer le dernier cycle complet si une mise à jour est incomplète ; à 06:15,
si une édition candidate échoue, conserver le pointeur de la dernière édition
valide avec sa date effective. Ne jamais renommer une ancienne édition comme
nouvelle pour satisfaire artificiellement l'heure. Les alertes opérateur et le
contrôle public de date devront être configurés et testés avant activation.

Aucun service payant nouveau n'est requis par les changements livrés. Si les
retards réels de GitHub rendent les marges insuffisantes, l'engagement d'heure
reste non acquis ; il faudra qualifier un déclencheur disponible dans
l'infrastructure existante avant de promettre 06:30 aux utilisateurs.

## Conditions avant T33

Rétablir les liaisons AROME/ARPEGE et droits des API, vérifier les variables GitHub,
autoriser le DEV ciblé, vérifier le solde Storage et les reprises durables, effectuer
le pilote nocturne avec export de produits compacts et contrôle indépendant du
pointeur. Stabiliser le contrat EvidenceBundle puis la collecte d'actualités.
T33 pourra brancher la rédaction sur ce dossier, sans déclencher l'IA dans DATA-01.
