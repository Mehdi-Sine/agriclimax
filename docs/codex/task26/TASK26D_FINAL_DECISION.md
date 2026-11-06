# Décision Task26D — état final DEV

Branche `codex/26-national-daily-climate`, PR55 conservée en draft ; aucun merge ni déploiement en production. Les dates scientifiques sontUTC, la consultation utilisateur distingue Europe/Paris.

1. **Dernier ERA5-Land :31octobre2026**, acquis et publié en archive-only sur713PRA, sans réingestion des journées déjà validées ni croissance de lignes PostgreSQL.
2. **Dernière estimation rétrospective complète :5novembre** ; J0du6novembre est aussi consultable avec sa mention de journée en cours comprenant des heures prévues. Aucune observation ou analyse quotidienne inventée.
3. **Nouveau cycle national :6novembre06UTC**, distinct de l'initialisation00UTC précédente. Les jours futurs MF utilisent06UTC ; le J0et le J−1 gardent leurs runs00UTC valides ; IFS00UTC complète réellement jusqu'au13novembre. Un seul modèle/run par journée sélectionnée, chacun explicitement conservé.
4. **713PRA par journée** ; trois températures exploitables sur713chaque jour. Pluie713sauf11novembreIFS519/713(72,79%) ; RH selon la journée, chiffres détaillés dans le rapport national06UTC. Les NULL ne sont ni zéro ni une prétendue couverture complète.
5. Historique :645supports complets,36supplémentaires≥90%,31entre0et90%,1nul. Tmoy/pluie :681valeurs qualifiées,31informations d'aire observée seulement, Crozon sans fausse valeur.
6. Couverture littorale :67géométries réellement couvertes, deux masques physiques MF acquis, IFSLSM conservé. ARPEGE Crozon17,54%terre et sensibilitéT−1,812°C : numérique présent ne vaut pas représentativité terrestre validée. Les diagnostics terrestres restent séparés des valeurs publiées.
7. Calendriers intégrés aux espaces Climat/Analyse, modes directs sans opt-in, PRA/canvas conservés, sources et dates distinctes, lacunes explicites. Publication31octobre détectée par une page ouverte sans reload/code/déploiement :preuve réelle.
8. Nouveau national06UTC et nouvelle journéeERA31 publiés ; arrêt/reprise ERA réels, rejeux et rejet de candidat incomplet sans écriture ; chaîne manuelle complète `daily-dev-check` réussie, run42221119710, zéro acquisition/écriture.
9. Cycle06UTC :93requêtes,9,77Mo,136,99s,archive562520octets. ERA31archive284028octets ; ressources et projection complètes dansRESOURCE_BUDGET.md. Aucune suppression de données/preuves ni abonnement ajouté.
10. Activation quotidienneDEV : après revue utilisateur et fusion séparée sur branche par défaut, contrôle des compteurs puis drapeau explicite ; kill switch et santé préparés. Calendrier actuellement désactivé, production interdite.

## Verdicts indépendants

Recette réelle `task26d-preview/browser-real.json` :33comparaisons, trois formats, même canvas, aucune erreur. `agriculture/browser-real.json` :12parcours responsive RPG/SAA/Climat/Analyse, routes blé/bovins conservées. Les diagnostics et avertissements restent distincts de la validation statistique agricole.

| Verdict | Décision et périmètre |
|---|---|
|READY_FOR_UNIFIED_WEB_UX|OUI — recette Preview réelle desktop/tablette/mobile, accès direct aux trois modes, contexte PRA et carte conservés|
|READY_FOR_COASTAL_SPATIAL_RESTITUTION|OUI — support réel, moyennes qualifiées et masques officiels vérifiés ; aucune valeur historique inventée, sensibilité terrestre explicitement diagnostique|
|READY_FOR_NATIONAL_DAILY_DEV_AUTOMATION|OUI pour activation DEV après revue/fusion/contrôle des compteurs — sources réelles, reprise et chaîne manuelle complète vérifiées ; cron actuellement désactivé, première exécution planifiée non réalisée|
|READY_FOR_AGROCLIMATIC_DEVELOPMENT|OUI pour développer sur ces fondations et leurs statuts de qualité ; NON comme validation de nouveaux scores, du THI national ou de la performance statistiqueJ+7|

Aucun score agricole nouveau ni garantie statistiqueJ+7. Les limites restantes sont scientifiques (RH native, quantification des petites pluies, représentativité terrestre et vérité de référence) et opérationnelles (revue/branche par défaut/quotas/première exécution planifiée). Les normales et RPG/SAA sont conservés.

## Recette, protections et limites de clôture

266tests TypeScript et312tests Python existants et2tests supplémentaires de découverte des runs réussis ; typecheck, lint, build de production, Ruff/Mypy des six nouveaux modules, garde secrets et migrations réussis. Les workflows Quality/Security obligatoires restent actifs ; leurs résultats GitHub et la Preview sont consultables depuis la PR. Les tests synthétiques CI restent distincts des preuves Preview réelles.

Le nouveau cycle réel est **6novembre06UTC**, différent du cycle00UTC deTask26C, mais **pas une nouvelle date d'initialisation après le6novembre**. Cette distinction est conservée : aucun run futur ni nouveau jour de prévision14novembre n'est inventé. Une prochaine date ne pourra être vérifiée qu'après sa disponibilité fournisseur.

Les scénarios A–D/G/H sont couverts par la recette responsive ; E par les vues détaillées Crozon/LaHague/Corse, supports réels et masques ; F par la transition réelle ERA30→31 sans rechargement ; I par le rejet avant écriture du candidat incomplet et la conservation byte-identique de l'ancien cycle. L'échec de publication est exercé en lecture seule, sans corruption volontaire du stockage partagé.

Opérations restant après cette tâche : revue utilisateur dePR55 draft ; éventuelle fusion explicitement autorisée sur branche par défaut ; contrôle des compteurs puis activationDEV et observation du premier cron. Aucun de ces gestes n'est exécuté implicitement. Les investigations scientifiques ouvertes sont détaillées dans WEATHER_QUALITY_FINAL.md, sans faux succès ni score agricole nouveau.
