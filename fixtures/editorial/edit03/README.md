# Preuves réelles EDIT-03

Copies en lecture des archives publiées les 12 et 13 novembre 2026 et de leurs
bundles de dix cartes. Extraites le 13 novembre via les RPC existants `archive_read`
et Storage GET uniquement. Aucune acquisition, génération IA, insertion ou
publication. Les deux éditions sont celles décrites dans `manifest.json`.

Chaque export gzip contient `archive`, `bundle` et `publication`. Le gzip local
est un export JSON recompressé, pas le blob de stockage original ; son empreinte
et celle du blob source sont distinctes et toutes deux renseignées. Les archives,
cartes et manifestes sont vérifiés avec les validateurs existants avant utilisation.
Les données concernent des PRA, sans clé API ni données de compte. Le reçu IA
historique du 12 conserve son identifiant et coût d'origine ; il ne s'agit pas
d'un nouvel appel. Le 13 utilise la révision factuelle OPS-07.

Aucun snapshot ou fichier d'entrée d'acquisition n'est copié ou recalculé.
Ces fixtures ne doivent pas être mises à jour avec une nouvelle couverture ou
des résultats plus récents. Le script `scripts/edit03_simulate.ts` les lit hors
ligne sans jamais les réécrire. Les preuves synthétiques de tests restent en
mémoire et ne sont pas enregistrées dans ces exports.
