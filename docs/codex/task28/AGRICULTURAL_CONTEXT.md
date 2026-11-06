# Contexte agricole

Le composant WheatContext existant est réutilisé et appelle `/api/agriculture?action=wheat-context&pra=…`. Les surfaces RPG 2025 et leur part dans les surfaces acquises restent déclaratives ; les limites de couverture et les réserves de recouvrement sont conservées. Exemple réel Beauce dunoise : 14 242,28 ha, 22,43 %. Aucun pipeline RPG/SAA n'a été exécuté.

La lecture distingue l'aléa territorial et la présence agricole déclarée. La sensibilité biologique et le risque de dommage ne sont pas calculés. Aucun stade phénologique, hectare affecté, perte ou rendement n'est déduit.

Les lecteurs SAA existants conservent leur échelle départementale/régionale dans Productions agricoles. Aucune statistique départementale n'est affectée aux PRA et aucune prairie RPG n'est assimilée à un effectif bovin. L'Analyse bovins décrit la couverture climatique indépendamment d'une présence documentée d'animaux ; elle renvoie explicitement au contexte SAA à son échelle officielle. Aucun nouveau jeu d'effectifs n'est acquis ; seuls les effectifs départementaux SAA déjà intégrés sont réutilisés dans la fiche.

Le catalogue déjà intégré contient `saa-efa-20-eff-departement` (Ensemble espèce bovine, EFA 20, EFF, têtes). La fiche bovins réutilise cette série pour le département officiellement attaché à la PRA dans le référentiel : année 2025, statut provisoire/secret/absence conservé, source et règle affichées. Ce nombre est présenté comme le total de tout le département, jamais comme un effectif PRA ou un effectif exposé. Le lien ouvre la lecture départementale existante avec la PRA conservée dans l'URL. Aucun rattachement n'est deviné si la propriété officielle `department` manque.
