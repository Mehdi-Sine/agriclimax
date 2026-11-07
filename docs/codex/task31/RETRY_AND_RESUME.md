# Reprises et idempotence

## Lectures réseau

AROME/ARPEGE WCS et lectures IFS : au plus **3 tentatives par requête**, backoff 2 puis 4 secondes. HTTP réessayés : 408, 429, 500, 502, 503, 504 ; indisponibilité réseau et interruptions de transport pertinentes. `Retry-After` numérique est respecté jusqu'à 30 secondes ; une attente plus longue ou une date HTTP diffère le traitement vers un prochain job, sans raccourcir l'attente serveur. 401/403, absence de secret, 404, contenu/format/range invalide et checkpoint corrompu ne provoquent pas de boucle de reprise.

Chaque tentative consomme le compteur de requêtes. Les réponses incomplètes IFS et erreurs WCS sont comptées conservativement lorsque le nombre exact d'octets lus est indisponible. La réserve avant requête et le contrôle du temps peuvent refuser une requête pourtant petite : priorité au budget. Les ranges IFS restent exacts (206 et `Content-Range`), jamais un fichier GRIB complet en remplacement.

Le SDK CDS conserve son paramétrage existant `retry_max=3`, `sleep_max=8`, subprocess borné à 240 s ou au temps restant. Aucun retry supplémentaire aveugle n'est ajouté autour de CDS. Un défaut de secret/licence doit être corrigé avant relance.

## Checkpoints météo

Le WCS conserve chaque corps et reçu SHA-256 par URL/champ natif ; une requête défaillante ne remet pas à zéro les autres champs. Les caches IFS sont isolés sous `cycles/YYYYMMDDTHH/ifs`. IFS reste le cycle 00 UTC existant ; aucun changement de sélection scientifique. Les caches legacy du jour correspondant sont déplacés localement vers ce namespace, sans redownload ; les checksums et reçus restent contrôlés.

La restauration automatique cherche au maximum 20 exécutions de la même branche. Elle ignore l'exécution courante. Si l'API identifie un artifact et que son téléchargement échoue, le job échoue : **pas de reprise froide silencieuse**. Un ID explicite absent/expiré échoue également. Les identités natives et références sont vérifiées par les consommateurs.

L'export conserve un seul cycle sélectionné (448 MiB maximum), sans supprimer les originaux. Les catalogues de découverte WCS sont volontairement rafraîchis ; leur cache horaire ne constitue pas une publication. Un nouveau cycle utilise de nouvelles identités natives, et n'invente pas des champs manquants à partir du précédent.

## ERA5

Les tuiles compactes, sources vérifiées et sorties PRA restent immutables. Les journées déjà dans le catalogue sont restaurées/vérifiées puis quittées avec zéro acquisition et zéro écriture distante. Une journée historique antérieure au dernier jour validé ne peut être réacquise. Le plafond conservateur reste aujourd'hui moins six jours.

`acquire_windows` continue seulement les tuiles absentes ; les sorties PRA terminées sont relues avec leur checksum. Si la limite de groupes est atteinte, le job échoue avec checkpoint, ce qui permet les deux continuations bornées existantes. `--resume` lit la date du reçu restauré et refuse une date contradictoire : une continuation ne passe pas au lendemain si la publication précédente a déjà abouti. La dernière continuation disponible est recherchée au prochain schedule.

Le quota de l'agrégation hors réseau est initialisé par un scan, puis majoré de chaque répertoire produit. Une réserve de 1 MiB par sortie journalière est vérifiée ; les sorties existantes peuvent être surcomptées. Ce mode est interdit pour une acquisition, une fenêtre multijour ou des paramètres scientifiques additionnels. La méthode de calcul et les identités de sortie sont inchangées.

## Relance manuelle sûre

Sur `main` corrigé : inspecter le rapport quotidien et l'artifact disponible, puis utiliser `workflow_dispatch` du workflow `pra-climate.yml`.

- Météo interrompue : `mode=weather-national`, `checkpoint_run_id` explicite, `from=YYYY-MM-DD`, `to=H00/H06/H12/H18`, `execute=true`, `national_authorized=true`. N'ajouter `publish_dev=true` que pour une publication DEV autorisée après validation. Choisir exactement le cycle interrompu.
- ERA5 interrompu : `mode=era5-archive`, ID explicite, `from` égal à la journée du reçu, mêmes autorisations ; limite de téléchargements 1–64. La restauration choisit la dernière continuation de cet ID. Une date déjà publiée est un rejeu sans acquisition.
- Contrôle seul : `mode=weather-health` ; ou CLI météo `--mode replay --execute --run-date ... --run-hour ...`, et ERA5 `--replay-latest --execute`. Les rejeux lisent Storage et peuvent écrire un reçu local, mais n'écrivent pas Storage et ne téléchargent aucun champ source.

Les continuations automatiques restent réservées au schedule et aux flags DEV/kill switch existants. Pour une interruption manuelle, répéter explicitement le dispatch avec le nouvel ID de checkpoint. Ne pas relancer tous les jobs échoués sans vérifier les reçus, les secrets/licences et la rétention de trois jours.
