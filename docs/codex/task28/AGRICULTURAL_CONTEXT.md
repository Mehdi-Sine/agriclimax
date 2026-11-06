# Contexte agricole

Le composant WheatContext existant est réutilisé et appelle `/api/agriculture?action=wheat-context&pra=…`. Les surfaces RPG 2025 et leur part dans les surfaces acquises restent déclaratives ; les limites de couverture et les réserves de recouvrement sont conservées. Exemple réel Beauce dunoise : 14 242,28 ha, 22,43 %. Aucun pipeline RPG/SAA n'a été exécuté.

La lecture distingue l'aléa territorial et la présence agricole déclarée. La sensibilité biologique et le risque de dommage ne sont pas calculés. Aucun stade phénologique, hectare affecté, perte ou rendement n'est déduit.

Les lecteurs SAA existants conservent leur échelle départementale/régionale dans Productions agricoles. Aucune statistique départementale n'est affectée aux PRA et aucune prairie RPG n'est assimilée à un effectif bovin. L'Analyse bovins décrit la couverture climatique indépendamment d'une présence documentée d'animaux ; elle renvoie explicitement au contexte SAA à son échelle officielle. Aucun nouvel effectif de cheptel n'a été introduit ni inféré dans cette V1.
