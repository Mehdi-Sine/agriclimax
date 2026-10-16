# Task 18 — Intégration V0.2

Base : `main` 6e876b2. Branche : `codex/18-v02-integration`.
Validation du 16 octobre 2026. PR draft uniquement, aucun merge.

La passe conserve blé/bovins et les règles existantes. La station est choisie
explicitement, les liens entre vues gardent indicateur/période/paramètres, et le
lien dernière publication change uniquement la fenêtre. La carte propose zoom,
pan tactile/souris/clavier et sélection via points ou tableau accessible.
Les indisponibilités et la référence THI absente sont explicites. Le diagnostic
conserve la projection serveur minimale et affiche le seuil de la règle blé.
Aucune migration, écriture DEV, acquisition météo ou nouvelle exception sécurité.

Voir [VERIFICATION.md](VERIFICATION.md), [PERFORMANCE.md](PERFORMANCE.md),
[SECURITY.md](SECURITY.md), [LIVE_DATA.md](LIVE_DATA.md) et [LIMITS.md](LIMITS.md).
Les preuves réelles et synthétiques sont séparées. **Task 18 non terminée** :
la preview est déployée mais protégée par authentification Vercel, donc les
contrôles déployés restent bloqués. Voir [PREVIEW.md](PREVIEW.md).
