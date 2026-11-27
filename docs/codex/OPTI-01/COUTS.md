# OPTI-01 · Coûts et capacité

Les montants ci-dessous séparent hébergement, acquisition, stockage, transferts et IA. Les devis sont indicatifs au 27 novembre 2026, hors taxes, change, dépassements, matériel et temps d’exploitation sauf mention. L’alerte transmise ne contient aucun total facturé. Le coût connu d’une édition est 0,087014 € au ledger. Répéter ce coût sur 30 éditions donnerait 2,61 €/mois (31,76 €/365 éditions), indépendamment de l’hébergement.

| Architecture | Coût mensuel indicatif d’hébergement | Bande passante et marge |
|---|---:|---|
| Supabase Pro + Vercel | À partir de 25 $ pour Supabase, plus Vercel selon plan | 250 Go cached + 250 Go uncached inclus selon barème, 100 Go Storage, 8 Go DB/projet. |
| Supabase Free + R2 Standard + Vercel | 0 $ si les trois enveloppes et critères d’usage sont respectés | Supabase 5 Go cached + 5 Go uncached, 500 Mo DB, 1 Go Storage. R2 gratuit en egress, 10 Go-mois, un million A et dix millions B inclus. Vercel a ses propres limites et usages. |
| Neon + R2 + Vercel | 0 $ possible sous quotas. Neon Launch annonce un coût typique de 15 $ | Neon Free affiche 1 Go de stockage, 100 CU-h et 5 Go de transfert par projet et par mois. Ajouter raccord API et watchdog, et tester le réveil avant engagement. |
| PostgreSQL/PostGIS sur VPS | 4–8 €/mois en scénario d’entrée, plus sauvegarde, éventuel IPv4 et exploitation | Exemple CX23, 2 vCPU/4 Go/40 Go et trafic inclus de 20 To dans l’UE selon offre. Sorties additionnelles à chiffrer. Calcul météo à isoler. |
| Supabase auto-hébergé sur VPS | Budget de travail 8–20 €/mois, plus sauvegarde et exploitation | 8 Go RAM et ≥ 40 Go SSD comme point de départ, mesurer concurrence, disque, WAL, IOPS et réseau. |
| Calcul/archive locaux, publication cloud légère | 0 $ cloud dans la franchise. Exemple 6,72 €/mois d’électricité à 40 W constants et 0,23 €/kWh, matériel et sauvegarde en plus | La machine pousse une publication par jour. Le cloud absorbe les lecteurs. Débit montant et durée des transferts d’archive à mesurer. |
| Hébergement intégral local | 6,72 €/mois d’énergie dans le même exemple, plus matériel, secours, sauvegarde, accès Internet et maintenance | Débit montant, coupures et limitation FAI/CGNAT. Le nombre de bêta-testeurs dépend des mesures de capacité. |

[Supabase](https://supabase.com/pricing) · [R2](https://developers.cloudflare.com/r2/pricing/) · [Vercel](https://vercel.com/pricing) · [Neon](https://neon.com/pricing) · [VPS Hetzner](https://www.hetzner.com/cloud/cost-optimized/)

Vercel Hobby est limité à un usage personnel et non commercial. Valider le statut de Climacta, les modalités de la bêta et les usages du propriétaire avant de retenir ce coût. Le plan Pro affiché commence à 20 $/mois selon l’offre et la consommation. Pour Vercel, suivre stockage des déploiements et fonctions, transferts edge et origin, invocations, CPU et mémoire séparément. Les runners GitHub standard d’un dépôt public ont une gratuité de calcul. Suivre le stockage conservé des artifacts et l’ensemble des usages du compte indépendamment. [Hobby](https://vercel.com/docs/plans/hobby) · [Fair use](https://vercel.com/docs/limits/fair-use-guidelines) · [Facturation Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

## Scénarios de lecteurs

Hypothèses de simulation sur 30 jours, une visite par lecteur et par jour. L’ancienne colonne compte une seule lecture scientifique à froid de 6 330 949 o par visite et laisse de côté le parcours de liste, Vercel et le reste de la production. Le scénario publication légère lit 45 472 o d’index et 75 916 o de WebP par visite sans cache, soit trois GET. Si ces objets sont servis depuis R2, ce transfert n’entre plus dans le cached egress Supabase. Les lectures PostgreSQL du registre, le chargement volontaire d’une carte et les visites d’éditions historiques sans projection suivent des lignes distinctes.

| Lecteurs/jour | Visites/mois | Ancien bundle, Go/mois | Projection, Go/mois sans cache | GET R2/mois sans cache |
|---:|---:|---:|---:|---:|
| 1 | 30 | 0,190 | 0,00364 | 90 |
| 10 | 300 | 1,899 | 0,03642 | 900 |
| 100 | 3 000 | 18,993 | 0,36416 | 9 000 |
| 1 000 | 30 000 | 189,928 | 3,64164 | 90 000 |

La projection du 27 représente 121 388 o et deux vignettes. À poids fixe, 30 productions ajoutent 3,64 Mo et 365 ajoutent 44,31 Mo. Sans rotation des objets scientifiques, la cohorte observée hors prévisions natives projetterait environ 3,36 Go supplémentaires sur douze mois et les importations natives environ 17,86 Go supplémentaires si leur cadence exceptionnelle se répétait. Cette extrapolation linéaire excède R2 Free. Scénario médian à tester avec historique après deux mois, rétention fondée sur les références et croissance spécifique à chaque famille. Considérer que quatre copies temporaires (original, recette, archive indépendante et retour arrière) multiplient le stockage pendant la vérification.

## Avant et après

| Poste | Avant, observé ou communiqué | Après, état ou cible |
|---|---|---|
| Facture d’hébergement | Total non exporté. Alerte 13,44 Go cached pour Acta | Aucun changement de plan. Scénario de 0 $/mois sous franchises et éligibilité. |
| PostgreSQL | 201,41 Mo | Stable lors de cette tâche. Suivi mensuel. |
| Supabase Storage | 823,46 Mo, 1 414 clés | Aucun retrait. Projection ~0,121 Mo/édition du 27 sur le backend retenu. |
| Cached egress | 13,44 Go sur la période signalée, part organisation à rapprocher | Cibles ≤ 4,03 Go à base identique (−70 %) et < 3 Go/mois durablement. Résultat après déploiement à mesurer. |
| Cache miss / uncached | 20,47 Mo de réponses Storage MISS le dernier jour mesuré, agrégat facturé manquant | Mesurer séparément, y compris le coût transitoire des copies. |
| IA quotidienne | 0,087014 € le 27 | Aucun appel supplémentaire. Le coût des futures productions dépend des jetons. |
| Fonctions et parcours mobile | Mesures de référence EDIT-09 et traces Next | Voir [Performances](PERFORMANCES.md). |
