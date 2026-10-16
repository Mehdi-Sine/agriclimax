# Performance locale sur DEV

16 octobre 2026, build production Next local, données réelles Supabase DEV.
Trois requêtes HTML par vue et production, station 29075001 publiée, sans cache applicatif.
Temps total HTTP côté client de test, HTML décodé ; trafic local + sortie proxy vers DEV.
Pas de SLA, percentile ou test de charge déduit de ces petits échantillons.

| Vue | Min / médiane / max (ms), 6 lectures | HTML (octets) |
|---|---|---|
| Carte | 260 / 396 / 641 | 57483–58070 |
| Diagnostic | 287 / 403 / 519 | 28281–28469 |
| Historique | 252 / 392.5 / 428 | 26806–28549 |
| Veille | 245 / 335.5 / 442 | 27231–27503 |

Mesures navigateur TTFB/fin réponse/transfert dans `evidence/real-browser-report.json`.
RPC initial réel : 1505 ms / 281754 octets, latest + selected. Une lecture par rendu ;
validation serveur bornée à dix stations par production et sept jours par publication,
sélection SQL LIMIT 1 par fenêtre, statement_timeout 5 s, timeout fetch 10 s.
Budget JS/CSS gzip : 570843 octets sur 2097152. Le diagnostic ne transmet aucun
payload complet Task 17, série brute, paramètres complets ou provenance détaillée.
Les séries affichées dans Historique sont rendues sous forme de cellules, sans objet brut.

Preview Vercel : mesures à ajouter après création de la PR.
