# Stockage — mesures réelles et passage à 713 PRA

Mo décimaux. Les mesures physiques incluent TOAST/FSM/VM et les index.
DB avant/après : **31.30 → 33.43 Mo**, delta 2129920 octets.

| Relation | Delta table/TOAST | Delta index | Delta total (octets) |
|---|---:|---:|---:|
| pra_batches | 638976 | 40960 | 679936 |
| pra_daily | 843776 | 548864 | 1392640 |
| pra_diagnostics | 0 | 0 | 0 |

Projection Task19B pour les seuls 23 jours ajoutés : **3.346 Mo** (1 679×1105 +292×5106).
Delta physique daily+lots observé : **2.073 Mo**, soit 61.9 % de cette enveloppe.
Le delta global DB peut différer des seules relations (catalogue, maintenance, pages).
La projection totale Task19B comportait une réserve pour toute la référence nationale
et la croissance future ; ce n’était pas une prévision de taille immédiate DEV.

Les 584 diagnostics anciens sont conservés avec leur empreinte. Aucun nouveau
diagnostic systématique : calcul à la demande, sans multiplication par paramètres/productions.

## Prévision nationale, non exécutée

Enveloppes retenues : 1105 octets/jour et 6130 octets/lot, index compris.
Elles gardent au moins les marges Task19B/30 % des tailles mesurées ; les lots
nationaux ajoutent 1 Kio de réserve par lot pour la filiation explicite des caches.
Prévision prudente : **115.85 Mo** = DB actuelle +21 390 nouvelles journées +3 565 lots +14,93 Mo de référence complète en réserve +22 Mo logs/croissance.
Les éditions pilotes restent présentes : leur stockage n’est pas effacé pour faire
tenir le scénario. La référence partielle est donc volontairement comptée à nouveau
dans la réserve complète. Zéro nouveau diagnostic national prévu.

Sous la cible inchangée **375 Mo** et le plan Free **500 Mo PostgreSQL** ; vérifier
les quotas réels avant exécution. Le quota objet/egress n’agrandit pas PostgreSQL.
Les caches horaires restent hors DB et hors Supabase Storage. Aucun service payant,
aucune purge automatique ; 90 jours ne devient pas une rétention active.

Le plan réutilise 81 index de requêtes sources vérifiées : 54 Task19C +27 Task19B.
Trois emprises supplémentaires ×trois requêtes mensuelles/périodes = **neuf nouveaux
appels attendus**, plafond strict neuf ; aucune nouvelle acquisition des 27 emprises
déjà présentes. Leur cache doit être conservé/restauré avec ses checksums.
Le volume/durée national reste une estimation jusqu’au run ; les files CDS varient.
L’agrégation/persistance s’effectue séquentiellement, hors requêtes Vercel.
Aucun cron ou backfill Actions ajouté ; leurs quotas doivent être disponibles.
