# Conservation quotidienne durable

## Objets et index

Réutiliser le bucket privé `pra-climate-archives`, sans nouvelle table, service ou
abonnement. Les nouvelles journées ERA5 sont les enveloppes exactes d'une seule
date, gzip déterministe, adressées par SHA256. Les archives historiques multi-jours
restent intactes. Les supports quotidiens ont leur objet immuable ; les géométries
et masques communs sont référencés par leur empreinte et dédupliqués. Les prévisions
sont archivées par run de modèle : leur révision ne se confond pas avec une
révision d'observation ou de réanalyse.

L'identité d'une donnée comprend source, dataset, date UTC, variable et unité,
opérateur spatial, transformation temporelle, PRA, géométrie et poids. Les
variables d'une enveloppe ERA sont connues par contrat, pas devinées depuis un
nom de fichier. Le catalogue actuel indexe dates et objets ; les enveloppes
transportent l'identité détaillée. Une future indexation relationnelle peut
projeter ces champs sans recopier les valeurs météorologiques.

DATA-01 ajoute `catalogues/<sha256>.json.gz`, snapshot gzip immuable de métadonnées avant
la progression d'un pointeur. `current.json` porte `catalogue_revision`, l'empreinte
étant contenue dans le chemin. Les lecteurs existants acceptent cette extension
additive. Les anciennes révisions restent récupérables ; aucune purge ni écrasement
n'est introduit. Ce sont de petits index, jamais des copies des fenêtres de valeurs.

## Protocole de publication

1. Acquérir uniquement les tuiles absentes ; vérifier les checkpoints existants.
2. Produire les 713 sorties et les restituer indépendamment ; qualifier les supports.
3. Charger les blobs immuables, puis relire empreinte et taille.
4. Préserver l'ancien catalogue ; ajouter les références validées, réserver un budget conservateur de rétention des index, écrire le catalogue.
5. Relire le catalogue, préserver sa révision immuable ; remplacer `current.json` en une seule écriture et le relire.

Le groupe de concurrence existant sérialise les auteurs GitHub. Aucune transaction
multi-objets n'est revendiquée. Une coupure avant l'étape 5 laisse le dernier
current valide ; le catalogue peut déjà contenir le nouveau cycle. Les lecteurs
de catalogue historique peuvent voir cet ajout vérifié avant la progression du
pointeur courant. Les objets supplémentaires non référencés restent récupérables.
La réparation explicite DEV ne réacquiert rien et ne remplace pas une archive.
Un second auteur extérieur au groupe nécessite un verrou / contrôle de génération
avant autorisation : ne pas activer deux pipelines en concurrence.

## Révisions et intégrité

Une révision de fournisseur doit être une nouvelle identité de dataset et une
nouvelle empreinte, conservant la précédente. Le writer courant refuse la
réacquisition de l'historique legacy et ne remplace pas un jour déjà indexé.
Il ne constitue donc pas encore un mécanisme d'adoption automatique de corrections
CDS : cette adoption exige revue de compatibilité et sélection de révision.
Les conflits sont bloquants ; ne jamais choisir arbitrairement un doublon divergent.
Les objets identiques ne sont pas renvoyés ; l'index permet de reconstruire une
fenêtre stricte sans copies quotidiennes de 30 ou 60 jours.

La garde est de 8 Mio par objet et 900 Mio de stockage indexé. DATA-01 comptabilise
aussi une réserve persistée conservatrice pour les révisions d'index futures.
L'usage indexé ne certifie pas le solde du compte Supabase : anciens objets
orphelins, autres buckets et index antérieurs à DATA-01 doivent être inventoriés
avant une activation durable. En l'absence de place, arrêt avec diagnostic ;
aucune suppression automatique. Les index immuables sont des archives applicatives,
les checkpoints Actions de trois jours sont uniquement une aide de reprise.

## Sécurité et restauration

Transport serveur existant HTTPS, hôte DEV fixé, refus des redirects, clé privée
jamais transmise au navigateur. Aucun changement RLS, migration, rôle ou bucket
public. La classe `ArchiveStore(read_only=True)` refuse toute mutation. Les docs
Storage et le changelog Supabase ont été relus ; aucun changement d'API requis.

Pour une restauration : choisir une révision connue, vérifier chaque blob et ses
enveloppes, les dates/identités/versions/supports, puis préparer le pointeur en
DEV. La bascule de production reste soumise à l'autorisation explicite demandée
par TASK.md. Aucun test de mutation distante n'est effectué dans cette session.
