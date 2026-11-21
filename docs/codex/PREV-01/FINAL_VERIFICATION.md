# Vérification finale

| Critère | Résultat |
| --- | --- |
| Transport natif | Deux index privés retrouvés. Deux cycles opérationnels sur le candidat local et 106 contrôles HTTP réussis. La production publique des cycles du 14, du 15 et du 20 novembre sert 713 lignes IFS sans preuve native. |
| Contrats scientifiques | Sept règles Explorer et huit recettes descriptives équivalentes au contrat source pour le paquet. Les autres règles restent absentes des registres actifs. |
| 1 185 recalculs | Rejeu individuel complet. 660 résultats vérifiés sur les vraies routes par modèle et 525 refusés comme indicateurs absents d’Explorer. |
| 713 PRA et six corses | Contrôles de cardinalité, d’identité et du rendu navigateur. |
| AROME / ARPEGE / IFS | [Campagne et reproduction](NATIONAL_MATRIX.md) |
| Performance | [Mesures locales et seuils](PERFORMANCE.md) |
| Cartes interactives | Températures AROME, ARPEGE et IFS, puis pluie qualifiée 709/4/0 et absence 0/0/713 aux trois largeurs. Sélection de cycle, d’échéance et de PRA corse contrôlée dans Chromium. [Contrôles et captures](UX_VALIDATION.md) |
| Historique ERA5 | Neuf rendus Chromium sur ERA5 et le THI historique aux trois largeurs. Les cas température et pluie restent à 681 entières, 31 partielles et une grise. La preuve ERA5 reste vérifiée après la désactivation locale du lecteur prévisionnel. |
| Archives du Journal | Dix cartes publiées et dix miniatures comparées octet pour octet à l’origine publique. Journal et Cartes du jour vérifiés aux trois largeurs. |
| Production | **NO-GO**. Paquet composite absent du stockage distant. Le cycle courant est absent du registre privé de preuves vérifié. Seuils de latence non reproductibles sur les parcours mesurés et canari Vercel non vérifié. |

Le build Next de production, le lint des fichiers modifiés et les 13 tests ciblés passent. La suite web générale intermédiaire a donné 817 réussites et 15 tests facultatifs ignorés. L’audit privé a relu 260 objets et 172 331 262 octets en lecture seule. Les empreintes de `catalogue.json` et `current.json` sont identiques avant et après.

Aucune acquisition fournisseur, aucune mutation Storage ou Vercel, aucune réécriture d’archive et aucun changement des workflows éditoriaux. Les rapports détaillés et les octets privés restent hors du dépôt.
