# Budget de ressources

Les reprises utilisent les plafonds existants ; elles ne les augmentent pas.

| Poste | Limite |
| --- | --- |
| Météo nationale combinée | 512 tentatives, 128 MiB de corps source ; délai interne 1 260 s, timeout externe 22 min |
| IFS sous-processus | Au plus 240 tentatives, 96 MiB, 1 200 s ; plafonds requêtes/octets abaissés au solde national ; subprocess borné au temps national restant |
| Requête WCS | 20 s ; corps natif/description borné ; requêtes WCS espacées d'au moins 1 s ; backoff inclus dans la durée |
| Reprise transport | Trois tentatives maximum ; aucune réserve additionnelle au-delà du budget source |
| ERA5 par stage | 64 groupes maximum (ou limite manuelle inférieure), 128 invocations CDS, 128 MiB, fichier CDS 16 MiB maximum, 240 s maximum par invocation |
| ERA5 durée | Alarme interne 21 min ; externe 22 min ; job 25 min avec installation et export |
| ERA5 chaîne | Stage initial + au plus deux continuations ; chacune garde ses plafonds ; au plus 384 invocations CDS et 384 MiB par chaîne théorique, uniquement pour les parties absentes |
| Workspace | Garde 448 MiB par export et traitement ERA5 ; contrôle météo avant requêtes WCS et avant publication ; RAM process 4 GiB |
| Storage archives | Garde existante 900 MiB ; objets 8 MiB maximum ; aucun champ brut météo en Storage, aucun enregistrement DB nouveau |
| Checkpoints Actions | Trois jours, un seul cycle météo / une seule journée ERA5 exporté ; recherche de 20 runs, au plus 100 métadonnées artifacts par run |
| Rapports | 30 jours ; résumé compact et détails non secrets |

Les limites d'octets de transport sont conservatrices en cas de réponse partielle non mesurable. Le quota disque est une garde du pipeline, pas un quota OS : les dérivés IFS sont contrôlés après traitement, avant toute publication. Les requêtes HTTP internes du SDK CDS et les échanges de contrôle Storage/GitHub ne sont pas assimilés à des octets de champs scientifiques. Aucun SLA de temps n'est déduit du seul backoff.

## Mesures Task 31

- Incident ERA5 : reprise 34,8095 s, 0 requête source, 713 lignes, archive 232 333 octets, quatre écritures Storage déjà réalisées par le workflow incident, pas par Task 31.
- Santé réelle : trois lectures Storage, zéro requête source, zéro écriture ; catalogue indexé **4 304 053 octets**.
- Rejeu réel météo : deux lectures Storage, zéro requête source, zéro écriture ; réencodage intégral identique, 49 910 lignes et 713 PRA.
- Rejeu réel ERA5 : zéro requête source et zéro écriture distante, 713 lignes restaurées du 1er novembre.
- Validation publication locale : deux cycles nationaux réels conservés ; trois lectures Storage initiales, zéro acquisition, zéro écriture distante ; publication/lecture de 49 910 lignes dans un stockage fichier isolé.

Aucune acquisition nationale, opération payante, réingestion historique, modification de bucket, table, schéma, droits ou données historiques n'a été déclenchée. Le téléchargement CLI d'un artifact incident a rencontré un HTTP 403 sur sa redirection ; aucune réacquisition n'a servi de contournement. Les logs accessibles et les archives existantes ont suffi au diagnostic et aux vérifications.
