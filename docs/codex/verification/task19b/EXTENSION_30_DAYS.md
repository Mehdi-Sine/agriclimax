# Extension préparée, non exécutée

Plan versionné : `config/pilots/pra73-30day-plan-v1.json`.
Cible : les mêmes 73 PRA, du 19 septembre au 18 octobre 2026 UTC.
Le lot déjà présent du 12 au 18 octobre est réutilisé ; seuls 23 jours sont ajoutés.
Aucune programmation automatique, nouvelle branche Supabase ou ressource payante.

## Préflight de l’opérateur

1. Vérifier l’identité DEV, le catalogue/historique réconcilié, les checksums du
   référentiel et de la sélection, les RLS, les quotas du compte et les tailles réelles.
2. Traiter séparément l’anomalie de privilèges préexistante de `spatial_ref_sys`.
   Aucun durcissement distant hors migration Task19 n’est appliqué par ce pilote.
   Une ouverture publique supplémentaire attend ce traitement ; les RPC Task19
   restent réservés au serveur et leurs tables ne sont pas accessibles aux clients.
3. Confirmer l’autorisation de la nouvelle période, la marge DB et la disponibilité
   source réelle. Le présent accord d’écriture porte sur le pilote de sept jours.
4. Valider la lecture/validation indépendante des reçus **multi-mois** avant la
   fenêtre du 26 au 30 septembre : le dernier jour de pluie exige le 1er octobre.
   Le validateur indépendant de ce pilote refuse volontairement les tuiles ayant
   plusieurs reçus mensuels. Le provider existant sait les acquérir, cela ne
   remplace pas ce contrôle scientifique supplémentaire.

Pour chaque objet `windows` restant du JSON, avec un root distinct :

```sh
PYTHONPATH=engine/src python scripts/pra_pilot_run.py --phase plan \
  --from "$START_UTC" --to "$END_UTC" --dataset-version "$EDITION" \
  --root "$RUN_ROOT" --max-cds-requests "$REQUEST_CAP"
# Examiner le plan puis acquire, aggregate, validation indépendante, persist,
# contrôle distant et replay, avec exactement les mêmes options et paramètres.
```

Concurrence 1, au plus 7 jours par lot. Le lot traversant une fin de mois
comprend **54 requêtes** (27 emprises × deux mois), plafond explicite 60 ;
les autres en comprennent 27, plafond 40. Estimation : **135 nouvelles requêtes**,
162 pour les 30 jours en comptant le lot initial ; les polls HTTP internes CDS
ne sont pas inclus. Les requêtes ne sont pas multipliées par PRA.
Le plan garde des éditions séparées ; l’interface devra proposer explicitement
ces éditions pour une vue continue de 30 jours, sans confondre les snapshots.

## Surveillance et arrêt

Mesurer après chaque lot : pg_database_size, heap/index/TOAST par table, lignes,
empreintes, taille cache, téléchargements réels, durée, RSS, taux de cache,
quotas Storage/egress et minutes Actions. Alertes DB 300/375/450 Mo ; **arrêt
avant ingestion à 375 Mo**, cache borné à 448 MiB et jobs bornés par le plan.
Arrêt immédiat si checksum/identité divergent, conflit d’idempotence, RLS ou
privilèges inattendus, valeurs fabriquées, sortie incomplète annoncée complète,
échec scientifique, quota indisponible ou croissance non expliquée.
La file CDS et les retries SDK peuvent allonger la durée ; ne pas augmenter
la concurrence ou souscrire un service pour contourner un échec.

PRA littorales : conserver NULL/couverture observée/compteurs et fraîcheur,
sans interpolation ni changement de poids. Sept jours ne prouvent pas un masque
structurel permanent. SAFRAN/SIM ou ERA5 restent des pistes à qualifier séparément.

## Retour arrière

Suspendre le pilote et retirer son entrée de navigation/configuration si nécessaire.
Conserver les publications immuables et les anciennes données v0.2.0. Reprise
sur checksums/checkpoints après correction autorisée ; aucun DELETE, purgeur,
rollback destructif de schéma ou réécriture des migrations déjà appliquées.
La rétention 90 jours est un horizon de budget, aucune suppression automatique.

## Étape nationale ultérieure

713 PRA ×30 jours reste **non exécuté**. La grille complète requiert 96 tuiles
et 30 groupes contre 86/27 pour ce pilote. Avec les mêmes fenêtres et le passage
mensuel, estimer 180 requêtes logiques, pas 162 ×713/73. Agrégation et persistance
croissent plutôt avec le nombre de PRA ; file CDS, taille réelle et quotas restent
à revalider. Une autorisation nationale distincte sera nécessaire.
