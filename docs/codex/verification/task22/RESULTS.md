# Task22 — Résultats

**READY_FOR_FULL_CLIMATOLOGY**

Climatologie ERA5-Land **1991–2020**, Tmin/Tmax/Tmean/pluie, calculée et stockée
sur agriclimax-dev : **713 PRA × 366 positions calendaires = 260 958 lignes**.
Les **92 checkpoints SHA256** sont présents et vérifiés ; aucun téléchargement
ni recalcul historique lors de la reprise finale. Le traitement de fond avait
achevé les acquisitions et l'import après le dernier état intermédiaire à 51/92.

**941 700 normales disponibles** pour 645 PRA sur 365 jours ordinaires.
Les 68 PRA au support spatial incomplet sont conservées avec comptes et NULL
explicites. Total : **102 132 scalaires NULL**, 29 février compris. Aucune
interpolation, aucun lissage et aucun THI. Méthode scientifique Task21 inchangée.

29 février : huit années réelles dans 1991–2020 (compte 8 pour 645 PRA, 0 pour
les 68 autres). La règle Task21 exige 30 années : normale et anomalie restent
NULL. Les 365 autres dates sont présentes ; correspondance calendaire ancrée
en 2000 pour éviter tout décalage en mars les années non bissextiles.

| Mesure réelle | Résultat |
|---|---:|
| Acquisition + calcul, attente CDS incluse | 11,27 h |
| Sources transférées, spool évincé après contrôle | 6,565 Go |
| Checkpoints PRA hors Supabase | 194,57 Mo |
| Import initial | 260 958 insertions / 108,64 s |
| Replay final intégral | **0 insertion / 90,93 s** |
| Table compacte + index | **25,90 Mo** |
| Base totale réelle | **115,49 Mo** |

Contrôle exhaustif : empreinte des valeurs float32 binaires et comptes SQL
identique à celle du cache pour les 260 958 lignes. Les **88 412 lignes Task21**
et les données actuelles ont leurs empreintes initiales inchangées ; les
**85 560 scalaires quotidiens Task21** sont réutilisés exactement.

API réelle : **396 scalaires**, PRA 28341, 06245 et 29102, fenêtre du
19/09–18/10/2026, 29/02–01/03/2024 et 01/01/2026. Valeur actuelle de réanalyse,
normale, anomalie calculée côté serveur, unités, provenance, couverture et
qualité vérifiées. Observations/références absentes donnent une anomalie NULL.
Le réglage de sérialisation `extra_float_digits=3` corrige la troncature JSON
préexistante à six chiffres significatifs, sans changer les valeurs stockées
ni le calcul scientifique. La vérification des différences reste stricte.

Validation : 246 tests Python et 237 web lors de l'implémentation ; 35 tests
climate, lint/types, gardes migrations et SQL Task21/Task22 rejoués à la clôture.
RLS forcée et droits serveur uniquement, garde de base réelle à 375 Mo par lot.
Les avertissements historiques PostGIS/anciennes RPC restent inchangés.

Preuves : measurements.json, database-final.json, stored-digest.json,
cache-validation.json, annual-manifest.json, import.json, replay.json et
api-validation.json. Caches sous work/task22, hors PostgreSQL et Supabase Storage ;
aucune durabilité du workspace éphémère n'est supposée. PR draft #51, aucun merge.
