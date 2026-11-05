# Stockage Task25

Les agrégats publics sont versionnés dans `apps/web/data/agriculture/`, lus côté serveur par un index d’imports statiques tracé par Next/Vercel. Aucun fichier agricole complet n’est importé par un composant client. Les parcelles, archives, GeoPackages et index d’identités restent dans `work/task25/`, hors Git/PostgreSQL/Supabase Storage.

## Mesures de restitution et DEV

- **14 882 244 octets**, 521 fichiers JSON de restitution, soit moins de 15Mo supplémentaires.
- Bundle client JS/CSS : **595 598 octets gzip**, budget **2 097 152 octets**.
- Table ou index agricole PostgreSQL créé : **aucun** ; agrégats agricoles écrits en DB ou Supabase Storage : **0 octet**.
- Base DEV entière : **144 004 787 → 145 225 395 octets** pendant la reprise. Mesures SQL en lecture seule, avec tailles des douze plus grandes relations/index, dans `database-resume-before.json` et `database-final-after.json`.
- Delta global observé : **1 220 608 octets**, entièrement dans la relation préexistante `agriclimax_private.climate_references`. Les agrégats agricoles restent des fichiers ; ce delta ne leur est pas imputé. Aucune table agricole n’existe dans les schémas non système.

La mesure initiale date du 5 novembre 2026 à 11:57 heure de Paris ; la mesure après ingestion est à 13:31 heure de Paris. Elles documentent la reprise, pas un état historique fictif avant le début de Task25. Au regard d’un budget nominal de 500Mo, la marge globale reste supérieure à 350Mo. Aucun changement de schéma, RLS/grant ou droit `spatial_ref_sys`.

## Sources conservées et capacité locale

Les treize archives complètes totalisent **10 945 220 073 octets**, au-delà du disque de 7,9Gio du worker si elles sont conservées ensemble. Le traitement régional conserve donc chaque couche **RPG_Parcelles originale complète**, sans perte en XZ : **6 296 264 704 octets originaux → 2 751 121 956 octets retenus**. Chaque cache comporte SHA256 original/compressé, provenance de l’archive et vérification des octets décompressés (`national-source-cache-proofs.json`). Les couches Ilots/SNA/ZDH inutilisées sont hors du périmètre de rétention.

Après un checkpoint et toutes les vérifications, seules les copies redondantes sont évincées. Aucun effacement récursif ni suppression d’autres preuves. Les tests couvrent restauration exacte, empreinte divergente, liens symboliques, plages tronquées et conservation d’une plage déjà vérifiée après interruption. Les téléchargements emploient au maximum quatre requêtes bornées, avec subdivision des plages lentes ; les empreintes de livraison complète sont vérifiées avant extraction.

Budget annuel d’une édition comparable : environ **10,95Go de transferts**, **2,75Go de cache Parcelles conservé**, plus environ 15Mo d’agrégats pour le périmètre actuel. La rétention de plusieurs éditions exige d’additionner leurs caches et la marge d’extraction régionale ; aucun stockage payant n’est provisionné. Le workflow annuel/manuel ne vérifie que les catalogues, sans acquisition massive automatique ni publication en production.
