# Décision de livraison Task 28

PR draft unique : https://github.com/Mehdi-Sine/agriclimax/pull/56

Les calculs nationaux et comparaisons indépendantes déjà validés sont conservés. La recette réelle de la Preview du dernier commit applicatif `20c60495b420f9947f6a98f052f1024a0b84162f` (déploiement 7607665041) est achevée. La présente clôture ne modifie que documentation (dont un mémo dans le dossier web pour publication Preview), preuves et harness de recette ; aucun code applicatif, formule, seuil, géométrie ou pipeline n'est redéveloppé. Après publication de cette clôture, l'origine Preview et les checks de son dernier commit sont vérifiés à nouveau ; l'attestation finale est consignée dans la description de la PR, sans modifier les données ni les calculs nationaux.

| Verdict demandé | Décision | Éléments probants |
|---|---|---|
| READY_FOR_WHEAT_V1 | READY — exploratoire | Calcul réel/API déjà validés ; neuf indicateurs blé consultés dans la Preview sur desktop, tablette et mobile ; historique, J+7, contexte RPG, lacunes et limites explicites |
| READY_FOR_CATTLE_THI_V1 | READY — exploratoire | Formule existante conservée et concordante avec l'article scientifique cité par Idele ; THI calculable et refus RH, séries et contexte SAA départemental validés dans la Preview ; aucun diagnostic animal |
| READY_FOR_AGROCLIMATIC_UX | READY | 13 indicateurs × 3 formats, récent, cartes/fiches, unités, légendes, même canevas, PRA persistante, URL rechargeable ; zéro erreur JavaScript applicative ni débordement dans ces parcours |
| READY_FOR_NATIONAL_MAP_VISUAL_REVIEW | READY | 713 contours, Crozon/La Hague/Camargue/Corse, sélection et zooms, 0,7 px uniforme, surfaces partielles hachurées, ombre nationale distincte ; captures Preview réelles |

READY signifie ici disponibilité fonctionnelle de cette V1 exploratoire et aptitude à la revue visuelle, pas validation agronomique, clinique ou zootechnique universelle. Les règles et paramètres conservent leur statut scientifique exploratoire.

## Preuves de clôture

- `evidence/preview/acceptance.json` et captures : trois formats 1440×1000, 768×1000, 390×844 ; valeurs API/fiche, navigation et état conservé.
- `evidence/preview/portfolio.json` : 39 vues pour les 13 indicateurs et trois contrôles supplémentaires du récent, soit 42 contrôles ; pas de mock applicatif.
- `evidence/preview/coasts.json`, `thi-available.json`, `cattle-context.json` : littoraux, THI disponible et contexte agricole à l'échelle officielle.
- `THI_IDELE_REVIEW.md`, `evidence/thi-scientific-sources.json` : bilan officiel CAICalor Idele du 20 juin 2025 et Vinet et al. (2023), doi:10.1186/s12711-023-00779-1. L'équation quotidienne est identique au code ; les effets biologiques et seuils dépendent de la population, du caractère et de la fenêtre. Aucun changement de formule/seuil ; 20 tests ciblés de non-régression passent.
- Tous les checks GitHub du commit applicatif 20c6049 sont réussis, y compris web-demo, Python, SQL, sécurité et dépendances. Les précédentes preuves locales (279 tests TypeScript, 314 tests Python, 4 991 comparaisons indépendantes et 130 cas nationaux) ne sont pas relancées.
- `evidence/preview/access-audit.json` : autorisation utilisateur explicite, GET/HEAD uniquement, 127.0.0.1, origine HTTPS exacte, en-tête officiel côté serveur, aucun secret persisté, aucune redirection suivie, TLS vérifié, arrêt et nettoyage.

## Couverture et limites inchangées

Blé historique : 645/713 PRA sur 25–31 octobre ; chaque journée J+1..J+7 : 713/713. THI prévisionnel : 216 à 601/713 selon la journée ; THI historique indisponible sans RH. Les cumuls entre sources/runs incompatibles restent NULL. Aucun dommage, stade, rendement, hectare ou animal effectivement touché n'est inféré.

Les effectifs SAA bovins restent départementaux ; ils ne sont pas répartis entre PRA. Les températures et THI quotidiens ne décrivent ni les maxima horaires, ni l'intérieur des bâtiments, ni l'homogénéité d'un territoire. Les courbes ne traversent pas les lacunes. Aucun effet biologique publié par Idele n'est transformé en recommandation automatique.

Les mesures de chargement Preview passent par une passerelle ; elles ne prouvent pas une absence de régression WebGL sur tout appareil physique. L'outil facultatif de feedback Vercel a échoué à charger dans le navigateur headless avec la confiance TLS standard de ce navigateur ; aucun contrôle TLS n'a été désactivé et ce composant auxiliaire n'est pas utilisé comme preuve applicative.

## Suite et état de la PR

Aucun blocage d'accès ou documentaire initial ne subsiste pour cette recette. À prévoir pour une version suivante : qualification scientifique des paramètres par population/stade/caractère, amélioration de la couverture RH par les cycles existants, validation explicite de toute future agrégation multi-modèles, mesures contrôlées sur appareils physiques et audit d'accessibilité complet. Ces travaux ne sont pas simulés par la V1.

PR #56 conservée en draft. Aucune fusion, aucune mise en production, aucune acquisition ou réingestion, aucun rejeu national déjà validé, aucune modification des automatismes quotidiens et aucun service payant ajouté. La passerelle est arrêtée après chaque série de tests ; les états temporaires d'authentification ne sont pas conservés.
