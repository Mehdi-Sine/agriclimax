# OPS-07 — résultat et diagnostic

## Production le 13 novembre 2026

- [Journal du 13 novembre](https://agriclimax.vercel.app/journal?date=2026-11-13)
- [Cartes du 13 novembre](https://agriclimax.vercel.app/cartes-du-jour?date=2026-11-13)

Édition de secours `35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222`,
révision 2, empreinte `bd1a261966ef5b01aa3a7373e639ca1230fa44d90f58a8c83a3d3696e97b349f`.
Les API de production retournent cette édition et dix cartes publiées. Les dix
payloads, leurs empreintes, les 713 identités par carte, unités, périodes et
qualifications passent `verifyBundle`. Les captures navigateur ordinateur/mobile
montrent les deux pages, sans débordement horizontal ni erreur JavaScript.

Les cinq cartes de réanalyse portent sur le 31 octobre–6 novembre : 645 PRA
qualifiées, 68 indisponibles. Les cinq cartes prévisionnelles portent sur les
14–15 novembre : 713 PRA qualifiées. Le texte cite ses propres périodes, issues
du briefing, et les cartes affichent explicitement leur période et leurs limites.
Aucune valeur absente n'est remplacée ; légendes et règles scientifiques inchangées.

Le statut technique `needs_editorial_review` conserve une réserve sur les phrases
de présentation. Il n'impose aucune validation humaine quotidienne dans le
circuit expérimental OPS-06. La validation du secours ne contient aucune erreur.
L'avertissement expérimental, la nature prévisionnelle et l'absence de dommage
agricole évalué restent visibles.

Snapshot gelé `37da3d50e7da9ce8fd6958ce5aa2a46ff483f210bb4d038917ae990c33bed705` :
comparaison intégrale avant/après identique. Archive IA source
`e57437494a5d64a83f429cccacf5c4b4b5120bb35f44d123d6798d76a89d17da` :
empreinte `9a3267e1f294401690cadff3fc6769f6029fe274347d4cfa2d8081b136abfc93`
conservée avec son rejet `REGIONAL_EXTRAPOLATION`. Zéro nouvelle acquisition et
zéro nouvel appel OpenAI. La republication des cartes retourne `already_published`.

Preuves : [vérification des payloads](evidence/verification.json),
[recette navigateur](evidence/browser/report.json), captures associées.

## Cause du blocage OPS-06 et correction appliquée

La réponse OpenAI du 13 novembre a été archivée avant le rejet scientifique.
`archiveFactualFallback` crée un nouvel identifiant déterministe, puis appelle
`archive_save`. L'insertion échouait avec SQLSTATE `23503`, contrainte
`editorial_archives_id_fkey` : le nouvel identifiant n'avait aucun enregistrement
dans `editorial_runs`. Le mock TypeScript sauvegardait une Map en mémoire et
ne reproduisait pas cette contrainte. Le run source restait `outcome_unknown`,
sans `archive_id`, bien que sa réponse et son archive soient présentes.

La migration `20261113120438_ops07_factual_fallback_ledger.sql`, appliquée et
relue sur le projet partagé, ajoute un trigger privé `SECURITY INVOKER` avant
insertion. Pour une révision factuelle d'une archive IA rejetée, il crée
atomiquement un registre `factual_fallback`, `completed`, coût nul, lié au parent.
Il exige même briefing/date, révision suivante, validation sans erreur, absence
de reçu fournisseur et d'illustrations IA. Le stop d'urgence reste bloquant.
La FK, les RPC, les contrôles de checksum, la sérialisation et l'immuabilité
restent actifs. Aucun ancien enregistrement n'est réécrit. Le code OPS-06 déjà
sur main bénéficie immédiatement du correctif pour les prochains matins.

La reprise a relu l'archive existante, produit le secours déterministe existant,
puis utilisé `int01_maps.ts publish-experimental` depuis les entrées gelées.
La sélection publique attend toujours le commit des cartes vérifiées.

## Stations : faits établis et limites du diagnostic

Le [diagnostic existant](evidence/stations-existing-diagnostic.json) du run
`43364269336` porte sur les 6–12 novembre, cinq stations et 210 lignes. Il ne
rejette que les cinq stations du **12 novembre**, pour absence de toutes les
variables requises ; les six journées précédentes n'ont pas de rejet.

210 = 5 stations × 7 dates × 6 variables de l'enveloppe interne. L'adaptateur
émet ces lignes même lorsque la date source ou ses valeurs manquent : ce nombre
ne prouve donc pas la présence de 210 mesures brutes. L'intersection des stations
valides sur toute la fenêtre devient vide dès que la dernière journée manque
pour les cinq stations. Aucune erreur de normalisation (`issues: []`) n'est
rapportée ; ce n'est pas un échec d'unité ou de décodage démontré.

| Champ DPClim | Variable interne | Unité source | Granularité | Obligatoire |
|---|---|---|---|---|
| TN | temperature_min | degC | quotidienne, date source | oui |
| TX | temperature_max | degC | quotidienne, date source | oui |
| TM | temperature | degC | quotidienne, date source | oui |
| UM | humidity | % | quotidienne, date source | oui |
| RR | precipitation | mm | quotidienne, date source | oui |
| ETPMON | etp_monteith | mm | quotidienne, date source | non |

`ETPMON` n'est pas assimilé à une ET0 homologuée. La date est conservée comme
étiquette quotidienne source (`daily_source_date_label`), sans nouvelle
interprétation de sa fenêtre physique. Les règles existantes exigent des valeurs
non nulles quotidiennes pour TN/TX/TM/UM/RR sur toute la fenêtre, des unités
compatibles, des valeurs physiques admissibles, une provenance non future, et
aucun problème de normalisation. Les échantillons DPObs t/u/rr1 (horaire/récent,
K/%/mm) ne fournissent pas ces cinq agrégats quotidiens et ne les remplacent pas.

**Limite : les CSV bruts de ce run stations n'ont pas été conservés dans les
artefacts du workflow.** La base ne contient pas non plus de batch DPClim pour
ces dates (seulement des échantillons DPObs récents). On ne peut pas départager
rétrospectivement une ligne source absente d'une ligne entièrement vide. Le retard
de mise à disposition de J−1 est l'hypothèse compatible avec le diagnostic ;
aucun renommage de colonne ni conversion nouvelle n'est justifié par ces preuves.

La stratégie automatique T36 et le CLI quotidien prennent désormais sept dates
J−8 à J−2. Les dates effectives restent transportées dans les résultats ; ce
recul conservateur ne garantit pas la complétude. Si une date est absente ou
entièrement vide, la source est déclarée `daily_source_unavailable` / `no_new_data`
avec conservation de la publication précédente. Les erreurs techniques restent
distinctes. Le Journal continue avec ses autres sources qualifiées.

Les nouveaux diagnostics conservent, pour chaque station/jour refusé, les champs,
unités source, granularités, présence/absence des valeurs et checksum du CSV,
ainsi que la distinction date absente/valeurs vides. Aucune valeur n'est inventée.
**Aucune collecte réelle du 13 novembre n'a été relancée pour essayer J−2** :
la disponibilité réelle de la prochaine fenêtre sera constatée au prochain run.

## Tests

- 204 tests Vitest éditoriaux/nocturnes réussis, dont le rejeu réel du 13 novembre
  dans `ops07.test.ts`. Le fixture contient briefing et texte rejeté, sans reçu
  fournisseur ni secret. Rejet conservé, secours admissible, idempotence, un seul
  appel simulé, texte factuel littéral et briefing inchangé.
- 62 tests Python et 12 sous-tests réussis sur daily, l'adaptateur Météo-France et
  les retries T36. Régression 210 lignes, cinq stations, dernière date absente ou
  entièrement vide, aucune persistance/publication ; fenêtre J−2 et classement
  `no_new_data` vérifiés. 15 tests unittest T36 réussis.
- PostgreSQL 17 local : migrations éditoriales réelles, rôle `service_role`, FK
  conservée ; tests OPS-02, OPS-03, ledger et OPS-07 réussis. OPS-07 est ajouté
  au runner SQL CI et vérifie insertion atomique, coût nul, immuabilité,
  idempotence et refus d'un secours encore rejeté.
- TypeScript web et scripts éditoriaux : réussi. Ruff et mypy strict sur les trois
  modules Python concernés : réussis. Contrôles secrets, migrations forward-only
  et `git diff --check` : réussis.
- Avis Supabase avant/après : aucun nouvel avis. Les avis préexistants PostGIS et
  fonctions publiques sont hors périmètre ; les tables éditoriales privées restent
  fermées aux rôles publics ([référence RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).

## Revue des détections Gitleaks CI

Le scan de tout l'historique a signalé quatre correspondances `generic-api-key` :
les deux descripteurs publics `forecast/frost/Normandie` et
`forecast/frost/Occitanie` dans le briefing réel ; un UUID de bail d'acquisition
terminée (inutilisable sans la clé serveur et retiré de l'export actuel) ; et
`scientific_tokens_sha256`, empreinte publique préexistante du commit UX-02B.
Aucune clé fournisseur, clé Supabase ou identité d'authentification n'est présente.
`.gitleaksignore` ne cible que ces trois empreintes historiques exactes
(commit/fichier/règle/ligne ; les deux descripteurs partagent une ligne).
Aucune exclusion de chemin, de règle ou de nouveaux commits n'est ajoutée.
