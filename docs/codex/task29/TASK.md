# Task 29 — Clôture de la couverture climatique historique des 713 PRA

## Instructions reçues le 7 novembre 2026

Base : dernier main fusionné, dépôt Mehdi-Sine/agriclimax. Branche unique codex/29-historical-coastal-completion ; une PR draft, sans merge ni production. Le cahier des charges antérieur complet n’est pas présent dans le checkout ou les tickets trouvés ; sa référence a été demandée, sans arrêter les travaux indépendants autorisés par les consignes complémentaires.

Priorités : restaurer les cellules ERA5-Land depuis les checkpoints ; étendre les fenêtres 7 puis 30 jours ; reconstruire extrema/événements uniquement avec données natives défendables ; traiter Crozon et les déficits réels par une méthode complémentaire documentée ; restituer Climat et Analyse sur les 713 contours officiels avec supports et traçabilité ; recette nationale Preview et matrice par PRA/indicateur.

Réutiliser les archives et outils, ne pas créer d’architecture concurrente, ne pas réingérer ni relancer la météo opérationnelle confirmée le 7 novembre (713 PRA). Ne pas modifier le workflow quotidien ni son cron non encore observé, sauf anomalie directement causée par le développement. Ne pas modifier les 13 indicateurs validés sans justification. Validation successive autonome, commits et push intermédiaires, pas de 100% artificiel.

## Frontières de responsabilité

1. Restauration vérifiée des artefacts existants et inventaire des jours/cellules/valeurs natives.
2. Extension du producteur de supports Task26D et de sa publication versionnée, sans réécrire les agrégats stricts.
3. Lecteurs historiques existants, qualification et carte/fiche ; moteurs indicateurs et formules THI conservés.
4. Validation indépendante, inventaire des lacunes et preuve du complément scientifique, sans acquisition massive.
5. CI et Preview de la PR ; automatisation opérationnelle hors périmètre.

## Point de départ et première restauration

Main 3fea8d2 contient la PR56 fusionnée. Les supports publiés couvrent seulement 27–31 octobre. Le connecteur officiel GitHub permet maintenant de restaurer l’artefact13448541085 (20–26 octobre), précédemment bloqué au transport CLI : ZIP 7125805 octets, 2910 fichiers, 10195146 octets décompressés. Les tuiles possèdent Tmoy/Tmin/Tmax/pluie et indicateurs de réduction quotidienne ; leurs SHA et axes seront contrôlés avant toute qualification. Aucun appel CDS ou acquisition opérationnelle effectué.
