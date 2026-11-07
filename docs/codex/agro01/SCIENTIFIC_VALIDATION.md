# Validation scientifique et technique

## Question évaluée

Les opérations temporelles donnent-elles le bon résultat **à partir des valeurs archivées disponibles** ? La réponse technique est distincte de la qualité instrumentale de ces données et d'une interprétation agronomique. Aucune mesure de rendement, phénologie ou dommage n'a servi de vérité terrain ; aucune validation de risque agricole n'est revendiquée.

## Protocole indépendant

`features/wheat/real.test.ts` lit les archives privées avec le lecteur existant : contrôle SHA-256 du blob, des enveloppes historiques et des identités PRA ; schéma et sélection nationale des prévisions. Les mêmes entrées numériques vérifiées sont ensuite confrontées à [verify_reference.py](verify_reference.py), un programme Python utilisant exclusivement la bibliothèque standard, sans import des calculateurs de production TypeScript ou Python.

La référence utilise `math.fsum` pour les sommes, une somme d'indicatrices pour les comptes et une partition par indices des échecs pour les séquences (algorithme différent de la boucle de production). Elle recalcule la complétude, les métadonnées, l'homogénéité, les bornes strictes et les contrôles physiques ; aucun raccordement de source n'est autorisé.

Tolérance : 1e−9 absolue ou 1e−12 relative. Les valeurs nulles doivent concorder exactement. Les identités et preuves sont distinctes de l'arrondi d'affichage à deux décimales ; le nombre factuel conserve toute sa précision.

## Données réelles et témoins synthétiques

- Réanalyse : les dix règles sur les 713 PRA, fenêtres 1/7/30 jours se terminant au dernier jour archivé accessible.
- Prévisions : les dix règles sur les 713 PRA, J+1 et J+1…J+7 du dernier cycle national vérifié.
- Témoins synthétiques explicitement étiquetés : 1/7/30 jours, dates traversant le changement d'année, températures négatives, pluie nulle, limites exactes, manque de jour ou valeur, interruption, changement de source/run/support et couverture partielle.
- Les tests unitaires ajoutent zéro franchissement, épisodes multiples, valeurs non finies, incohérences thermiques, doublons, dates impossibles, unités erronées, changement de grille/méthode et refus de qualification avec seuil personnalisé.

Résultats chiffrés, date d'exécution et erreurs : [evidence/validation.json](evidence/validation.json). Entrées et sorties de cinq PRA contrastées (Beauce dunoise, montagne bourbonnaise, Crozon, littoral corse, littoral niçois) : [evidence/samples.json](evidence/samples.json). Dans le fichier de preuve, `support_fingerprint` correspond au champ interne `support_key` (empreinte de support, jamais une clé API). Les clés `input_key` mutualisent les entrées communes aux indicateurs ; aucune observation synthétique n'est introduite dans ces exemples.

## Corrections et limites

Pas de réécriture des noyaux ni correction arbitraire des seuils. La voie 2.0 ajoute : contrôle de l'identité spatiale à travers les jours ; unité/fenêtre UTC de la variable réellement demandée ; source/run de cette variable, plutôt que ceux d'une autre ligne du jour ; statut explicite des couvertures partielles ; refus des métadonnées absentes et garde de cohérence thermique. Les anciennes versions restent accessibles et inchangées.

La recette révèle un changement de modèle/support dans la sélection prévisionnelle de sept jours : le résultat intégré reste nul. Les valeurs quotidiennes J+1 sont utilisables descriptivement. La fenêtre historique de trente jours comprend des jours non archivés et reste nulle. Les séquences ne sautent jamais un jour manquant. Aucune normale ni anomalie n'est calculée dans cette voie.

Le contrôle indépendant porte sur la réduction temporelle et les barrières de qualité après décodage des archives, pas sur une nouvelle validation des poids géographiques ou des champs météorologiques. Les arrondis `postgresReal` sont conservés par le lecteur existant. Les coefficients terre/mer non disponibles restent une réserve explicite, même pour des prévisions à couverture numérique complète.

## Reproduction

```bash
pnpm install --frozen-lockfile
NODE_USE_ENV_PROXY=1 AGRO01_REAL=1 pnpm --filter @agriclimax/web test features/wheat/real.test.ts
NODE_USE_ENV_PROXY=1 AGRO01_RUNTIME=1 pnpm --filter @agriclimax/web test features/wheat/runtime.real.test.ts
pnpm test
```

`NODE_USE_ENV_PROXY=1` est nécessaire au Node 24 de cet environnement cloud ; il ne modifie pas l'application ni les secrets. Les tests réels sont opt-in ; une erreur réseau les fait échouer sans substitution. Une nouvelle exécution peut trouver un autre catalogue : consulter ses empreintes et sa date avant de comparer les nombres.
