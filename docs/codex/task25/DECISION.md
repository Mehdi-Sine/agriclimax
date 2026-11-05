# Décision Task25

**READY_FOR_AGRICULTURAL_UX_REVIEW**

Les conditions du mandat sont remplies : RPG2025 acquis, calculé et publié sur **13 régions et 713 PRA**, SAA officielle conservée aux mailles natives, audit national des surfaces et identifiants validé, rubrique Productions et premier croisement blé alimentés, recette réelle locale/Preview et CI vertes.

## Résultat vérifiable

- 9 721 133 parcelles lues ; 14 659 doublons exclus ; 148 géométries invalides réparées en copie de travail.
- **27 792 417,506253ha** restitués dans les PRA ; **9 629,827855ha hors du snapshot** comptabilisés séparément ; les bilans région×groupe passent.
- **SAA 2010–2025 : 128 productions, 496 indicateurs et 436 761 valeurs numériques**, avec unités, NULL, conventions et statut provisoire 2025 conservés.
- **265 tests Python, 253 TypeScript**, build/lint/typecheck, audits de sécurité et suites SQL public/extensions réussis. Référence climatique, migrations et géométries originales inchangées.
- Recette réelle à **1440/768/390**, même canevas entre les trois espaces, empreintes API/carte/fiche cohérentes. Les **68 PRA sans climat restent renseignées en agriculture**.

Commit fonctionnel validé : `60090e83e3b06133db5d8d318fece3a15326b96d`. CI : `ci-functional.json`. Preview : https://agriclimax-4rscsoh29-mehdi-sines-projects.vercel.app . Le navigateur de recette utilise une passerelle locale en lecture seule vers cette Preview avec vérification HTTPS normale, sans mocks ni contournement TLS ; `preview/browser-real.json` en précise le transport.

## Périmètre scientifique

RPG = déclarations PAC, pas toute la surface agricole. Le groupe source25 présente deux libellés officiels contradictoires : il reste dans le dénominateur surfacique mais n’est pas proposé comme culture qualifiée. Les statuts SAA, unités et séries révisées restent ceux de la source. Les références agricoles 2025 et climatiques 2026 sont distinguées ; aucune perte, sensibilité au stade ou surface touchée n’est estimée. Ces limites de définition sont affichées et ne constituent pas une acquisition régionale manquante.

Le contrôle final de reprise a restauré l’attribution de 770 identifiants partagés, puis reconstruit les index de l’audit. Les treize checkpoints de surfaces sont restés byte-identiques ; leurs digests d’identifiants correspondent tous. La publication refuse un audit périmé et peut figer explicitement une cohorte auditée.

**La PR #54 reste draft. Aucun merge, aucune mise en production.** Cette décision ouvre la revue UX agricole ; elle ne valide pas un modèle de risque agronomique.
