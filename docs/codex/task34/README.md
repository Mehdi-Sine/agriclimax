# T34 — veille documentaire agricole

Moteur batch manuel prêt à évaluer, sur branche `codex/34-agricultural-news-ingestion`, base `c837fcd` intégrant DATA-01. Aucun horaire ni publication activé.

- [Accès et droits des sources](SOURCES_RIGHTS.md)
- [Architecture et fenêtre avant 6 h 30 Europe/Paris](ARCHITECTURE.md)
- [Contrat de qualification](QUALIFICATION_CONTRACT.md) et [JSON Schema v1](editorial-news-1.schema.json)
- [Rapprochements documentaires](MATCHING_RULES.md)
- [Pilote réel](PILOT.md)
- [Ressources et limites](RESOURCES_LIMITS.md)
- [Tests et preuves](TESTS_PROOFS.md)

Résultat du pilote : 7 flux DRAAF disponibles (6 éditeurs), 130 publications uniques, 17 contextes utiles à relire, 113 rejets lexicaux et 6 doublons/republications possibles. Zéro concordance à 14 jours avec l’archive disponible ; sept liens de contexte saisonnier issus d’une publication, sans confirmation scientifique. Instituts et presse restent désactivés tant que les accès/droits ne sont pas établis.

L’export réel compact est `evidence/pilot-bundle.json.gz`. Pour le consulter sans accès réseau :

```sh
python -c 'import gzip; print(gzip.open("docs/codex/task34/evidence/pilot-bundle.json.gz", "rt").read())'
```

Le pilote n’établit pas une couverture nationale exhaustive, une validation agronomique, ni l’autorisation de reproduire les articles liés. La PR reste draft pour revue du corpus, des droits et du futur branchement T35.
