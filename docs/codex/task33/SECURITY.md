# Vérification de sécurité T33

Gitleaks 8.24.2, même version officielle vérifiée que la CI, a signalé une seule occurrence : `real-cases.json`, ligne 337, champ `quiet_pra_day.row.batch_key` du premier commit T33. Cette valeur est une empreinte SHA-256 publique de lot DATA-01, pas un credential. Elle est égale à l'empreinte de l'identité reconstruite par `sha256(json.dumps(identity, sort_keys=True, allow_nan=False).encode())`, comme dans le pipeline existant.

La vérification indépendante de ces trois propriétés (64 caractères hexadécimaux, même batch_key que l'archive, égalité au hash recalculé) est enregistrée dans `evidence/digest-false-positive.json`. `.gitleaksignore` contient uniquement le fingerprint exact commit/fichier/règle/ligne de cette occurrence ; aucune règle, aucun chemin général ni aucun motif de secret n'est désactivé. L'historique complet est rescanné avec cette exception ciblée.

Les clés Supabase restent dans l'environnement serveur ; seules les lectures existantes ont été utilisées pour les archives de prévision. Aucun secret, jeton de bypass ou en-tête d'authentification n'est conservé dans les captures, dossiers, logs ou liens de livraison. Les preuves documentaires contiennent des métadonnées et URL publiques, pas les articles intégraux.

Audits de dépendances : les seuils high/critical JavaScript passent ; les avis low/moderate restent dans le journal. Les audits Python et navigateur passent dans GitHub. Voir également ACCEPTANCE.md.
