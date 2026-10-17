# Task 18 — Intégration V0.2

Base : `main` 6e876b2. Branche : `codex/18-v02-integration`.
Validation locale du 16 octobre et preview du 17 octobre 2026. PR draft uniquement, aucun merge.

La passe conserve blé/bovins et les règles existantes. La station est choisie
explicitement, les liens entre vues gardent indicateur/période/paramètres, et le
lien dernière publication change uniquement la fenêtre. La carte propose zoom,
pan tactile/souris/clavier et sélection via points ou tableau accessible.
Les indisponibilités et la référence THI absente sont explicites. Le diagnostic
conserve la projection serveur minimale et affiche le seuil de la règle blé.
Aucune migration, écriture DEV, acquisition météo ou nouvelle exception sécurité.

Voir [VERIFICATION.md](VERIFICATION.md), [PERFORMANCE.md](PERFORMANCE.md),
[SECURITY.md](SECURITY.md), [LIVE_DATA.md](LIVE_DATA.md) et [LIMITS.md](LIMITS.md).
Les preuves réelles et synthétiques sont séparées. La preview est validée :
24 vues blé/bovins en 1440/768/390 px, confidentialité HTML/RSC/bundles déployés,
24 mesures HTTP, source/station publiées et fraîcheur conformes à DEV.
Voir [PREVIEW.md](PREVIEW.md) et les sous-dossiers `preview` des preuves.
Clôture conditionnée aux checks du commit final après push ; PR reste en draft.
