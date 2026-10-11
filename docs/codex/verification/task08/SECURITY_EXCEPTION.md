# Exception ciblée braces — 11 octobre 2026

Décision autorisée dans la demande de suivi Task 08 : exception temporaire pour
**braces 3.0.3, GHSA-vfj7-8cjw-p6xm / CVE-2026-93687**, sévérité high,
épuisement de pile lors du traitement récursif d’un motif. Aucun correctif publié.
Référence : https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.

## Origine et exposition

Seule chaîne résolue : `apps/web` devDependency `eslint-config-next@16.4.0`
→ `@next/eslint-plugin-next@16.4.0` → `fast-glob@3.3.1`
→ `micromatch@4.0.8` → `braces@3.0.3`.

Les dernières versions publiées ont été interrogées le 11 octobre 2026 :
eslint-config-next et son plugin 16.4.0 ; fast-glob 3.3.3 dépend encore de
micromatch ^4.0.8 ; micromatch 4.0.8 dépend encore de braces ^3.0.3 ; braces
3.0.3 est la dernière version. Aucun upgrade compatible du parent ne supprime
la vulnérabilité. Les réponses du registre sont archivées dans `security-exception/`.

Cette chaîne sert à ESLint, pas aux requêtes applicatives. `pnpm --recursive why
--prod braces --json` ne retourne aucun chemin ; aucun import de ces outils dans
les sources applicatives ; les 11 traces serveur Next de production ne contiennent
pas braces. Le client ne les importe pas non plus. Leur présence éventuelle sur
le disque d’une installation avec devDependencies ne signifie pas une exécution
par le client ou le serveur. Le risque de disponibilité de l’outillage développeur
reste accepté temporairement : le lint traite des motifs contrôlés par le dépôt.

## Politique et garde-fous

L’unique exclusion native pnpm est `ignoreGhsas: ["GHSA-vfj7-8cjw-p6xm"]`.
Son périmètre package/version/chaîne est contrôlé par
`scripts/quality/audit-exceptions.mjs`, avec politique dans le JSON voisin.
Responsable : Mehdi-Sine. Valide du **2026-10-11 au 2026-11-10 exclus** (UTC).
TODO : retirer dès qu’un parent compatible élimine braces ; réévaluation obligatoire
avant expiration. Aucun renouvellement implicite.

Le guard bloque à expiration, si la version/chaîne change, si braces entre dans
les dépendances de production ou les traces serveur, si une autre exclusion est
ajoutée, et si l’exception devient obsolète. Il est exécuté dans Security audits,
Quality et make check. Six tests couvrent ces refus et le retrait après correctif.
Le simple audit pnpm applique l’exclusion statique ; l’expiration est imposée par
le guard CI, pas par pnpm lui-même.

Tous les autres high/critical JS restent bloquants, comme tous les audits Python,
l’audit navigateur et Gitleaks. Aucun seuil modifié, aucun continue-on-error.
Avec pnpm 10.0.0, `audit --json` filtre l’affichage mais conserve un code d’échec
fondé sur le total brut, même après exclusion. Le job utilise donc la commande
native `pnpm audit --audit-level high` et archive le rapport texte, conservant
son seuil et son code de sortie ; aucune interception d’erreur.

## Validation

Rapports actualisés : `security-exception/`. Audit JS high, audits Python stricts
engine et qualité, audit navigateur high, Gitleaks historique masqué, make check
(lint/typecheck/tests/build), guard des traces et scan du bundle client.
Aucune fonctionnalité, règle scientifique ou contrat métier modifié.
L’intégration carte/diagnostic avait été validée dans `INTEGRATION.md` ; ce suivi
ne modifie aucun fichier applicatif. Aucun merge.
