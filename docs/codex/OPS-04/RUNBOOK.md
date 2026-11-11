# Produire ou tester le Journal à la demande

Précondition vérifiée : PR #78 fusionnée dans `main` le 11 novembre 2026 à 10:43 Paris (commit `5d5e486`). OPS-04 utilise les mêmes fonctions de préparation, sélection, qualité, calcul AGRO et validation. Aucun cron nocturne, secret, service ou contrôle de publication ajouté/modifié.

## GitHub Actions

Actions → **AgriClimaX — Produire / tester le Journal** → Run workflow.
Après fusion de cette PR le workflow apparaît sur `main`. Le déclenchement du nouveau fichier avant sa présence sur `main` peut retourner HTTP 404 (constaté dans la recette). Après fusion manuelle, utiliser `--ref main` :

```sh
gh workflow run manual-journal.yml --ref main \
  -f edition_date=2026-11-11 -f mode=dry-run -f refresh_sources=false \
  -f recompute_indicators=true -f reuse_ai=true -f force_ai_regeneration=false
```

| Paramètre | Effet |
|---|---|
| `edition_date` | Vide = date du jour Europe/Paris ; dates impossibles/futures refusées |
| `mode` | `dry-run` (défaut), `resume`, `publish` |
| `refresh_sources` | Acquisitions locales isolées, bornées, sans publication des données météo ; défaut false |
| `recompute_indicators` | Rejoue AGRO-02 depuis les archives déjà présentes ; défaut false |
| `reuse_ai` | Réutilisation uniquement si bundle exact et validation compatible ; défaut true |
| `force_ai_regeneration` | Défaut false ; interdit en dry-run ; seulement pour une étape IA réellement manquante/rejetée |
| `authorized_snapshot` | SHA exact requis pour la reprise IA explicitement forcée |
| `regeneration_reason` | Justification d'au moins 12 caractères requise pour cette reprise |

Le résumé Actions et `report.json` distinguent résultats, état des acquisitions, dates/âges, couverture, indicateurs, snapshot gelé ou de test, réponse IA disponible/réutilisée/appel effectué, validation, publication et consultation. Les blocages métier peuvent produire un workflow de diagnostic terminé : lire le verdict et la publication, pas seulement la coche verte.

## Tester une modification AGRO le matin

1. Modifier l'indicateur dans le moteur/registre existant et pousser une branche.
2. Lancer `dry-run`, `recompute_indicators=true`, `refresh_sources=false` sur cette branche. Aucun téléchargement fournisseur n'est nécessaire : seules les archives vérifiées sont lues.
3. Télécharger l'artefact `ops04-journal-RUN-ATTEMPT`. Il contient dossier, captures d'entrées, résultats, cartes, preview et rapport ; aucun secret ni grille fournisseur brute.
4. Extraire dans `work/manual-journal/latest`, puis lancer le site local avec les dépendances verrouillées :

```sh
AGRICLIMAX_AI_PREVIEW_ARCHIVE_DIR="$PWD/work/manual-journal/latest/preview" \
AGRICLIMAX_MANUAL_RUN_DIR="$PWD/work/manual-journal/latest" pnpm dev
```

Ouvrir l'URL `/journal/preview?date=...&id=...` du rapport. Le texte de secours déterministe est explicitement étiqueté, rédigé depuis les faits du nouveau dossier sans IA. Les cartes utilisent les 713 géométries et le composant PRA existants, avec dates, nature, unités, couverture et valeurs absentes. Les liens Sources & méthodes et les espaces Journal/Climat restent ceux du produit. Une réponse IA compatible est vérifiée et réutilisée pour la reprise, sans inventer de revue humaine locale ; son URL d'archive réelle est fournie séparément. Un dossier modifié ne reçoit jamais une ancienne narration incompatible.

Les recettes météorologiques et agroclimatiques communes à plusieurs productions partagent une carte, un calcul et un fait éditorial : le budget T33 ne doit pas être épuisé par des doublons de productions ; la liste des productions décrit l'applicabilité du calcul, pas leur présence effective dans chaque PRA. Les mesures anciennes restent datées. Humidité manquante = aucun THI inventé.

## Rejouer les entrées capturées, sans réseau

```sh
NODE_OPTIONS=--conditions=react-server apps/web/node_modules/.bin/tsx \
  scripts/manual_replay.ts work/manual-journal/latest/indicators.json.gz work/replay.json
```

Le checksum des entrées est vérifié, puis le moteur courant est recalculé pour les 713 PRA. Deux rejouages identiques produisent les mêmes empreintes de résultat ; une modification de recette peut être testée immédiatement. Les résultats cartographiques complets sont dans `maps.json.gz`, les captures/empreintes dans `indicators.json.gz`.

## Reprendre ou publier

Pour `resume`, désactiver les recalculs/rafraîchissements si l'on souhaite poursuivre le snapshot de production existant. Le pilote réutilise une génération compatible, sinon délègue l'étape manquante à T36, qui conserve ses verrous et son admission IA persistante. Les appels sont comptés depuis les reçus persistés, y compris en cas d'échec.

Un snapshot isolé porte `test_only=true` : il peut être construit avant 05:40, sans fausse date de gel future. Le chemin de production le refuse explicitement ; ses règles de cutoff restent inchangées.

Un recalcul/rafraîchissement peut changer le dossier de test ; il n'écrase jamais un snapshot de production gelé. Le rapport indique alors `TEST_SNAPSHOT_DIFFERS_FROM_FROZEN_PRODUCTION` et renvoie la preview isolée. Une édition déjà publiée et une génération valide sont conservées. Les reprises concurrentes sont sérialisées par workflow et les opérations persistantes par les leases/verrous Supabase existants.

`publish` contrôle le commutateur existant puis exige une approbation éditoriale persistée correspondant au checksum exact avant promotion. Il n'active jamais `publication_enabled` et n'inscrit jamais lui-même de revue humaine. Attente explicite `PUBLICATION_DISABLED` ou `EDITORIAL_APPROVAL_REQUIRED`. Une promotion réussie est suivie d'un contrôle de consultation.

## Limites des rafraîchissements

Les commandes d'acquisition réutilisent les adaptateurs existants sans `--publish-dev` ; stations/observations utilisent leur mode `--dry-run`. Les limites de quotas/checkpoints des adaptateurs restent en place, plus un budget temporel par source. Une panne laisse les autres acquisitions et archives exploitables disponibles. Les cycles locaux et réanalyses nouvellement acquis passent les mêmes décodeurs/validateurs avant le dossier de test. Les échantillons de stations ne deviennent pas arbitrairement des agrégats PRA. Les observations instantanées historiques ne sont jamais téléchargées comme si elles dataient du jour demandé.

Pour exécuter localement, remplacer les entrées Actions par les variables `MANUAL_EDITION_DATE`, `MANUAL_MODE`, `MANUAL_RECOMPUTE_INDICATORS`, etc., puis lancer `pnpm journal:manual`. Les clés restent dans l'environnement sécurisé. En dry-run la clé OpenAI n'est même pas transmise par Actions.
