# Décision

**READY_FOR_713x30**

Le pilote DEV a réellement produit les 2 190 journées attendues, avec continuité
multi-mois, identité des sources explicite, calculs indépendamment vérifiés, NULL
et disponibilité correctement signalés. Le rejeu conserve comptes/empreintes ;
les sept jours Task19B, ses diagnostics et v0.2.0 restent inchangés.
Le stockage mesuré et la prévision nationale prudente (115.85 Mo) restent sous la cible Free. Les lectures et diagnostics à la demande ont été mesurés, sans SLA.
Les PRA partielles/indisponibles ne constituent pas un blocage. Aucun changement
de contour, poids, règle scientifique, migration, RLS ou privilège dans cette tâche.

## Run national préparé, non lancé

Configuration : `config/pilots/pra713-30day-prepared-v1.json`, exécution désactivée.
Runner : `scripts/pra_national_30day.py` ; plan par défaut, double garde explicite
avant tout calcul/acquisition/persistance nationale. Aucune autorisation nationale
déduite du présent verdict. Le SQL insert-only existant pour 713 PRA /14 541 poids
est généré dans `work/task19d/reference.sql`, **jamais appliqué**.

Ordre préparé :

1. Après autorisation distincte, vérifier DEV/quotas et compléter l’import officiel existant ; contrôler 713 PRA /14 541 poids. Aucune migration nouvelle.
2. Conserver les caches pilotes et leurs SHA256 ; vérifier les 81 reçus puis créer les alias de cache avec filiation explicite sous la nouvelle édition nationale.
3. Acquérir seulement les trois emprises manquantes : neuf requêtes, concurrence 1. Vérifier les 30 frontières horaires et les checksums.
4. Calculer les cinq fenêtres de sept jours maximum, sans diagnostics systématiques.
5. Exécuter la validation indépendante des 713×30, exigée par le garde d’écriture ; persister sur DEV uniquement, mesurer et rejouer.
6. Arrêter si source/checksum/identité incohérents, erreur scientifique, manque de support masqué, quota indisponible, cible 375 Mo franchie ou corruption/idempotence en défaut.

La future édition nationale reste distincte des éditions pilotes et conserve leurs
archives/empreintes ; aucun remplacement silencieux de révision. Retour arrière :
suspendre le run, garder checkpoints et données immuables ; aucune purge ni rollback
destructif. Aucun merge automatique, activation payante ou run national exécuté ici.

Les résultats CI/sécurité/Vercel du SHA final sont consignés dans la PR draft.
