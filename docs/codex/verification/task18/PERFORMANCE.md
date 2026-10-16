# Performance locale sur DEV

16 octobre 2026, build production Next local, données réelles Supabase DEV.
Trois requêtes HTML par vue et production, station 29075001 publiée, sans cache applicatif.
Temps total HTTP côté client de test, HTML décodé ; trafic local + sortie proxy vers DEV.
Pas de SLA, percentile ou test de charge déduit de ces petits échantillons.

| Vue | Min / médiane / max (ms), 6 lectures | HTML (octets) |
|---|---|---|
| Carte | 286 / 369.5 / 436 | 57483–58070 |
| Diagnostic | 255 / 319 / 398 | 28281–28469 |
| Historique | 243 / 344.5 / 409 | 26806–28549 |
| Veille | 232 / 310 / 383 | 27231–27503 |

Mesures navigateur TTFB/fin réponse/transfert dans `evidence/real-browser-report.json`.
RPC initial réel : 1505 ms / 281754 octets, latest + selected. Une lecture par rendu ;
validation serveur bornée à dix stations par production et sept jours par publication,
sélection SQL LIMIT 1 par fenêtre, statement_timeout 5 s, timeout fetch 10 s.
Budget JS/CSS gzip : 570843 octets sur 2097152. Le diagnostic ne transmet aucun
payload complet Task 17, série brute, paramètres complets ou provenance détaillée.
Les séries affichées dans Historique sont rendues sous forme de cellules, sans objet brut.

Preview Vercel : non mesurée, HTTP 302 vers SSO avant l’application ; voir PREVIEW.md.

Reproduction : `E2E_BASE_URL=http://127.0.0.1:3000 E2E_STATION=29075001 node tests/e2e/live-performance.mjs`.
Le script refuse les états sans source/station, mesure sans enregistrer les corps réels
et vérifie les champs bruts et credentials dans chaque réponse.
