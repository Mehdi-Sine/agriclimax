# Résultats Task25

Les fichiers JSON joints sont les preuves d'import réelles ; les fixtures scientifiques utilisent uniquement des géométries synthétiques et n'alimentent jamais le produit.

## SAA réellement acquise

Deux XLSX officiels, 2010–2025 ; 128 productions, 496 indicateurs, 29 350 séries, 436 761 valeurs. Les valeurs source sont conservées sans conversion implicite d'unité. `saa-import.json` conserve les lignes d'échantillon et les contrôles nationaux.

`saa-controls.json` : 2 943/2 944 comparaisons de sommes départementales avec le total France sont dans la tolérance d'arrondi. L'unique différence est +2ha, maïs fourrage non irrigué, surface 2010 : une cellule source −2 est restituée NULL, sans compensation arbitraire. Pour le blé tendre 2025 : somme départementale = total officiel France = **4 494 355ha**. Seine-et-Marne : **117 468ha** ; Corse-du-Sud : **2ha** ; Haute-Corse : **75ha**.

## RPG réellement acquis

Les compteurs/contrôles régionaux et les surfaces par PRA/groupe figurent dans `rpg-import.json`. Seuls les lots terminés sont publiés ; la bannière et les statuts signalent la couverture partielle. Aucun résultat régional n'est présenté comme national.

Premier lot vérifié : Île-de-France, 125 212 parcelles, 5 géométries invalides traitées, aucun doublon d'identifiant, 6,385878817ha de recouvrements exclus. Les comparaisons avec les surfaces déclarées passent pour tous ses groupes. Le pipeline continue avec checkpoints, sous contrainte de disque documentée dans `STORAGE.md`.

## Validation

Les résultats finaux des commandes, captures et URL de Preview sont à lire dans `validation.json`, `browser-real.json` et `UX_ACCEPTANCE.md`. Aucun résultat CI distant ni contrôle Preview ne doit être déduit d'un simple succès local. Les calculs ERA5, normales, anomalies, périodes, cumuls et règles existantes ne sont pas modifiés.
