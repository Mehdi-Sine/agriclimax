# PREV-01 · Prévisions natives nationales

**NO-GO pour l’activation publique.** Le candidat est isolé. La configuration publique ne transporte pas les preuves natives sur les cycles vérifiés. L’inventaire privé de PREV-01 contient exactement deux index natifs vérifiés, pour les archives du 14 et du 15 novembre 2026. Le cycle courant du 20 novembre à 18 h UTC n’y est pas rattaché. L’index composite COUV-05E a été reproduit à l’identique localement et manque au stockage distant.

La branche part de `0479893e5972b787907a673b58f277fdd714ad61`, fusion de la [PR #108](https://github.com/Mehdi-Sine/agriclimax/pull/108). PREV-01 raccorde plusieurs index exacts au même processus, isole les erreurs de preuve, ajoute la sélection explicite du cycle et du modèle et conserve la version scientifique d’origine des recalculs réutilisables.

Sur le code de départ, un index manquant ou mal lié produit un transport vide. L’absence totale du champ de transport avec 713 lignes nationales correspond au lecteur désactivé sur le serveur. Le contrôle public retrouve cet état pour les trois cycles examinés. Le tableau de bord Vercel n’a pas été vérifié avec un accès administrateur. Une simple activation côté serveur ne couvrirait que les archives explicitement rattachées.

| Volet | État |
| --- | --- |
| Transport et preuve | [Matrice nationale](NATIONAL_MATRIX.md) |
| Contrats et 1 185 recalculs | [Validation scientifique](SCIENTIFIC_VALIDATION.md) |
| Performance | [Mesures et protocole](PERFORMANCE.md) |
| Parcours utilisateurs | [Recette navigateur](UX_VALIDATION.md) |
| Activation et retour arrière | [Mise en production](DEPLOYMENT.md) |
| Contrôles et limites | [Vérification finale](FINAL_VERIFICATION.md) |
