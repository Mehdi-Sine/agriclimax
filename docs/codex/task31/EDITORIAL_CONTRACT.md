# Contrats et conférence de rédaction

`JournalEdition`, `EditorialEvent`, `EditorialFact` : `apps/web/features/journal/model.ts`. Schéma runtime strict AJV : `validate.ts`, avec contrôle supplémentaire des références (faits, cartes, régions) et des portes de publication. Les interfaces TypeScript et schémas sont vérifiés par les tests.

L'édition transporte identité SHA-256, date UTC du cycle choisi, version, génération effective, initialisations sources, acquisition/cutoff, fraîcheur à la consultation, statut `preview`, titre, chapeau, faits, sujets, rubriques variables, visualisations référencées, dossier de preuves, réserves et provenance.

La période effective figure dans chaque fait et événement. L'initialisation est distincte de l'acquisition et de la génération. La publication persistante n'existe pas encore et aucun timestamp de publication du journal n'est inventé. La publication inconnue de la source est conservée dans les drapeaux météo. Une édition expirée porte explicitement une mention de lecture d'archive.

## Éligibilité et priorités

Seuls les événements issus du lecteur vérifié, de valeur finie, avec PRA concernées, dénominateur cohérent et provenance non vide sont éligibles. Les réserves exploratoires et de couverture restent visibles. Le nombre de PRA est un dénombrement territorial, jamais une surface ni une population agricole exposée.

Ordre lexicographique : nombre de PRA franchissant le critère décroissant, identifiant du phénomène, région. Les intensités hétérogènes de Task30 ne servent pas au classement du journal. Le sujet principal reste le phénomène de plus grande étendue. Les faits et éclairages suivants privilégient d'abord des phénomènes différents, puis complètent dans l'ordre stable. Pas de score scientifique, d'optimisation de clics, de tendance inventée ou de rotation cachant le sujet dominant. La diversité entre éditions persistées reste future.

Jusqu'à trois faits et trois éclairages secondaires. Jusqu'à trois régions distinctes sélectionnées dans l'ordre des événements ; toutes les autres restent consultables. Chaque région donne les dénominateurs par phénomène et le périmètre total. Pas de moyenne des PRA.

## Dossier de preuves

`evidence` (version `editorial-evidence-1`) contient faits identifiés, valeurs, unités, périodes, provenance, versions, drapeaux, fraîcheur source, liens, réserves, texte de secours et identifiants des visualisations. Les phrases numériques de la veille sont conservées avec leur preuve source. Un futur modèle recevra ce dossier uniquement ; aucun accès libre à la base. Aucune API OpenAI intégrée.

L'identité dépend des sources, versions de veille/journal, adaptateurs et date d'édition. L'heure de génération et le classement de fraîcheur à la consultation ne changent pas l'identité factuelle ; la fraîcheur change toutefois l'ETag.
