# Validation en cours

Données synthétiques : uniquement tests unitaires explicitement nommés. Les preuves DEV sont des lectures réelles. Aucun succès d'ingestion ne peut être déduit des anciens rapports.

- 271 tests Python et 256 TypeScript réussis avant les derniers ajustements du catalogue ; vérification finale en cours.
- Contrats, automation YAML, secrets sources, migration forward-only : vérifiés localement.
- RPC catalogue appliqué uniquement DEV : `SECURITY INVOKER`, anon/authenticated interdits, serveur autorisé. Aucun droit sur table changé.
- Baseline : 23580 journées, digest `9e1b5d29a1969b5936ff7ed579174a87` ; 521916 normales compactes, digest `7fd7fa815a78ea2bfd4412a658e15612` (active + édition supplantée conservée).
- Géométries, pondérations, RPG2025 et SAA ne font partie d'aucun chemin d'écriture ajouté.
- Premier essai local : interrompu, aucune persistance. Pas de validation nationale Task26 à ce stade.

Restent à constater : pilote réel GitHub, au moins une journée 713 PRA, rejeu et delta SQL, valeurs Supabase/API/carte/fiche, Preview responsive 1440/768/390, build et CI du SHA final. Les logs et preuves sont ajoutés à mesure, sans masquer les contrôles non exécutés.
