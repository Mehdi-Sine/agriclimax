# Recette nationale — Task26C

## Données réelles

- Cycle national Actions42189132229 réussi, 713PRA,49910 lignes source,32085 sélectionnées, neuf journées5–13novembre.
- Préflight mesuré avant généralisation, contrôles indépendants MF/IFS et comparaisons inter-modèles conservés dans national-evidence/.
- Rejeu depuis racine vide : deux GET, zéro requête source, zéro écriture, réencodage byte-identique. Tests supplémentaires interdisent tout POST/PUT/PATCH/DELETE du transport read-only et tout hôte autre que DEV.
- 2145 enveloppes ERA exactes restaurées ;2852 lignes typées restaurées dans une table temporaire DEV, différences aller/retour=0. Aucune modification des tables réelles.
- 8556 lignes API chaude/froide strictement identiques sur19/20/30octobre et quatre variables ; preuve national-local/cold-parity.json.
- API locale et API Preview : **81995 comparaisons exactes chacune**, toutes dates/variables de la sélection et des trois sources contre l'archive immuable déjà vérifiée. Réponse maximale1059713 octets ; aucune tolérance numérique cachée. national-local/api-exact.json et national-preview/api-exact.json.

## Interface et protections

Le canevas existant expose713 contours officiels. Sélections modèle/date/PRA/variable, nature prévision explicite, J−1 rétrospectif, support et motifs NULL, fraîcheur, qualification côtière. Trois formats1440×1000,768×1000,390×844 ;60 comparaisons fiche/API par environnement, captures et vérifications de vrais survols de polygones. Les captures de carte dédiées évitent le canvas WebGL hors champ lors d'une capture pleine page. La recette n'intercepte ni réseau ni données et ne modifie pas l'heure du navigateur. La passerelle Preview existante n'accepte queGET/HEAD et conserve la vérification TLS normale ; le secret de protection demeure côté serveur.

Le rapport browser-real.json de chaque environnement fait foi ; une tentative arrêtée n'est pas un succès. Le premier harness avait un mauvais identifiant La Hague50345 : corrigé vers50081 après lecture du référentiel. La synchronisation URL et le rendu après changement de caméra sont attendus explicitement pour éviter les faux échecs de survol. Aucun changement des géométries ni hook de test dans le produit.

## Contrôles de code

307 tests Python complets passent, plus deux tests ciblés de frontières read-only/DEV ajoutés ensuite ;263 tests TypeScript passent. Lint, typage strict, build de production, scans source/bundle et migrations forward-only passent localement. Les nouvelles dépendances n'ont pas été modifiées pour contourner le réseau.

Sur aa19aa0, Quality42203034172 : python-contracts, web-demo (lint/type/build/tests/navigateurs), SQL public et extensions **réussis**. Guards échoue sur un vrai défaut de workflow :11 paramètres manuels, maximum10. Correction : le référentiel national immuable est fixé dans l'environnement du workflow ; ses dix autres paramètres restent disponibles. Aucune garde désactivée. La campagne finale doit confirmer cette correction.

Security42203034196 : dépendances réussies, Gitleaks signale exactement un faux positif dans comparison.json139 : le texte public de statut d'accès stationnel est interprété avec le champ JSON suivant comme une clé générique. L'exception ajoute **un fingerprint précis du commit aa19aa0**, à la liste existante, sans exclusion de fichier, de règle ou de futur commit. Le scan complet local reste actif et passe après qualification. Aucune clé réelle ni rotation nécessaire pour un texte de statut public. Le rapport redacted initial et le résultat du scan doivent rester vérifiables ; les clés modèles ne figurent dans aucune preuve.

## Incidents et limites de recette

Le contrôle automatique d'approbation a rejeté deux propositions antérieures : différer Quality/Security (affaiblissement des contrôles), puis rejouer le mode national (risque de réacquisition/écritures). Ces actions n'ont pas été exécutées ni contournées. Alternative sûre : protections conservées, rejeu dédié read-only réel. Les CI automatiques des commits de jalon sont donc restées actives malgré la préférence d'une seule campagne ; aucune relance manuelle complète superflue.

Les 300 révisions legacy héritées des exécutions Task12 antérieures ne sont pas supprimées. Le workflow est désormais dispatch-only avec autorisation DEV explicite ; les tests de frontière interdisent les credentials réels dans les CI PR/push. Aucune acquisition ERA5 supplémentaire pour ces recettes.

Limites scientifiques : RH souvent NULL,194NULL pluieIFS11novembre, pas de référence stationnelle accessible ni date commune ERA récente, pas de masque physique MF, un seul cycle ne valide pas le score statistiqueJ+7. Les cinq décisions sont indépendantes dans FINAL_DECISION.md.

Audit final Supabase :23580lignes historiques digest9e1b5d29a1969b5936ff7ed579174a87 et521916normales quotidiennes digest7fd7fa815a78ea2bfd4412a658e15612 strictement inchangés.88412lignes de normales historiques également présentes. Les agrégats agricoles serveur restent inchangés dans le diff. Voir task26c-final-preservation.json.

La recette finale local et Preview passe également12survols réels chacun. `national-local/hover-failure.png` conserve une tentative de synchronisation trop courte, antérieure au rapport final réussi ; ce fichier n’est pas une preuve de succès. Le harness attend désormais le rendu asynchrone des tuiles avant de réémettre le survol.
