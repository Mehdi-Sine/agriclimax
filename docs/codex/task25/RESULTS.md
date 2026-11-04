# Résultats Task25

Les fichiers JSON joints sont les preuves d'import réelles ; les fixtures scientifiques utilisent uniquement des géométries synthétiques et n'alimentent jamais le produit.

## SAA réellement acquise

Deux XLSX officiels, 2010–2025 ; 128 productions, 496 indicateurs, 29 350 séries, 436 761 valeurs. Les valeurs source sont conservées sans conversion implicite d'unité. `saa-import.json` conserve les lignes d'échantillon et les contrôles nationaux.

`saa-controls.json` : 2 943/2 944 comparaisons de sommes départementales avec le total France sont dans la tolérance d'arrondi. L'unique différence est +2ha, maïs fourrage non irrigué, surface 2010 : une cellule source −2 est restituée NULL, sans compensation arbitraire. Pour le blé tendre 2025 : somme départementale = total officiel France = **4 494 355ha**. Seine-et-Marne : **117 468ha** ; Corse-du-Sud : **2ha** ; Haute-Corse : **75ha**.

## RPG réellement acquis

Les compteurs/contrôles régionaux et les surfaces par PRA/groupe figurent dans `rpg-import.json`. Seuls les lots terminés sont publiés ; la bannière et les statuts signalent la couverture partielle. Aucun résultat régional n'est présenté comme national.

Premier lot vérifié : Île-de-France, 125 212 parcelles, 5 géométries invalides traitées, aucun doublon d'identifiant, 6,385878817ha de recouvrements exclus. Les comparaisons avec les surfaces déclarées passent pour tous ses groupes. Le pipeline conserve ses checkpoints ; la contrainte de disque est documentée dans `STORAGE.md`. Trois lots complets sont publiés : Île-de-France, Centre-Val de Loire, Corse. Au total : **737 006 parcelles**, **123 PRA** avec déclarations connues, dont les **six corses**. Les autres PRA ne reçoivent aucune valeur inventée. Les comparaisons avec les surfaces déclarées passent pour tous les groupes des trois lots. Résidu maximal de conservation : 2,86×10⁻⁹ha.

## Validation

Les résultats finaux des commandes, captures et URL de Preview sont à lire dans `validation.json`, `browser-real.json` et `UX_ACCEPTANCE.md`. 252 tests Python, 253 tests TypeScript et build/lint/typecheck locaux passent. La recette locale réelle produit 13 captures, vérifie les mailles SAA, les surfaces RPG, le croisement blé et la persistance du canevas. Les API Preview sont testées séparément dans `preview-http.json` ; la validation visuelle Preview reste soumise au blocage TLS Chromium documenté, pas à une absence de données. Aucun succès navigateur Preview ne doit être déduit du succès local. Les calculs ERA5, normales, anomalies, périodes, cumuls et règles existantes ne sont pas modifiés.
