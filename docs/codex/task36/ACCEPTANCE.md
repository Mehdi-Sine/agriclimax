# Journal consultable directement — recette de mise en service

L’article OpenAI réel du 9 novembre est raccordé à `/journal` par défaut, sans
interrupteur de lecture ni authentification applicative. Il conserve la maquette
T32B, ses rubriques et ses preuves. Mention visible : « Édition expérimentale —
contenu IA non entièrement vérifié ». Les réserves initiales et actuelles sont
dépliables ; noindex est activé. Consultation et certification sont indépendantes.

Le parcours public n’expose ni reçu OpenAI, identifiant fournisseur, coût, paramètres,
clé serveur, empreinte de prompt, dossier d’identité interne ou diagnostic technique.
Une copie contrôlée du contenu public et des faits/repères cités est embarquée pour
raccorder immédiatement un déploiement Production différent de DEV et conserver
une édition après panne au démarrage. SHA source inchangé ; SHA public distinct.
Les futures éditions viennent du registre partagé dès que les variables serveur de
Production pointent sur agriclimax-dev. `/api/journal/availability` indique
`shared_archive` ou `retained_copy` sans divulguer de secret.

[Analyse précise des cinq contrôles](SCIENTIFIC_ALERT_REVIEW.md). Les quatre faux
positifs mécaniques sont corrigés ; le lien Almanach implicite reste une réserve
éditoriale. Le verdict initial n’est pas effacé et aucun article n’est déclaré
certifié. Réponses mal formées, preuves incompatibles, archives corrompues,
simulations et fallbacks déterministes ne deviennent pas des éditions IA publiques.
La dernière édition consultable garde sa date réelle si la suivante échoue.

Aucun appel OpenAI à la navigation ou pour cette recette. Le premier article ne
contient aucune carte jointe compatible ; aucune carte courante n’est ajoutée.
Les endpoints de cartes historiques conservent cycle, période, source et SHA.

## Déploiement et actions propriétaire regroupées

L’URL normale existante est https://agriclimax.vercel.app/journal, publique sans
authentification Vercel. Avant ce correctif, elle répond HTTP200 mais ne contient
pas le vrai texte. L’accès disponible permet les déploiements Preview par push,
pas la promotion Vercel Production : aucun outil ou jeton Vercel de déploiement
n’est raccordé. Le secret de bypass Preview ne remplace pas cette autorisation.

Après CI et recette du commit final :
1. Vercel / projet agriclimax / Deployments / déploiement de cette PR : **Promote to Production**. Cela reconstruit avec les variables Production et ne fusionne pas la PR. Vérifier https://agriclimax.vercel.app/journal et son endpoint availability sans en-tête de bypass ni mot de passe.
2. Pour les éditions suivantes, vérifier côté serveur Production que NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY lisent le même projet agriclimax-dev que le batch. availability.storage doit être shared_archive ; retained_copy conserve seulement la copie de secours. Aucune clé à placer côté client ni dans le chat.
3. Fusion manuelle de la PR #73 après revue. Activer AGRICLIMAX_NIGHTLY_ENABLED=true sur main et les contrôles DB acquisition/IA ; les anciens writers cèdent alors la main. Aucune approbation matinale pour rendre l’archive expérimentale consultable. La promotion certifiée reste une opération distincte. Aucune limite financière applicative.
4. Le contrôle de page utilise l’URL normale par défaut ; pas de nouveau secret Vercel requis pour ce contrôle public. Pour le watchdog indépendant seulement, renseigner son token Vault Actions:write puis activer son cron séparément. Aucun de ces interrupteurs n’a été activé dans cette recette.

[Promotion Vercel officielle](https://vercel.com/docs/deployments/promoting-a-deployment).
La programmation Paris reste 02:15, reprises bornées à 30 minutes jusqu’à 05:15,
gel vers 05:40, T33/T34 et génération, archivage puis lecture directe, contrôles
06:30/06:45/07:00. L’absence de certification n’empêche ni affichage ni supervision.
Le watchdog conserve les réserves comme notices distinctes d’une édition absente.
Les secrets fournisseurs/OpenAI existent dans editorial-ai-dev, sans approbateur
obligatoire. Le préflight manuel existant vérifie maintenant aussi run avec IA
explicitement arrêtée. Aucune nuit complète mesurée ; disponibilité à observer.

## Recette locale de la version prête à déployer

571 tests TypeScript passés, 7 ignorés ; cinq tests Python de reprise, tests SQL
avec concurrence, lint/typecheck/build réussis. `/journal` et la navigation datée
rendent le texte réel sur desktop/mobile sans authentification, sans débordement,
avec réserve expérimentale, cinq contrôles historiques dépliables et noindex.
Les réponses publiques sont dépourvues de métadonnées confidentielles.

Le mode dégradé a été testé sur un second serveur de production local, privé de
SUPABASE_SECRET_KEY : la copie contrôlée conserve le vrai article et les valeurs
numériques exactes. Comme les archives historiques déjà utilisées dans le projet,
la copie est compressée/encodée avec SHA ; un import JSON direct de Next modifiait
certains flottants à l’empaquetage et a donc été écarté. L’original Supabase est
inchangé. Les appels fournisseur enregistrés restent à un avant/après navigation :
aucun nouvel appel OpenAI. `availability.storage` distingue copie retenue et lecture
partagée afin de vérifier le raccordement quotidien en Production.

La migration watchdog actualise uniquement sa fonction : disponibilité expérimentale
et notices scientifiques séparées, sans approbation matinale. Aucun cron, acquisition
ou appel IA quotidien n’est activé. Le domaine normal doit encore recevoir ce déploiement.
