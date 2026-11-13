# EDIT-03 — Comparaison hors ligne

Sélection algorithmique ; contrôle de comité déterministe, sans appel IA. Valeur éditoriale = proxy à valider. Les données publiées sont inchangées.

## 2026-11-12

Avant : 10 cartes, une = première carte technique. Après : 6 cartes ; une proposée = temperature_min forecast.

| Carte | Nature | Avant | Après | Score marginal | Redondance | Motif |
|---|---|---:|---:|---:|---:|---|
| [temperature_min](https://agriclimax.vercel.app/cartes-du-jour?id=650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee&map=d5d377ea9554dcaa2e7f449016efcfd45c7205a3d82ecaea1a262b14199e25d5) | reanalysis | 1 | écartée | 27.16 | −16.2 | Score marginal 27.16 inférieur au plancher 45. |
| [temperature_mean](https://agriclimax.vercel.app/cartes-du-jour?id=650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee&map=91076f495582ecca8ad5f714b94ed2ddaa39c392fd7363fde332e79d8aa32142) | reanalysis | 2 | écartée | 14.95 | −19.99 | Score marginal 14.95 inférieur au plancher 45. |
| [rain](https://agriclimax.vercel.app/cartes-du-jour?id=650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee&map=fe300971142154eff46951e3a4a835271c5fa9e87c1e8ae26cbe2b9a7ab73bf6) | reanalysis | 3 | 3 | 56.91 | −0 | importance 26.51 ; agriculture 75 ; qualité 81.42 |
| [frost](https://agriclimax.vercel.app/cartes-du-jour?id=650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee&map=ba5c5ed960eebe012579fec6009376280a29f87af155b7ebfae9ee85b2d0bdb0) | reanalysis | 4 | 6 | 45.86 | −0 | importance 24.03 ; agriculture 75 ; qualité 81.42 |
| [gdd](https://agriclimax.vercel.app/cartes-du-jour?id=650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee&map=bdcec35cfd92dd979ad02adcee927e27a64d8f0859678b4f7ed8810105e31930) | reanalysis | 5 | 5 | 46.79 | −0 | importance 34.42 ; agriculture 25 ; qualité 81.42 |
| [temperature_min](https://agriclimax.vercel.app/cartes-du-jour?id=650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee&map=c794a212918c07818d2387366e8599b807b20270fcea7c32bb18646b0a0e82d6) | forecast | 6 | 1 | 62.25 | −0 | importance 38.92 ; agriculture 75 ; qualité 90 |
| [temperature_mean](https://agriclimax.vercel.app/cartes-du-jour?id=650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee&map=7507471a45f38ff237a5159a45aaf21d0d31c4d1bab73821d907859ff9a46170) | forecast | 7 | 4 | 50.45 | −0 | importance 10.66 ; agriculture 25 ; qualité 90 |
| [rain](https://agriclimax.vercel.app/cartes-du-jour?id=650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee&map=5842d0d24b5eee47ed0d13b1d0e2bd0fb6802548344a5cc3aa57429c7906247c) | forecast | 8 | 2 | 61.77 | −0 | importance 6.73 ; agriculture 75 ; qualité 90 |
| [frost](https://agriclimax.vercel.app/cartes-du-jour?id=650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee&map=74c3174ce6541ab37c0efe84cb9c235b2d90aff1885a1bbfbefb90c59e2d990c) | forecast | 9 | écartée | 43 | −14.23 | Score marginal 43 inférieur au plancher 45. |
| [gdd](https://agriclimax.vercel.app/cartes-du-jour?id=650ff674f40a90648b3e326b85c58e9bf7312e550c109e66ccea1e5a253597ee&map=d6f778124bcf6928c2628d0ce480909df21fd99c4aa0e6d177c7c93020103413) | forecast | 10 | écartée | 22.27 | −19.98 | Score marginal 22.27 inférieur au plancher 45. |

Indicateurs : 5 → 5 (frost, gdd, rain, temperature_mean, temperature_min). Familles : 3 → 3. Natures : forecast, reanalysis.

Régions évaluables : 13 → 13 ; régions avec seuil documenté : 10 → 10. Il s'agit de couverture et de seuils descriptifs, sans surface agricole ni impact déduit.

Valeur éditoriale estimée (moyenne des scores initiaux, diversité initiale identique) : 52.93 → 55.26/100. Ce proxy favorise mécaniquement les cartes conservées ; il ne constitue pas une évaluation humaine.

Coût supplémentaire réel : 0 € ; aucun appel IA. Dossier : 78399 octets ; supplément maximal d'entrée face à une liste d'IDs : 72088 tokens sous borne 1 octet/token.

- Scénario autonome gpt-6.1-terra : borne 0.098995 € avec 82495 tokens d'entrée et 1500 de sortie ; tarif openai-editorial-pricing-2026-11-09, cache non supposé.
- Scénario autonome gpt-6-luna : borne 0.0099 € avec 82495 tokens d'entrée et 1500 de sortie ; tarif openai-editorial-pricing-2026-11-09, cache non supposé.

[Scores, métadonnées et motifs complets](2026-11-12.json) · [Dossier du comité](2026-11-12-committee-request.json) · [Contrôle déterministe](2026-11-12-committee-control.json) · [Structure UX-03](2026-11-12-ux.json).

## 2026-11-13

Avant : 10 cartes, une = première carte technique. Après : 6 cartes ; une proposée = rain forecast.

| Carte | Nature | Avant | Après | Score marginal | Redondance | Motif |
|---|---|---:|---:|---:|---:|---|
| [temperature_min](https://agriclimax.vercel.app/cartes-du-jour?id=35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222&map=849e1864800f402d750362b1b3c9ff5fdea840df9b8d45bb50cc9e37ef3073f1) | reanalysis | 1 | écartée | 26.57 | −16.86 | Score marginal 26.57 inférieur au plancher 45. |
| [temperature_mean](https://agriclimax.vercel.app/cartes-du-jour?id=35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222&map=c6c332634ce19448e53b28a8df9e5ce4ae5f5f477df3d962006e1b68a13c806e) | reanalysis | 2 | écartée | 14.73 | −19.98 | Score marginal 14.73 inférieur au plancher 45. |
| [rain](https://agriclimax.vercel.app/cartes-du-jour?id=35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222&map=7307d13d6e5dc0e209fdc74ae0c00f5f5f1ea244529579ab5f00216f8b3383cc) | reanalysis | 3 | 3 | 59.33 | −0 | importance 34.57 ; agriculture 75 ; qualité 81.42 |
| [frost](https://agriclimax.vercel.app/cartes-du-jour?id=35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222&map=f0b57fdefb644445c6c8c8c9da501fc612eeb780fb8377aeb89f614cea7b8106) | reanalysis | 4 | 6 | 45.93 | −0 | importance 24.19 ; agriculture 75 ; qualité 81.42 |
| [gdd](https://agriclimax.vercel.app/cartes-du-jour?id=35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222&map=5695399ad69898e8919b16bab5f96b522591ae38be0b2957da5ed3bf5f463564) | reanalysis | 5 | 5 | 47.35 | −0 | importance 36.28 ; agriculture 25 ; qualité 81.42 |
| [temperature_min](https://agriclimax.vercel.app/cartes-du-jour?id=35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222&map=e9581197816167e5e80aaab2ea951a9b94691648f7bc348d9ef5a00e60628690) | forecast | 6 | 2 | 61.79 | −0 | importance 37.94 ; agriculture 75 ; qualité 90 |
| [temperature_mean](https://agriclimax.vercel.app/cartes-du-jour?id=35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222&map=eaaea46ee426d60024f3c87bc3feba12e90c4bc16c880fc8482c8fd08c0274fd) | forecast | 7 | 4 | 52.8 | −0 | importance 18.51 ; agriculture 25 ; qualité 90 |
| [rain](https://agriclimax.vercel.app/cartes-du-jour?id=35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222&map=a7e78ee1f6eedede0dfb8afff84b88ebb2b26595c1d2755b3d3437c5215cfac0) | forecast | 8 | 1 | 72.67 | −0 | importance 43.06 ; agriculture 75 ; qualité 90 |
| [frost](https://agriclimax.vercel.app/cartes-du-jour?id=35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222&map=43656509aae3fe6a009139001594d83882f4d095d089600debf38cc82d7f1ec3) | forecast | 9 | écartée | 42.88 | −13.85 | Score marginal 42.88 inférieur au plancher 45. |
| [gdd](https://agriclimax.vercel.app/cartes-du-jour?id=35d91c82ce9e11e6d93526499955492f240d3704b5ea3ea242ddb859d8a28222&map=d1b1a0e83c652ccf1bfb58d1a9626c4323eca61b0ae86e709c861f5f66a63ac6) | forecast | 10 | écartée | 22.26 | −19.99 | Score marginal 22.26 inférieur au plancher 45. |

Indicateurs : 5 → 5 (frost, gdd, rain, temperature_mean, temperature_min). Familles : 3 → 3. Natures : forecast, reanalysis.

Régions évaluables : 13 → 13 ; régions avec seuil documenté : 10 → 10. Il s'agit de couverture et de seuils descriptifs, sans surface agricole ni impact déduit.

Valeur éditoriale estimée (moyenne des scores initiaux, diversité initiale identique) : 54.45 → 57.9/100. Ce proxy favorise mécaniquement les cartes conservées ; il ne constitue pas une évaluation humaine.

Coût supplémentaire réel : 0 € ; aucun appel IA. Dossier : 79290 octets ; supplément maximal d'entrée face à une liste d'IDs : 72979 tokens sous borne 1 octet/token.

- Scénario autonome gpt-6.1-terra : borne 0.099975 € avec 83386 tokens d'entrée et 1500 de sortie ; tarif openai-editorial-pricing-2026-11-09, cache non supposé.
- Scénario autonome gpt-6-luna : borne 0.009998 € avec 83386 tokens d'entrée et 1500 de sortie ; tarif openai-editorial-pricing-2026-11-09, cache non supposé.

[Scores, métadonnées et motifs complets](2026-11-13.json) · [Dossier du comité](2026-11-13-committee-request.json) · [Contrôle déterministe](2026-11-13-committee-control.json) · [Structure UX-03](2026-11-13-ux.json).

## Recommandation

GO pour la revue en simulation isolée. NO-GO pour l'activation quotidienne : validation éditoriale des pondérations, évaluation qualitative réelle du comité IA, calibrage sur davantage d'éditions et contrôle du budget de l'appel unique requis. Aucun déploiement ni changement du cycle OPS-07.
