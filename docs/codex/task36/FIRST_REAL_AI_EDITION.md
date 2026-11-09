# Décision propriétaire — budget géré dans OpenAI

Les réservations, plafonds applicatifs et rapprochements financiers ne conditionnent
plus T36. Le parcours actif utilise `generateOperational` et un verrou par date :
tentatives distinctes, reprise manuelle après erreur pour la même date, aucune
relance automatique, aucune régénération d’une édition techniquement validée.
L’ancien HTTP 400 et ses montants historiques restent inchangés. Les tokens et
coûts sont des métadonnées facultatives ; le coût calculé est une estimation,
jamais une facture prétendument retournée par Responses.

Migration ciblée `20261109152744_editorial_operational_attempts.sql` appliquée en DEV :
contrainte financière retirée, index unique sur les tentatives actives par date et
RPC invoker service-only dédiée. Aucun nouveau tableau, aucune activation quotidienne
ni publication publique. Tests : 558 tests locaux passés, recette SQL et deux vraies
connexions concurrentes locales (une seule admission), contrôle DEV avec rollback.
Le dossier réel du 9 novembre conserve son snapshot et sa date pour l’essai autorisé.

Les consignes comptables ci-dessous sont historiques et ne s’appliquent plus.

<details><summary>Historique antérieur à la décision propriétaire</summary>

# Premier essai réel — échec conservé

Le secret OpenAI existant a été confirmé présent par GitHub Actions ; aucune nouvelle clé n'est nécessaire. Le modèle qualifié gpt-6.1-terra a reçu un unique appel autorisé à partir du dossier réel T33 du 9 novembre.

- Run Actions : 42610453514 ; run financier `9da626c533c6e928ee5d768a21b79a4d1fe290e6356345a2faac3f8e73a0e671`.
- Résultat : `PROVIDER_HTTP_400`, `outcome_unknown`, provision 0,094549 €, coût réel et tokens inconnus.
- Aucun article réel ni reçu OpenAI. Archive de fallback seulement, exclue de la lecture des brouillons IA et de la publication.
- IA arrêtée immédiatement ; aucune seconde requête. Ne pas effacer le run ni ramener arbitrairement son coût à zéro.

L'ancien code ne conservait pas le corps de rejet : la cause exacte reste indéterminée. Le code conserve désormais uniquement code/type/param/request_id assainis, sans message brut ni secret. Le schéma envoyé normalise const/enum avec type explicite ; c'est une correction hors ligne testée, **pas une cause prouvée du HTTP 400 ni une correction validée par un nouvel appel**. La réponse réussie future est archivée avant validation du modèle/usage.

Le propriétaire doit rapprocher les journaux et la facturation OpenAI de la tentative avant une nouvelle autorisation bornée. Les gardes financières et l'unicité quotidienne ne doivent pas être contournées. Aucun texte simulé n'est livré comme premier article.

## Revue ciblée de la requête — 9 novembre, après l'échec

Frontières concernées : adaptateur Responses et schéma de transport, diagnostics privés,
préflight du batch manuel, proposition de rapprochement financier. Aucun changement
scientifique, aucune migration, aucune activation de cron/IA quotidienne/publication.

Audit documentaire et local de `requestBody` :

| Élément | Constat |
|---|---|
| Endpoint et entrée | POST `/v1/responses`, `instructions`, message user/input_text ; pas de tools, température, ancien response_format ou relance HTTP |
| Sortie | `text.format={type:json_schema,name:EditorialDraft,strict:true,schema:…}` ; store=false |
| Schéma normalisé | 13 objets, 62 propriétés, profondeur 7, 39 valeurs enum ; toutes les propriétés requises, objets fermés, racine object ; nullable explicite conservé |
| Normalisation | 11 nœuds const/enum sans type reçoivent le type scalaire explicite ; contrat canonique intact. Aucune autre incompatibilité identifiée dans ce schéma documenté pour le modèle de base |
| Modèle | Terra documente Responses, structured outputs et reasoning low ; 1 050 000 tokens de contexte et 128 000 de sortie maximum |
| Tokens | 6 000 sortie, raisonnement inclus ; borne entrée réelle revue 56 130, sous seuil tarifaire prudent 272 000. Le minimum Responses 16 est maintenant vérifié dans checkConfig |
| Coût | standard/default, cache explicit/30m sans breakpoint : aucun cache write ; prix conservateurs existants, plafond 0,15 €/édition et 5 €/mois inchangés |
| Préflight DEV sans appel | Dossier réel inchangé, provision existante 0,094549 € comptée ; nouvelle estimation 0,094743 €, `allowed=false`, UNRECONCILED_GENERATION |

La normalisation est suffisante pour les incompatibilités **identifiées hors ligne**.
Elle ne prouve pas l'acceptation d'un prochain POST ni la cause du HTTP 400 initial.
Les refus, réponses incomplètes et usages invalides restent des échecs, sans deuxième appel.

Sources officielles consultées : [Terra](https://developers.openai.com/api/docs/models/gpt-6.1-terra),
[Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[Responses create](https://developers.openai.com/api/reference/resources/responses/methods/create),
[cache](https://developers.openai.com/api/docs/guides/prompt-caching),
[identifiants de requête](https://developers.openai.com/api/reference/overview).
Les empreintes des documents lus et du schéma figurent dans `evidence/request-audit/`.

Avant transport, les prochaines tentatives enregistrent dans les diagnostics privés :
run_id, horodatage UTC, modèle, limite sortie, SHA de la requête et du schéma,
UUID transmis par X-Client-Request-Id. Si cet enregistrement échoue, aucun POST.
Les rejets conservent statut/code/type/param/x-request-id, catégorie de cause et
chemin de schéma limité au vocabulaire du contrat. Aucun message brut, prompt, clé
ou en-tête Authorization n'entre dans ce diagnostic. Les causes non reconnues sont
explicitement UNCLASSIFIED_PROVIDER_REJECTION, à rapprocher avec le request_id,
sans inventer une explication. Les sorties réussies et reçus sont conservés en
archive privée avant toute admission dans `/journal/personnel`.

## Rapprochement propriétaire à effectuer

Tentative ciblée : run Actions **42610453514**, commit d805ee6 ; étape de requête
entre **12:37:24 et 12:37:33 Europe/Paris**, soit 11:37:24–11:37:33 UTC, le 9 novembre.
Registre mis à jour à 11:37:33.840190 UTC. Modèle gpt-6.1-terra ; aucun response_id
ni request_id ancien disponible. `store=false` ne permet pas de supposer que le texte
pourrait être récupéré depuis le registre Responses.

Le propriétaire doit isoler la requête dans son projet/clé et fournir une référence
vérifiable de rejet sans usage, ou consommation/tokens/reçu et montant attribuables.
[Usage](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/completions)
permet des agrégats minute par projet/clé/modèle ;
[Costs](https://developers.openai.com/api/reference/resources/admin/subresources/organization/subresources/usage/methods/costs)
utilise des agrégats journaliers. Un total journalier ou l'absence provisoire d'une
ligne ne démontre pas à lui seul le coût de cet appel. Vérifier délais, pagination,
autres requêtes et conversion USD/EUR. Ces données nécessitent l'accès propriétaire ;
aucune nouvelle clé de génération n'est demandée. Sans attribution fiable, conserver
`outcome_unknown` et la provision entière.

Après vérification du justificatif privé, préparer un fichier hors dépôt contenant :
`run_id`, `verified_by`, `source_reference`, `evidence_file`, `evidence_sha256`,
`finding` (`rejected_without_usage` ou `consumption_confirmed`), `actual_eur`,
`input_tokens`, `output_tokens`, `response_id` (null uniquement pour rejet sans usage).
Aucune valeur zéro préremplie ne constitue une preuve. Le SHA assure l'intégrité du
fichier ; le propriétaire doit vérifier sa provenance et son attribution.

```bash
pnpm editorial:nightly reconcile-plan --evidence /chemin/prive/rapprochement.json
```

Cette commande lit le registre et vérifie le SHA du justificatif ; **elle n'exécute
aucune écriture SQL ni aucun appel OpenAI**. Elle prépare `work/task36/owner-reconciliation.sql`
(mode 0600) pour revue propriétaire. La transaction proposée exige tous les contrôles
arrêtés, prend le verrou financier, compare le registre entier à son état attendu,
ajoute un diagnostic privé avant/après/proof, puis comptabilise uniquement le montant
justifié. Elle conserve id, date, mois, scope, erreur HTTP400, réserve historique et
archive de fallback. L'état terminal validation_failed indique l'absence d'article,
pas une approbation scientifique. Si le coût dépasse la réserve, si le justificatif
est ambigu ou si la ligne a changé, arrêter : pas de libération automatique.

## Nouvel essai, seulement après rapprochement et autorisation distincte

L'unicité SQL sur edition_date reste inchangée. Le dossier du 9 novembre est déjà
tenté : aucun changement de scope, aucune suppression, aucune fausse date, aucun
nouveau modèle ou revision pour contourner cette règle. Le prochain essai utilisera
le **prochain véritable dossier quotidien qualifié**, avec sa date réelle et son
snapshot exact, après rapprochement. Le préflight manuel refuse explicitement un
jour déjà tenté et tout résultat inconnu, avant accès modèle ou génération.

Le propriétaire devra autoriser le nouveau snapshot exact, gpt-6.1-terra et le plafond
0,15 €. Le workflow manuel existant `generate-shared-once` porte cette autorisation ;
le contrôle IA SQL devra être armé ponctuellement puis arrêté dans une opération
séparée. Pas d'activation quotidienne ; publication=false, cron inactif. En cas de
succès : reçu/tokens/coût, texte, preuves et SHA relus en DEV, affichage privé vérifié ;
relecture éditoriale et publication publique restent indépendantes. Aucun nouvel
essai payant effectué dans cette revue, faute de justificatif propriétaire.

Validation locale : **555 tests passés, 7 ignorés**, lint et typecheck réussis,
build production réussi. Recette de la transaction de rapprochement sur PostgreSQL 17
avec justificatif **synthétique local uniquement**, audit avant/après vérifié et refus
SQL d'une deuxième tentative à la même date ; rollback final. Cette fixture ne
constitue pas un justificatif financier pour DEV et n'a jamais été appliquée en DEV.

</details>
