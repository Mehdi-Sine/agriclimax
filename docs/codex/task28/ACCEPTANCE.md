# Recette Task 28

## Validations effectuées

- Base PR #55 fusionnée, commit 648a192 ; branche unique `codex/28-agroclimatic-v1`, PR draft #56.
- Tests TypeScript : 279 cas réussis (278 au passage complet puis le cas supplémentaire de séparation température/GDD au passage ciblé final), dont les nouveaux cas GDD/seuils/séquences/lacunes/changement d'année/pluie/THI/provenance et adaptateur national. Contrat JSON Schema validé sur la réponse nationale. Le test d'interface historique Task24 est adapté aux nouveaux filtres Analyse et passe.
- Tests Python existants : 303 réussis au premier passage complet, puis les 11 tests initialement empêchés par des dépendances manquantes passent après installation des dépendances de test. Total 314. La CI Python du premier commit poussé est également verte.
- Build de production, TypeScript strict, lint, gardes secrets/migrations/automatisation/contrats, Ruff et Mypy strict des scripts ajoutés : réussis. Les tests scientifiques THI partagés Python/TypeScript existants restent inchangés et passent.
- 130 cas nationaux réels, 92 690 états de résultats. Vérification Python indépendante : 4 991 comparaisons numériques/NULL. Fenêtre de 30 jours vérifiée, détails sélectionnés bornés. Zéro acquisition source et zéro écriture cloud.
- Recette réelle locale en build de production : desktop 1440×1000, tablette 768×1000, mobile 390×844 ; égalité API/fiche, production/indicateur/temporalité, J+7, série de semaine incompatible expliquée, sélection persistante, même canevas, URL rechargeable, trois espaces, absence de débordement et d'erreurs JS.
- Cas THI calculable pra:05231 le 7 novembre : 32,79101134916147, affiché 32,79, avec provenance AROME. Cas Beauce dunoise THI NULL conservé sélectionnable. Captures distinctes dans `evidence/local/`.
- Captures cartographiques Crozon (29102), La Hague (50081), Camargue (13244), Corse (2A258), zoom territorial et national ; épaisseur intrinsèque uniforme 0,7 px, sélection par remplissage, ombre extérieure unique, pas de contours des supports couverts ajoutés.
- Les chemins RPG/SAA, normales et lectures des archives restent ceux du socle. Le test synthétique historique valide normales/anomalies, contexte, carte, trois espaces, clavier et responsive, séparément des preuves scientifiques réelles.

## Limites de recette

La Preview Vercel de la PR #56 est déployée, mais son accès anonyme est redirigé vers l'authentification. La revue automatique d'autorisation a refusé le lancement d'une passerelle qui aurait transmis VERCEL_AUTOMATION_BYPASS_SECRET à cette Preview. Une autorisation explicite a été demandée ; le blocage n'a pas été contourné. Les preuves locales réelles ne sont pas présentées comme des preuves Preview. Les quatre verdicts READY restent donc non accordés.

Le site de l'Institut de l'Élevage renvoie une vérification de connexion : comparaison documentaire indépendante non validée. Aucun seuil n'a été modifié. Les lectures de source, leur couverture et les périodes incompatibles conservent leurs limites scientifiques. Aucun test sur appareils physiques ou audit WCAG complet n'est revendiqué.

## Reprise sans recalcul ni acquisition

1. Lire le dernier commit de la PR et son statut CI, puis l'URL du déploiement Preview correspondant.
2. Après autorisation de l'accès protégé, utiliser uniquement GET/HEAD, avec une passerelle locale 127.0.0.1 et secret côté serveur lié à cette seule origine.
3. Exécuter `TASK28_ORIGIN=http://127.0.0.1:<port> TASK28_OUTPUT=docs/codex/task28/evidence/preview node tests/e2e/task28-real.mjs` puis `python scripts/agroclimatic_verify.py --origin http://127.0.0.1:<port> --output docs/codex/task28/evidence/independent-preview.json`.
4. Comparer les résultats au cycle explicitement choisi, documenter tout nouveau cycle ; ne relancer aucun fournisseur météo, pipeline agricole ou publication quotidienne.
5. Ajouter les captures et attribuer séparément les quatre verdicts seulement après validation Preview. Garder la PR draft, sans fusion ni déploiement production.

Complément C4 : le total bovin départemental SAA 2025 réutilise le dataset existant `saa-efa-20-eff-departement`, avec rattachement officiel du référentiel, source et statut. La lecture API et la fiche THI calculable sont comparées, et les captures bovines incluent ce contexte ; aucune affectation d'effectif aux PRA.
