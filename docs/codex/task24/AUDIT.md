# Audit bref — Task24
Base vérifiée localement : e835a5745178c723359e904983eb439931529182, checkout propre avant création de codex/24-unified-product-ux. Dernier main confirmé par le propriétaire ; aucun fetch requis.

Frontières : routes/navigation et URL, carte commune et accessibilité, lecteurs serveur ERA5/climatologie, agrégation scientifique, provenance et tests. Aucun changement de schéma, droits, ingestion ou géométrie.

Réutilisation : source officielle OFB/MASA 713 PRA (6 corses), préparation GeoJSON et worker MapLibre local, RPC nationales et climatologie quotidienne 1991–2020. Couverture archive 19/09–18/10/2026. Données DEV non vérifiées pendant cette exécution réseau limitée.

Défaut confirmé dans SQL : historique `current_coverage` est le tableau [Tmin,Tmax,Tmoy,pluie], lecteur exigeait un scalaire. Le contexte journalier fournit un scalaire. Normalisation au bord serveur, sans migration.

Routes : accueil/productions/analyse dans un layout persistant ; territories devient alias ; stations et démo séparées. Capacités stationnelles conservées. Agriculture SAA non qualifiée localement : aucune statistique ou colorisation inventée. THI reste stationnel.
