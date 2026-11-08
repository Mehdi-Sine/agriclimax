# Installation résiliente des scanners CI

## Incident et périmètre

Les relances des runs [Quality 42468556327](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42468556327) et [Security audits 42468556306](https://github.com/Mehdi-Sine/agriclimax/actions/runs/42468556306) échouent avant le démarrage des scanners : HTTP 504 lors du téléchargement des archives Actionlint 1.7.7 et Gitleaks 8.24.2. Les logs des jobs `128698959883` et `128699013613` confirment le code curl 22.

La correction porte uniquement sur les deux workflows, `scripts/quality/install-go-tool.sh`, ses tests et cette documentation. Aucun calcul, contrat scientifique, dépendance applicative ou composant du Journal modifié.

## Chemin principal : archives officielles

Versions, URLs et SHA-256 inchangés :

| Outil | Version | SHA-256 de l'archive Linux amd64 |
|---|---|---|
| Actionlint | v1.7.7 | `023070a287cd8cccd71515fedc843f1985bf96c436b7effaecce67290e7e0757` |
| Gitleaks | v8.24.2 | `fa0500f6b7e41d28791ebc680f5dd9899cd42b58629218a5f041efa899151a8e` |

Téléchargement HTTPS uniquement, redirections HTTPS uniquement, validation TLS conservée. Curl effectue au plus **quatre tentatives**, avec trois secondes entre les reprises. Il traite les erreurs temporaires HTTP 408/429/500/502/503/504, les timeouts et les connexions refusées ; un 404 ne déclenche pas de répétitions inutiles. Connexion bornée à dix secondes, transfert à trente secondes par essai, budget de reprises à 120 secondes. Une limite externe de **150 secondes** borne également les délais `Retry-After`.

Un téléchargement complet doit passer le SHA-256 **avant extraction**. Un checksum incorrect ou une erreur d'extraction est terminal : aucun repli ne masque une anomalie d'intégrité.

## Secours : compilation Go authentifiée

Si le téléchargement est inaccessible, compilation des modules officiels à leurs versions exactes :

- `github.com/rhysd/actionlint/cmd/actionlint@v1.7.7` ;
- `github.com/zricethezav/gitleaks/v8@v8.24.2` (le chemin du module officiel précède le transfert du dépôt vers l'organisation Gitleaks).

Les workflows préparent **Go 1.26.10** avec `actions/setup-go` épinglé au commit `d35c59abb061a4a6fb18e82ac0862c26744d6ab5`. Le cache de modules de l'action est désactivé. Le compilateur ne télécharge pas automatiquement un autre toolchain (`GOTOOLCHAIN=local`).

L'installateur impose `GOPROXY=https://proxy.golang.org` et **`GOSUMDB=sum.golang.org`**, avec la clé publique connue du client Go. Les modules publics sont authentifiés par la base de checksums Go ; aucune exception privée ou désactivation n'est héritée : `GOPRIVATE`, `GONOSUMDB`, `GONOPROXY`, `GOINSECURE` vides, `GOENV=off`, `GOWORK=off`, `GO111MODULE=on`, `GOFLAGS` vide. Chaque installation utilise des caches de modules et de compilation privés et neufs.

Deux essais Go au maximum, chacun borné à **180 secondes**, avec trois secondes entre eux. Le budget des deux jobs passe de dix à quinze minutes pour accueillir ce secours sans supprimer aucun contrôle. Les métadonnées `go version -m` doivent confirmer le module principal, sa version exacte et son empreinte `h1:` avant la copie du binaire. Gitleaks compilé sans les paramètres de packaging peut afficher `dev` à la commande `version` : la version est donc contrôlée dans les métadonnées Go, et non présumée d'après cet affichage.

Un ancien binaire est supprimé avant l'installation. Le staging est nettoyé, y compris les modules que Go extrait en lecture seule. Un binaire n'est publié dans le répertoire de destination qu'après réussite des vérifications.

## Contrôles bloquants conservés

Les commandes de contrôle ne changent pas :

```sh
work/actionlint/actionlint -shellcheck= .github/workflows/*.yml
work/gitleaks/gitleaks git --redact --exit-code 1 --report-format json --report-path work/gitleaks/report.json .
```

Le checkout Gitleaks conserve `fetch-depth: 0`. Aucun `continue-on-error`, désactivation de règle, changement de configuration de scan, condition de saut ou succès artificiel n'est ajouté. Le rapport Gitleaks reste téléversé avec `if: always()`.

Si Releases, le proxy Go ou la base de checksums sont inaccessibles, si le compilateur manque ou si une vérification échoue, l'installation reste **en échec explicite**, et le job ne peut pas annoncer un scan réussi. Ce mécanisme résiste à l'indisponibilité de Releases, sans promettre un fonctionnement hors ligne lorsque toutes les sources de confiance sont inaccessibles.

## Validation

Les tests d'injection de panne sont synthétiques et portent sur l'installation : archive vérifiée avant extraction ; checksum et archive invalides bloquants ; versions/modules exacts ; neutralisation des exemptions Go ; reprise Go bornée ; indisponibilité totale bloquante ; suppression des anciens binaires et nettoyage des modules en lecture seule ; rejet d'une version de module inattendue. Un test de contrat des workflows protège les commandes de scan et leur caractère inconditionnel/bloquant.

Commandes reproductibles :

```sh
bash -n scripts/quality/install-go-tool.sh
python -m unittest discover -s tests/quality -p 'test_*.py' -v
python -m ruff check scripts/quality tests/quality
python scripts/quality/check_automation.py
bash scripts/quality/install-go-tool.sh actionlint work/actionlint
bash scripts/quality/install-go-tool.sh gitleaks work/gitleaks
work/actionlint/actionlint -shellcheck= .github/workflows/*.yml
work/gitleaks/gitleaks git --redact --exit-code 1 --report-format json --report-path work/gitleaks/report.json .
```

Résultats locaux de la correction :

| Vérification | Résultat |
|---|---|
| Installation Actionlint | Quatre vrais HTTP 504, puis compilation authentifiée de v1.7.7 réussie |
| Installation Gitleaks | Quatre vrais HTTP 504, puis compilation authentifiée de v8.24.2 réussie |
| Actionlint sur tous les workflows du dépôt | Réussi, options d'origine |
| Gitleaks sur l'historique Git complet | Réussi, options d'origine, aucune fuite |
| Actionlint sur fixtures valide / invalide | Codes 0 / 1 attendus |
| Gitleaks sur dépôt propre / faux jeton synthétique commité | Codes 0 / 1 attendus ; détection `github-pat` et rapport entièrement expurgé |
| Archive Gitleaks officielle disponible en cache | SHA-256 et extraction réussis ; binaire 8.24.2 opérationnel |
| Même archive volontairement altérée | Code 1, aucun binaire installé et aucun repli Go |
| Tests qualité Python / Node | 20 / 8 réussis ; huit tests Python ajoutés |
| Couverture des garde-fous qualité | 82 %, seuil 80 % conservé |
| Ruff, structure YAML/JSON, sécurité sources, migrations immuables, `bash -n`, `git diff --check` | Réussis |

Les tests de scanners utilisent les vrais binaires issus de la compilation de secours. Le faux jeton est généré aléatoirement dans un dépôt temporaire ignoré par le dépôt principal ; aucune valeur du jeton n'est publiée. Les résultats résumés figurent dans [evidence/ci-tools.json](evidence/ci-tools.json). Les tests d'installation synthétiques ne sont jamais présentés comme des scans réels.
