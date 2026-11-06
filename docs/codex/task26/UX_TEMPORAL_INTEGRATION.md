# Task26D — navigation temporelle unifiée

Les espaces Climat et Analyse agroclimato utilisent désormais une seule instance du canevas national existant, avec trois boutons directement visibles : **Historique climatique**, **Météo récente**, **Prévisions**. Aucun opt-in expérimental nécessaire. Productions conserve ses sources, sa cartographie et le contexte PRA partagé. Les liens historiques blé/bovins restent accessibles.

Les géométries officielles sont chargées une seule fois et partagées entre les modes ; changer la source ne crée pas une deuxième carte. Les filtres et la fiche sont ceux du mode choisi : historiques/normales/anomalies et indicateurs validés pour ERA5, cinq variables météo sans fausses normales ni scores agricoles pour les prévisions.

## Dates réellement publiées

L'historique consulte le catalogue chaud et les archives privées. Météo récente/prévisions consultent le dernier manifeste météo publié : récent jusqu'au jour du run, prévisions après ce jour. J0 porte explicitement la mention de journée en cours comprenant des heures prévues. J−1 reste une estimation issue de prévisions antérieures, jamais une observation.

Chaque mode a son état partageable : `date` pour historique, `recent_date` et `forecast_date` pour météo. `pra`, production et autres paramètres restent conservés. Les anciennes URL `experimental=weather`/`weather_date` sont reconnues ; un run archivé peut être demandé par date ou horodatage UTC explicite. Une date inconnue n'est pas remplacée silencieusement par une date connue.

Défaut sans date : dernière journée historique publiée, dernière estimation récente publiée, première prévision du cycle. Les raccourcis Dernier historique/Dernière estimation/Aujourd'hui/J+3/J+7 n'offrent que des journées réellement présentes. Les lacunes entre séries sont affichées ; aucune continuité calculée entre le31octobre et le5novembre.

Le client rafraîchit les disponibilités toutes les60secondes et au retour de focus. Le petit manifeste serveur a une durée de cache60secondes ; le catalogue complet15minutes. La date de consultation Europe/Paris, l'initialisation du modèle, l'acquisition et la validité UTC restent distinctes. Le vieillissement est recalculé, même sur une page laissée ouverte.

## Publication sans commit ni déploiement

La Preview41a34f6 était prête le6novembre12:20:49UTC ; une page sans date explicite a été ouverte à12:21:06 sur le30octobre. Après publication archive-only du31octobre, son calendrier a changé automatiquement à12:29:07 : même canvas, mêmes scripts, aucun rechargement et aucune modification du code pendant l'observation. Preuve `task26d-evidence/live-era-update/` (copie du rapport réel).

Cette recette a détecté un défaut du graphique froid : le contrat SQL d'historique omet le PRA au niveau de chaque ligne. Le lecteur ajoute maintenant le PRA de la requête avant la jointure froide ; un test spécifique valide les120lignes et les variables du31octobre. Les anciennes valeurs strictes ne sont pas réécrites par les nouvelles moyennes de support.

Recette finale responsive et chemins : `task26d-preview/browser-real.json` fait foi. Une tentative antérieure de surveillance météo a commencé après la publication06UTC ; elle n'est pas revendiquée comme une transition observée.
