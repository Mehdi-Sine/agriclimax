# Task26D — writer ERA5 incrémental archive-only

La première journée nouvelle après le30octobre, **31octobre2026**, est réellement publiée enDEV. Les journées déjà validées n'ont pas été réacquises. Le writer réutilise les requêtes partagées2°, les tuiles natives1°, les713géométries, les agrégateurs et les archives exactes existants.

## Exécution et reprise

[Premier lot42211037211](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42211037211) :4emprises,8appelsCDS,307949octets,380,63s. Son arrêt borné n'a publié aucune journée partielle. [Reprise42212542234](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42212542234) : plafond22minutes atteint, checkpoint conservé. [Finalisation42216071668](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42216071668) :11emprises restantes,21appels,1105506octets,837,98s, publication réussie. Les compteurs du second stade sont conservés dans son artefact13500722135 ; le budget n'a pas été augmenté.

Octobre31 exige des requêtes de deux mois, avec le00UTC du1novembre nécessaire à la pluie ; aucune disponibilité n'est déduite de la seule horloge. La borne conservatrice aujourd'hui−6 est seulement une limite d'acquisition. Les réponses et la complétude horaire font foi.

Archive **284028octets**, SHA256`1309eaacb1337dfe12ef04d3ad13988ed687d3e65ec963dd31fbd3ce52699961`.713enveloppes et713PRA du31octobre restaurées intégralement avant publication ; zéro écriture de lignes PostgreSQL. Les grilles brutes ne sont pas stockées dansSupabase. Le catalogue expose le31octobre et le lecteur froid l'intègre à l'application.

La publication indexe uniquement des blobs immuables vérifiés, puis remplace le petit manifeste de disponibilité. Une erreur conserve le dernier cycle complet accessible. Le rejeu explicite d'une date archivée vérifie les empreintes des enveloppes et les713PRA sans téléchargement ni écriture distante.

Le contrôle indépendant du31octobre reproduit2852valeurs natives sans appeler l'agrégateur de production, compare2852valeurs API brutes et1426lignes de moyennes qualifiées. La règle90% n'est appliquée ni aux extrêmes ni aux normales/anomalies. Les anciens calculs et URL restent disponibles.

Les checkpoints exportent uniquement la journée courante :6,96Mo de fichiers dans l'essai réel, compressés en4,60Mo. Les fichiers source originaux ne sont pas supprimés ; les preuves existantes restent conservées. Les futurs artefacts de reprise expirent après3jours, les preuves après30jours, sans accumuler des années de grilles brutes dans chaque nouvel artefact.
