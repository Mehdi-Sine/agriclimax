# Activation demandée le 17 novembre 2026

Instruction utilisateur ultérieure à la PR #102 : activer directement et rendre
la couverture visible sur main, sans nouvelles validations manuelles.
Cette instruction remplace les consignes initiales de non-activation/non-fusion.

Périmètre : rendu historique par défaut, gel des supports pour les prochaines
éditions et persistance automatique dans le job SIM indépendant existant.
Les archives déjà publiées et les règles scientifiques ne changent pas.
Les résultats SIM `technical_checks_only` ne sont pas présentés comme qualifiés.
Aucun appel OpenAI additionnel ni republication des anciennes éditions.

Retour arrière : flag public historique false + rebuild pour le rendu ; variable
COUV06_EDITION false pour les futurs gels ; flag SIM_CANDIDATE false pour arrêter
la collecte et sa persistance. Une édition déjà publiée reste figée.

## Résultat constaté

Le commit d'activation `750a0fe` a été déployé en production par Vercel avec succès.
Le site `https://agriclimax.vercel.app` sert le nouveau bundle, où le rendu historique
est actif par défaut. Vérification HTTPS des quatre variables du 01/11 : 713 lignes,
six PRA corses et classement 681 entières / 31 partielles / une indisponible.
La capture navigateur distante n'a pas été exécutée : certificat proxy non reconnu,
et ajout à la confiance TLS refusé par le contrôle automatique. Aucun contournement
ou changement de confiance ; les lectures HTTPS conservent la vérification TLS.

Les sauvegardes SIM et les nouveaux gels d'édition s'exécuteront dans le cycle
normal suivant. Aucun cycle éditorial ou appel OpenAI supplémentaire déclenché.
