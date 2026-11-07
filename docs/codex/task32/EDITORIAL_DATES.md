# Dates éditoriales françaises

`features/journal/ui/editorial-dates.ts` centralise l’affichage, avec `Intl.DateTimeFormat('fr-FR', {timeZone:'UTC'})`.

| Entrée | Présentation |
| --- | --- |
| 2026-11-08 | 8 novembre 2026 |
| 2026-11-08 → 2026-11-14 | du 8 au 14 novembre 2026 |
| 2026-10-30 → 2026-11-04 | du 30 octobre au 4 novembre 2026 |
| 2026-12-30 → 2027-01-03 | du 30 décembre 2026 au 3 janvier 2027 |
| Même journée | le 8 novembre 2026 |
| Cycle 2026-11-07T00:00:00Z | 7 novembre 2026, 00 h UTC |

`frenchPeriod` privilégie les dates structurées. `editorialText` transforme uniquement les chaînes affichées : d’abord les périodes « du ISO au ISO », puis les horodatages UTC, puis les dates ISO isolées. Cela couvre aussi les textes factuels hérités de T31, les productions, les éclairages et les résumés régionaux. Les unités, valeurs, seuils et assertions restent inchangés.

Périmètre : titre, chapeau, période principale, chiffres de une, article, éclairages, filières, régions et carte. Les identifiants, URLs, cycles transmis aux API, preuves techniques, empreintes et stockage conservent leurs formats d’origine. Le dossier JSON reste inchangé. La transformation ne doit jamais être appliquée à un URL ni à un objet de contrat entier.

Six tests de formatage couvrent mois, changement de mois/année, journée unique, UTC et conservation des données structurées. La recette navigateur contrôle l’absence de dates ISO brutes dans les contenus éditoriaux visibles, sur les trois largeurs.
