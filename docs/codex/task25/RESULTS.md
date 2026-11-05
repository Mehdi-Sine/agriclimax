# Résultats Task25

La publication nationale repose sur les treize livraisons RPG2025 officielles, les séries SAA réellement acquises et le référentiel original des 713 PRA, dont six corses. Aucune donnée de démonstration n’alimente ces rubriques.

## RPG2025 national

- **13 régions sur 13 ; 713 PRA renseignées ; 22 groupes source qualifiés.**
- **9 721 133 parcelles lues**, 14 659 occurrences d’identifiants identiques exclues, 148 géométries invalides réparées en copie de travail.
- **27 792 417.506253ha** restitués dans les PRA, par intersections réelles en EPSG:3035.
- 556.134909ha de recouvrements internes et 0.317937039ha interrégionaux exclus ; **9629.827855ha hors du snapshot PRA**, comptabilisés séparément.
- 50762 paires candidates interrégionales, 1439 parcelles avec recouvrement positif. Tous les contrôles région×groupe passent ; résidu maximal 1.88e-07ha, sous la tolérance de 0,001ha.

Les totaux sont des surfaces géométriques de déclarations PAC, pas une mesure exhaustive de l’agriculture. Les comparaisons aux hectares déclarés source et les exemples blé/maïs/orge/colza/prairies/vigne figurent dans `rpg-national-samples.json`. Aucun rapprochement arbitraire avec les estimations SAA.

Les digests de propriété des identifiants correspondent aux treize checkpoints (`identity-ownership-audit.json`). L’ancienne réhydratation de l’index avait déplacé 770 identifiants partagés ; leur propriété a été restaurée depuis la source vérifiée, puis tous les index de l’audit ont été reconstruits. Les treize checkpoints de surfaces sont restés strictement byte-identiques (`regional-checkpoints-unchanged.json`). La publication refuse un audit périmé et peut figer explicitement une cohorte auditée.

## SAA conservée et vérifiée

Deux XLSX officiels 2010–2025 : **128 productions, 496 indicateurs, 29 350 séries, 436 761 valeurs numériques**. La comparaison de **469 600 cellules, NULL compris**, et des unités/statuts/anomalies aux fichiers conservés est conforme (`saa-source-fidelity.json`). Une qualité non renseignée reste NULL.

Contrôle blé tendre 2025 : total France = somme départementale = **4 494 355ha** ; Seine-et-Marne **117 468ha**, Corse-du-Sud **2ha**, Haute-Corse **75ha**. Les contrôles nationaux passent pour 2 943/2 944 sommes à la tolérance d’arrondi. L’unique écart de +2ha en 2010 vient de la cellule source −2 restituée NULL, sans compensation fabriquée. Les fichiers bruts et leurs empreintes restent disponibles hors Git.

## Application et validation

La même carte persistante dessert Climat, Productions et Analyse. Les statistiques SAA restent à leur maille départementale/régionale ; le RPG est à la PRA. Le croisement blé distingue aléa observé et contexte PAC2025, sans stade, dommage ni surface touchée estimés. Les **68 PRA climatiques indisponibles ont toutes un contexte agricole connu** (`coverage-independence.json`).

Validation du commit fonctionnel `60090e83e3b06133db5d8d318fece3a15326b96d` : **265 tests Python, 253 TypeScript**, build/lint/typecheck, contrôles de contrats, migrations, secrets et budget réussis. Recettes locales et Preview réelles, sans mocks, à **1440/768/390px**, 13 captures par environnement. Elles vérifient aussi le même canevas entre espaces, les unités volailles régionales, le millésime 2010 et les parcours stationnels, dont le THI.

Preview : https://agriclimax-4rscsoh29-mehdi-sines-projects.vercel.app . Transport de recette distant : passerelle locale en lecture seule vers cette Preview, HTTPS amont normalement vérifié ; aucune désactivation TLS ni modification du magasin de confiance personnel. Les valeurs et l’empreinte API/carte/fiche correspondent à `07afe77f98583d05f83f476be44bdaf3de89f77b55d9935459253c7a079a8d30`. Les détails CI sont conservés dans `ci-functional.json` et `validation.json`.

Le socle scientifique, les migrations et les géométries originales sont inchangés depuis la base Task24 (`foundation-unchanged.json`). Aucun merge ni déploiement en production.
