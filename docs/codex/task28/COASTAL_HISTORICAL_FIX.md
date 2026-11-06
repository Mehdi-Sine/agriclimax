# Correction historique littorale — diagnostic et jalon initial

Branche exclusive `codex/28-agroclimatic-v1`, PR draft #56 conservée.

Frontières affectées : lecture des supports Task26D, qualification scientifique historique versionnée, contrats de résultats, carte/fiche Analyse et raccordement Climat. Aucune acquisition, migration, automatisation ou géométrie officielle modifiée.

Le lecteur agroclimatique exige actuellement `status=available` et `coverage>=0.9999` pour les archives et le repli national. Le calcul exige ensuite `complete=true`. Le lecteur Unified ne qualifie les supports que sur une seule journée et pour Tmoy/pluie. Le composant Analyse exclut explicitement les géométries de support de NationalMap. Ces trois barrières masquent les restitutions partielles déjà validées.

Les supports réellement exposés comprennent 36 PRA à couverture >=90%, 31 entre 0 et 90%, Crozon sans support. Le catalogue et le bundle versionné fournissent actuellement les journées 27–31 octobre ; les archives strictes plus anciennes ne contiennent que les agrégats PRA, NULL sur les supports incomplets, sans valeurs de cellules. Les artefacts GitHub de checkpoints natifs ont été identifiés, mais leur téléchargement est refusé par le transport (403). Aucune acquisition alternative ne sera lancée pour masquer cette absence.

Politique de correction : conserver le calcul strict 1.0.0 accessible ; qualifier Tmoy, GDD et pluie sur un support observé prouvé et stable. Les événements de pluie ne peuvent décrire que le franchissement du seuil de la moyenne de ce support, pas un événement garanti sur toute la PRA. Les extrema/gel/chaleur ne seront pas inférés de Tmoy. Une période incomplète ou dont le support change reste NULL, même si chaque journée a une valeur sur des supports différents.

Les tableaux avant/après, l'inventaire résiduel et les preuves de recette seront ajoutés à la clôture.
