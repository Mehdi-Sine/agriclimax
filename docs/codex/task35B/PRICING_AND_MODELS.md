# Modèles, API et tarifs vérifiés

Vérification documentaire publique : **9 novembre 2026**. L'accès d'un projet est distinct : aucun GET authentifié ni génération n'a été effectué pendant cette PR. `verify-model` permettra au propriétaire de contrôler sa clé et le modèle réellement accessible ; le reçu vaut 24 heures. Un modèle documenté peut rester indisponible dans son projet.

Sources officielles :

- [GPT-6.1 Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra.md)
- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna.md)
- [Tarification API](https://developers.openai.com/api/docs/pricing.md)
- [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching.md)
- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs.md)
- [Cours de référence BCE](https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml)

La documentation confirme Responses, structured_outputs, texte en entrée/sortie et reasoning.effort low pour les deux candidats. Le transport utilise `text.format` avec `type:json_schema`, `strict:true`, tous les champs requis et objets fermés. La disponibilité GET ne constitue pas une génération de validation du schéma : la conformité effective d'une première réponse sera évaluée lors du seul essai autorisé.

| Modèle | Entrée Standard USD / million | Sortie USD / million | Écriture cache 30 min USD / million |
| --- | ---: | ---: | ---: |
| gpt-6.1-terra | 1,00 | 5,00 | 1,25 |
| gpt-6-luna | 0,10 | 0,50 | 0,125 |

Ces valeurs proviennent des pages officielles, pas des fixtures T35. Les écritures de cache sont facturées à un tarif distinct, non additionnel. Pour ne pas les sous-estimer, le profil impose `prompt_cache_options:{mode:"explicit",ttl:"30m"}` sans breakpoint : aucune écriture implicite. Aucun avantage de cache, Batch ou Flex n'est supposé. `service_tier:"default"` exclut Fast. Un majorant régional de 10 % est conservé même sur l'endpoint standard.

La dernière publication BCE obtenue date du 6 novembre 2026 : 1 EUR = 1,1165 USD, soit environ 0,8957 EUR/USD. Le majorant choisi est **1 EUR/USD**, puis le facteur régional 1,10 : taux de réservation Terra 1,10 / 5,50 EUR par million et Luna 0,11 / 0,55. La grille expire après sept jours et doit être revérifiée explicitement, sans mise à jour automatique de tarifs ou de plafonds.

Au-delà de 272 000 tokens d'entrée, les prix changent : le premier protocole refuse ce contexte plutôt que d'utiliser le prix court. Sur le vrai replay du 30 octobre, la borne est d'environ 100 555 tokens (requête entière, schéma, instructions et réserve inclus), inférieure à ce seuil. Les tokens de raisonnement sont compris dans la borne de sortie de 6 000.

Estimations conservatrices hors ligne : **0,143611 € pour Terra**, **0,014361 € pour Luna**, sous 0,15 €. Le budget réellement disponible est inconnu sans le store financier autoritaire : `estimate` retourne donc `allowed:false`. `preflight` relit le registre réel ; un refus précise entrée, sortie, réserve, plafond édition et reste mensuel. Aucune bascule automatique vers Luna et aucun relèvement des limites.

Après un appel, `usage` désigne les tokens réellement retournés ; `accounted_cost_upper_eur` est le coût calculé au majorant pour le registre, pas un montant de facture certifié. Confronter la dépense au tableau de bord/facture OpenAI. En l'absence de métadonnées fiables, le coût reste inconnu et la réservation demeure engagée, jamais zéro. Les reçus d'empreintes des sources figurent dans `evidence/public-source-receipts.json`.
