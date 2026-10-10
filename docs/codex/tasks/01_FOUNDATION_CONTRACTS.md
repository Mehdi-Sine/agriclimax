# Task 01 — Foundation Contracts

**Branche :** `codex/01-foundation-contracts`

## Objectif
Rendre le starter installable, valider les frontières, figer les contrats V1 et obtenir un mode démo sans credentials.

## Scope
- normaliser workspace pnpm et package web ;
- configurer Python install/test ;
- ajouter validation JSON Schema + YAML ;
- ajouter script `check-contracts`;
- créer repository abstractions et demo adapters ;
- formaliser state URL partagé ;
- garantir que toutes les données démo affichent un label “Données fictives”.
- corriger versions de dépendances seulement après vérification de compatibilité ; pinner les majors.

## Règles communes
Lire `AGENTS.md` et la documentation liée. Ne pas modifier `contracts/` sans procédure. Travailler sur la branche indiquée. Ajouter tests et documentation. À la fin : commandes exécutées, résultats, fichiers modifiés, risques/limites, résumé PR.

## Critères d'acceptation
- installation reproductible ;
- CI locale minimale verte ;
- page web démo démarre ;
- schemas/examples validés ;
- aucun appel externe nécessaire ;
- zéro nouvelle référence legacy.
