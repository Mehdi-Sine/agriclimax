# Mesures, limites et décision

## Mesures réelles

| Opération | Mesure | Portée |
| --- | --- | --- |
| Lecture Storage initiale | Archive 561 740 octets + support de réanalyse 13 003 octets ; catalogue lu séparément | Trois GET, zéro écriture ; taille exacte de la réponse catalogue non instrumentée. Le support de réanalyse n'est jamais substitué à une prévision. |
| Checkpoint réutilisé | 90 641 402 octets ZIP ; 138 076 225 octets extraits ; 1 018 fichiers | Budget de téléchargement local 100 Mio, extraction plafonnée à 448 Mio. Aucun champ acquis chez un fournisseur. |
| Reprise des 3 modèles | 87,40 s ; RSS parent/enfant maximal 686 356 Kio | 49 910 lignes identiques ; zéro requête fournisseur, zéro octet fournisseur. |
| Audit agrégats seuls | 8,21 s ; RSS 233 600 Kio | Diagnostic initial ; ne construit aucune géométrie. |
| Qualification native, reprise finale | 294,92 s ; RSS 1 154 836 Kio | Réutilise 35 champs AROME/ARPEGE déjà calculés, calcule IFS et revérifie l'index complet. Ce temps n'est pas un benchmark de génération fraîche des 70 champs. Les essais initiaux/rejets monolithiques ont consommé du temps supplémentaire non consolidé. |
| Objets candidats natifs | **172 331 262 octets**, 260 objets, dont index de 4 146 octets | Géométries fragmentées et dédupliquées ; conservés en privé, sans changement de pointeur ni activation. Blobs de coordonnées partagés sans `support_id`, liaison stricte par manifeste. |
| Matrice de recettes complète | 101,34 s ; 758 632 lignes ; 67 796 840 octets gzip | Identités complètes dérivées ; matrice allégée mais exhaustive conservée dans la PR, avec empreinte de la version complète. |

Les mesures de RSS sont celles de Linux (`ru_maxrss` en Kio). Les octets compressés proviennent des fichiers réels. Aucun coût monétaire n'est inventé ; tarifs et capacité restants doivent être revus avant publication.

Le catalogue initial comptabilise 10 444 433 octets, ce qui ne remplace pas un inventaire physique des objets retenus/orphelins. Le garde existant de 900 Mio n'est pas augmenté. Le candidat tient isolément dans ce garde, mais 730 copies indépendantes de ce volume représenteraient environ **125,8 Go** : ce majorant volontairement sans déduplication inter-cycles montre qu'une rétention pérenne doit être dimensionnée. Le coût marginal entre cycles n'a pas été mesuré. L'outil refuse un envoi sans inventaire explicite des anciens objets prévisionnels.

La conservation privée a été exécutée après inventaire physique : bucket privé, RLS active, aucune politique d'accès client, 56 380 664 octets existants et aucun ancien objet COUV-05. Les 260 objets ont été insérés et relus à l'identique en **595,51 s**, avec **782 requêtes Storage / 260 insertions**. Charge utile : **172 331 262 octets envoyés et autant relus**, hors en-têtes, erreurs 404 de pré-vérification et métadonnées. Le projet atteint un total projeté audité de **228 711 926 octets**, sous le garde de 900 Mio. Une requête SQL finale confirme les 260 objets / 172 331 262 octets du préfixe candidat ; les empreintes exactes des deux pointeurs sont identiques avant/après (`storage-publication.json`).

La reprise après changement de journée UTC a également été vérifiée : **49 910 lignes et toutes les captures identiques**, en 133,18 s, zéro acquisition fournisseur. Le contexte de classement prévision/estimation récente d'origine est préservé pendant cette reproduction ; dates d'émission, validité et acquisition restent celles des sources.

## Blocages résiduels

| Volet | Réalisé | Reste / correction requise | Risque si activé prématurément |
| --- | --- | --- | --- |
| Natif AROME/ARPEGE/IFS | Cycle réel complet, 713 PRA × variables × échéances, provenance et topologie contrôlées | Répéter sur d'autres cycles réels ; conserver le suivi des sources/grilles | Variabilité inter-cycles non encore démontrée |
| Recettes | Intersection exacte des cellules, 28 recettes et 758 632 états | Calculer et persister les 2 577 géométries communes nouvelles ; qualifier les valeurs sur ces mêmes cellules | Généralisation numérique erronée si des agrégats hétérogènes servent aux recettes |
| Stockage durable | Implémentation immuable, fragments, contrôles SHA, reconstruction depuis preuves légères conservées | Inventaire physique, politique de rétention, mesure marginale inter-cycles, politique de publication des cycles suivants | Saturation de quota ; hausse de latence/volume |
| Météo | Liaison lecteur/qualité/support/carte sous drapeau distinct | Recette interactive et sélection de modèle réelle au navigateur, latence Storage réelle | Preuve inconnue en cas d'erreur ; le repli reste gris, sans disparition de contour |
| Explorer / agro / cartes du jour / Journal / carrousels | Adaptateur partagé disponible ; moteur COUV-04 et éditions préservés | Injecter les supports exacts dans chaque contrat de résultat et tester les surfaces réelles, archives et échéances | Support d'un autre résultat si un futur raccordement contourne l'adaptateur |
| Visuels | Miniature réelle ARPEGE et repli gris, 3 tailles, 713 contours et valeurs préservées | Cartes interactives, multi-jours, multivariables, Journal, alternatives de modèle et archives ; littoraux/îles en détail | Pas de certification visuelle complète |

Avec les drapeaux inactifs, aucune modification du rendu publié n'est induite. Les anciennes éditions et archives ne sont pas réécrites. La recommandation reste **PARTIAL / NO-GO pour activation**, malgré la validation native réelle du cycle étudié.
