# Coûts et protections

Plafond initial global : **5 €/mois**, configurable à la baisse. Plafond initial par édition : **0,15 €**. Sortie initiale : 6 000 tokens, plafond technique 16 000. Aucun prix réel n'est présumé : le mode réel exige modèle, grille tarifaire explicitement saisie, version et date de vérification.

Variables serveur : `OPENAI_API_KEY`, `AGRICLIMAX_EDITORIAL_MODEL`, `AGRICLIMAX_AI_ENABLED`, `AGRICLIMAX_AI_MAX_OUTPUT_TOKENS`, `AGRICLIMAX_AI_MONTHLY_BUDGET`, `AGRICLIMAX_AI_MAX_EDITION_COST`, `AGRICLIMAX_AI_TIMEOUT_MS`, `AGRICLIMAX_AI_INPUT_EUR_PER_MILLION`, `AGRICLIMAX_AI_OUTPUT_EUR_PER_MILLION`, `AGRICLIMAX_AI_PRICING_VERSION`, `AGRICLIMAX_AI_PRICING_VERIFIED_AT`. Ne jamais préfixer ces valeurs par NEXT_PUBLIC.

Borne d'entrée : nombre d'octets UTF-8 de la requête entière (prompt, dossier, schéma strict, enveloppe) + 4 096 tokens de réserve. Pour les modèles à tokenisation en octets vérifiés, cette borne est volontairement prudente ; ce n'est pas la règle approximative « caractères / 4 ». Le plafond de sortie Responses couvre aussi le raisonnement. Refuser les modèles dont cette borne n'est pas applicable.

Coût réservé = plafond entier conservateur d'entrée × prix d'entrée + max_output_tokens × prix de sortie ; arrondi supérieur au micro-euro. Les réservations et coûts connus des échecs sont comptés. La consommation effective conserve modèle retourné, réponse, tokens entrée/sortie/raisonnement et durée. Les tokens de raisonnement sont inclus dans la sortie, sans double comptage.

L'identité combine date, bundle, prompt, modèle, configuration, mode et révision. Un verrou global protège tout le budget, pas seulement un dossier. La réservation est synchronisée sur disque avant le POST. Une édition quotidienne existante est réutilisée même si la configuration change ; une modification du dossier exige une révision explicite. Les expériences ont un plafond supplémentaire et un suivi par identifiant, sans dépasser le plafond mensuel global.

Timeout, transport ambigu, refus ou métadonnées insuffisantes : réservation conservée et état `outcome_unknown`, aucune relance payante automatique. Le verrou laissé après crash exige réconciliation manuelle ; ne pas le supprimer pour « réessayer ». Le stockage doit être unique et durable : plusieurs répertoires ou volumes indépendants ne constituent pas un budget global.

Projet OpenAI recommandé : clé restreinte, modèles autorisés, limites de débit, alertes et budget projet. Ces réglages ne remplacent pas le plafond applicatif. Coût réel T35 : **0 €**. Les tarifs 1 €/million en entrée et 5 €/million en sortie des fixtures sont fictifs et réservés aux tests, sans recommandation commerciale.

À raison de 31 éditions au plafond initial de 0,15 €, le maximum théorique quotidien représente 4,65 €. Révisions et comparaisons restent soumises au plafond global de 5 €, elles ne créent pas de budget supplémentaire implicite. Cette borne financière ne constitue pas une estimation de tarif pour un modèle non encore choisi.
