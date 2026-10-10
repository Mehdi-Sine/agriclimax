# Task 09 → Tasks 04 / 05 : contrôles à intégrer

## Task 04 : sécurité DB/API

Sur le main Task 01 (`5c2426f`), les migrations créent les tables publiques
sans activation RLS ni politiques. Task 09 ne modifie pas les migrations.
Avant toute connexion à une base réelle, Task 04 doit définir les grants/RLS,
les accès anon/authenticated/service_role et leurs tests d'autorisation négatifs.
Ne pas exposer les tables par défaut et ne pas utiliser un secret serveur dans le client.

Le job SQL teste aujourd'hui le SQL/PostGIS sur une DB jetable ; il ne simule
pas toute la plateforme Supabase. Si les migrations utilisent auth/storage,
Task 04 devra fournir un harness Supabase local réaliste, sans fausse fonction
auth.uid qui masquerait les erreurs d'autorisation.

## Task 05 : hooks sémantiques de démo

Conserver le landmark main, lang=fr, l'affichage « Données fictives » et le
marqueur existant data-demo="true". Le smoke/E2E transverse ne dépend pas de
classes CSS ni de composants internes. Ajouter les tests clavier détaillés des
sheets/dialogues au domaine propriétaire ; Task 09 ne prétend pas les couvrir
sur la page de fondation actuellement non interactive.

Aucun changement de contrat V1 demandé.

## Task 02 : dépendance de test Python

L'audit du lockfile hérité détecte `pytest==8.4.2` : PYSEC-2026-1845,
GHSA-6w46-j5rx-g56g / CVE-2025-71176. Le correctif annoncé est pytest>=9.0.3.
Le pyproject actuel borne pytest<9. Task 09 n'édite pas `engine/`.
Task 02 doit mettre à jour la contrainte et le lockfile, puis revalider ses tests.
L'audit CI Python reste bloquant en attendant ; aucune vulnérabilité ignorée.

## Outillage JS : vulnérabilité sans correctif disponible

Après correction via overrides racine Vitest 4.1.11 / Tinypool 2.1.2,
l'audit JS ne conserve que `braces==3.0.3`, GHSA-vfj7-8cjw-p6xm (high),
transitif de eslint-config-next → fast-glob → micromatch.
L'avis ne publie pas de version corrigée au 10 octobre 2026.
Surveiller une publication corrigée ; l'audit high/critical reste bloquant.
Aucun remplacement de librairie de glob ni patch tiers non vérifié n'est introduit.
