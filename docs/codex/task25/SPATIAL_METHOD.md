# Agrégation RPG/PRA — rpg-area-1

Le pipeline lit chaque GeoPackage régional par curseur SQLite, dans l'ordre `fid`, avec vérification de la table, de la colonne géométrique et du SRID2154. Les géométries GeoPackage binaires sont décodées selon leur en-tête OGC puis WKB. Les autres couches du 7z ne sont pas ingérées.

Les parcelles et les PRA sont projetées en EPSG:3035, XY explicite. Les invalidités sont réparées dans une copie de travail polygonale (`make_valid`) ; les coordonnées PRA versionnées et les pondérations ERA5 ne sont pas modifiées. Les identifiants PRA réparés et le nombre de parcelles invalides sont enregistrés.

Un STRtree indexe les 713 PRA. L'aire de chaque intersection parcelle/PRA est réellement mesurée, puis divisée par 10 000. Une parcelle traversant une limite contribue aux deux territoires suivant ses intersections, jamais suivant son centroïde. Une géométrie PRA multi-département ne conduit à aucune attribution SAA artificielle : l'utilisateur choisit la vraie couche départementale/régionale, indépendante du contexte PRA.

Le RTree natif du GeoPackage fournit les parcelles antérieures voisines. Leur union est retranchée de la parcelle courante : priorité déterministe à la première occurrence `fid`, recouvrements exclus explicitement mesurés, pas de double compte silencieux entre cultures. Cette convention introduit une limite sur les parcelles concurrentes, affichée/documentée. Des identifiants répétés doivent avoir le même fingerprint ; les conflits arrêtent le lot. Un index d'identités interrégionales compact, hors DB produit, permet la reprise et le contrôle des doublons entre livraisons.

Un audit interrégional (`agriculture_cross_region.py`, `rpg-cross-region-1`) recharge les couches originales depuis le cache vérifié, une seule région en mémoire. Un RTree de boîtes englobantes donne un sur-ensemble conservateur de paires de régions différentes. Les géométries candidates sont projetées et débarrassées des recouvrements internes, puis intersectées exactement. Priorité au code région croissant ; l'union des propriétaires précédents évite une double soustraction entre trois régions. Les corrections par PRA/groupe et les surfaces hors PRA sont mesurées avec contrôle de conservation. L'audit n'est appliqué que si son empreinte de provenance correspond exactement aux checkpoints publiés ; sinon la limite `cross_region_distinct_id_overlap_not_checked` reste affichée.

Pour chaque région et groupe :

`aire source géométrique = aire allouée aux PRA + aire hors snapshot PRA + recouvrements exclus`.

Le résidu doit être inférieur à 0,001ha par groupe. Une allocation dépassant l'aire disponible de plus de 1m² provoque une erreur (recouvrement des PRA de travail), plutôt qu'un gonflement du total. La comparaison avec `surf_parc` est séparée : tolérance de 0,5% de l'aire géométrique + 0,005ha/parcelle pour l'arrondi déclaré à deux décimales et la différence de mesure projetée. Les résultats des deux contrôles sont conservés ; ils ne réconcilient pas le RPG avec la SAA.

Les groupes à libellés source non univoques ne sont pas proposés. Le dénominateur des parts inclut toutes les surfaces RPG acquises, y compris les groupes non proposés. Un seul millésime RPG est intégré ; aucun historique n'est simulé. Une PRA sans parcelle connue vaut NULL, pas « aucune agriculture ». Avec une couverture partielle, les surfaces et parts portent sur les seuls lots acquis.

La couche source Parcelles originale est conservée intégralement en XZ sans perte, avec SHA256 avant/après et preuve de restauration. Les couches de livraison non utilisées ne sont pas retenues. Après checkpoint, l'option `--compact-cache` évince uniquement les représentations redondantes vérifiées, sans suppression de répertoire. Voir `STORAGE.md`.

Le téléchargement reprend un `.part` par plages HTTP de 16Mio, quatre au maximum en parallèle. Statut206, Content-Range et taille exacte sont contrôlés avant assemblage ; l'empreinte MD5 de l'éditeur et le SHA256 du fichier complet sont contrôlés avant extraction. Taille, version de méthode et SHA256 du référentiel accompagnent chaque checkpoint. Un lot interrompu n'est jamais servi à l'interface.
