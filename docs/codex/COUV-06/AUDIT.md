# Audit opérationnel

Base : `origin/main` 39b5031. Le checkout initial 7f03354 était ancien ; aucune
modification n'a été faite avant récupération des développements existants.
COUV-04/05, collecteur COUV-03 et persistance COUV-04 réutilisés. Aucun pilote
historique relancé et aucune requalification prévisionnelle COUV-05E.

## Canari depuis le 15 novembre

29 workflows du 15 au 17 novembre relus, étapes/journaux réels ; huit exécutions
SIM après activation observée. Sept rapports terminés et un échec réel. Les jobs
peuvent rester verts malgré l'échec non bloquant d'une étape.

| Job réel | Résultat collecteur | Dernière date source | Total / transport |
| --- | --- | --- | --- |
| 132802905859, 15/11 11:54 | succès | 14/11 | 7,749 s / 12 247 506 octets |
| 133035710016, 16/11 01:30 | partiel, J−1 absent | 14/11 | 7,869 s / 12 247 506 octets |
| 133044522913, 16/11 02:00 | source inchangée | 14/11 | 2,188 s / 118 735 octets |
| 133166472311, 16/11 08:01 | partiel, J−1 absent | 14/11 | 16,780 s / 12 247 506 octets |
| 133303616887, 16/11 12:39 | **échec SIGALRM, code 142** | aucun nouveau rapport | limite 115 s atteinte |
| 133748341018, 17/11 01:30 | partiel, J−1 absent ; ERA a échoué séparément | 15/11 | 10,360 s / 12 284 806 octets |
| 133760594838, 17/11 02:00 | partiel, J−1 absent | 15/11 | 8,619 s / 12 284 781 octets |
| 133778988567, 17/11 02:45 | source inchangée | 15/11 | 1,445 s / 118 590 octets |

Les étapes du 15 avant activation sont explicitement skipped. Les sept dates
d'un même fichier ne constituent pas sept mises à jour quotidiennes indépendantes.
Le pic RSS des collectes terminées est conservé dans les rapports, environ
120–169 Mio ; la limite mémoire existante n'est pas relevée.

L'artefact **14291421424** du run **43996036456** a été téléchargé, extrait localement
et validé par le lecteur existant (`validate`, `CandidateStore.read`, empreintes).
ZIP : `fcce72627c7944257d3df31e06af7d3f6f8d7e7c6c8d3039e6fdd524a5c22c1f`.
Aucun payload d'archive privé ni grille native n'est ajouté au Git.

Sept dates **09–15/11**, **1 120 lignes**, 32 PRA × sept jours × cinq variables.
Tmoy et pluie : **224/224 PRA-jours numériques**, couverture minimale
**96,504711637 %**, 91 supports complets et 133 partiels par variable.
Les 32 cibles et 807 cellules sont inchangées. Chaque date est réellement lue,
aucune extrapolation vers le 16 novembre. Sur ces dernières collectes matinales,
la source est à J−2 ; le succès du 15 à 11:54 ne garantit pas J−1 à 01:30.

Les cinq variables présentes ne sont pas toutes des variables publiques
interchangeables. Tmoy `degC`, journée ]00UTC–00UTC] ; pluie liquide + solide `mm`,
journée ]06UTC–06UTC] ; humidité quotidienne `%` séparée ; moyennes des extrema
horaires TINF_H/TSUP_H sur leurs journées distinctes. Ces dernières ne remplacent
pas Tmin/Tmax. Toutes les lignes sont **technical_checks_only**. Le rapport
conserve **indicator_eligible=false / journal_eligible=false**.

## Persistance

Le job indépendant était ignoré dans les exécutions observées depuis son ajout.
L'API des variables du dépôt est inaccessible au jeton disponible (HTTP 403) :
aucune valeur de variable n'est inventée, aucune activation n'est tentée.
Les étapes, rapports `remote_writes=0` et le checkpoint distant démontrent
l'absence de progression quotidienne du store roulant.

Reprise réelle depuis le bucket privé existant : génération **0**, sauvegardée
**15/11 10:28 UTC**, **27 914 octets**, dernière date source **13/11**.
SHA : `5ac52199ed5dc1090031fb453dc11de82d24ade4aa74642343db202ff60d461e`.
La restauration vérifie le bucket privé, la taille, l'empreinte et toutes les
révisions ; elle ne dépend pas de la rétention Actions de trois jours.
`catalogue.json`, `current.json` et le pointeur candidat ont les mêmes empreintes
avant/après. **Zéro écriture distante** pendant COUV-06.

Le raccordement existe déjà ; il ne manque pas une nouvelle infrastructure.
Les changements se limitent aux reçus persistés comme artifacts 21 jours et à
Bash/pipefail. Aucun défaut du collecteur n'est caché derrière `tee`.
La sauvegarde roulante réelle COUV-04 est réutilisée ; ses tests de corruption,
interruption, idempotence et huit slots passent. Aucune nouvelle sauvegarde CLI
n'est lancée contre un éventuel écrivain concurrent.

## Frontières scientifiques et produit

Le flag historique consomme les qualités et masques ERA existants. La couverture
à 90 % est uniquement une règle d'emprise visuelle ; elle ne rend ni une valeur
scientifiquement territoriale, ni une portion éligible aux chiffres du Journal.
Les valeurs sur portions restent dans `observed_value`, séparées de `value`.

Les cinq cartes d'édition existantes reçoivent une version de rendu seulement
si leurs supports sont figés avant sélection éditoriale, dans l'archive d'entrées
existante. À lecture ultérieure, ni réseau météo, ni masque courant pour ces
cartes : elles utilisent leur propre bundle signé. Un changement de flag ne peut
repeindre une archive publiée. Pas de mélange de variables ou journées à supports
différents ; aucune intersection déduite d'agrégats.

SIM public reste NO-GO : conventions journalières, qualification publique et
fiabilité quotidienne ne sont pas levées par ces contrôles techniques. La PR ne
contient aucun switch public permettant de contourner ces barrières. ERA partiel
et persistance privée sont activables séparément après décision humaine.
