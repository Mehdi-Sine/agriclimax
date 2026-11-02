# Task22 — Résultats

**READY_FOR_FULL_CLIMATOLOGY**

Climatologie ERA5-Land **1991–2020**, Tmin/Tmax/Tmean/pluie : **713 PRA × 366
positions calendaires = 260 958 lignes dans la version active** sur agriclimax-dev.
92 checkpoints vérifiés par SHA256 et géographie ; caches conservés et aucune
réacquisition à la reprise finale. Le traitement initial avait achevé le calcul
et l'import après le dernier état intermédiaire à 51/92.

**941 700 normales disponibles** pour 645 PRA sur les 365 jours ordinaires.
Les 68 PRA au support incomplet gardent leurs comptes et NULL explicites.
**102 132 scalaires NULL**, 29 février compris. Aucun comblement, interpolation,
lissage ou THI ; méthode scientifique Task21 inchangée.

29 février : huit années réelles (compte 8 pour 645 PRA, 0 pour 68). La règle
Task21 exige 30 années : normale et anomalie NULL. Dates indexées dans le
calendrier bissextile 2000, sans décalage en mars les années non bissextiles.

| Mesure réelle | Résultat |
|---|---:|
| Acquisition/calcul initial, attente CDS incluse | 11,27 h |
| Sources transférées ; spool évincé après contrôle | 6,565 Go |
| Checkpoints PRA hors Supabase | 194,57 Mo |
| Import de la version active | 260 958 insertions / 94,02 s |
| Replay intégral de la version active | **0 insertion / 87,53 s** |
| Table + index, deux versions conservées | **51,74 Mo** |
| Base totale réelle | **141,69 Mo** |

Le contrôle direct a détecté une troncature à six chiffres significatifs lors
du premier export JSON Task21. Une nouvelle version reprend les float32 via
`float4send`, sans recalcul scientifique. La première version reste privée pour
traçabilité, mais l'API refuse sa lecture comme version remplacée. Il existe
521 916 lignes physiques, soit deux versions de 260 958 lignes ; `release.json`
désigne explicitement la version active correcte. Le budget de correction,
validé avant son import, reste sous 200 Mo avec marges et réserve.

Contrôles de la version active : empreinte binaire exhaustive des normales et
comptes SQL identique au cache ; **85 560 scalaires repris de Task21 comparés
directement en SQL, zéro différence**. Les **88 412 lignes Task21** et les
données actuelles conservent leurs empreintes initiales.

API réelle : **396 scalaires**, PRA 28341, 06245 et 29102, fenêtre
19/09–18/10/2026, 29/02–01/03/2024 et 01/01/2026. Réanalyse actuelle, normale,
anomalie serveur, unités, provenance, couverture et qualité vérifiées. NULL si
actuel ou référence absent. `extra_float_digits=3` préserve les valeurs JSON
pour reproduire strictement l'anomalie. Tests contre l'export arrondi et la
lecture d'une version remplacée ajoutés.

Validation : 36 tests climate finaux, SQL Task21/Task22, lint/types et gardes
sécurité/migrations passent. 246 tests Python et 237 web lors de l'implémentation ;
CI finale relancée après les corrections. RLS forcée et serveur uniquement,
garde réel de base à 375 Mo. Alertes historiques PostGIS/anciennes RPC inchangées.
Gitleaks : identifiants SHA256 vérifiés, exceptions historiques exactes seulement.

Preuves dans ce dossier : measurements.json, database-final.json,
task21-reuse-sql.json, stored-digest.json, cache-validation.json,
annual-manifest.json, import.json, replay.json et api-validation.json.
Caches sous work/task22 hors PostgreSQL/Supabase Storage ; workspace éphémère,
aucun archivage durable externe prétendu. **PR draft #51, aucun merge.**
