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

## Recette Preview achevée

L'autorisation explicite de l'utilisateur a permis la recette de la Preview du commit applicatif 20c60495b420f9947f6a98f052f1024a0b84162f, déploiement 7607665041. Aucun outil Vercel authentifié ni CLI configurée n'étant disponible, le mécanisme officiel x-vercel-protection-bypass a été utilisé côté serveur, uniquement vers son origine HTTPS exacte.

La passerelle était liée à 127.0.0.1, n'acceptait que GET/HEAD, ne suivait aucune redirection et conservait TLS vérifié. Aucun secret dans les URL, rapports, captures, code ou logs. Les navigateurs ne recevaient pas cet en-tête ni de cookie de bypass. Passerelle arrêtée et port fermé après la recette ; aucun état d'authentification persistant créé. Audit : `evidence/preview/access-audit.json`.

- `evidence/preview/acceptance.json` : parcours réels trois formats, historique/récent/prévision, J+7, PRA/URL, API/fiche et même canevas ; zéro erreur JavaScript applicative et zéro débordement.
- `evidence/preview/portfolio.json` : 39 vues = 13 indicateurs × 3 formats, plus 3 vérifications du récent. Unités, légendes, valeurs API/fiche, 713 géométries et sélection persistante contrôlées.
- `evidence/preview/coasts.json` et captures : Crozon, La Hague, Camargue, Corse ; zoom territorial et contours uniformes.
- `evidence/preview/thi-available.json` et `cattle-context.json` : THI calculable et contexte SAA départemental réels ; le cas sans RH reste sélectionnable dans le parcours principal.
- Référence scientifique Idele désormais accessible et comparaison terminée : `THI_IDELE_REVIEW.md`. Formule et seuils inchangés ; 20 tests ciblés de non-régression passent.
- Tous les checks GitHub du commit applicatif 20c6049 passent, y compris web-demo, Python, SQL et sécurité. L'attestation de vérification du dernier commit de documentation/recette est portée dans la description de la PR après sa publication Preview.

Les nouvelles requêtes sont les lectures nécessaires à la recette de l'API Preview. Aucun rejeu des 130 calculs nationaux, aucune réexécution de la validation indépendante, aucune acquisition météo ou agricole.

## Limites conservées

Les règles et seuils restent exploratoires ; pas de diagnostic ni d'impact animal. Aucun test sur appareils physiques ou audit WCAG complet n'est revendiqué. Les temps via la passerelle ne constituent pas un benchmark CDN direct. L'outil facultatif de feedback Vercel a rencontré une erreur de confiance TLS dans le navigateur headless ; les contrôles TLS n'ont pas été désactivés. L'application, ses API, ses cartes et ses graphiques sont validés séparément de cet outil.

L'attente réseau initiale a expiré à cause de trafic auxiliaire/préchargements ; les harness attendent désormais le DOM puis explicitement les valeurs API et le rendu des 713 PRA. Aucune réponse applicative n'est simulée ni remplacée.

## Reprise

Les preuves et sources nationales déjà validées sont conservées. Toute nouvelle consultation reste limitée à la Preview exacte du dernier commit de cette PR, dans les conditions d'accès autorisées. Fermer la passerelle et les contextes navigateur à la fin. Ne relancer ni acquisition ni calcul national déjà validé. La PR reste draft, sans fusion ni production.

Complément C4 : le total bovin départemental SAA 2025 réutilise le dataset existant `saa-efa-20-eff-departement`, avec rattachement officiel du référentiel, source et statut. La lecture API et la fiche THI calculable sont comparées, et les captures bovines incluent ce contexte ; aucune affectation d'effectif aux PRA.
