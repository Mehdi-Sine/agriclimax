# Pilote DEV isolé — protocole non exécuté en écriture

Les tests mémoire et locaux ne prouvent pas les garanties d'un service distant. Les secrets présents ne valent pas autorisation d'écriture. Le transport existant cible exclusivement `yyfbpecxvxglzxopsmel.supabase.co` ; cette allowlist ne prouve pas l'isolation réelle. Ne pas changer cet hôte pour contourner la garde.

Avant exécution : l'opérateur confirme que cette référence est un DEV isolé sans consommateurs production, autorise explicitement acquisition bornée, écritures dans `pra-climate-archives` et interruptions contrôlées, fixe date/fournisseur/budget, vérifie espace libre et exclusivité du writer. Si un autre projet DEV est requis, préparer d'abord une configuration revue et des clés propres à ce projet. Aucun pilote en production.

1. Capturer catalogue/current, SHA256 de tous les objets référencés, configuration de référence et état des API. Lire seulement jusqu'à autorisation.
2. Après autorisation, sélectionner une journée réellement livrée par CDS et non déjà archivée, utiliser le writer existant `era5_archive_daily.py --execute --root work/ops01/dev --max-downloads 4`. Conserver les bornes 16 Mio/fichier et 128 Mio/campagne. Une journée non terminée n'est pas un succès.
3. Agréger avec la référence versionnée existante ; vérifier les 713 identités exactes et les supports/flags CORE-01, sans transformer les PRA partielles en complètes.
4. Reprendre le même root avec `--resume --execute --publish-dev` uniquement après autorisation. Écrire l'objet immuable et ses métadonnées ; relire indépendamment les octets et calculer SHA256 avant current.
5. Capturer current après publication et relire les API consommateurs ; comparer dates, identité, comptes, qualité et calculs aux objets, pas seulement HTTP 200.
6. Sur une seconde journée autorisée, interrompre entre écriture de l'objet et promotion du pointeur (injection contrôlée sur DEV uniquement). Vérifier ancien current et son contenu inchangés ; conserver l'orphelin, aucune suppression.
7. Relancer avec mêmes root/date/version. Vérifier aucune acquisition des tuiles déjà validées, absence de doublons de dates/identités, empreintes identiques et publication finale valide.
8. Simuler échec de vérification avant pointeur : ancien cycle toujours lisible. Capturer étapes, timestamps UTC, durées, requests/bytes et erreurs sans secrets.
9. Vérifier catalogue/current après interruption entre leurs mises à jour ; utiliser la réparation existante en rejeu `--execute --replay-latest --publish-dev`, sans réacquérir.
10. Relancer health et APIs ; conserver reçus et hashes avant/après, résultat indépendant et statut par étape dans ACCEPTANCE.

Commandes à compléter avec une date vérifiée ; ne pas déclencher aveuglément un backfill trente jours. La météo nationale se pilote via les modes existants et exige `national_authorized`, `execute`, `publish_dev` distincts. Aucun dispatch d'écriture n'a été lancé dans OPS-01.

Action restant à autoriser : pilote borné ci-dessus sur un DEV identifié, y compris mutations Storage et interruption volontaire. Aucune clé à communiquer en chat.
