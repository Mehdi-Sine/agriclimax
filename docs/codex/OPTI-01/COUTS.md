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

## OPTI-01A · Architecture de référence et seuils d’observation

La référence avant activation est le relevé OPTI-01, confirmé le 27 novembre à **201 422 515 o** PostgreSQL et **823 463 484 o** Storage pour **1 414 clés**. Aucun objet `journal/v1` n’était présent. La facturation de l’organisation demeure à extraire. Les logs étendus, soit 22,77 Go HIT et 1,17 Go MISS, couvrent 26 fenêtres d’observation et une partie des sources. Ils servent à attribuer les familles et ne couvrent pas tous les postes de facturation.

| Dimension | Avant OPTI-01A | Après activation, estimation ou validation requise |
|---|---|---|
| Composants d’hébergement | GitHub, Supabase, Vercel | Mêmes trois fournisseurs. Projection dans le bucket privé existant. |
| Secrets et workflows | Identifiants Supabase dans Actions et Vercel, autres accès scientifiques et éditoriaux existants | Zéro nouveau secret ou workflow pour la voie Supabase. Deux drapeaux non secrets. |
| Intervention | Un déploiement pour livrer le code | Activation ponctuelle, reprise du 27 et activation web. Zéro action à chaque édition normale. |
| Stockage | 823,46 Mo scientifiques et associés | +121,4 ko pour le 27. À taille fixe, ~44,3 Mo pour 365 éditions, archives scientifiques en sus. |
| Risque | Lecture historique coûteuse à froid, quotas partagés, prévision indisponible | Projections manquantes ou indisponibles et réchauffement du CDN. Secours historique et drapeaux indépendants. |
| Coûts | OpenAI 0,087014 € pour le 27, cumuls d’hébergement à extraire | Aucun service ajouté. Budget indicatif Supabase Pro à partir de 25 USD/mois et calcul selon usage. Le coût des éditions dépend des jetons. |

### Scénarios avec cache

Hypothèses illustratives sur 30 jours. Une visite quotidienne, un accès origine à l’index de 45 472 o pour 10 % des visites, et accès origine aux WebP de 75 916 o au total pour 5 %. Pour Cartes, 10 % des visiteurs ouvrent une carte et 20 % de ces ouvertures nécessitent une lecture du bundle de 6 330 949 o. Jouer les hypothèses avec les taux mesurés, par région et par profil. Les volumes de la colonne Journal sont des transferts origine indicatifs, pas du cached egress facturé. Les anciennes dates sans projection restent hors du scénario optimisé.

| Lecteurs quotidiens | Visites / 30 j | Journal indexé vers origine | Cartes vers origine |
|---:|---:|---:|---:|
| 1 | 30 | 0,25 Mo | 3,80 Mo |
| 10 | 300 | 2,50 Mo | 37,99 Mo |
| 100 | 3 000 | 25,03 Mo | 379,86 Mo |
| 1 000 | 30 000 | 250,29 Mo | 3 798,57 Mo |

Ajouter la charge indépendante des visiteurs et les lectures du catalogue. Mesurer acquisitions, réessais, copies, previews, rapports et lectures de masques dans des fenêtres séparées, puis rapprocher les compteurs d’organisation. Le modèle large de l’audit donne un solde théorique de 2,08 Go HIT par 30 jours à fréquentation constante si les transferts des cartes d’édition et des masques étaient entièrement évités. Il ne constitue pas une prévision. La croissance des nouvelles clés hors natives atteignait environ 3,36 Go/an en extrapolation de cohorte. Pour tenir sur Free, remplacer cette extrapolation par une série nette après rotation autorisée et contrôle des dépendances. [Audit](AUDIT.md) · [Inventaire](INVENTAIRE.md)

### Décider d’un retour à Free

Le plafond publié est de 500 Mo DB par projet, 1 Go Storage, 5 Go cached et 5 Go uncached séparés selon le barème public, avec vérification des unités et de l’imputation dans Acta. Repères opérationnels proposés **DB < 400 Mo**, **Storage ≤ 0,90 Go** avec trajectoire compatible, **cached ≤ 3 Go/mois**, **uncached ≤ 4 Go/mois** en incluant la charge de l’organisation. Viser également −70 % cached à fréquentation comparable, trois productions successives acceptables, restauration intégrale vérifiée, maintien de l’accès historique et résultats mobiles stables. Une seule semaine sert à décider s’il faut prolonger l’observation. Tenir compte des cycles de prévision et des pointes.

Le propriétaire relève dans Supabase → organisation Acta → Billing le plan actif, la date réelle de renouvellement Pro, les projets, options payantes, limites, période d’usage, crédits et factures. La date de reconstitution Free annoncée au 18 décembre ne détermine pas le renouvellement Pro. Vérifier l’offre et l’aperçu de la modification avant toute décision. La documentation directe indique que le changement peut être immédiat et que les dépassements du cycle sont calculés au changement de plan. Les crédits éventuels dépendent des conditions du compte. **NO-GO tant que mesures, marge et sauvegarde intégrale n’ont pas été vérifiées.** [Gestion de l’abonnement Supabase](https://supabase.com/docs/guides/platform/manage-your-subscription) · [FAQ facturation](https://supabase.com/docs/guides/platform/billing-faq)

### Alternatives de publication

| Service | Capacité et usage pertinent | Effet sur l’exploitation |
|---|---|---|
| Vercel Blob | Offre Hobby annoncée avec 1 Go-mois, 10 Go de Blob Data Transfer, 10 000 opérations simples et 2 000 avancées incluses. Au-delà, consulter prix et zone. Blobs privés via accès autorisé et fonction. | Un service et un ou plusieurs tokens, sauvegarde et plan de récupération. Adapté aux projections légères si leur coût d’origine le justifie. Son stockage et son transfert sont distincts de Function Storage. |
| Git existant | Référentiels stables, Almanach, code et géométries publiques versionnés. | Les publications quotidiennes feraient grossir l’historique, les clones et la CI. Si couplées à une livraison Vercel, elles déclencheraient des déploiements inutiles. |
| Dépôt GitHub dédié / Pages | Publication statique publique découplée de Vercel. Pages prévoit 1 Go recommandé pour la source et 100 Go/mois souples. Le service impose des conditions d’usage commercial. | Dépôt et pipeline supplémentaires, coordination des révisions, gestion du cache et des clés. Les archives scientifiques privées restent ailleurs. |
| Releases | Actifs de moins de 2 Gio par fichier, intéressants pour des versions publiables et des snapshots de preuve. | Les releases d’un dépôt public sont publiques. Friction quotidienne et restauration à concevoir pour le Journal. |
| Artifacts / LFS | Artifacts pour checkpoints et rapports à durée de vie contrôlée. LFS pour fichiers versionnés avec quotas de stockage et transfert. | Les expirations et quotas rendent ces services peu adaptés à la source de vérité des archives et du Journal. |
| Cloudflare R2 | Standard annonce 10 Go-mois, 1 million A, 10 millions B et egress R2 gratuit. Pertinent si la charge bloquante reste celle des masques et archives lourdes. | Fournisseur, clés, contrôle des copies et reprise supplémentaires. Maintenir S3 en réserve. |

GitHub Actions standard sur dépôt public et Vercel Hobby sont soumis à leurs conditions. Hobby vise l’usage personnel et non commercial. Requalifier la bêta et toute exploitation professionnelle avant de planifier un hébergement Hobby. [Vercel Blob](https://vercel.com/docs/vercel-blob/usage-and-pricing) · [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) · [Git LFS](https://docs.github.com/en/billing/concepts/product-billing/git-lfs) · [R2](https://developers.cloudflare.com/r2/pricing/)
