# AgriclimaX V0.1 — intégration Task 10

Base : `main c2b203aef3ea228c6fe991f2930cabb33fa94017` du 11 octobre 2026.
Worktree : `/workspace/agriclimax-v01`. Branche : `codex/10-integration-v01`.
Identité locale : `Mehdi-Sine <mehdi.sine@acta.asso.fr>`, identité documentée
par Task 07 ; le placeholder fourni n’a pas été utilisé comme adresse.

## Utilisation

- Observation : `/?mode=demo`. Sélectionner `demo-001` sur la carte ou dans
  le tableau accessible ; ouvrir le diagnostic depuis le panneau ou le sheet.
- Diagnostic direct : `/diagnostic?mode=demo&cell=demo-001&production=wheat_soft&indicator=tmax_days_above&date=2026-07-01&rule=demo_heat_wheat&version=0.1.0`.
- Veille : `/watch?mode=demo`. Ouvrir « Vérifier le signal », puis les preuves
  et le payload factuel. Carte et diagnostic reçoivent l’identité du résultat.
- Live vide : `/?mode=live&production=wheat_soft&indicator=tmax_days_above&date=2026-07-01&rule=demo_heat_wheat&version=1.0&bbox=-5.5,41,10,51.5&zoom=6`.
  Ces identifiants servent uniquement à vérifier une lecture vide ; aucun
  résultat live ni règle réelle n’est créé par cette URL.

## Ce qui fonctionne

Carte MapLibre locale, filtres, sélection partageable, panneau desktop et bottom
sheet mobile, diagnostic lié au résultat et deep-link, retour restaurant la cellule,
navigation carte/veille/diagnostic, liste/détail de veille, provenance et
EvidenceBundle, labels demo/live, états absents et erreurs explicites, thèmes
clair/sombre, alternative clavier à la carte et focus des overlays hérités.

Le contexte partagé conserve production, indicateur, date, cellule/territoire,
règle/version, comparaison et caméra. Les identifiants contenant un point,
autorisés par l’API existante, ne sont plus perdus par la navigation UI.
Aucun résultat scientifique n’est recalculé par ces liens.

## Démo et connexion réelle

La démo utilise les fixtures V1 existantes, marquées « Données fictives », avec
une seule cellule et un seul résultat au 1er juillet 2026. Le risque est fictif,
exploratoire ; il n’est pas produit par une exécution du moteur dans la page.
La fraîcheur fournie décrit le payload ; elle ne prouve pas son actualité aujourd’hui.
La narration de veille est un template déterministe, sans assistance IA ni LLM.

Map, series et territory sont réellement connectés au projet DEV Supabase
`yyfbpecxvxglzxopsmel` par le repository serveur et les routes API Task 04.
Les trois lectures validées retournent HTTP 200 et des collections vides.
La page diagnostic utilise le même repository serveur pour la série.
Le live n’utilise aucune fixture de remplacement. La veille live n’a pas de
source connectée et l’indique explicitement : aucune liste de signaux live.
Aucune ingestion automatique n’est activée par cette intégration.

## Limites scientifiques

Hazard, exposure, sensitivity, risk, confidence et freshness restent distincts.
Exposition, sensibilité, score, fenêtres de calcul, paramètres et seuils absents
restent absents. Aucune interpolation, conversion en zéro, nouvelle formule,
règle, classe, validation scientifique ou modification de contrat.
Les classes ne sont pas comparables entre règles sans leur documentation.
La démo ne permet aucune décision agronomique.

## Limites techniques et V0.2

- Live vide : l’affichage de vrais résultats est couvert par les tests d’adapters,
  mais ne peut pas être attesté avec des données métier sur cette base vide.
- Veille live non connectée ; audit narratif non persisté. Aucun provider LLM.
- Carte : fond Natural Earth local simplifié, aucune promesse de précision parcellaire.
- Validation Chromium/axe aux trois formats, pas une certification WCAG ni un
  test sur appareils physiques. Le tableau mobile peut défiler horizontalement.
- Exception héritée braces 3.0.3 : dev lint uniquement, expiration inchangée
  au 2026-11-10 UTC exclus. Aucun chemin production ou trace serveur.

Pour V0.2 : connecter la veille à des événements structurés validés, préparer
l’ingestion et publication contrôlées de résultats réels, valider les règles par
usage et production, compléter la provenance/fenêtre temporelle côté producteur,
vérifier sur appareils physiques, suivre le retrait de l’exception braces.
Ces éléments sont des suites recommandées, pas des fonctionnalités ajoutées ici.

Voir [VERIFICATION.md](VERIFICATION.md), [PR_SUMMARY.md](PR_SUMMARY.md) et
[les captures](screenshots/). Le statut distant est suivi dans `DELIVERY.md`.
