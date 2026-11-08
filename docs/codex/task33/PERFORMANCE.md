# Performance et exploitation

Mesures du replay, environnement Node 24 / TypeScript tsx, 21 390 lignes nationales (713 PRA × 30 jours) et quatre descripteurs. Voir evidence/metrics.json pour le temps réel et RSS observés. Ce coût est celui du batch, pas de la consultation du Journal.

Les lecteurs d'archives existants vérifient les empreintes et mettent en cache les trente jours. L'adaptateur indexe dates/PRA/phénomènes ; les épisodes sont reconstruits par séquences ordonnées. Le dossier est plafonné à 96 KiB compact ; l'archive complète des épisodes et toutes les comparaisons sont compressées et séparées. Le plus long horizon qualifié suffit à chaque proposition, les quatre diagnostics restant présents.

Mémoire : le replay matérialise les données et preuves dans un processus Node ; le RSS constaté inclut runtime, imports et caches, et n'est pas une mesure d'allocation exclusive du moteur. Il faut prévoir environ 0,6 Go de RAM par worker de ce batch actuel, vérifier une marge avant d'étendre à 60 jours et éviter une parallélisation nationale non bornée.

Aucun coût API IA, service payant ou nouveau cron. API d'exemple statique avec ETag/304 ; page Almanach rendue côté serveur, sans expédier le JSON maître au client. La taille JSON n'est pas une mesure exacte des tokens ; T35 devra mesurer son tokenizer et définir son budget modèle avant activation.

Replay livré : 2.903 s, RSS 497.1 MiB, dossier compact 82,135 octets. Identité : `20dbb0cf1ead680f6f95ea86224907066efd63c27511915a4f707c1ce5fe1ac6`. Une seconde exécution vérifie l'idempotence ; les durées varient selon la concurrence des tests.
