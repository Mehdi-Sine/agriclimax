# EDIT-01 — Validation éditoriale du 12 novembre 2026

**NO-GO pour la relance opérationnelle sous la contrainte de non-publication.**
Le correctif du prompt est prêt pour revue ; le texte existant reste rejeté. Aucun
appel payant, publication, acquisition ou changement de snapshot/archive distante.

Le dépôt étant public, les documents privés récupérés de Supabase, identités,
diagnostics fournisseur, données météo et reçus restent dans l'espace de travail
local `work/edit01/private/`. Le rapport complet y donne les citations, règles,
empreintes, sources exactes, coûts et procédure opérateur. Ne pas versionner ce
dossier. Les tests de cette PR utilisent uniquement une simulation publique déjà
versionnée, avec une reproduction dépersonnalisée du défaut syntaxique.

## Cause constatée

Les deux codes visent la même réserve de `draft.decision` :

> « elles ne documentent ni évolution observée ni dommage agricole »

| Erreur | Motif du validateur | Défaut identifié |
| --- | --- | --- |
| UNPROVEN_AGRONOMY | `dommages? agricoles?`, transmis à `unqualifiedAssertion` | La négation `ne…ni…ni` n'est pas reconnue. |
| FORECAST_AS_OBSERVATION | Preuves de candidats forecast et motif `observ[eé]` | Même défaut de portée de négation. |

Cette phrase nie les observations et les dommages ; ce sont deux faux positifs
lexicaux. Le remplacement de ce seul bloc dans une copie de recette donne
`needs_editorial_review`, sans correction du texte archivé. La requête d'origine
a été reconstruite hors ligne : empreintes des instructions, du schéma normalisé
et du corps complet identiques aux diagnostics conservés. Le dossier de l'archive
correspond au snapshot. Aucun indice de corruption des données ou du schéma.

Le prompt fr-3 distinguait déjà les natures de données mais ne séparait pas assez
explicitement les propositions. Le prompt fr-4 demande des blocs distincts pour
réanalyse historique et prévision attribuée aux modèles, puis uniquement des
questions saisonnières étayées pour les conséquences hypothétiques. Les réserves
décrivent les données manquantes dans des propositions simples. Il interdit
explicitement d'utiliser des synonymes pour faire passer une conséquence non
prouvée. Validateur, helper, schéma et règles scientifiques restent inchangés.

## Tests et limites

La fixture publique préexistante est conservée. Les tests ajoutés reproduisent
les deux erreurs ensemble et séparément, vérifient le besoin de revue humaine,
le maintien des rejets de causalité même au conditionnel, des fausses observations
et des assertions précédées d'un disclaimer. La revalidation du texte inchangé
reste refusée. Le nouveau prompt n'a pas fait l'objet d'un essai rédactionnel
payant ; son efficacité réelle reste à mesurer.

## Reprise contrôlée

1. Consulter le rapport privé et relire uniquement `report`, `snapshot_read`,
   `archive_read`. Vérifier les identités et empreintes consignées ; arrêter si une
   nouvelle tentative est apparue. Aucune acquisition, préparation, reconstruction
   ou modification du snapshot n'est nécessaire.
2. Le rejeu gratuit du texte inchangé échoue toujours. La récupération d'une
   réponse interrompue ne s'applique pas : la réponse et l'archive existent déjà.
   Ne pas réenregistrer la même réponse ou modifier son contenu/verdict.
3. Ne pas lancer T36 `run --authorize-snapshot` dans cette intervention : il peut
   reprendre le snapshot et créer une tentative manuelle distincte, mais
   `operationalEditions()` rend automatiquement consultables les nouvelles
   archives compatibles. L'absence de `promote`, voire `publication_enabled=false`,
   ne garantit pas l'absence de consultation expérimentale.
4. Tout nouvel appel nécessite une autorisation explicite portant sur le snapshot,
   le modèle et le coût. Préparer d'abord un driver isolé à appel unique, avec
   verrou et trace durable, utilisant exclusivement le bundle vérifié exporté.
   Sa sortie doit rester hors du store Supabase, des registres et des répertoires
   lus par le Journal. Cette capacité n'est pas livrée dans le correctif minimal.
5. Valider intégralement la nouvelle sortie puis effectuer la revue humaine.
   Aucun second appel automatique ; tout rejet reste rejeté. Une nouvelle sortie
   est une nouvelle tentative, pas une duplication de la réponse originale.
   Toute intégration au Journal demande une autorisation séparée.

Le coût est estimé par `(input_tokens × tarif_entrée + output_tokens ×
tarif_sortie) / 1_000_000`. Les tokens de raisonnement inclus dans output_tokens
ne sont pas refacturés séparément. Le rapport privé fournit consommation réelle
enregistrée, estimation du premier appel et borne prudente du nouveau prompt,
avec maximum de 6 000 tokens de sortie. Vérifier les tarifs et le budget du projet
OpenAI avant accord : les tarifs diagnostiques du code ne sont pas une facture
fournisseur ni des plafonds applicatifs de dépense T36.

**GO** pour revue du correctif et diagnostic hors ligne. **NO-GO** pour la reprise
gratuite de l'ancien texte, la relance T36 partagée et toute publication.
