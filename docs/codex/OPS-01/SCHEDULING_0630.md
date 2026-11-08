# Objectif 06:30 Europe/Paris

L'horaire actuel PRA 08:20 UTC est déjà postérieur à 06:30 Paris, même sans retard. Le retard réel du 8 novembre est 6 h 57 min 33 s. L'automatisation actuelle ne qualifie donc pas cet objectif. Aucun cron modifié ni déclencheur activé.

| Option | Coût et bénéfice | Limite |
|---|---|---|
| Actions anticipées + contrôle de fraîcheur | Pas de nouveau service ; réutilise concurrence/checkpoints | Schedule best-effort, retards de plusieurs heures observés ; aucune garantie minute |
| Déclencheur externe économique | Petit timer existant ou service gratuit déclenchant workflow_dispatch avec droit minimal | Actions peut encore attendre un runner ; nouveau secret/service à administrer, quota à vérifier |
| Hybride + observateur indépendant | Actions unique writer, timer de secours si aucun cycle frais, supervision indépendante | Meilleure détection des absences complètes ; coût/fiabilité du timer à mesurer et autoriser |

Recommandation préparée : hybride, sans acquisition parallèle. L'observateur vérifie l'identité du dernier cycle et le run actif avant un dispatch idempotent ; concurrence existante et kill switch conservés. Ne pas acheter de service ou élargir un token implicitement.

## Proposition éditoriale à mesurer

Utiliser ZoneInfo Europe/Paris : deadline 06:30 vaut 05:30 UTC l'hiver et 04:30 UTC l'été. Proposer lancement à 02:00 Paris, contrôle à 04:30, cutoff à 05:30, calcul jusqu'à 06:10, gel à 06:15 et marge 15 min. Ces horaires sont des hypothèses, pas un SLA. Le cutoff est une sélection immuable d'archives déjà validées. Si échec ou arrivée après cutoff, garder édition précédente avec date/stale explicites ; préparer une révision climatique ultérieure distincte, sans réécrire l'édition gelée. ERA5 différée n'est pas une observation fraîche J−1.

## Mesure sur sept nuits — à exécuter après autorisation

Sept dates locales consécutives, y compris test simulé des changements d'heure ; aucun faux résultat de sept nuits fourni. Pour chaque nuit conserver : date Paris, slot prévu UTC, event créé, runner démarré, début/fin acquisition, date/run fournisseur vérifiable ou null, agrégation, validation, archive path/hash, promotion, gel, contrôle API, PRA évaluables/partielles par variable, bytes, RSS, tentatives, erreurs et édition conservée. Une absence totale de run compte comme échec et nécessite l'observateur externe.

Indicateurs : taux de nuits avec édition valide à 06:30, taux de fraîcheur par source, retard lancement p50/p95/max, durée acquisition/calcul/publication p50/p95/max, marge restante, taux de reprise réussie et coût par cycle. Avec n=7, publier les sept valeurs et maximum, pas une prétention statistique de disponibilité annuelle. Critères proposés : 7/7 contrôles à l'heure, zéro pointeur invalide, zéro doublon, 713 identités, qualité conservée, budget respecté ; sinon analyser et prolonger sans annoncer un SLA. Échantillon témoin actuel : retard 417,55 min, hors objectif.
