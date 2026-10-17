> État courant après réception de l’archive OFB/MASA :
> [intégration des 713 contours, poids, pilote réel et stockage](OFFICIAL_PRA_INTEGRATION.md).
> Les éléments ci-dessous décrivent les observations antérieures. La comparaison
> INRAE/OFB est désormais reproduite ; le contrôle administratif indépendant reste ouvert.

# Budget et coûts — mesures distinctes des hypothèses

| Élément | Mesuré / estimé |
|---|---|
| Supabase DEV avant / après développement local | 24 598 195 / 24 598 195 octets, SQL lecture seule |
| Storage distant | 0 objet / 0 octet, métadonnées |
| 713 × 90 lignes quotidiennes **synthétiques**, PostGIS 17 local | 64 170 lignes ; table + deux index : 29 696 000 octets ; tuple moyen 297 octets |
| Polygones officiels et correspondance nationale | non mesurés, import bloqué |
| Pilote source réel | 4 fichiers, 143 114 octets, 36 cellules, un jour ; aucune extrapolation de SLA |

Les géométries du benchmark de stockage sont de petits carrés synthétiques,
pas la référence officielle. La taille des chaînes de version/flags et des index
influe sur le coût réel ; ne pas appliquer ce chiffre comme mesure nationale.

Le plan utilise 512 octets/ligne quotidienne index compris et 16 KiB par batch
hebdomadaire. À 713 PRA et 90 jours : 64 170 lignes climatiques partagées,
9 269 batches maximum si une PRA/fenêtre de sept jours. Les diagnostics ne sont
stockés que sur demande, pas sur une matrice 100 productions × PRA × indicateurs.
Géométrie/mapping : formule depuis le vrai export et intersections, pas une surface
supposée ; aucune géométrie répétée sur les lignes climatiques.

`evidence/storage-budget.json` donne un **scénario**, pas une validation : réserves
hypothétiques de 100 MB de référence, 5 MB de mapping, 1 MB de logs, huit diagnostics
par fenêtre hebdomadaire. Environ 335 MB à 90 jours, sous la cible 375 MB, sous
réserve des mesures officielles, de la croissance v0.2 et des tailles de provenance.
Le scénario à un an **sans rétention** dépasse 500 MB : ce n’est pas un mode durable
compatible Free. Il faut valider archive/recalcul et rétention avant cette durée.
Ne pas supprimer les historiques utiles pour masquer ce dépassement.

Free : plafond de planification 500 MB confirmé le 17 octobre 2026. Alertes
applicatives 60/75/90 % = 300/375/450 MB ; cible initiale 375 MB. Le dry-run sépare
les données mesurées et les estimations ; taille existante inconnue => warning
unknown_existing_size. La RPC refuse une ingestion qui franchirait la cible,
sans upgrade payant. L’import SQL de référence a aussi un preflight estimatif.
Un compteur PostgreSQL n’est pas une garantie de facturation/egress côté fournisseur.

## Réductions de coût mises en œuvre

- Quatre statistiques communes par PRA/jour, références et unités séparées.
- Sources horaires hors DB ; `.download` temporaires supprimés, cache borné.
- Tuiles quotidiennes natives compactes partagées entre PRA et entre reprises,
  avec checksums, pour éviter de télécharger à nouveau la même météo par production.
- Metadata une fois par batch, lectures paginées, aucun calcul bulk dans Vercel.
- Logs des nouveaux runs bornés à 100 ; aucun purgeur des données existantes.
- Rétention configurable en dry-run, initialement 90 jours ; références futures
  et statistiques utiles longue durée séparées. Pas de suppression activée.

## Actions / Vercel / archivage optionnel

Le dépôt est privé. Les limites Actions publiées ont été consultées : les enveloppes gratuites de
minutes et d’artifacts dépendent du compte et de la visibilité du dépôt. Les
quotas disponibles du compte n’ont pas été mesurés. Ne pas multiplier 713 jobs
par jour : le chemin national autorisé peut traiter les PRA déjà couvertes par
les tuiles compactes dans un seul job, avec **un seul nouveau téléchargement**
par job configuré. Les temps de file CDS et le coût national mensuel sont encore
à mesurer. Aucun cron national ni augmentation de concurrence n’est activé.
Artifacts de reprise 7 jours, horaire brut exclu ; pas une archive pérenne.

Aucune infrastructure externe créée. Option locale : archive compressée des
intermédiaires quotidiens + reçus/checksums, coût de stockage du disque existant,
durabilité à gérer par l’opérateur. Option objet externe uniquement après chiffrage
volume × tarif + requêtes/egress et autorisation ; aucun prix contractuel supposé.
Une archive 30 ans n’est ni générée ni transférée dans Supabase.
Vercel ne reçoit que les DTO territoriaux bornés ; usage/plan exact à contrôler
avant exploitation nationale, aucun service payant activé ni promesse de gratuité
si l’usage réel ou les conditions contractuelles dépassent l’enveloppe du compte.
