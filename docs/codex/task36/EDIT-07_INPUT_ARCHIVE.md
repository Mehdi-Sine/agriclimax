# EDIT-07 · Archives du Journal du 22 novembre 2026

Le job éditorial [44988577228](https://github.com/Mehdi-Sine/agriclimax/actions/runs/44988577228) a terminé en phase `input_archive`. Le rejeu depuis les cinq acquisitions déjà qualifiées a reproduit l'échec au plafond gzip. Le plafond décodé de 134 217 728 octets était respecté.

| Dossier | JSON en octets | Gzip en octets |
| --- | ---: | ---: |
| 21 novembre, archive existante | 102 352 373 | 7 809 249 |
| 22 novembre, préparation historique | 106 681 712 | 9 731 832 |
| 22 novembre, références immuables et supports cartographiques | 3 856 191 | 1 074 583 |
| Plafonds de stockage | 134 217 728 | 8 388 608 |

Le 15 novembre est devenu le 28ᵉ jour d'ERA5 contigu disponible (19 octobre au 15 novembre). Les fenêtres de comparaison de 14 jours ont enfin disposé de deux périodes complètes. Les 52 comparaisons de cet horizon ont ajouté 51 604 références de provenance. La section des comparaisons est passée de 1 813 305 à 3 615 622 octets gzip, mesurés séparément. L'ancien dossier incorporait aussi 19 964 lignes ERA5 et un bulletin de 49 910 lignes de prévision déjà stockés dans leurs archives sources. Le bulletin de prévision a légèrement diminué à taille de section comparable, de 1 652 173 à 1 649 754 octets gzip. Les objets `forecast-native/v1` ont leur propre publication et sont absents de l'entrée éditoriale.

Le format `editorial-source-pins-1` référence les jours ERA5 réellement admis (60 jours au maximum) et le bulletin sélectionné par chemin, taille et SHA-256. Il conserve le contexte d'acquisition, les supports cartographiques gelés et les empreintes des comparaisons et épisodes avec leurs versions de calcul. Les cartes relisent au plus les sept jours nécessaires auprès des archives sources immuables, avec les validateurs scientifiques existants. Ces fichiers doivent rester conservés, distinctement des objets natifs soumis à rétention. La voie de lecture historique accepte toujours les dossiers inline. Les captures manuelles isolées restent autonomes.

Pour un rejeu validé, utiliser `prepare` sur la branche corrigée avec la date explicite, puis vérifier le snapshot, l'archive et la sélection cartographique. Déclencher le workflow avec `stage=run`, `generation_only=true` et `authorized_snapshot` égal au SHA-256 du snapshot. Cette voie utilise le verrou de génération habituel et laisse le texte et les cartes en attente de la revue. Après revue, le manifeste cartographique expérimental est la dernière écriture nécessaire à la visibilité publique. `publication_enabled` commande la promotion certifiée.

Pour le 23 novembre, le correctif peut être mis en service via la revue et la fusion manuelles de cette PR. Si le correctif attend encore sa revue, préparer le snapshot du 23 sur cette branche après le cutoff de 05 h 40, heure de Paris, avec les acquisitions qualifiées. Le run existant peut ensuite relire ce snapshot via son identifiant de date. Vérifier le journal de taille, l'état du run et la page publique datée. L'enregistrement du snapshot du 22 n'autorise aucune génération supplémentaire.
