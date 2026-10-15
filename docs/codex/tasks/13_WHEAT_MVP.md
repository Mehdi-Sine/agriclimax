# Task 13 — Wheat MVP

Périmètre de cette exécution utilisateur, branche `codex/13-wheat-mvp`.
L'ancien fichier `13_PRODUCTION_HARDENING.md` garde son périmètre historique.

Créer des indicateurs climatiques descriptifs pour blé tendre, depuis le dernier
main incluant Task11 Météo-France et Task12 ERA5-Land validées. Ne pas produire de
risque agronomique complet ni de conseil de conduite. Statut `exploratory`.

Minimum : GDD configurable, jours et séquences chaudes, jours et séquences de gel,
cumul pluie, jours sans pluie significative, séquence sèche maximale, anomalies
température et pluie si références scientifiquement suffisantes. Seuils sourcés,
configurables, versionnés, non universels. Une donnée absente ne vaut pas zéro.

Fenêtres préparées : tallage, montaison, épiaison, anthèse, remplissage. Bornes
calendaires explicites ou stade et source fournis ; aucun modèle ni stade inféré.
Préparer seulement un point de branchement futur pour modèle validé.

Chaque résultat expose règle/version, production wheat, indicateur, période,
valeur/unité, seuil/niveau éventuels, confiance, fraîcheur, provenance, sources,
statut et limites. Brancher Observation Map, Scientific Diagnostic et suivi Watch
descriptif si pertinent. Vérifier plusieurs vrais points station, sans annoncer
une couverture continue de France.

Tests manuels connus, limites exactes, absences, fenêtres incomplètes, GDD, pluie,
séquences, anomalies ; Python, web, lint, typecheck, build, audits et make check.
Preuves et méthodes dans `docs/codex/verification/task13/`.
Identité Git Mehdi-Sine <mehdi.sine@acta.asso.fr>. Commit, push, PR draft vers main.
Aucun merge, aucune modification Task12, aucune autre Task.
