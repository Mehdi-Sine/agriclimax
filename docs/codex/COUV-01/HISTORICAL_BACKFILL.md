# Archives et continuité historique

## Deux catalogues, deux résultats réels

Le catalogue Storage et tous ses cinq blobs ERA ont été lus et leurs SHA256
vérifiés : 19/10–01/11/2026, quatorze jours. Les enveloppes embarquées sont aussi
vérifiées. Trois doublons identiques sont dédupliqués ; un conflit aurait fait
échouer le contrôle. Aucun objet indexé n'est manquant dans cet échantillon.
Le manifeste courant ne référence pas les journées antérieures au 19/10.

La RPC historique renvoie en revanche trente journées du 01/10 au 30/10. Des
lectures nationales ont confirmé l'existence des données, pas seulement des
dates dans un catalogue. Les trente journées, 21 390 lignes PRA avec batch keys,
ont été sauvegardées localement dans `evidence/legacy/`, empreintes et manifeste
inclus. Chaque journée a 645 PRA complètes ; l'intersection des PRA complètes sur
les trente jours est aussi 645. Voir `legacy-restoration.json`.

La restauration utilise trois étapes de 14/14/2 jours ; bornes de 113/113/17 RPC
lecture par étape, sans réacquisition météo et sans écriture distante. La reprise
relit les empreintes locales et ne redemande pas les journées présentes. Ces
exports sont le contrat de lecture legacy avec valeurs float4 et batch keys,
**pas** les octets des enveloppes initiales ni les cellules natives perdues.
Ils ne remplacent aucune archive ou valeur historique existante.

Cela explique la divergence Task28/AGRO-01 : le chemin de lecture Storage seul
n'est pas l'inventaire de toute la conservation historique. Le raccordement
éventuel à #62 doit être une contribution ultérieure, après revue, pour respecter
l'isolation demandée. Aucun lecteur métier de #62 n'a été modifié ici.

## Checkpoints et expiration

L'inventaire GitHub compte 2 170 artefacts examinés. Les artefacts Task29 sont
encore catalogués, notamment `13571358993`, 9 682 683 octets, expiration 14/11/2026
11:08:18 UTC. Les artefacts ERA existants ont également des expirations rapprochées.
Leurs métadonnées sont conservées ; les payloads n'ont pas été retéléchargés pour
prétendre revalider les cellules. Les agrégats DB retrouvés rendent inutile une
nouvelle acquisition ERA pour reconstruire la série strictement agrégée.

## Nouvelle série SIM

60 journées réellement continues du 08/09 au 06/11 sont conservées dans un
instantané explicite. Le lecteur `safran_archive.read_day` vérifie taille,
empreinte, dates, identités, variables et versions. Les fenêtres de 7/14/30 jours
sont strictes : aucun remplissage et aucune concaténation de récupérations
différentes. Ce choix conservateur évite un raccordement invisible de révisions.

La conservation pérenne du pilote est assurée par ses petits résultats versionnés
dans cette PR ; ce n'est pas une promesse d'archivage quotidien automatique.
Les artefacts Actions de sept jours ne constituent pas une sauvegarde durable.
Avant activation quotidienne, il faut un index de journées immuables avec
révisions, un stockage durable borné et une stratégie de déduplication ; conserver
un nouvel instantané de 60 jours chaque jour dépasserait le budget à terme.
Les données révisées ne doivent jamais écraser leur version antérieure.

## Reprise opérateur

```bash
# Lecture seule : au plus 14 jours réellement absents par exécution.
PYTHONPATH=engine/src:scripts python scripts/archive_legacy_pra_reads.py --start 2026-10-01 --end 2026-10-30
# Répéter la même commande jusqu'à missing_dates=[] (trois étapes dans le pilote).
```

Les variables d'environnement existantes restent côté serveur ; aucun secret dans
les arguments. Il n'existe pas d'option d'écriture distante dans ce programme.
Les anciennes séries peuvent être relues indépendamment des nouvelles données SIM.
