# Décision de livraison — Task 30

Livraison sur la branche unique `codex/30-national-agroclimatic-watch`, PR **#58 maintenue en draft**. Aucun merge ni déploiement production.

## Résultat livré

1. **Phénomènes détectables** : chaleur, gel, pluie quotidienne importante, séquences sans pluie significative et THI synthétique, à partir du cycle national vérifié. Les anomalies de température et écarts de précipitations utilisent séparément les références homologues ERA5-Land complètes.
2. **Situations réelles** : cycle du 7 novembre, horizon 8–14 novembre, 296 PRA au critère gel, 117 au critère pluie, 63 au critère de séquence sèche. Aucun événement de chaleur ou THI inventé. La réanalyse du 31 octobre porte explicitement son retard.
3. **Classement** : convention éditoriale déterministe par dépassement relatif, durée, effectif territorial et identifiant stable. Dénominateurs explicites, pas de moyenne nationale non pondérée, ni probabilité de dommage.
4. **Productions** : maïs, vigne, vergers et prairies, en plus du contexte blé, joints aux groupes RPG publiés. Les phénomènes sont calculés une seule fois. Les données SAA gardent leurs mailles départementales et régionales.
5. **Palettes** : registre `semantic-1.0.0` partagé entre Climat, météo, Analyse, Productions, Veille et aide. Classes fixes, pluie bleue, déficit sec, anomalie thermique centrée sur zéro, gel froid, chaleur/THI chauds, degrés-jours ocres et productions vertes. NULL, supports partiels et reconstructions restent distincts.
6. **Comparaison temporelle** : deux cycles réels comparés, ancien cycle réellement conservé affiché avec avertissement, invariance des classes vérifiée par tests. Cache indexé sur archive et versions, invalidation automatique, ETag pour les relectures identiques.
7. **Performance** : réponse nationale réduite à environ 668 ko ; calcul local voisin d’une seconde ; 304 sans corps pour une identité inchangée ; bundle complet sous 630 ko gzip. Le rendu initial des contours reste le poste le plus visible, mesuré et documenté.
8. **Recette** : 311 tests web, lint, build et contrôles de secrets/budget ; comparaisons indépendantes des valeurs ; parcours réels desktop/tablette/mobile et Preview ; simulations de chargement isolées. Détails, captures et résultats dans `ACCEPTANCE.md` et `evidence/`.
9. **Limites scientifiques** : sources exploratoires, extrêmes échantillonnés, représentativité littorale non garantie, humidité souvent insuffisante pour le THI, aucune référence inter-modèles implicite, aucune sensibilité/stade ou perte agricole modélisée. La présence RPG 2025 ne prouve pas qu’une culture est en place à la date d’un événement de 2026.
10. **Suite pour bêta-test** : revue éditoriale et scientifique des seuils descriptifs et du classement, suivi du coût réel en serverless, supervision séparée du cron existant et revue d’accessibilité manuelle complémentaire. Aucun de ces sujets n’est présenté comme une validation agronomique acquise.

## Verdicts indépendants

Les verdicts reposent sur la recette réelle documentée, pas seulement sur les tests unitaires. Ils désignent une V1 exploratoire prête à revue ; ils n’autorisent pas une mise en production.

| Verdict | Décision | Preuves |
|---|---|---|
| `READY_FOR_NATIONAL_WATCH_V1` | READY | cycle national réel, 713 PRA, provenance, dénominateurs, état THI absent/insuffisant, calculs indépendants et comparaison de cycles |
| `READY_FOR_SEMANTIC_CARTOGRAPHY` | READY | registre commun, invariance temporelle, anomalies valides seulement, pluie bleue, surfaces partielles et reconstruction conservées |
| `READY_FOR_EDITORIAL_HELP` | READY | aide publique générée depuis les palettes et les deux catalogues d’indicateurs ; liens contextuels testés |
| `READY_FOR_RESPONSIVE_UX` | READY | parcours réels à 1440/768/390 px, URL et retour, clavier, lenteur/erreur et réduction de mouvement |
| `READY_FOR_BETA_REVIEW` | READY pour revue | Preview réelle utilisable et preuves ci-dessus, avec réserves scientifiques et opérationnelles explicites |

Les synthèses ne sont pas persistées dans une nouvelle table : les archives sources conservées, les règles versionnées, les identités et les snapshots de recette permettent leur reproduction. Le cache de calcul est local à chaque instance, sans garantie de coût monétaire universel. Les mesures de durée ne sont pas une certification de performance ni de conformité WCAG.
