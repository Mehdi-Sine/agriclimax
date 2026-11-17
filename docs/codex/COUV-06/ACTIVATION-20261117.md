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
