# Diagnostiquer et rattraper une édition

Exécuter depuis la racine avec les dépendances verrouillées Python et pnpm 10.
Les secrets restent dans l'environnement sécurisé ; ne jamais les copier dans les commandes.

```sh
PYTHONPATH=engine/src:scripts .venv/bin/python scripts/journal_recover.py --edition-date 2026-11-11
PYTHONPATH=engine/src:scripts .venv/bin/python scripts/journal_recover.py --edition-date 2026-11-11 --execute
```

La première commande inspecte, la seconde prépare, génère/rejoue puis vérifie le parcours public. Aucun retry IA implicite : réponse persistée rejouée par les validateurs existants, tentative ambiguë bloquée, reprise payante seulement via l'autorisation existante de l'identité exacte du snapshot. Une archive consultable existante est réutilisée. Aucun secret ni activation globale modifié.

Pour acquérir uniquement des sources manquantes, avant tout gel : ajouter par exemple `--acquire stations forecast` à `--execute`. Les leases, cooldowns et plafonds sont conservés. Une erreur fournisseur n'interdit pas d'essayer la préparation avec les autres archives. Les stations utilisent la période exacte J-7 à J-1 de l'édition. Les observations instantanées historiques ne sont jamais retéléchargées comme si elles concernaient la date passée. IFS n'est conservé par le fournisseur que quelques jours ; utiliser les archives pour une date ancienne.

Alternative GitHub, après disponibilité du code et de la migration :

```sh
gh workflow run operational-journal.yml --ref codex/ops-03-journal-recovery -f stage=run -f edition_date=2026-11-11 -f recovery=true
# Après génération :
gh workflow run operational-journal.yml --ref codex/ops-03-journal-recovery -f stage=report -f edition_date=2026-11-11
```

Sans `--recover`/`recovery=true`, les entrées restent bornées à 05:40 Paris. Une reprise explicite le jour même capture son propre `input_cutoff_at`, sans déplacer le cutoff nominal ni remplacer un snapshot existant. Une reprise d'une date passée conserve le cutoff de cette date : aucune météo ultérieure ne devient une observation historique. Les gels insuffisants nouveaux sont conservés dans les diagnostics, pas dans le registre des snapshots exploitables : ils restent reprenables. Les anciens gels insuffisants ne sont pas supprimés automatiquement.

## Qualité

- Prévisions : mêmes âges maximums AROME 36 h, ARPEGE 60 h, IFS 72 h ; même validation native des 713 PRA. Un cycle antérieur peut rester qualifié et conserve son émission réelle.
- Sans prévisions : dossier rétrospectif possible avec réanalyse datant d'au plus dix jours, et au moins 571/713 PRA (80 %) disposant des quatre descripteurs qualifiés au dernier jour historique. C'est un seuil d'utilité nationale, pas un changement des seuils scientifiques par PRA. Pas de valeur imputée, ni de prévision inventée.
- Une réanalyse de plus de deux jours est explicitement historique. Référence, âge, nature, couverture et états d'acquisition sont transmis dans les limitations du briefing OpenAI, ainsi que la validité/les preuves structurées existantes.
- Stations : seule une fenêtre entièrement qualifiée par station est persistée. Une station défectueuse ne détruit pas les autres fenêtres. Si le lot est partiel, la publication agrégée précédente est conservée ; le checkpoint est `degraded`, jamais `success`.
- Sans faits qualifiés ou sans support national suffisant et sans prévisions valides : aucun article généré ; dernière édition conservée et datée.
- Les nouvelles éditions OPS-03 rejetées par le validateur restent dans l'archive de diagnostic et ne sont pas admises à la consultation. Les archives historiques ne sont pas réécrites.

## Première étape bloquante

Lire `editorial_acquisitions.checkpoint.report` puis `editorial_diagnostics` (`stage-DATE-*`). Les erreurs de préparation conservent `phase`, code, type et chemins JSON de validation sans valeurs fournisseur. Le reçu ne suffit pas : contrôler snapshot, run, archive, puis `/api/journal/availability` et `/journal`. La certification dans `editorial_publications` reste soumise aux règles de revue existantes ; la consultation expérimentale provient de l'archive réelle et n'est pas une certification.

Horaires existants conservés : acquisitions dès 02:15, préparation 05:40, génération 06:05, contrôles 06:30/06:45/07:00 Europe/Paris ; watchdog jusqu'à midi, rattrapage manuel ensuite. Les crons GitHub peuvent être retardés : seuls les contrôles de consultation prouvent la disponibilité. Aucun serveur de supervision ajouté.
