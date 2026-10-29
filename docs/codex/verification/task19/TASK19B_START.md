# Task19B — activation nationale progressive, cadrage

**Plan uniquement.** Ni le merge ni ce document n'autorisent une migration,
un import distant, un backfill, une purge ou un service payant. L'activation
nationale reste NOT READY tant que ses prérequis ne sont pas levés.

1. **Fermer les prérequis.** Décision géographique explicite sur Marseille/Lyon
   et l'emprise officielle acceptée ; retrouver des runners GitHub autorisés
   sans augmenter automatiquement les dépenses ; checks du SHA final verts.
   Identifier la cible Supabase, sauvegarder, tester la restauration, contrôler
   le plan Free, les quotas, versions d'extensions et l'exposition Data API.
2. **Réconcilier l'historique.** Appliquer le
   [plan de réconciliation](SUPABASE_RECONCILIATION_20261029.md) après autorisation
   de cette écriture de métadonnées. Les deux objets daily sont déjà conformes :
   aucun rejeu de leur DDL. Refuser un plan qui rejoue v0.2.0.
3. **Migrer/importer sous autorisations distinctes.** Appliquer uniquement la
   migration additive Task19, puis le SQL du paquet revu. Attendre 713 PRA,
   14 541 poids et leurs checksums, droits service_role seulement, RLS forcées,
   rejeu sans doublon. Conserver la version et les réserves d'acceptation ;
   ne pas forcer reference_verified_national à true pour contourner une réserve.
4. **Pilote réel distant borné.** Quatre PRA contrastées au maximum (plaine,
   montagne, littoral, Corse), petite période et révision source immuable.
   Vérifier acquisition, persistance idempotente, états complet/partiel/absent,
   fraîcheur et séparation des sources dans API/preview protégée. Aucune clé
   privilégiée dans le client ou les artifacts. Évaluer durée, mémoire, volumes,
   egress et impact DB réel avant d'étendre.
5. **Étendre vers 30 jours.** Autorisation nationale séparée, périodes de sept
   jours au plus, dates compatibles avec la publication ERA5-Land (environ J−5),
   concurrence 1, cache source partagé et reçus/checksums. Utiliser les contrôles
   existants --max-batches/--max-downloads et checkpoints ; ne pas créer de fan-out
   illimité. Reprendre le même lot/révision après interruption. Une révision
   différente crée une identité différente et impose un nouveau budget.
6. **Valider chaque PRA et chaque variable/période.** Publier séparément
   référence géographique, couverture observée, heures attendues/valides,
   fraction pondérée, disponibilité structurelle connue/inconnue et fraîcheur.
   Le pilote à deux instants ne prouve ni les jours complets ni la permanence.
   Les diagnostics blé restent exploratoires ; THI PRA reste non supporté.
7. **Surveiller et arrêter.** Relever DB, taux de croissance, cache/disque local,
   octets téléchargés, cache hits, requêtes CDS, minutes Actions et egress/quotas.
   Alertes internes à 300/375/450 Mo, refus RPC Task19 à 375 Mo ; ne pas attendre
   le quota Free de 500 Mo. Stopper au moindre écart de checksum/version,
   conflit d'idempotence, permission inattendue, faux état disponible, fuite de
   secret, réponse source incomplète, échec récurrent, budget dépassé ou runner
   indisponible. Ne pas augmenter les limites ou changer de plan pour continuer.
8. **Politique littorale provisoire.** Conserver toutes les PRA du référentiel
   accepté ; ne pas masquer discrètement celles qui ont des données manquantes.
   Une cellule/heure requise absente produit partial/unavailable et le scalaire
   complet NULL. Zéro donnée n'est jamais zéro risque. Aucun seuil de 90/99 %
   ne transforme une PRA partielle en complète. Le support structurel reste
   unknown tant que non démontré. Aucune interpolation, renormalisation, substitution
   station ou SAFRAN. Toute source complémentaire fera l'objet d'une validation
   distincte et d'un budget, sans mélange implicite.
9. **Retour arrière et historique.** Suspendre uniquement les appels PRA,
   retirer PRA_REFERENCE_VERSION/PRA_DATASET_VERSION et redéployer l'UI approuvée
   pour désactiver l'affichage territorial. Préserver tables, reçus, lots et
   v0.2.0 ; pas de DROP ni de suppression de données pour revenir à l'ancienne
   interface. Correction forward-only ou restauration explicitement autorisée
   après analyse des écritures intervenues. Les 90 jours sont un horizon de
   budget ; toute rétention destructive exige une décision ultérieure.

À l'issue des 30 jours : décision opérationnelle distincte, fondée sur les
mesures réelles et les exclusions/réserves publiées. Le fait d'avoir intégré les
713 contours ne suffit jamais à déclarer la couverture climatique nationale.
