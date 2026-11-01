# Task22 — Climatologie annuelle nationale compacte 1991–2020

Depuis le merge Task21 (`9a04eb5`), mesurer le stockage réel et tester localement
une ligne par PRA/jour regroupant Tmin/Tmax/Tmean/pluie et leurs comptes d'années.
Ne pas refaire la méthode scientifique, le pilote ni un audit géographique.
Anomalies = actuel − normale calculées côté serveur ; NULL propagés.

Budget avant acquisition : 713 × 366 lignes, conservation intégrale de Task21,
marge de 50 %, réserve de 30 Mo ; 375 Mo garde d'arrêt. Cible sous 200–250 Mo.
Migration additive forward-only, RLS forcée, service_role uniquement.
Acquisition CDS bornée, trois jobs, spool 2 Gio, checkpoints hors Supabase.
Réutiliser exactement les 30 jours Task21. Le 29 février suit la règle Task21 :
huit années réelles, normale NULL car moins de 30 années, aucune interpolation.

Valider 713 PRA, 366 jours, compte réel/NULL par variable, anomalies serveur,
rejeu immuable et conservation Task21. Aucun THI ni changement UI.
Livrer RESULTS.md, STORAGE.md, DECISION.md, measurements.json et une PR draft.
READY_FOR_FULL_CLIMATOLOGY seulement après calcul et stockage annuels effectifs.
