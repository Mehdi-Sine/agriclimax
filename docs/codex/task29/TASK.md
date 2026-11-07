# Task 29 — AgriclimaX : clôture de la couverture climatique historique des 713 PRA

Cahier des charges complet fourni par l’utilisateur le7novembre2026, complété par ses consignes opérationnelles.

## Mission et périmètre

Dépôt `Mehdi-Sine/agriclimax`, partir du dernier `main` après fusion PR56. Une branche `codex/29-historical-coastal-completion`, une seule PR draft. Exploiter au maximum les données ERA5-Land déjà acquises pour les littoraux, fenêtres7/30jours ; étudier et mettre en œuvre un complément scientifiquement validé, ciblé, pour les déficits réels. Ne pas refaire les Tasks19–28. Aucune fusion ni production, aucun100% artificiel.

## A — Récupérer les checkpoints existants

Priorité au mécanisme GitHub Actions authentifié ou à la sauvegarde utilisateur des quatre ZIP :

| Run | Artefact |
|---|---|
|42091357008|13447760693|
|42095551736|13448541085|
|42099133896|13450332612|
|42103633624|13450584616|

Ces tuiles20–30octobre contiennent température,Tmin,Tmax,pluie ; expiration annoncée12novembre2026. Vérifier SHA256,doublons,divergences,identités cellules,dates,unités,provenance. Aucun CDS pour une journée dont les cellules intègres sont récupérables. Conserver anciennes valeurs et versions.

## B — Restaurer les supports manquants

Recalculer depuis les cellules, jamais depuis les PRA NULL : Tmoy et pluie moyennes spatiales, supports Tmin/Tmax distincts, couvertures/géométries valides, résultats de portion. Priorité aux68PRA incomplètes du20au26octobre puis fenêtres7jours à support commun. Rechercher les checkpoints2–19octobre pour30jours. S’ils ont disparu, estimer une acquisition strictement ciblée cellules/journées manquantes ; exécution seulement après validation des limites de ressources déjà fixées, sans reprendre les journées existantes.

## C — Indicateurs

Réutiliser règles1.0.0/1.1.0 et moteurs existants. Étendre Tmoy/GDD,pluie,Tmin/Tmax,chaleur,gel,séquences et événements uniquement depuis des données natives justifiées et compatibles dans le temps et l’espace. Support commun multi-jours vérifié. Aucune déduction d’extrema/événements depuis Tmoy. Distinguer valeurs PRA complètes, estimations≥90%, valeurs de portion et indisponibilités. Climat et Analyse mis à jour sans deuxième cartographie.

## D — Déficits réels, notamment Crozon

Ne pas récupérer de données inexistantes avec un masque nul. Étudier reconstruction depuis cellules terrestres ERA5-Land voisines, avec validation sur PRA littorales de référence, et SAFRAN/SIM (couverture effective,résolution,période,licence,cohérence climatique). Comparer biais/coûts/limites ; retenir une méthode scientifiquement défendable et économiquement soutenable. Provenance/version distinctes pour fournisseur ou reconstruction distincts ; aucune normale ou anomalie hybride non validée.

## E — Archive incrémentale et UI

Intégrer les supports nouveaux au mécanisme incrémental ERA5 existant lorsque les données natives sont disponibles ; aucun pipeline quotidien concurrent. Préserver713contours officiels, portions couvertes,hachures,gris,interface unifiée,performances,sources,seuils,versions. Ne modifier ni relancer l’acquisition AROME/ARPEGE/IFS confirmée le7novembre pour713PRA, avec catalogues Supabase et affichage immédiat. Réserve opérationnelle : cron quotidien pas encore observé ; ne pas modifier le workflow quotidien, sauf anomalie directement causée par le développement.

## F — Validation et livraison

Comparaisons scientifiques indépendantes, non-régression, Preview desktop/tablette/mobile. Matrice par indicateur et PRA pour1/7/30jours : complètes,qualifiées≥90%,portions,estimations complémentaires distinctes,indisponibles. Résultats détaillés dans `docs/codex/task29/`. L’information doit être justifiée et identifiable, pas seulement remplir des lignes. PR toujours draft, aucun merge/production.

## Discipline et responsabilités

Un seul agent principal, un seul chantier ; acquisitions et calculs validés conservés. Validation successive autonome, sans nouvelle Task après chaque pilote. Commits/push réguliers. Calculs longs sur GitHub Actions. Pas de nouveau service payant, de CI complète après chaque détail, de second moteur ou d’architecture climatique concurrente. Ne pas modifier les13indicateurs déjà validés sans justification.

Frontières : restauration/provenance native ; producteur Task26D et archive incrémentale ; lecteurs historiques/versionnement ; carte/fiche existantes ; science du complément ; matrice et recette. Automatisation opérationnelle hors périmètre.

Base effective `3fea8d2`, PR draft57. Première sauvegarde de la restauration effectuée avant développement.
