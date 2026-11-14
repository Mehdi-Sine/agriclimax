# EDIT-04 — Sélection éditoriale quotidienne des cartes

Base : `main bdce460` (UX-03 #90 fusionnée). PR draft ; aucune fusion, activation distante, acquisition ou publication effectuée pendant cette tâche.

## Contrats et raccordement

| Frontière | Avant | Après |
|---|---|---|
| Cartes candidates | Liste technique construite après l’article | Même constructeur, mêmes entrées gelées et mêmes règles, également lu avant l’appel éditorial |
| EDIT-03 | Simulation verrouillée sur deux dates | Catalogue vérifié utilisable pour toute date ; classement inchangé, plancher 45 et plafond quotidien 6 |
| Comité IA | Briefing et anciennes illustrations seulement | Même appel Responses, enveloppe `{draft, map_selection}` ; toutes les cartes admissibles et leurs métadonnées sont proposées |
| Choix | Première carte technique ; dix cartes dans le carrousel | Une principale, zéro à cinq complémentaires ; aucune obligation de remplissage ; choix et rejets justifiés par références autorisées |
| Archivage | Article immuable, bundle cartographique indépendant | Champ optionnel `map_selection` dans les nouvelles archives : classement factuel complet, réponse contrôlée, mode IA/déterministe et empreinte du contenu cartographique |
| UX-03 | Ordre du bundle | Ordre archivé de sélection, principale en premier ; anciennes éditions sans ce champ inchangées |

La préparation crée un objet candidat **en mémoire seulement**. `readFrozenMapInputs` est la lecture extraite du script INT-01 existant ; aucune source n’est reacquise. Le constructeur scientifique `buildEditionMaps` n’est pas modifié. Il est réutilisé au moment de la publication, où `selectedMapIds` exige la même empreinte de snapshot, d’entrées et de toutes les cartes. L’empreinte exclut l’enveloppe édition/checksum pour éviter une dépendance circulaire : l’archive contient la sélection, et le bundle est ensuite lié au checksum final de cette archive.

Les identifiants des cartes sont des empreintes de leur contenu complet. Titres, dates, palettes, miniatures et URL sont construits à partir du **même** objet `EditionMapInfo` vérifié. Les liens ne sont jamais rédigés par l’IA. Une révision factuelle OPS-07 conserve le contenu cartographique mais reçoit ses propres liens d’édition. Le catalogue interactif complet reste archivé et accessible ; seuls les éléments mis en avant dans le Journal sont réduits à six au maximum.

Les contrôles `verifyArchive`, `verifyBundle`, `journal_eligible`, qualification territoriale, règles, provenance et périodes sont conservés. Les valeurs partielles ne sont pas promues en résultats territoriaux. Zéro reste distinct de NULL. L’archive vérifie aussi le classement par recalcul déterministe ; la lecture publique vérifie sa liaison au bundle avant visibilité.

## Dossier et réponse de l’IA

Le dossier contient phénomènes/indicateurs et familles, six axes de score, score marginal, pénalité de redondance, seuil démontrable ou absence de seuil, unités et statistiques existantes, territoires qualifiés/partiels/absents, dates et cycles, fraîcheur, sources, versions des règles, contexte saisonnier sourcé et limites. Les hypothèses agricoles restent théoriques. Les valeurs brutes par PRA ne sont pas transmises.

Les réserves et références agricoles identiques sont regroupées dans `shared` et reliées explicitement par identifiants, sans supprimer de contenu. Le classement complet conservé dans l’archive permet de reproduire le dossier. `recommended` est une recommandation : le comité peut choisir une autre carte admissible dont le score atteint le plancher, changer la principale ou produire une édition courte. Une réponse vide alors qu’il existe des cartes sélectionnables déclenche le secours déterministe.

L’IA renvoie uniquement des identifiants de cartes, motifs et fenêtres saisonnières existants. Le serveur refuse valeurs ou textes ajoutés, cartes inventées, références d’une autre carte, doublons, omissions, principale incohérente, plus de six choix et cartes sous le plancher. Les métadonnées cartographiques ne deviennent jamais des `evidence_ids` utilisables dans le texte de l’article. Le prompt est versionné `editorial-board-fr-5`, le dossier `edit04-board-fr-1`.

## Secours et reprise

- Sélection invalide : conserver l’article s’il passe ses contrôles et employer le classement déterministe.
- Rejet scientifique du texte : conserver l’archive privée d’origine, puis produire la révision factuelle OPS-07 et sa sélection déterministe.
- Panne fournisseur, modèle non qualifié ou sortie sans contrat de texte exploitable : produire une archive factuelle sur l’identifiant de tentative existant. Cela respecte la clé étrangère du registre sans nouvelle tentative payante. Une utilisation fournisseur inconnue reste inconnue ; aucun coût nul n’est inventé.
- Interruption : le dossier est enregistré avant l’appel, la réponse avant validation. La reprise utilise ces diagnostics ; après une tentative interrompue sans réponse exploitable, elle peut produire le secours sans nouvel appel.
- Entrées ou cartes invérifiables : arrêt des contrôles concernés ; aucune carte de substitution, aucune modification des règles scientifiques. Une panne de publication cartographique demeure reprenable par OPS-07.

Aucun appel fournisseur depuis les lectures du Journal. Aucun retry payant automatique ajouté. L’appel de vérification d’accès au modèle déjà présent reste une lecture, pas une génération supplémentaire.

## Comparaison des archives réelles

Voir [le tableau complet avant/après](evidence/COMPARISON.md), les scores et motifs par carte dans les rapports des [12](evidence/2026-11-12.json), [13](evidence/2026-11-13.json) et [14 novembre](evidence/2026-11-14.json).

- **12 novembre** : avant, Tmin historique en première position ; après, Tmin **prévisionnelle** principale (62,25), puis pluie prévue (61,77). L’actualité des prévisions et le contraste spatial priment ; la Tmin historique redondante avec le gel historique est écartée.
- **13 novembre** : pluie prévue principale (72,67), puis Tmin prévue (61,79). La pluie présente un contraste spatial plus marqué ; le gel prévu est redondant avec la Tmin prévue et passe sous le plancher après pénalité.
- **14 novembre** : pluie prévue principale (73,30), puis température moyenne prévue (61,18). Le gel historique (48,97) et la somme thermique historique (48,00) passent devant la Tmin prévue (45,80). L’ordre change avec le contenu réel, sans liste de priorité fixe.

Six cartes sont retenues dans ces trois cas ; ce résultat n’est pas un quota. Les tests couvrent aussi une principale seule et aucune carte admissible. Les fenêtres historiques se chevauchent et les cycles prévisionnels diffèrent : aucune évolution observée n’est déduite entre ces éditions.

Les dix cartes étaient effectivement publiées dans chaque bundle ; les six cartes du scénario « après » restent un **contrôle déterministe hors ligne**. Aucune réédition historique, aucun nouvel appel IA réel. Les réponses IA valides/invalides sont testées avec un fournisseur contrôlé ; la qualité qualitative des choix du modèle réel devra être observée dans les prochaines éditions.

## Coût de l’appel unique

Le plafond de sortie reste **6000 tokens**, le modèle et le profil de cache existants restent inchangés. Aucun appel quotidien supplémentaire. Les contrôles de schéma strict portent sur l’enveloppe réellement sérialisée ; la profondeur reste dans la limite autorisée.

Sur les trois archives, la borne conservatrice du **surcoût d’entrée** est de **0,077459–0,078458 € pour Terra**, et **0,007746–0,007845 € pour Luna**, avec le tarif diagnostique existant. Coût total maximal estimé pour Terra : **0,183946–0,186008 €**, sortie maximale incluse. Borne d’un token par octet, réserve de 4096 tokens et aucun cache supposé : ce n’est ni une mesure de tokens réels, ni un devis fournisseur actuel.

Cette borne dépasse le plafond historique indicatif de 0,15 € affiché par `budgetReport` : les rapports le signalent explicitement (`EDITION_COST_EXCEEDED`). Le cycle opérationnel existant utilise déjà la dépense du projet OpenAI et ne bloque pas sur cette réservation historique ; cette PR ne change aucun garde financier. La facture réelle est conservée via `receipt.usage` et `receipt.cost_eur` quand le fournisseur la retourne ; sinon le coût reste inconnu. Aucun paiement n’a été effectué pendant la recette (zéro appel OpenAI).

## Activation et retour arrière

1. Après revue et fusion **manuelles**, déployer le code web et le code exécuté par le cycle quotidien, depuis la même révision. Aucune migration et aucun changement de workflow requis.
2. `AGRICLIMAX_EDITORIAL_MAP_SELECTION` absent ou différent de `false` active le raccordement pour les **nouvelles** tentatives. La variable se règle sur l’environnement du job éditorial, pas uniquement sur Vercel. Les contrôles d’arrêt d’urgence et d’activation IA existants restent prioritaires.
3. Sur la prochaine édition, vérifier le diagnostic `map_selection_request`, une seule réponse fournisseur, `map_selection.mode`, la réponse contrôlée, le checksum du bundle publié et les liens du carrousel. Contrôler les tokens réels et le reçu financier.
4. Pour arrêter l’enrichissement des nouvelles éditions, définir `AGRICLIMAX_EDITORIAL_MAP_SELECTION=false` dans l’environnement effectif du job éditorial, puis laisser le prochain cycle normal s’exécuter. Il reprend le contrat historique article + ordre technique du bundle, sans reclasser une archive existante.
5. Les sélections déjà archivées continuent d’être rendues par le lecteur compatible. Ne pas revenir à un ancien lecteur ignorant le champ optionnel ; ne pas effacer ou réécrire une archive. Une reprise en cours conserve son dossier et sa réponse, même si la variable a changé, et ne relance pas OpenAI.

## Reproduction

Dépendances du lockfile (pnpm 10), puis depuis la racine :

```sh
node --conditions=react-server --import ./apps/web/node_modules/tsx/dist/loader.mjs scripts/edit04_simulate.ts
apps/web/node_modules/.bin/tsc --noEmit -p scripts/tsconfig.edit04.json
cd apps/web
node_modules/.bin/vitest run features/editorial-map-selection features/editorial-ai features/edition-maps features/nightly
```

`edit04_fetch.ts --verify-only` relit les trois archives distantes et compare les empreintes ; il nécessite les variables serveur existantes. Il n’écrit rien à distance.

La recette navigateur utilise `edit04_preview.ts`, qui écrit exclusivement dans `work/edit-04/preview`. Remplacer **temporairement** le bootstrap local par son `bootstrap.json`, conserver une copie et le restaurer après recette. Ne jamais commettre ce bootstrap de recette. Préparer les workers via `node apps/web/features/observation/prepare-worker.mjs`, lancer Next sur **127.0.0.1:3001**, avec `AGRICLIMAX_MAP_PREVIEW_ENABLED=true` et le chemin absolu `AGRICLIMAX_MAP_PREVIEW_DIR`, sans variables Supabase. Exécuter `node tests/e2e/edit04.mjs`. Ces cartes restent explicitement marquées comme recette non publiée et leurs miniatures utilisent `no-store` ; la politique de cache des cartes publiées est inchangée. Restaurer le bootstrap avant les tests unitaires et le build.
