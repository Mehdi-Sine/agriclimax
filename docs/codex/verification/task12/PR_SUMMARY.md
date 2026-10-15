# Task 12 — socle climatologique ERA5-Land / anomalies

Task 12, mergée via la PR #28, ajoute une référence historique ERA5-Land aux
observations live Météo-France d'AgriclimaX : acquisition par petite bbox/période,
réduction quotidienne explicite, révisions traçables
et des comparaisons statistiques indépendantes des règles agricoles.

- Référence historique séparée du live, des indicateurs dérivés et des risques.
  Tmin/Tmax/moyenne depuis 24 horaires ; pluie depuis le cumul du lendemain.
  RH et ET0 absentes, sans substitution. Grille CDS 0,1°, aucune interpolation.
- Période/couverture/version de snapshot obligatoires, provenance et checksums,
  cache/rejeu, timeout/retry, nulls et insuffisance explicites. Normales par jour
  de calendrier, quantiles type 7, anomalies/rank, fréquence empirique et primitives
  de classement de périodes homologues. Comparaisons station/grille exploratoires
  avec limites spatiales et fenêtres non harmonisées visibles.
- Migration additive versionnée : deux tables privées RLS forcées et index,
  RPC INVOKER serveur append-only, aucune mutation des tables Task 11. Testée
  localement public/extensions ; persistance réelle Supabase DEV validée via
  GitHub Actions. Aucun contrat V1 modifié.
- Validation : tests Python/climatologie, export CLI Task 11 synthétique et rejeu,
  contrats, Ruff/mypy, lint/typecheck/build, SQL, audits et make check. Documentation
  complète et exemple numérique explicitement fictif dans ce dossier.

**Livraison mergée dans `main`** : PR #28, commit
`ccbf4805bf07f5b3ed3590d8e9c3ca92d51a51c3`. Accès CDS avec `CDSAPI_KEY`,
téléchargement ERA5-Land, NetCDF réel (`t2m`, `tp`, grille latitude/longitude),
full smoke test continental, persistance DEV et replay/idempotence validés.
Tests climatologiques, Quality, Security, Vercel et workflow Task12 ERA5 real
validation verts. Preuves et limites dans [VERIFICATION.md](VERIFICATION.md).
Le smoke test de trois jours ne constitue pas une normale complète 1991–2020
ni une validation scientifique agronomique ; l'exemple livré reste fictif.
