# Déploiement progressif et retour arrière

Aucun des switches ci-dessous n'a été activé dans cette PR. Ne pas déclencher le
workflow éditorial pour une recette SIM. Le workflow normal reste la seule horloge.

1. **Collecte** : `AGRICLIMAX_SIM_CANDIDATE_ENABLED` existant, sans changement.
2. **Persistance** : nouveau `AGRICLIMAX_SIM_PERSISTENCE_ENABLED`, absent/false par
   défaut. Avec les deux variables vraies, le job `sim-candidate` remplace le
   canari embarqué ERA : un écrivain pour restore → collect → save → restore.
   Aucun job éditorial ne dépend de lui. Cinq minutes maximum, continue-on-error,
   collecteur existant limité à 115 s. Sans persistance, ancien canari conservé.
3. **Qualification/publication SIM** : aucun switch changé, éligibilités false.
   La persistance n'autorise pas la consommation publique.
4. **Rendu** : `NEXT_PUBLIC_COUV04_RENDER_ENABLED=true` doit être défini au build
   d'une preview isolée. Absent/false par défaut. Next incorpore cette valeur au
   build ; changer une variable sans reconstruire ne change pas le navigateur.
   Les cartes publiées/archives restent gelées même avec le flag.

Retour arrière : retirer le flag de rendu puis reconstruire. Retirer le flag de
persistance pour retrouver l'ancien canari ; retirer celui de collecte pour tout
arrêter. Les objets candidats existants sont conservés. Ni suppression ni purge
d'archives. Aucune migration, table, bucket, politique, nouveau cron ou service.

## Reprise durable bornée

Bucket privé existant `pra-climate-archives`, préfixe exclusif
`candidates/safran-sim/v1/rolling/`. Huit slots fixes de **2 Mio maximum** et un
pointeur de moins de 4 Kio : plafond **16 781 312 octets**, pas un nouveau plafond
supplémentaire à chaque cycle. Le slot suivant est relu avant déplacement du
pointeur ; il ne remplace pas le slot courant. Les anciens slots roulants sont
remplacés uniquement dans ce namespace candidat, jamais les checkpoints immuables
COUV-03B ni les archives publiées. Un crash avant le pointeur laisse la dernière
reprise valide. Une corruption bloque la restauration, sans écraser de répertoire
local. Le dépassement du budget bloque la sauvegarde sans supprimer de données.

Le job Actions sérialise le cycle complet. **Ne pas lancer un CLI save concurrent**
avec ce job ou un autre écrivain : le transport Storage ne fournit pas de CAS.
Les huit slots gardent huit sauvegardes, pas une rétention de huit journées.
La durée sans Actions est indépendante de ses artifacts (le dernier pointeur
reste dans Storage) ; elle ne garantit pas la conservation d'une source brute
que le fournisseur aurait révisée pendant l'arrêt.

Recette manuelle serveur (pas de secret dans le navigateur) :

```sh
PYTHONPATH=engine/src:scripts python scripts/couv04_checkpoint.py save --root docs/codex/COUV-03B/evidence/candidate
PYTHONPATH=engine/src:scripts python scripts/couv04_checkpoint.py restore --root work/couv04/recovery-new
```

Une destination neuve est obligatoire. Les secrets Actions nécessaires au job
n'ont pas été audités par cette tâche ; les secrets locaux ont permis la recette
réelle Storage, pas une preuve de configuration du futur runner distant.
