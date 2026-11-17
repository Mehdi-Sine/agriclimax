# COUV-05E — lecteur composite

**Livraison PARTIAL ; activation NO-GO.** Base : `9944e05bb88088a9470aabb0330adbd7a64d6a11`, fusion de #100. Aucune activation, écriture distante, modification d'archive publiée, collecte nationale, formule, seuil, source, infrastructure ou appel OpenAI. AGRO-03 reste désactivé.

## Raccordement livré

Le candidat ajoute `qualified_entries` à l'index immuable existant, dans les mêmes namespaces `forecast-masks/indexes` et `blobs`. Les 1 185 résultats COUV-05D sont copiés, jamais recalculés. Les géométries déjà certifiées sont reprises exclusivement pour le même PRA, la même empreinte de cellules et les mêmes poids. Les manifestes et géométries natifs sont vérifiés par SHA. Les géométries COUV-05C, lorsqu'elles sont utilisées, exigent aussi identité de cellules et fraction exacte.

Le lecteur vérifie le pin, l'archive, la règle complète (version incluse), le seuil, le modèle/cycle UTC, les variables/dates sans doublon, le PRA, les empreintes sources, le référentiel, l'identité du résultat, la fraction et le support de sa géométrie. La certification immuable du producteur lie cellules et coordonnées ; le lecteur ne reconstruit pas de géométrie ni de grille native. Toute corruption refuse le lot. Limites supplémentaires : 512 références, cinq shards maximum par requête, 1 Mio par objet, 2 Mio transférés et 16 Mio décompressés. Aucun nouveau cache ou flag.

Les résultats sont raccordés à `forecastRecipeMasks`, au transport dynamique agroclimatique et à la pièce de rendu des cartes candidates. Une édition déjà publiée reste exclue ; une pièce candidate n'est acceptée que si sa valeur égale exactement la valeur gelée. Les autres résultats restent sous le lecteur antérieur. Les 26 400 THI inadmissibles et 660 absences ne figurent pas dans les nouvelles pièces et ne sont pas rendus admissibles.

Le contrôle temporel porte sur la qualification conservée du support commun. La complétude d'un agrégat historique sur un autre support n'est pas utilisée comme certificat du support commun.

## Résultats et limites

- Lecteur réel, transport local des octets conservés : **1 185/1 185** résultats strictement identiques ; **540/540** géométries partielles acceptées par `coveragePaint`, refus systématique d'un support géométrique incompatible. Chaque jeu d'entrées couvre 713 PRA. Refus d'une autre archive, version de règle, seuil ou provenance ; refus du contenu corrompu et absence de lecture flag désactivé.
- **Ces 540 contrôles ne sont pas un rejeu dans les parcours HTTP/navigateur réels.** Aucun succès de bout en bout n'est revendiqué.
- Les pièces numériques portent la version exacte `multiproduction-agro03-1.0.0`. Explorer utilise `agroclimatic-1.3.0` et les éditions actives `multiproduction-descriptive-1.0.0`. Le lecteur ne les assimile pas. Activer AGRO-03 ou renommer une règle pour contourner cette différence violerait le périmètre. Le raccordement livré reste donc inaccessible à ces routes pour ces nouvelles valeurs.
- Météo, analyse, Cartes du jour, Journal, miniatures et carrousel : les parcours réels et les 713 contours rendus par le navigateur **ne sont pas requalifiés dans COUV-05E**. Les preuves COUV-05D ne sont pas présentées comme un nouveau rejeu. Aucun composant de contours, légende ou palette n'est modifié.
- Le candidat est généré localement pour revue, **pas inséré dans Storage ni exporté vers GitHub**. Le contrôle automatique a refusé le push initial contenant les copies d’archives et de sidecars potentiellement privés ; ces copies ont été retirées du commit avant publication. Le pin de production reste inchangé. Une activation globale reste NO-GO tant que les identités de règles des parcours autorisés ne sont pas résolues et les 540 cas rejoués réellement.

## Performances

243 shards, au plus 40 171 octets compressés chacun. Mesures du lecteur sans cache, octets locaux : médiane 24,48 ms, p95 59,11 ms, maximum 109,25 ms. Ces mesures comprennent vérification SHA, décompression, sélection et identité ; elles n'incluent ni HTTP, ni Next, ni navigateur, ni démarrage serverless. **Chargement web à froid non qualifié**.

L'audit Storage relit 260 objets / 172 331 262 octets en 25,15 s, 267 GET, zéro écriture. Les trois archives conservées sont relues et leurs SHA contrôlés. Les pointeurs `catalogue.json` et `current.json` sont identiques avant/après. C'est une mesure de lot de vérification, pas une latence web.

## Reproduction

Depuis la racine, avec les dépendances Python `engine[geo]` et pnpm 10.0.0 :

```bash
PYTHONPATH=engine/src:scripts python scripts/couv05d_storage.py --output work/couv05e-store
python scripts/couv05e_package.py --store work/couv05e-store --output work/couv05e-candidate
cd apps/web
node_modules/.bin/vitest run lib/server/forecast-qualified.real.test.ts lib/server/forecast-composites.test.ts features/cartography
node_modules/.bin/tsc --noEmit
```

Après les deux commandes de préparation ci-dessus, le test lit les nouveaux objets locaux sous `work/couv05e-candidate` et la copie inchangée d'archive sous `work/couv05e-store`, sans acquisition, réseau ou recalcul scientifique pendant le test. Le test d'intégration est explicitement ignoré si le candidat local est absent ; le test de refus reste exécuté. Son transport local est explicitement mocké ; le lecteur, les octets, les résultats et `coveragePaint` sont réels. Le rapport d'exécution actualisé est écrit sous `work/couv05e-results`.

Pin candidat : `40cc3aebeb338f5cb63898f77a12680104749a7d9f67c27afc97810e5ec193c9`. Son index conserve les références natives antérieures ; les blobs sont générés localement ; seuls les rapports sont inclus dans `evidence`. Aucun objet publié n’est remplacé. Retour arrière : les flags et pins existants sont inchangés ; désactiver `COUV05_RENDER_ENABLED` reste effectif avant toute lecture.
