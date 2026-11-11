# INT-01 — Recette et preuves

**PARTIAL.** Le raccordement fonctionne sur l’édition réelle du **11 novembre 2026**.
Les cartes restent candidates en recette. Aucune persistance ou publication distante
n’a été exécutée pour obtenir artificiellement READY.

## Identité et fraîcheur

| Élément | Valeur vérifiée |
|---|---|
| Édition / révision | `bdde45c62dc8d0df6e87687c6dfe81d4c392b9dea721158dc9e0751482497af5`, révision 2 |
| Checksum d’archive conservé | `c6c253b501c6f39719069deb5e4b3efa64d234cdd6b0b8aa7f91007ef60af3c1` |
| Snapshot réel | `2e9ed6d01173cb0851505863ecd28c3e916fe0a10de3a92f2fb5769987d8446e` |
| Entrées gelées | `d2c7f1cdf4d09a9f9975fdcf9337595c099358f275ce8b0b047fdab2995f3892`, 5 390 367 octets gzip |
| Lot cartographique INT-01 | `80245fade38bc42251720aa9ec602a092600fdbcd14c53605c05b8d7d5ae8cd6` |
| Historique utilisé par les cartes | 29 octobre–4 novembre ; cinq indicateurs, **645/713** valeurs territoriales, **68 NULL** conservés |
| Prévision utilisée par les cartes | 11–12 novembre ; ARPEGE du **9 novembre 12Z**, acquisition le 9 à 19:01:50 UTC ; cinq indicateurs, 713 valeurs selon le moteur existant |
| Dernière donnée quotidienne station persistée | DPClim : 24 octobre ; acquisition 25 octobre, 250 lots |
| Dernier échantillon station récent | DPObs : 11 novembre à 04:00:59 UTC ; 15 lots, **pas un agrégat quotidien national** |
| Publication | Aucune ; commutateur existant `publication_enabled=false` |

Les nombres ci-dessus ne prouvent ni une représentativité terrestre indépendante,
ni des dommages agricoles. Les cartes restent descriptives/exploratoires. Les
réserves côtières de CORE-01 et les limites d’humidité ne sont pas assouplies.

## Tests exécutés

| Vérification | Résultat / preuve |
|---|---|
| Suite web complète `pnpm test` | **666 réussis, 8 ignorés**, 79 fichiers réussis ; voir [web-tests-final.log](evidence/web-tests-final.log). Aucun test ignoré par INT-01. |
| Python `pytest engine/tests` | **446 réussis**, avertissements de dépendances existants, aucun échec |
| TypeScript web et CLI | `pnpm typecheck`, `tsc --project scripts/tsconfig.task35.json` réussis |
| Lint | `pnpm lint` / ESLint sans avertissement ; Actionlint de tous les workflows réussi |
| Build optimisé | `pnpm build` réussi ; la recette navigateur finale utilise **`next start`**, pas le serveur de développement |
| Qualité | 27 tests Python de qualité et 9 tests Node réussis ; contrats, garde d’automatisation, migrations immuables et budget réussis |
| Sécurité source/bundle | Gardes de secrets réussis ; bundle client sous le budget de 2 Mio gzip |
| MF-01 + main #80 | Fusion sans conflit dans un worktree isolé ; 96 tests Python ciblés, 12 tests T36 et trois tests qualité Météo-France réussis, sans modification de la branche #81 |
| Oracle numérique indépendant | **75 comparaisons Python**, 35 historiques et 40 prévisionnelles, écart absolu max **7,11e-15**. Voir [numerical-oracle.json](evidence/numerical-oracle.json). Vérifie l’arithmétique, pas une validation météo indépendante. |
| Reproductibilité | Plusieurs préparations depuis le blob Supabase gelé donnent le même lot, **octet pour octet** ; aucune acquisition météo ni appel IA |
| Publication refusée sans geste explicite | CLI `publish ID` sans options : `EXPLICIT_MAP_PUBLICATION_REQUIRED`. Aucun essai `--execute` sur le stockage réel. |

Les tests INT-01 contrôlent les empreintes, le mauvais ID/checksum, les identités
inventées, les NULL partiels transformés indûment en valeurs territoriales, l’approbation
du SHA exact avant la première écriture, les courses d’insertion, le conflit immuable,
la reprise après un blob orphelin, l’intégrité au relire, les erreurs API 400/404/503,
le cache immuable limité aux cartes publiées, le mode preview explicitement non publié
et l’absence d’emprunt de cartes d’une autre édition.

## Recette navigateur réelle

[Script reproductible](../../../tests/e2e/int01.mjs) ; [rapport final](evidence/browser/report.json).
Chromium/Playwright, build optimisé local, **1440×1000, 768×1024, 390×844, 360×780**.
Le serveur lit l’archive publique réelle et le lot vérifié dans un mode isolé explicite.
Les connexions Supabase sont désactivées pour ce processus de recette ; les requêtes
du navigateur vers tout autre domaine sont refusées. Pas d’injection de valeurs fictives.

- Accueil redirigé vers le Journal réel ; carte visible après le signal de rendu du composant.
- 713 contours ; liste de 713 PRA, six identités corses ; sélection accessible et clic
  sur un polygone continental qui change effectivement la PRA sélectionnée.
- Crozon et littoraux : NULL conservés ; Corse historique : couverture partielle et
  valeur non évaluable ; Corse prévisionnelle : valeur, unité et couvertures affichées.
- Navigation vers Cartes du jour, changement vers pluie puis température prévisionnelle,
  période, légende physique et cycles sources vérifiés.
- Même ID, checksum d’édition et SHA de lot entre API et pages ; aucune carte récente
  substituée à l’archive du 10 novembre.
- Erreur de transport simulée explicitement : carte indisponible, sans données de remplacement.
- Aucun débordement horizontal et aucune erreur JavaScript ; captures inspectées desktop/mobile.

Captures principales : [Journal desktop](evidence/browser/desktop-journal.png),
[Journal mobile](evidence/browser/mobile-journal.png),
[Cartes desktop](evidence/browser/desktop-cartes-du-jour.png),
[Cartes mobile](evidence/browser/mobile-cartes-du-jour.png),
[Corse historique](evidence/browser/desktop-journal-corse.png),
[ancienne édition sans carte](evidence/browser/desktop-archive-absent.png),
[échec de lecture](evidence/browser/desktop-map-unavailable.png).

## Préservation et sécurité

[Contrôle avant/après](evidence/preservation.json) : les cinq checksums d’archives
sont identiques ; **30 objets Storage avant et après**, zéro objet `edition-maps/`,
zéro publication certifiée, contrôles inchangés. Les entrées météo et les archives
n’ont pas été modifiées. Zéro appel OpenAI d’INT-01 ; scripts et chemins de lecture
n’importent aucun générateur ou fournisseur IA. Les reçus privés ne passent pas dans
le catalogue ni les réponses cartographiques publiques.

Bucket `pra-climate-archives` vérifié privé. Les RPC éditoriales sont exécutables par
`service_role`, pas par `anon` ou `authenticated`. Aucune extension des droits, clé,
policy ou migration. Les clés secrètes restent côté serveur, dans `apikey`.

L’advisor Supabase signale des points **préexistants**, non masqués par une affirmation
de sécurité globale : huit tables privées avec RLS sans policy, `spatial_ref_sys`
public sans RLS, PostGIS dans public et certaines fonctions de lecture `SECURITY DEFINER`
accessibles. [Rapport](evidence/security-advisors.json) ; documentation :
[RLS public](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public),
[extensions](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public),
[fonctions publiques](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
INT-01 ne crée aucune fonction SQL et ne modifie pas ces frontières existantes.

## Ce que la recette ne prouve pas

- Aucun nouveau lot n’a été persisté dans le bucket réel ni servi par la production déployée.
  Le protocole de publication/relecture est vérifié avec un stockage isolé ; le contrôle
  de production reste une étape humaine de [RELEASE.md](RELEASE.md).
- Pas d’acquisition nationale fraîche J-1/J+7 dans INT-01 ; pas de fusion #81 ou #63.
- Pas de nouvelle génération ni d’approbation sémantique de l’article IA.
- La CI distante de la PR est une preuve supplémentaire, à lire séparément des tests locaux.

**Verdict : PARTIAL.** Cartes réelles reproductibles et intégration testables ; mise
en production conditionnée à la revue du lot exact, au déploiement et à la publication
distincte. La fraîcheur nationale reste un chantier d’alimentation, pas un problème
d’affichage résolu par maquillage des dates.
