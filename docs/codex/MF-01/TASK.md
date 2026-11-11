# MF-01 — acquisitions Météo-France

Mission du propriétaire : diagnostic réel DPClim, DPObs, AROME et ARPEGE depuis main actualisée ; correction des causes démontrées ; sondes bornées sans valeurs de secrets, renouvellement ni abonnement modifié. PR codex/mf-01-acquisition-reliability non fusionnée. Aucun appel OpenAI, aucune publication, aucun snapshot/archive historique réécrit.

Frontières : transport/authentification Python, diagnostics Actions, reçu quotidien et qualification indépendante des archives en lecture seule. Les calculs scientifiques, contrats, UI, migrations et données de production restent hors modification. La commande manuelle catalogue est indépendante de toute persistance et génération éditoriale.

Intégration contrôlée : examiner #77 UX-01, #63 COUV-01 et les travaux déjà fusionnés #76 AGRO-02, #78 OPS-03, #79 OPS-04 ; rapport des chevauchements, régression, ordre de fusion et retour arrière. READY exige une intégration et une vérification scientifique effectives.

Finalisation demandée après #80 et #82 INT-01 : conserver l'historique MF-01 et intégrer main, vérifier les contrats cartes/API/Journal, relancer CI complète et acquisitions sur le commit final ; tracer acquisition/persistance/indicateurs/cartes/édition. Recette avec persistance locale immuable et accès distants GET uniquement ; aucune édition publiée, aucun appel OpenAI et aucun secret renouvelé. Les archives et snapshots de production ne sont pas remplacés. Livrer un GO/NO-GO de fusion distinct de la préparation opérationnelle de la prochaine édition.
