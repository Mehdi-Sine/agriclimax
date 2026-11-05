# Contrôle des souscriptions AROME et ARPEGE

Suite à l’ajout des souscriptions modèles le5novembre2026, le probe utilise exclusivement `METEOFRANCE_AROME_API_KEY` pour AROME et `METEOFRANCE_ARPEGE_API_KEY` pour ARPEGE. La clé Observations reste réservée aux catalogues Observations ; aucun repli entre produits. Les401 antérieurs ont été observés avec la clé Observations sur les modèles : ils ne constituent pas un test des nouvelles souscriptions.

Workflow existant `meteofrance-ingestion.yml`, branche `codex/26-national-daily-climate`, `probe_only=true`. Le job d’ingestion est exclu ; aucun secret DB n’est lié au job probe. Aucune acquisition nationale ni exécution ERA5 n’est déclenchée par ce contrôle.

Deux GetCapabilities WCS fixes (AROME0,025°France, ARPEGE0,1°Europe). Les identifiants de variables sont lus depuis les réponses réelles. Seulement si les deux catalogues sont valides : DescribeCoverage de température en hauteur pour chaque produit, puis une lecture TIFF d’un seul instant et de la hauteur2m, emprise48–48,1°N/1,4–1,5°E. Les axes et bornes doivent être annoncés par le service ; sinon aucune lecture. Plafonds1,5Mo/métadonnée,256Kio/champ,100points/champ,20s/requête, aucune relance ou redirection. Au maximum10requêtes avec les quatre catalogues historiques conservés. Ce contrôle d’accès n’est ni une analyse J−1 validée ni une ingestion météorologique.

Aucune clé, réponse d’erreur brute ou en-tête d’authentification n’est imprimé. Les URLs de rapport ne contiennent pas les clés. TLS normal, refus des redirections, refus des réponses renvoyant la clé. Les petits champs et métadonnées publiques peuvent être conservés en artefact7jours ; résultats HTTP et synthèse sans secrets dans `access.json`.

Vérifications locales :9tests de sécurité fonctionnelle/limites, Ruff, mypy strict et contrôle structurel du workflow réussis. Résultat distant à ajouter après le dispatch borné, sans modifier les données existantes ni la décision nationale sur la seule base d’un succès HTTP.
