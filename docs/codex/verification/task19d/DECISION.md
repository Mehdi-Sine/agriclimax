# Décision

**READY_FOR_NATIONAL_DEV**

Les critères réels sont satisfaits :

- 21 390 journées nationales uniques ; 713 PRA traitées sur 30 jours.
- Disponibilité des 713 explicitée dans [availability.csv](availability.csv), y compris partial/unavailable et NULL, sans interpolation.
- Acquisition complète contrôlée : 60 requêtes CDS, concurrence1, plafond 100 respecté ; validation indépendante multi-mois réussie.
- Persistance DEV et replay effectués ; zéro doublon, comptes/empreintes inchangés ; pilotes/v0.2.0 préservés ; aucun diagnostic nouveau.
- DB finale réelle **75.07 Mo**, sous le budget 375 Mo ; lectures nationales mesurées et exploitables sans SLA inventé.

L’ancienne recherche de caches/restauration est abandonnée conformément à l’instruction utilisateur. Aucune nouvelle conclusion géographique ou documentaire n’est requise pour ce verdict. Aucune migration ni modification de RLS/privilèges, contours, poids ou règles scientifiques.

Ce verdict concerne l’exploitation **DEV** de cette édition ERA5-Land, pas une couverture climatique complète ou un modèle agronomique validé. Les limites de disponibilité restent signalées. Aucune ouverture publique nouvelle ni service payant, aucune purge ou migration de production. PR #44 mise à jour ; **aucun merge**. Les checks du SHA final sont consignés dans la PR.
