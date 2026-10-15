# Task 12 — socle climatologique ERA5-Land / anomalies

AgriclimaX dispose d'observations live Météo-France mais pas encore d'une référence
historique homogène exploitable. Cette PR prépare l'acquisition ERA5-Land par
petite bbox/période, sa réduction quotidienne explicite, ses révisions traçables
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
  localement public/extensions, **non appliquée à DEV**. Aucun contrat V1 modifié.
- Validation : tests Python/climatologie, export CLI Task 11 synthétique et rejeu,
  contrats, Ruff/mypy, lint/typecheck/build, SQL, audits et make check. Documentation
  complète et exemple numérique explicitement fictif dans ce dossier.

**Draft bloquée pour acceptation réelle** : CDSAPI_KEY et accès réseau Copernicus
non configurés. Tentative de backfill réelle arrêtée proprement ; aucun jeu
ERA5-Land acquis, pas d'anomalie réelle prétendue, aucun seed sur DEV. La forme
NetCDF effectivement retournée reste à vérifier. Voir VERIFICATION.md pour les
résultats, warnings NumPy/netCDF4 et étapes restantes. Ne pas merger en cet état.
