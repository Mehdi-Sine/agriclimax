# Archivage immuable

Contrat `editorial-archive-1.schema.json` : texte intégral, rubriques, T33 complet, cartes figées sans géométrie dupliquée, modèle, paramètres, versions, empreinte du prompt, consommation et résultat de validation. Le modèle ne choisit pas son identité ni son statut final.

L'édition est adressée par SHA-256, avec empreinte globale de contenu. Une correction est une nouvelle identité de révision avec lien `supersedes` ; le parent demeure inchangé. Une date peut donc conserver plusieurs révisions. La lecture vérifie contrat, checksum et données scientifiques. Les archives corrompues ne sont pas servies.

Le store local/DEV écrit un temporaire complet synchronisé puis crée le lien final sans écrasement. Les fichiers de registre financier utilisent rename atomique et fsync. Les réservations, états ambigus et verrous survivent aux interruptions de processus. Les diagnostics rejetés sont séparés, non proposés à la lecture journalistique.

Les cartes figées conservent valeurs, qualité, source, cycle et période. La géométrie PRA versionnée T32B reste partagée. Une édition historique sans carte compatible affiche un état explicite ; aucune substitution par une carte actuelle. Les cartes choisies sont accessibles par édition et identifiant avec ETag immuable.

La Preview consulte un manifeste versionné de deux exemples, pas le répertoire d'écritures du batch. L'intégration de nouvelles archives est une action explicite de revue. T36 devra stocker les blobs immuables dans le backend existant puis remplacer atomiquement un manifeste `published` après approbation. Aucune écriture de production T35.

Le manifeste Preview contient les JSON compressés et encodés avec empreinte des octets décompressés. Cela évite la réécriture des nombres flottants par l'import JSON de Turbopack, observée pendant la recette. `node scripts/task35_pack_preview.mjs` régénère ce manifeste après une modification explicite des exemples. Le contrôle d'intégrité demeure strict ; aucune tolérance numérique ajoutée.

Pour consulter les sorties d'un batch local/DEV sans reconstruire les exemples, configurer côté serveur `AGRICLIMAX_AI_PREVIEW_ARCHIVE_DIR` vers la racine du store (`editions/` en dessous). Le catalogue est exclusivement lecteur : il ne crée pas le répertoire et ne génère rien. Les dates et identifiants utilisateur ne servent jamais de chemins de fichiers.
