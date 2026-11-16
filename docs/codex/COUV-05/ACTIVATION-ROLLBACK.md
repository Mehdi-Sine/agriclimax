# Activation et retour arrière — procédure candidate, non exécutée

## État livré

`COUV05_CAPTURE_NATIVE_MASKS` et `COUV05_RENDER_ENABLED` sont indépendants et inactifs par défaut. Aucune variable distante n'a été changée. `NEXT_PUBLIC_COUV04_RENDER_ENABLED` est inchangé. La draft reste PARTIAL et l'activation reste NO-GO.

Le branchement livré couvre l'API météo et sa carte via le moteur COUV-04 existant. L'adaptateur de liaison est partagé, mais Explorer, les calculateurs agroclimatiques, cartes du jour, Journal, éditions, miniatures et carrousels ne reçoivent pas automatiquement les nouveaux sidecars. Leur raccordement à des valeurs calculées sur le support exact reste à réaliser/valider. Les éditions déjà publiées gardent leurs objets et leur rendu.

## Reproduction sans acquisition

Installer les dépendances verrouillées du dépôt. Aucun des exemples suivants ne lance de workflow distant ni d'acquisition fournisseur.

```bash
# Audit d'une archive prévisionnelle locale vérifiée, sans invention de masque.
PYTHONPATH=engine/src:scripts python scripts/couv05_archive_audit.py \
  --archive work/couv05-real-weather.json.gz --output work/couv05-audit

# IFS uniquement : si un cache national natif, son SHA et son manifeste sont disponibles.
# Ce script reconstruit aussi les réductions DANS LE RÉPERTOIRE LOCAL DE RECETTE.
# Le copier d'abord dans un espace de travail distinct des archives publiées.
COUV05_CAPTURE_NATIVE_MASKS=true PYTHONPATH=engine/src:scripts \
  python scripts/operational_weather_pilot.py --scope national \
  --run-date YYYY-MM-DD --root work/couv05-local/ifs --offline-native --execute

# Captures AROME/ARPEGE déjà disponibles + cache IFS vérifié :
PYTHONPATH=engine/src:scripts python scripts/couv05_masks.py \
  --root work/couv05-local --run-date YYYY-MM-DD --geometry \
  --archive-sha256 SHA256_ARCHIVE_NUMERIQUE --output work/couv05-sidecars

# Plan de stockage OFFLINE : aucun accès distant, aucune publication.
PYTHONPATH=engine/src:scripts python scripts/couv05_store.py \
  --root work/couv05-sidecars --index-sha256 SHA256_INDEX --budget-bytes BUDGET_REVU
```

`--run-date` ancre la fenêtre de validité ; chaque capture garde son cycle UTC d'émission propre, dont H18. Les reprises actuelles ont été validées sur la fenêtre ancrée au 14 novembre 2026. Ne pas réétiqueter un H18 en H00 ni fusionner des supports de cycles différents.

Reconstruction après expiration du checkpoint : `couv05_rebuild.py --evidence docs/codex/COUV-05/evidence --archive ARCHIVE_LOCALE --output work/rebuilt`. Le paquet conserve les captures de cellules et les poids certifiés ; il ne conserve aucune grille de valeurs météo. Un contrôle borné sur le premier objet AROME a prouvé son identité bit à bit ; le rebuild intégral doit encore être rejoué.

AROME/ARPEGE : un checkpoint réduit ne suffit pas. Il faut des champs natifs vérifiés ou une capture v2 déjà produite. Une réacquisition WCS exige une revue des budgets et une autorisation distincte ; aucune commande d'acquisition n'est exécutée ici.

## Conservation candidate effectuée et reprises ultérieures

Le candidat de ce cycle est déjà conservé en privé, avec 260 relectures exactes et empreintes des pointeurs inchangées. Cette opération relève de la persistance demandée et n’active aucun rendu. Voir `evidence/storage-publication.json`.

Pour un cycle suivant, après inventaire Storage complet et revue de son budget, `couv05_store.py --upload` peut insérer les blobs puis l'index. Il impose un budget explicite et `--retained-forecast-bytes` incluant les anciennes révisions et objets orphelins ; sans cet inventaire audité, l'envoi est refusé. Le garde total existant de 900 Mio reste appliqué. Le bucket existant doit être privé. Insertion sans upsert, lecture de contrôle exacte et collision bloquante. Aucun pointeur publié n'est déplacé et aucun index historique n'est remplacé.

Avant toute activation : valider les masques natifs complets, leurs fractions/géométries pour les 713 PRA et six corses, les sorties scientifiques sur ces supports, les 28 recettes et toutes les surfaces/cartes requises. Refaire les comparaisons réelles littoraux/îles/proches du seuil et toutes les tailles d'écran. Les seules preuves synthétiques ou le contrôle de repli gris ne satisfont pas ce gate.

Après cette revue seulement : une décision distincte pourra autoriser `COUV05_RENDER_ENABLED=true` et fixer `COUV05_INDEX_SHA256` au SHA exact de l'index immuable, avec le contrat COUV-04 activé séparément. L'index est lié à une archive précise ; une autre archive, source ou période est refusée. La requête est bornée à cinq manifestes, douze fragments géographiques par manifeste, 8 Mio par objet et 1 Mio pour l’index. Le budget cumulé de lecture est de 16 Mio comprimés et 64 Mio décomprimés ; les fragments sont dédupliqués et seules les géométries réellement peintes partiellement sont renvoyées au client. Une requête plus grande donne une preuve inconnue ; le routage des historiques multi-variables nécessite encore une stratégie de pagination.

## Retour arrière

Remettre `COUV05_RENDER_ENABLED` à sa valeur inactive, retirer le pin si nécessaire. Le lecteur ne fait alors aucune lecture de sidecar et le chemin antérieur est repris. Arrêter séparément la capture facultative. Aucun objet publié n'est réécrit ou supprimé ; conserver les blobs et index pour l'audit. Ne pas modifier les règles scientifiques, les seuils, les sources ou les éditions pour effectuer ce retour arrière.


## Protection contre le déploiement automatique

Le contrôle de la PR initiale a révélé une intégration Vercel active. `vercel.json` à la racine et dans `apps/web/` fixe `git.deploymentEnabled["codex/COUV-05-native-forecast-masks"]` à `false`, pour couvrir les deux racines de projet possibles. Aucun autre branchement n'est désactivé. Configuration vérifiée contre le schéma officiel Vercel. Ce garde empêche le push demandé de provoquer une prévisualisation ; aucun appel de déploiement n'est effectué et les workflows GitHub existants ne sont pas modifiés.
