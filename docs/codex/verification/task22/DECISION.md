# Décision Task22

**READY_FOR_FULL_CLIMATOLOGY**

Climatologie annuelle 1991–2020 effectivement calculée et stockée sur
agriclimax-dev : **713 PRA, 366 jours calendaires, 260 958 lignes**.
92 checkpoints vérifiés, valeurs/comptes SQL identiques au cache, import intégral
puis replay à **zéro insertion**. API réelle validée sur trois PRA et plusieurs
dates ; anomalies calculées côté serveur, NULL et qualité explicites.

Base totale réelle : **115,49 Mo**, dont **25,90 Mo** pour la table annuelle et
son index, largement sous le budget compact et le garde d'arrêt de 375 Mo.
Task21 et données actuelles conservées, empreintes inchangées. 29 février explicite :
compte réel de huit années, normale NULL sous la règle Task21 à 30 années.
Migration additive forward-only, RLS forcée, aucune nouvelle exposition publique.

Aucun blocage scientifique, corruption, nouvelle exposition de sécurité,
impossibilité d'acquisition ou incompatibilité de stockage constaté.
Les avertissements historiques PostGIS restent documentés sans être introduits
par cette tâche. Aucun THI, aucune interpolation. **PR draft #51, aucun merge.**
