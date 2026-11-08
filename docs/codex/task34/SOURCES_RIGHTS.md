# Inventaire des accès et droits — 8 novembre 2026

Le registre `config/news/sources.v1.json` contient **10 entrées, dont 7 activées** : six éditeurs DRAAF et une rubrique BSV dédiée. Il ne prétend pas contenir dix organismes indépendants. Les sources publiques régionales ont été retenues après examen des flux réellement annoncés, des robots et des mentions légales. Les métadonnées et résumés sont conservés avec attribution, URL originale, date et réserves. Ni image, ni PDF, ni article complet n’est collecté.

| Source | Flux effectivement testé | Accès | Droits et décision |
|---|---|---|---|
| DRAAF Auvergne-Rhône-Alpes | [RSS actualités](https://draaf.auvergne-rhone-alpes.agriculture.gouv.fr/spip.php?page=backend-actu) | 200 XML | [Mentions](https://draaf.auvergne-rhone-alpes.agriculture.gouv.fr/mentions-legales-a2.html) : Etalab 2.0 sauf mention contraire ; activée |
| DRAAF Grand Est | [RSS actualités](https://draaf.grand-est.agriculture.gouv.fr/spip.php?page=backend-actu) | 200 XML | [Mentions](https://draaf.grand-est.agriculture.gouv.fr/mentions-legales-a24.html) : même licence ; activée |
| DRAAF PACA | [RSS actualités](https://draaf.paca.agriculture.gouv.fr/spip.php?page=backend-actu) | 200 XML | [Mentions](https://draaf.paca.agriculture.gouv.fr/mentions-legales-a20.html) : même licence ; activée |
| DRAAF Hauts-de-France | [RSS actualités](https://draaf.hauts-de-france.agriculture.gouv.fr/spip.php?page=backend-actu) | 200 XML | [Mentions](https://draaf.hauts-de-france.agriculture.gouv.fr/mentions-legales-a103.html) : même licence ; activée |
| DRAAF Bretagne | [RSS actualités](https://draaf.bretagne.agriculture.gouv.fr/spip.php?page=backend-actu) | 200 XML | [Mentions](https://draaf.bretagne.agriculture.gouv.fr/mentions-legales-a2.html) : même licence ; activée |
| DRAAF Nouvelle-Aquitaine | [RSS actualités](https://draaf.nouvelle-aquitaine.agriculture.gouv.fr/spip.php?page=backend-actu) | 200 XML | [Mentions](https://draaf.nouvelle-aquitaine.agriculture.gouv.fr/mentions-legales-a119.html) : même licence ; activée |
| BSV Grand Est | [RSS BSV](https://draaf.grand-est.agriculture.gouv.fr/spip.php?page=backend&id_rubrique=75) | 200 XML, lien sur la [page RSS officielle](https://draaf.grand-est.agriculture.gouv.fr/flux-rss-a271.html) | Même éditeur/licence, rubrique dédiée ; activée |
| IFV | [Flux annoncé dans le HTML](https://www.vignevin.com/feed/) | HTTP 500 | [Mentions](https://www.vignevin.com/mentions-legales/) accessibles ; autorisation de reprise non établie ; désactivée |
| Terre-net | [RSS](https://www.terre-net.fr/rss) | 200 XML | [Mentions](https://www.terre-net.fr/mentions-legales/p77) : reproduction/extraction encadrées, pas d’autorisation présumée pour le batch ; désactivée |
| Réussir | [RSS](https://www.reussir.fr/rss.xml) | 200 XML | [Mentions](https://www.reussir.fr/articles/mentions-legales) : reproduction/extraction réservées ; désactivée |

Pour les DRAAF, les robots sont servis directement par `spip.php?page=robots.txt`, cible effective de la redirection de `/robots.txt`, sur le même hôte. Le moteur ne suit aucune redirection. Les robots sont vérifiés à chaque collecte et ne prohibent pas ces flux. La licence générale exclut les contenus signalés autrement : relire les mentions particulières avant toute reprise éditoriale ; les réserves et l’attribution sont transportées dans le contrat. Les résumés conservés sont courts (600 caractères maximum), pas une copie des documents liés. Les dates de revue expirent après 90 jours ; désactiver plus tôt toute source dont les conditions changent.

## Organismes prioritaires examinés mais non intégrés

| Organisme | Vérification effective | Conclusion limitée à cet audit |
|---|---|---|
| ARVALIS | [Accueil](https://www.arvalis.fr), 200 ; [mentions](https://www.arvalis.fr/mentions-legales) identifiées ; aucun flux déclaré dans le HTML inspecté | Ne pas inventer de RSS ni remplacer un flux par une aspiration des articles |
| Idele | [Page officielle RSS](https://idele.fr/flux-rss), HTTP 200 mais page de challenge haphash, pas un flux exploitable | Ne pas résoudre ou contourner la protection ; accord/accès opérateur requis |
| CTIFL | [Accueil](https://www.ctifl.fr), 200 ; aucun flux déclaré repéré | Recherche ou contact à poursuivre ; aucun collecteur HTML |
| ITAVI | [Accueil](https://www.itavi.asso.fr), 200 ; aucun flux déclaré repéré | Même réserve ; pas d’affirmation d’absence universelle de flux |
| Ministère national | [RSS](https://agriculture.gouv.fr/rss.xml) et [publications](https://agriculture.gouv.fr/rss_publications.xml), 200 XML | [Mentions](https://agriculture.gouv.fr/mentions-legales) distinguent documents officiels et autres contenus et conditionnent les usages commerciaux ; pas d’autorisation générale présumée. Les DRAAF sélectionnées fournissent déjà des publications ministérielles régionales |
| Agreste | [Accueil](https://agreste.agriculture.gouv.fr), 200 ; aucun flux déclaré repéré dans l’accueil inspecté | Ne pas inventer d’API ou de RSS ; les publications statistiques relayées par les DRAAF restent attribuées à leur éditeur de flux |
| Cirad | [Page RSS](https://www.cirad.fr/flux-rss), [flux actualités](https://www.cirad.fr/rss/actualites), 200 XML | [Mentions](https://www.cirad.fr/mentions-legales) : autorisation expresse requise pour reproduction ; non retenu malgré l’accès technique |

Un HTTP 200 n’établit ni la validité XML, ni l’autorisation. L’existence d’un RSS n’accorde pas une licence de redistribution commerciale. Aucun contenu de presse ou d’institut exclu ne figure dans le corpus du pilote. Les vérifications techniques ponctuelles des flux exclus servent seulement à l’inventaire ; elles ne sont pas une collecte récurrente autorisée.

Preuves : `evidence/source-verification.json` conserve statuts, URL finales, tailles, empreintes et extraits courts des pages revues. Les premiers chemins de mentions PACA/Hauts-de-France devinés étaient erronés ; les liens officiels ont ensuite été suivis et les véritables pages « Mentions légales » vérifiées. Le registre utilise les liens corrigés.
