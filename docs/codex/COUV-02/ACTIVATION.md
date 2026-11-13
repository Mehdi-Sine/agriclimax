# Activation progressive et retour arrière

## État livré

Pas d'activation de production. Aucun workflow, migration, paramètre de runtime,
secret ou endpoint modifié. `select_window(..., enabled=False)` renvoie une liste
vide ; seuls les appels explicites de la recette locale passent `enabled=True`.
La recette ne dispose d'aucun client réseau ou base de données. Les méthodes du
pilote COUV-01 restent manuelles et indépendantes, sans workflow ajouté.

## Conditions avant une première intégration

1. Faire valider les conventions des journées SIM, le datum projeté et la
   représentativité sur les territoires ciblés. Documenter explicitement la
   résolution, l'altitude et le possible partage de stations avec l'assimilation.
   Le seuil 90 % autorise une disponibilité descriptive, pas une estimation certifiée.
2. Rejouer une nouvelle campagne bornée sans publication, avec les contrôles
   d'intégrité existants. Mesurer réellement appels, octets, mémoire, durée,
   latence de publication, dates manquantes et révisions du fournisseur.
   Arrêter sur dépassement des plafonds ou transport non qualifié.
3. Fixer une liste de PRA/variables autorisées, une période explicite et une
   version de source pour chaque série. Priorité ERA sur toute la fenêtre,
   puis SIM sur toute la fenêtre. Ne pas changer de source au milieu d'une série
   et ne pas remplacer silencieusement une série déjà publiée.
4. Premier canari : Crozon, La Hague, Camargue et les quatre PRA corses sous
   90 % avec ERA ; témoins de conservation ERA (Beauce et montagne continentale).
   Étendre ensuite aux 32 PRA nécessaires si ERA dispose de tous les jours,
   jusqu'à 68 uniquement si la période l'exige. Pour humidité/extrema SIM,
   demander une qualification distincte plutôt qu'étendre l'acquisition en silence.
5. Faire consommer les sorties par une carte de recette qui affiche source,
   période, fraction, état partiel et fraîcheur par PRA. Maintenir les états
   indisponibles sous 90 %, et conserver les légendes existantes. L'UX de
   production devra être traitée séparément : cette PR n'en propose aucun changement.
6. Qualifier séparément chaque règle agronomique. GDD calculé sur une moyenne
   spatiale, extrema de station, séquences locales, pluie UTC, THI et anomalies
   ne deviennent pas équivalents par simple présence de T/HU/PRELIQ/PRENEI.
   Conserver les barrières `indicator_eligible=false`, `journal_eligible=false`
   tant que cette étape n'est pas documentée et testée.

## Plan d'incrément et rétention

À implémenter et mesurer avant tout cron, sans nouvelle infrastructure :

- Catalogue local borné ou stockage existant, séparé des archives publiées.
  Clé logique `(source, version de définition, support, PRA, date, variable)`.
- Blobs immuables adressés par SHA256 ; manifestes par date. Si le checksum du
  blob existe, ne pas réécrire. Ne jamais conserver chaque snapshot roulant complet.
- Nouvelles dates seulement pour les agrégats, plus une fenêtre de révision
  explicitement bornée ; nouvelle révision conservée séparément avec reçu.
  Le fournisseur révisant aussi l'historique, une correction publiée hors fenêtre
  exige une campagne manuelle : l'incrément ne garantit pas l'absence de révisions.
- 730 jours uniques de rétention agrégée, au plus deux versions par journée,
  budget réservé avant écritures. Le maximum 32 PRA représente ~3,91 Mo avec
  réserve 25 % et une version ; ~7,82 Mo avec deux versions. Pour 68 PRA,
  ~7,41 Mo / ~14,82 Mo. Ces ordres de grandeur excluent le stockage source temporaire.
- Transport national encore nécessaire : garder un seul cache source courant,
  ne pas réacquérir un checksum déjà vérifié, ne pas conserver 730 Parquet nationaux.
  La procédure actuelle ne fournit pas un endpoint distant ciblé par PRA.
- Écrire et vérifier le manifeste en dernier. En cas d'échec garder le manifeste
  précédent et une indisponibilité explicite, pas une substitution météo.
  Purger uniquement les blobs candidats non référencés, après validation des
  références et à l'intérieur du répertoire expérimental autorisé.

## Retour arrière

À l'état livré, ne plus passer `enabled=True` suffit : aucune donnée à restaurer,
aucun job à arrêter, aucun effet sur les archives ou le Journal. Si un canari est
ultérieurement intégré, désactiver d'abord son lecteur et son acquisition, puis
revenir au manifeste candidat précédent. Les séries ERA, les archives publiées et
les états indisponibles existants restent la référence. Conserver les reçus et
preuves du canari pour diagnostiquer l'échec ; ne pas supprimer les archives de
production et ne pas recalculer l'historique publié.
