## Problème et résultat

Le diagnostic du shell ne présentait qu’une fiche fictive fixe et aucun lien
partageable pour auditer un résultat live. Cette PR fournit un diagnostic commun
au drawer et à `/diagnostic`, identifié par cellule, date, production, indicateur
et version exacte de règle. Il distingue chaque composante, confiance, qualité,
fraîcheur, provenance, statut et limites. Exposure/sensitivity absentes ne
deviennent jamais zéro ; aucune formule ni seuil n’est ajouté au frontend.

## Périmètre

- Task / branche : Task 08 uniquement, `codex/08-scientific-diagnostic`, depuis `be3711e`.
- Contrats consommés : RiskResult V1 et lectures map/series Task 04.
- Contrats modifiés : aucun.
- Impact scientifique : restitution des valeurs et métadonnées fournies ; aucune règle, formule, configuration ou classification modifiée.
- Impact sécurité / migrations / rollback : loader serveur validé, erreurs masquées, pas de migration ni écriture distante. Retirer la route et ses liens suffit au rollback UI.
- Vue desktop en panneau, drawer existant, vue dédiée mobile ; tableau de série avec fenêtre de calcul distincte de la période consultée.
- Nom accessible du logo partagé corrigé pour respecter son contenu visible, défaut préexistant Task 09.

## Vérification

- `make check` baseline et final : succès ; 44 tests Python, 74 tests web, guards, contrats, lint, typecheck et build.
- E2E diagnostic et régression Task 09 : desktop/tablette/mobile, clair/sombre, contexte, deep-link, historique, clavier et drawer ; zéro violation axe détectée, aucune exclusion.
- Données fictives explicitement marquées ; live sans remplacement par fixture.
- Guard secrets source et bundle client : passent.
- RPC/API live HTTP 200, collection vide ; diagnostic HTTP 200/missing sans badge risque ou marqueur demo.
- Limites : aucune méthode complète/seuil/nature de valeur fournie dans V1, absences affichées ; live non vide testé avec réponses validées en tests, DEV vide. Audits dépendances et harness SQL Task 04 non relancés, dépendances/DB inchangées.
- Rapport et captures : `docs/codex/verification/task08/`.

PR draft pour revue. Aucun déploiement et aucun merge.
