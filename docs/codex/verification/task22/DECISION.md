# Décision Task22

**READY_FOR_FULL_CLIMATOLOGY**

Version active `era5land-pra1991-2020-annual-compact-v1-9babc3b9b96830d2` :
**713 PRA × 366 jours calendaires = 260 958 lignes**, calculées et stockées sur
agriclimax-dev. 92 checkpoints SHA256 valides, aucune réacquisition à la reprise.

Empreinte binaire complète SQL identique au cache ; comparaison directe des
**85 560 scalaires Task21 : zéro différence**. Import puis replay intégral à
**zéro insertion**. API réelle validée sur trois PRA et plusieurs dates,
396 scalaires, NULL/couverture/qualité/anomalies serveur vérifiés.

Base totale réelle : **141,69 Mo**, sous 200 Mo et le garde de 375 Mo.
La première version Task22, issue d'un export JSON arrondi, est conservée privée
pour respecter l'immutabilité, mais sa lecture API est explicitement refusée
(`superseded_reference_release`). La version active reprend les float32 Task21
binaires exacts, sans nouveau téléchargement ni recalcul de ces normales.
Task21 et données actuelles restent inchangées, empreintes vérifiées.

29 février : huit années réelles, normale NULL selon la règle Task21 à 30 années.
RLS forcée, migrations additives forward-only, aucun nouveau droit public.
Aucun blocage restant ; avertissements historiques PostGIS inchangés.
Aucun THI, interpolation ou lissage. **PR draft #51, aucun merge.**
