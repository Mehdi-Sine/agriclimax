# Task26B — décisions finales au 5 novembre 2026

Branche existante `codex/26-national-daily-climate`, **PR55 conservée en draft**. Aucun merge, déploiement production ou calendrier national activé. Les checkpoints, anciens historiques,521916normales, géométries/poids ERA5 et données RPG/SAA sont conservés.

## READY_FOR_ERA5_DAILY_DEV : NOT_READY

Rattrapage réel **20–30octobre inclus :11journées,713PRA chacune**,645disponibles/67partielles/1indisponible. Trois pilotes du20 conservés octet-identiques. Dernière journée nationale30octobre, disponibilité horaire complémentaire pluie vérifiée. Groupage, déduplication, reprise après interruption, valeurs API et recette Preview validés ; rejeux sans source ni écriture, empreintes DB inchangées.

La conservation reste le verrou :163337907octets DB, progression groupée≈1,109Mo/jour et404,63Mo/an déjà incompatible avec375Mo avant socle ; scénario quotidien prudent735,46Mo/an. Archives exactes et restauration locale prouvées, trois canaris DEV idempotents. **Lecture froide des liens historiques, politique de rétention et restauration complète ne sont pas implémentées/validées**. Option chiffrée≈94Mo/an d’archives singleton +DB glissante30–60jours, à vérifier avec les limites des hébergements existants ; aucune suppression ni hausse arbitraire de garde.

## READY_FOR_OPERATIONAL_NATIONAL_SCALEUP : NOT_READY

Pilote IFS réel de12PRA officielles, cycle5novembre00UTC, prévisions6–12novembre J+1..7.420lignes sur5variables,52NULL explicites ; poids0,25° indépendants, calcul versionné `pra-weather-daily-2`, contrat `pra-weather-1`, provenance/fraîcheur/qualité strictes. Reproduction native hors réseau et validation indépendante/Preview réussies. Consultation expérimentale dans le canevas existant, aucune complétude nationale annoncée.

**J−1 absent** : le premier contrôle avait reçu six401 en utilisant la clé Observations sur les modèles. Après nouvelles souscriptions, le contrôle du6novembre confirme200 sur les deux WCS modèles et deuxlectures T2m bornées ; leurs champs H+0 sont codés prévision. Les catalogues Observations/Climatologie restent401 et aucune analyse quotidienne J−1 n’est validée. Alternative publique PNT réellement sondée : licence ouverte, un paquet57,22Mo accessible, seulement2048octets lus ; premier message H+0 identifié comme prévision, pas preuve d’analyse T2m ou d’observation. Aucun contournement d’accès. Comparaisons analyse/stations, chevauchement ERA5 et continuité AROME/ARPEGE/IFS non exécutées, donc non validées. Un seul cycle exploratoire ne prouve ni le skill J+7 ni la soutenabilité nationale.

## Livrables et opérations restantes

Huit documents de phase, métriques JSON, archives réversibles, recettes historiques et expérimentales locales/Preview, contrats et tests sauvegardés dans cette même branche. Sources GitHub : runs42091357008/42095551736/42099133896/42103633624 pour ERA5,42089278523 pour IFS,42089606819 pour les droitsMF.68invocationsCDS/12,31Mo ; IFS227appels logiques/66,26Mo ;6430s/111min arrondies de jobs source/probe, horsCI/Vercel. Aucun coût payant ajouté ; stockage annuel non résolu. Détails et limites dans COSTS_AND_WORKFLOWS.md.

Avant activation ERA5 : implémenter puis tester le lecteur historique froid, la rétention et une restauration complète, avec mesure12–24mois sous les limites. Avant généralisation opérationnelle : valider une voie officielle d’analyse quotidienne et les droits Observations utiles (les nouveaux accès modèles WCS sont confirmés), acquérir un pilote J−1 borné, effectuer les trois comparaisons scientifiques, puis mesurer plusieurs cycles et le dimensionnement713PRA. Ne pas relancer les sources déjà acquises pour ces validations.

Le dernier état CI exact figure dans QUALITY_COMPARISON.md et la PR ; un job annulé n’est jamais compté réussi. La tâche livre un socle sauvegardé et un pilote IFS démontré, sans prétendre livrer une chaîne nationale J−1/J+7 prête à l’exploitation.

Mise à jour d’accès du6novembre : voir [METEOFRANCE_MODEL_ACCESS.md](METEOFRANCE_MODEL_ACCESS.md), run42179450077. Les deux décisions NOT_READY restent inchangées : un contrôle d’accès sur deuxchamps ne démontre pas J−1 ni les comparaisons. L’incident du smoke ERA5 automatique et ses300révisions legacy aux valeurs identiques est audité séparément ; il est désormais bloqué sur cette branche.
