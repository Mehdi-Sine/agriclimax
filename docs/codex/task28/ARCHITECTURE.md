# Task 28 — Architecture

Base : 648a192, fusion PR #55. Frontières affectées : catalogue scientifique, calcul pur territorial, adaptateur API en lecture seule, expérience Analyse, couches de la carte nationale. Les acquisitions, workflows, schémas SQL, géométries officielles et contrats météo restent inchangés.

Un seul catalogue versionné pour toutes les productions. Les valeurs météo restent séparées des résultats agroclimatiques et du contexte agricole RPG/SAA. Les calculs consomment les archives nationales vérifiées et les sélections météo existantes. Pas de nouvelle table ni de résultat persisté. Les résultats portent version, paramètres, provenance, couverture et motifs NULL. Un changement de source ou d'initialisation interdit un cumul de période ; les valeurs quotidiennes restent consultables.

L'interface réutilise le composant NationalMap dans le même emplacement React, sans réinitialisation entre indicateurs. Les filtres et la PRA sont dans l'URL. Les lacunes restent explicites. Les données départementales ne sont jamais réparties entre PRA.
