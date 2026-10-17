# Limites connues

- V0.2 exploratoire, sans validation experte présumée ni score de risque nouveau.
- Cinq stations publiées ne constituent pas une couverture spatiale continue.
  Les mailles ERA5-Land restent distinctes ; aucun remplissage ou interpolation.
- Historique blé : résultat de la fenêtre publiée uniquement, pas une série
  journalière reconstituée. Anomalies seulement si une référence homologue existe.
- THI quotidien TM/UM : synthèse de mesures réelles, pas un maximum horaire ;
  pas d'anomalie THI sans référence humidité, pas d'alerte animale automatique.
- Run quotidien et heure exacte de publication en base non disponibles via le
  lecteur actuel. Dernière publication réussie ne signifie pas dernier run réussi.
- Pan/zoom vérifiés sur Chromium, événements tactiles émulés ; aucun appareil
  physique iOS/Android, Safari, lecteur d'écran humain ou audit WCAG exhaustif.
- Le cadrage carte est local à la vue ; les URL partagent la sélection métier
  (production, indicateur, station, période, paramètres), pas le geste de cadrage.
- Les mesures sont des échantillons DEV/preview, sans SLA ni test de charge.
  Le RPC retourne latest et selected (parfois identiques) ; deux publications
  bornées et validées côté serveur, jamais leurs objets complets côté navigateur.
- Pas de nouveau module, notification utilisateur, migration ou modification
  des données réelles. Pas de bascule de production Vercel ni merge.
