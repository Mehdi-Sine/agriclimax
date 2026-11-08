# Ressources et coûts

Mesures DATA-01 conservées comme mesures antérieures, non remesurées par supposition : API trente jours ~4 026 836 octets, pic RSS recette ~1,16 Gio, produit détaillé dix indicateurs 77,7 Mo JSON, factorisé 2,07 Mo gzip. API proche de 4 Mio : éviter toute extension nationale du payload avant mesure hébergement. Ne pas présenter ces chiffres comme limites contractuelles Vercel.

| Budget proposé par cycle | Plafond / action |
|---|---|
| Acquisition | 128 Mio par campagne, 16 Mio/fichier ; arrêter et conserver checkpoints |
| Temps stage | ~22 min utiles sous timeout job 25 min ; reprises existantes, pas boucle illimitée |
| Mémoire batch | 4 Gio garde existante ; alerte proposée à 2 Gio, mesure RSS par stage à ajouter |
| Stockage | Garde indexée 900 Mio ; usage global/quota réel à confirmer dans console |
| Sortie API | Ne pas dépasser mesure actuelle ~4,03 Mo ; cible compacte <1 Mio pour prochaines productions |
| Objets pérennes/jour | Hypothèse 0,30 Mo ERA/support + 0,56 Mo prévision/run, hors éditions et révisions |

Le runner hosted, son disque libre, les minutes restantes, le forfait Supabase et les limites Vercel du déploiement réel ne sont pas certifiés par les secrets de cette session. Les bornes YAML sont vérifiées dans le dépôt ; les limites commerciales nécessitent les consoles Billing/Usage GitHub, Supabase et Vercel. Aucune hausse de forfait ni purge effectuée. Distinguer bytes indexés et usage réel incluant orphelins, anciennes révisions et autres buckets.

Mesurer avec `/usr/bin/time -v` les acquisitions et calculs du pilote autorisé ; conserver RSS, wall time, requests, wire bytes, lectures/écritures et taille des objets. La supervision fournit durées de stages quand présentes et signale les comptes incomplets ; ne pas déduire un zéro d'une mesure absente.

Les calculs lourds trente jours restent côté batch. Mutualiser sources, géométries, supports CORE-01, qualification et cache par identité avant règles par production ; ne pas multiplier les acquisitions pour 50/100 productions. Ne pas archiver chaque jour une copie complète du produit trente jours : ~1,51 Go sur deux ans, hors climat. Le budget DATA-01 à un run/jour projette ~762,59 Mio sur 24 mois ; un deuxième run ajoute ~409 Mo et exige une nouvelle revue. Un déclenchement anticipé ne doit pas acquérir deux fois un même cycle. Aucune évolution du Journal ni recalcul à chaque visite ajoutée ici.

Sources consultées : changelog Supabase et documentation standard uploads (08/11), aucune modification de contrat Storage/SQL. Les tarifs et quotas effectifs de l'organisation restent à vérifier avant activation.
