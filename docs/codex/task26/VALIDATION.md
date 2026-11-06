# Validation Task26

## Résultat réel

- Pilote des **19 et 20 octobre**, PRA **28341**, **06245**, **29102 (Crozon)** : six lignes réellement acquises et persistées. Une complète, une partielle et une indisponible par jour, NULL conservés.
- **19 octobre national : exactement 713 identités uniques**, **645 complètes / 67 partielles / 1 indisponible**. Le catalogue n'a avancé du 18 au 19 qu'une fois les 713 lignes présentes.
- Publication finale : [run 42048394950](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42048394950), succès. Source réellement acquise jusqu'au 19 ; dernière acquisition 5 novembre 14:52:54 UTC, dernier calcul persisté 14:56:34 UTC.
- Rejeu : [run 42050446210](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42050446210), succès en **26,464 s**, **zéro appel CDS, zéro octet source et zéro persistance**. Compte de la nouvelle journée **713** et empreinte `26ec4787c9a41857af5646434e0aae9e` identiques ; empreinte des lots `694dcd35ba3ec87caea920f7772abc9c` identique.
- Historique conservé : **23580 lignes**, digest `9e1b5d29a1969b5936ff7ed579174a87`. Normales compactes conservées : **521916 lignes** (active + édition supplantée), digest `7fd7fa815a78ea2bfd4412a658e15612`, taille inchangée. Aucune écriture aux normales ni aux agrégats agricoles.
- **26 fichiers de checkpoints du pilote conservés octet par octet**, vérifiés contre l'artefact final ; `checkpoint-preservation.json`.

## Parité et interface

`values-preview.json` compare **2852 scalaires journaliers, NULL compris**, aux 713 sorties de lots réels, puis **713 DTO pour chacun des quatre indicateurs** Tmoy/Tmin/Tmax/pluie. La tolérance float4 réutilise la fonction déjà validée en Task19C ; aucun nouveau seuil scientifique. Les anomalies partielles restent NULL.

Les réponses agricoles sont comparées aux artefacts protégés du dépôt : 713 lignes RPG blé et 100 lignes SAA départementales. SAA est identique ; 65 scalaires RPG présentent exactement 1 ULP d'écart de sérialisation JSON/compilation JavaScript. Aucun autre champ ne diffère ; les fichiers agricoles sont byte-identiques à main. Il ne s'agit ni d'un arrondi scientifique ni d'un recalcul.

Recettes **locales DEV et Preview réelles**, sans mocks : trois espaces × **1440/768/390**, captures dans `local/screenshots` et `preview/screenshots`. Dernier jour proposé : **19 octobre** ; états 645/67/1, dates source/acquisition/calcul distinctes, fenêtres 7/30 et normales homologues, parité numérique API/fiche, même canevas entre espaces, URL et parcours stationnels blé/THI conservés. Zéro débordement horizontal et zéro erreur JavaScript dans ces recettes. Viewports émulés sur Chromium, pas une affirmation de tests sur tous les appareils physiques.

Preview : https://agriclimax-git-codex-26-national-da-7574b3-mehdi-sines-projects.vercel.app . La passerelle `task26-preview-gateway.py` est GET/HEAD uniquement, relaie les en-têtes RSC et vérifie TLS avec les CA système. Le bypass reste côté serveur, lié à cette origine ; aucun mock, aucun certificat désactivé, aucun en-tête privilégié envoyé au navigateur.

Les liens acquis restent consultables après leur sortie de la fenêtre glissante de trente jours ; le début de période implicite est calculé depuis la date sélectionnée, pas depuis la date système. Les dates inexistantes sont rejetées.

## Tests et sécurité

**274 tests Python et 258 TypeScript** réussissent ; lint, mypy strict, typecheck et build réussissent dans `make-check.log`. Contrats et automation YAML, garde des migrations forward-only et scans client/source passent. Les tests du partitionnement natif préservent les checkpoints existants et leurs masques NULL ; un support de mauvaise date est rejeté avant persistance.

Le RPC catalogue appliqué uniquement en DEV est `SECURITY INVOKER`, avec délai 5s, accès anon/authenticated refusé et service_role autorisé. Aucune table, géométrie, pondération ou RLS modifiée. Les avis de sécurité avant/après sont identiques aux réserves historiques (notamment PostGIS public) ; aucune extension de privilèges sur les données.

CI : suites SQL **public et extensions**, Python/contrats, gardes, audits sécurité et ERA5 vérifiés sur les commits fonctionnels ; le SHA documentaire final reste soumis au même CI. Les rapports de statuts finaux sont ajoutés à la clôture. Les données synthétiques des tests restent explicitement séparées de ces preuves réelles.

Les arrêts de source/validation et de durée restent visibles dans les reçus : aucun échec n'est masqué en succès. L'extension nationale à plusieurs jours n'a pas été exécutée après consommation du budget de campagne ; seuls les trois points du pilote existent le 20 octobre.
