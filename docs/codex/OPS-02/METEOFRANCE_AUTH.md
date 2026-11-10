# DPClim / DPObs — authentification et recette ciblée

Frontières modifiées : transport et authentification des stations, diagnostic
manuel et liaisons des secrets. Aucun changement du watchdog, des crons, du
Journal, des conversions/unités, des règles scientifiques ou des archives.

## Vérification officielle du 10 novembre 2026

- [FAQ du portail Météo-France](https://portail-api.meteofrance.fr/web/fr/faq),
  sections 3 et utilisation des tokens : deux protocoles distincts sont proposés.
  Un jeton **API Key**, JWT généré après souscription, se transmet dans `apikey`.
  Ce n’est ni un numéro d’abonnement ni un jeton OAuth2 temporaire.
  Sa durée est choisie à la génération ; il n’existe pas dans ce client de
  renouvellement automatique d’une API Key expirée.
- OAuth2 : l’`APPLICATION_ID` fourni dans la commande du portail s’envoie en
  `Authorization: Basic …` à `https://portail-api.meteofrance.fr/token`, avec
  `grant_type=client_credentials`. Le jeton obtenu se transmet en Bearer et a une
  durée limitée (le portail annonce une heure). Le programme doit le renouveler.
  Le client utilise `expires_in`, anticipe l’expiration, et ne retente qu’une fois
  après un 401. Aucun renouvellement sur 403 ou pour une API Key.
- La FAQ précise qu’une souscription ajoutée **après** la création du jeton exige
  de générer un nouveau jeton. Générer un nouveau jeton OAuth2 peut invalider le
  précédent : éviter de partager une même application entre workers concurrents.
- [Guide officiel des erreurs](https://confluence-meteofrance.atlassian.net/wiki/spaces/OpenDataMeteoFrance/pages/1447788546/) :
  401 signifie authentification manquante/invalide/expirée ; 403 signifie droits
  insuffisants, notamment abonnement. **Un 401 ne prouve pas un abonnement absent.**

Le contenu de la FAQ est également accessible dans l’API publique du portail :
[document FAQ officiel](https://portail-api.meteofrance.fr/api/am/devportal/v3/apis/3dfdcd1b-e92e-4d1e-942e-61b56c9bb345/documents/4e205af1-e5b7-437d-9099-2c839e9861be/content).

## Versions : pas de migration automatique

Le [catalogue officiel](https://portail-api.meteofrance.fr/api/am/devportal/v3/apis?limit=200)
publie actuellement **DPClim v1** et **DPObs v2** ; DPObs v1 n’apparaît pas dans
cette liste. Cela ne suffit pas à prouver que chaque accès historique v1 a cessé.
Les [spécifications DPClim](https://portail-api.meteofrance.fr/api/am/devportal/v3/apis/a5935def-80ae-4e7e-83bc-3ef622f0438d/swagger)
et [DPObs](https://portail-api.meteofrance.fr/api/am/devportal/v3/apis/c3b1fe90-c209-447c-8cab-8342bf157b83/swagger)
confirment les routes des catalogues et `/station/horaire` avec `id_station` et
`format=json`. La réponse 200 de DPObs n’y définit pas de schéma JSON détaillé :
une compatibilité scientifique complète ne peut pas être déduite de ces seules routes.

Le client d’acquisition conserve donc **DPClim/v1 et DPObs/v1**, leurs métadonnées
et leurs contrats stricts. Le test de santé propose **v2 en lecture seule**, sans
modifier le client d’ingestion, ses sorties ou la provenance. Une future bascule
DPObs nécessitera un accès autorisé puis une qualification réelle du catalogue,
des valeurs/unités et des horodatages. Aucun fallback silencieux de version.

## Configuration précise du propriétaire

Solution API Key, sans nouvelle configuration logicielle obligatoire :

- `METEOFRANCE_CLIMATOLOGY_API_KEY` : jeton **API Key** valide autorisant DPClim v1.
- `METEOFRANCE_OBSERVATIONS_API_KEY` : jeton **API Key** valide pour la version
  DPObs souscrite. Vérifier la version dans « Mes API » ; ne pas supposer qu’une
  souscription v2 autorise v1. La santé v2 permet de tester cet accès séparément.

Souscrire d’abord aux produits voulus, puis générer les jetons avec une durée
adaptée à l’exploitation. Les valeurs se renseignent uniquement dans les secrets
GitHub du dépôt et dans les réglages sécurisés du runtime, jamais dans le chat.

Solution OAuth2 optionnelle, préférable lorsqu’un renouvellement est nécessaire :

- `METEOFRANCE_CLIMATOLOGY_APPLICATION_ID`
- `METEOFRANCE_OBSERVATIONS_APPLICATION_ID`

Chaque valeur est l’APPLICATION_ID déjà encodé fourni dans la commande Basic du
portail, sans le préfixe `Basic `. Ne pas renseigner un jeton Bearer à sa place.
Une APPLICATION_ID présente est prioritaire sur l’API Key du même produit ;
aucun essai automatique de l’autre protocole en cas de refus. Effacer cette
APPLICATION_ID pour revenir au mode API Key. Les bindings sont transmis aux
workflows d’acquisition existants ; leurs horaires et stages sont inchangés.

## Contrôle de santé manuel

Workflow existant **Météo-France live station ingestion**, uniquement
`workflow_dispatch` avec **probe_only=true** ; `observations_version=v1` par défaut (parité avec ingestion),
`v2` pour sonder explicitement le catalogue actuel. Le job de santé ne reçoit aucun secret Supabase/OpenAI.
Pour exécuter le même contrôle dans un environnement déjà configuré :

```bash
PYTHONPATH=engine/src python scripts/meteofrance_station_health.py
PYTHONPATH=engine/src python scripts/meteofrance_station_health.py --observations-version v2
```

Un catalogue par produit, sans commande d’archive ni téléchargement de mesures.
Pas de retry temporaire ; seul OAuth2 peut renouveler une fois et rejouer le GET.
Réponses plafonnées à 1 Mo, pas de redirection d’identifiants, vérification TLS
active, aucune chaîne d’erreur amont ni en-tête d’authentification dans le rapport.
Les seuls codes amont conservés appartiennent à une liste numérique fixe.

États : `credential_missing`, `token_expired` (indication explicite du service),
`authentication_invalid_or_expired` (401 ambigu), `subscription_not_authorized`
(403 : abonnement ou droits), `oauth_application_rejected` (serveur de jetons),
`endpoint_incompatible`, `rate_limited`, `service_unavailable`,
`network_unavailable`, `access_succeeded`. Un 200 doit aussi présenter la forme
attendue du catalogue. Ce succès prouve l’accès au catalogue, pas la qualification
des données météo. Les deux produits sont toujours testés même si l’un échoue ;
le workflow échoue dès lors qu’au moins un accès n’est pas confirmé.

## Conclusion des essais réels

Avec les bindings actuels, DPClim v1, DPObs v1 et DPObs v2 répondent chacun
**401 / 900901 (Invalid Credentials)** via le protocole API Key documenté.
Aucun message explicite d’expiration ou d’abonnement n’est fourni. Passer à v2
ne résout donc pas les 401 observés. Les APPLICATION_ID OAuth2 ne sont pas
configurées ; le renouvellement est testé avec des identifiants synthétiques.

**Conclusion : diagnostic logiciel corrigé et OAuth2 pris en charge ; configuration
externe valide encore nécessaire.** La cause exacte du rejet des jetons présents
(expiration, révocation, mauvais type, jeton antérieur à souscription, etc.) reste
indéterminée au vu du seul retour du service. Aucune nouvelle génération IA,
aucune fusion et aucune activation d’un autre composant.
