# Résilience : simulations locales isolées

Aucun cas simulé n'est injecté dans les publications météo réelles DEV.
Les fixtures temporaires restent distinctes des fichiers CDS du pilote.

Tests exécutés dans `engine/tests/territories/test_pilot_resilience.py`, complétés
par les tests Task12/19 existants :

| Cas contrôlé | Invariant vérifié |
|---|---|
| Téléchargement interrompu / timeout | Aucun reçu fiable ni fragment `.download` conservé ; reprise valide puis cache hit |
| Tuile absente, budget de téléchargement nul | État processing, aucun appel source ni persistance |
| Cellule / heure manquante | Valeur complète NULL, compte valide inférieur à l'attendu |
| PRA partielle, poids 0,25 / 0,75 | Fraction 0,25 conservée, aucune renormalisation présentée comme complète |
| Source native dupliquée | Rejet avant destination |
| Checksum modifié | Rejet avant nouvelle destination ; sortie valide antérieure identique |
| Interruption de persistance puis rejeu | Même identité/calcul, pas de redownload ni nouveau timestamp de révision |
| Checkpoint de sortie corrompu | Ne permet pas de sauter le contrôle |

La suite ciblée résilience/pipeline/NetCDF passe : 25 tests. Les avertissements
NumPy/netCDF4 sont des dépréciations connues, pas des erreurs de calcul.
Le rejeu distant réel des 73 lots est aussi terminé : 73/511/584 lignes et
empreintes des trois tables strictement inchangées, aucun nouveau téléchargement.
Les dix snapshots v0.2.0 restent identiques. Deux tests supplémentaires refusent
persist et replay vers tout projet autre que DEV avant création de sorties.
