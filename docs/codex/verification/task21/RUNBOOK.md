# Exécution et passage national

Depuis la racine, avec les dépendances climate/geo du moteur et
`PYTHONPATH=engine/src`. Identifiants injectés dans l'environnement serveur,
jamais dans les commandes ou manifests. Cible d'import : agriclimax-dev seulement.

## Pilote unique

Sélection officielle existante de 73/713 PRA (10,24 %), 13 régions ; aucun nouveau
micro-pilote. Toutes les PRA sélectionnées sont analysées, y compris celles dont
le support incomplet doit produire une référence absente.

```sh
python scripts/pra_climatology.py --phase plan
python scripts/pra_climatology_acquire.py
python scripts/pra_climatology.py --phase reduce
python scripts/pra_climatology.py --phase build
python scripts/pra_climatology_validate.py --prepare-national
```

L'acquisition reprend les jobs sauvegardés ; aucun doublon soumis. Quatre jobs
maximum suivis, téléchargements sérialisés, plafond de 2 Gio. Quatre premiers
lots T2m/TP groupés réutilisés ; ensuite T2m garde 24 heures et TP seulement
00 UTC. Les 14 reçus/SHA256 et les dimensions/unités/coordonnées sont vérifiés.
Les données actuelles viennent de l'édition nationale du 19/09 au 18/10/2026 :
21 390 lignes uniques. Les real PostgreSQL sont exportés comme float64 JSON afin
de préserver leur précision, sans prétendre augmenter la précision du modèle.

Le validateur indépendant compare moyennes, quantiles, rangs, différences et
valeurs NULL, plus les résultats de l'agrégateur existant sur la première journée.
Une attente CDS n'est pas une impossibilité d'exécution.

## Passage direct aux 713 PRA pour la fenêtre disponible

Les sources du pilote couvrent déjà l'emprise nationale ; zéro téléchargement
supplémentaire pour ces dates. La porte `national-gate.json` n'est produite qu'après
la validation indépendante et le contrôle des enveloppes de stockage.

```sh
python scripts/pra_climatology.py --scope national --phase plan
python scripts/pra_climatology.py --scope national --phase reduce
python scripts/pra_climatology.py --scope national --phase build
python scripts/pra_climatology_validate.py --scope national
```

La méthode et les poids restent identiques, sur les 6 861 mailles nécessaires.
Les périodes homologues complètes restent séparées des journées ; aucune moyenne
de percentiles journaliers n'est utilisée pour une fenêtre.

## Stockage privé et lectures

Migration additive `pra_climatology_1991_2020`, créée avec le CLI Supabase.
Trois relations compactes : releases, support PRA lié à la version géographique,
normales scalaires. Aucune écriture dans les données actuelles ni dans l'ancien
stockage JSONB d'indicateurs de grille/agronomie. Voir SCHEMA.md.

Après déploiement du schéma sur DEV et validation locale :

```sh
python scripts/pra_climatology_store.py --scope pilot
python scripts/pra_climatology_store.py --scope national
```

Un rejeu doit retourner zéro insertion. Une même clé avec un contenu différent
est rejetée. Chaque import vérifie les empreintes du rapport indépendant et des
normales. Le RPC vérifie provenance, période, PRA, bornes physiques, échantillons,
doublons et limites de taille, puis applique l'insertion atomiquement.

La lecture serveur `agriclimax_pra_climatology_read` prend explicitement release,
édition actuelle, PRA et dates (366 jours maximum). Elle sépare current_value,
normal_1991_2020 et anomaly, avec unités, états, fraîcheur et provenance. Les
anomalies ne sont pas dupliquées en table. Le rang empirique du jour actuel est
fourni dans les exports calculés depuis le cache historique ; le RPC ne le devine
jamais à partir des seuls p10/médiane/p90. Aucun privilège public/anon/authenticated
n'est ajouté ; le futur backend produit appelle le RPC avec le compte serveur.

## Calcul annuel national préparé, non lancé

```sh
python scripts/pra_climatology_annual.py
python scripts/pra_climatology_annual.py --execute
```

La première commande prépare seulement. La seconde exige la porte validée et son empreinte (reprise depuis evidence/ si le
workspace de calcul a été remplacé), puis lance les 92 requêtes exactes : 78 blocs T2m (février séparé par statut bissextile),
13 blocs TP mensuels à 00 UTC et le TP 2021-01-01 pour le cumul du 31/12/2020.
Pas de produit cartésien inventant un 31 février.

Le runner traite et contrôle chaque fichier avant d'écrire un checkpoint PRA,
vérifie son SHA256 et évince uniquement son propre spool NetCDF. Les reçus et les
checkpoints restent hors Supabase. Le budget du spool tient compte du cache brut
du pilote conservé. Les 24 heures de température restent obligatoires.

Résultats annuels : cache compact de 366 jours calendaires +12 mois +année, et
historique float64 de chaque PRA, utilisable pour les rangs/périodes ultérieurs.
Les huit 29 février ne donnent pas une normale quotidienne à 30 échantillons.
Les mois et années utilisent leurs vrais 28/29 et 365/366 jours ; tout vrai jour
manquant invalide la période. Les sorties sont `computed_not_imported` : aucun
import annuel ni calcul annuel historique n'est prétendu réalisé par le pilote.
Conserver les sorties/checkpoints dans un stockage externe durable avant de
compter sur une reprise après remplacement du workspace ; aucun archivage durable
du workspace éphémère n'est supposé. Ne jamais purger les anciennes éditions de la
base pour faire rentrer la projection.
