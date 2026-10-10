# Task 09 — alertes revalidées sur main Tasks 01–05

Base : `a5c7c903313f675a4910d06b0029f1db870174a1`, 2026-10-10.
Aucun changement de contrat partagé demandé ou réalisé.

## Sécurité DB/API — ancienne alerte résolue

Task 04 active et force la RLS des 11 tables métier, retire l'accès direct client
et fournit des RPC bornées et un harness négatif. Task 09 réutilise ce harness
sur public/extensions. L'ancienne alerte « RLS absente » est retirée.
Les objets techniques PostGIS et limites Supabase restent documentés par Task 04 ;
aucune migration ni configuration hébergée n'est modifiée ici.

## Python — alerte toujours présente sur main

Le lock actuel contient pytest 8.4.2 et pyproject impose pytest<9.
L'audit frais confirme PYSEC-2026-1845 / GHSA-6w46-j5rx-g56g / CVE-2025-71176,
correctif annoncé >=9.0.3. Mise à jour coordonnée du domaine engine requise.
L'audit CI Python reste bloquant ; aucune exception ajoutée.

## JavaScript — alertes actuelles

braces 3.0.3 : GHSA-vfj7-8cjw-p6xm, high, toujours présent sur main et cette branche,
sans version corrigée publiée par l'audit. AJV 8.17.1 ajouté par Task 04 :
GHSA-2g4f-4pwh-qvx6, moderate, correctif >=8.18.0.
Les overrides racine Vitest 4.1.11/Tinypool 2.1.2 suppriment les alertes de test
observées sur main. Aucun changement des dépendances métier directes.

## Accessibilité du shell — nouvelle alerte reproductible

axe WCAG 2.5.3 : label-content-name-mismatch, serious, lien `.brand`.
Le nom accessible « AgriclimaX — accueil » omet la signature visible
« Observer. Comprendre. Anticiper. ». Corriger ce nom dans le domaine Task 05.
Le gate E2E ne supprime pas cette violation et collecte tous les formats/thèmes.
