# Activation manuelle nécessaire

L'identité GitHub disponible répond HTTP 403 sur lecture **et** PATCH de la
variable ; sa valeur actuelle n'est pas vérifiable. Aucun secret SIM ne manque
pour la collecte publique locale réussie. Les secrets des futurs jobs GitHub
n'ont pas été audités par cette identité ; les liaisons de l'environnement local
ne prouvent pas leur présence dans Actions.

Un administrateur du dépôt doit utiliser Settings → Secrets and variables →
Actions → Variables → Repository variables, puis créer ou modifier :

```text
AGRICLIMAX_SIM_CANDIDATE_ENABLED=true
```

Équivalent avec une identité disposant de l'écriture des variables Actions :

```sh
gh variable set AGRICLIMAX_SIM_CANDIDATE_ENABLED --body true --repo Mehdi-Sine/agriclimax
gh variable get AGRICLIMAX_SIM_CANDIDATE_ENABLED --repo Mehdi-Sine/agriclimax
```

Cette action est possible sur le main actuel car le hook est déjà fusionné dans
#92. Elle active seulement le canari dans les prochains **jobs ERA normalement
planifiés** ; elle ne déclenche pas de job si le cycle opérationnel est arrêté.
Ne changer aucun autre flag, secret ou réglage éditorial ; ne pas lancer le
workflow complet pour tester SIM. Vérifier l'artifact `t36-era5-checkpoints`,
sous-dossier `sim-candidate` : dates réelles, `missing_dates`, provenance,
éligibilités fausses et conservation du checkpoint ERA en cas d'échec SIM.
L'absence de droits n'est pas une activation réussie.

Désactivation simple :

```sh
gh variable set AGRICLIMAX_SIM_CANDIDATE_ENABLED --body false --repo Mehdi-Sine/agriclimax
```

Supprimer la variable a le même effet. Les jobs déjà commencés restent bornés.
Conserver preuves et objets candidats ; ne toucher à aucune archive publiée.

## Recette locale et reprise durable manuelle

Installer les dépendances verrouillées dev, geo et safran dans un environnement
Python 3.12. Les commandes de collecte/revue n'écrivent qu'en local.

```sh
PYTHONPATH=engine/src:scripts python scripts/couv03_collect.py --root work/couv03b/new-candidate
PYTHONPATH=engine/src:scripts python scripts/couv03b_review.py --root work/couv03b/new-candidate --output work/couv03b/review
# Transport manuel autorisé uniquement vers le bucket privé existant ; utilise
# NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY côté serveur, sans les afficher.
PYTHONPATH=engine/src:scripts python scripts/couv03b_checkpoint.py save --root work/couv03b/new-candidate
# Utiliser le digest exact retourné par save ; destination neuve obligatoire.
PYTHONPATH=engine/src:scripts python scripts/couv03b_checkpoint.py restore --root work/couv03b/restored-new --checkpoint-sha256 420ae816f19d6d18d506c9dc5915995eddf592552891f35806f062dafb777faf
```

Le dernier digest restaure la première collecte de cette PR, pas une garantie de
fraîcheur future. Le transport est préparé et testé mais reste manuel ; les
conditions de raccordement durable sont dans `RESULTATS.md`.
