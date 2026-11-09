# DailyEditorialSnapshot v1

Contrat TypeScript : `features/nightly/snapshot.ts`. Identité SHA-256 sur le contenu,
jour Europe/Paris, cutoff UTC correspondant à 05:40 Paris, gel horodaté, politique,
qualité, sources avec émissions/acquisitions/validités/variables/supports/empreintes,
dossier T33 complet (indicateurs, épisodes, Almanach, documentaire), limitations.

Le lot d’entrées complet (catalogue capturé, document national, séries ERA5,
épisodes/comparaisons et T34) est compressé puis stocké sans upsert sous
`pra-climate-archives/editorial-inputs/<sha256>.json.gz`, avec lecture retour exacte.
Le snapshot référence chemin, taille et SHA. Postgres porte le dossier immuable
par date ; une seconde préparation différente échoue au lieu de modifier le gel.
Les historiques ERA5 sont lus par entrées du catalogue capturé, le forecast par
checksum exact ; les dates d’acquisition/calcul postérieures au cutoff sont exclues.

`prepare-offline` lit les vraies archives distantes mais écrit uniquement en local :
sa référence input_archive est explicitement null. Cette preuve n’est **pas** un
snapshot partagé déployé. `prepare` / `run` vérifient stockage puis gel SQL avant IA.

Les clés des sujets réellement publiés la veille alimentent la nouveauté T33 ; la
référence de cette édition antérieure est conservée dans le lot gelé.

Les arrivées tardives sont réservées au prochain dossier/explorateur. Aucune lecture
météo dans le prompt, aucun accès IA aux calculateurs. En cas d’insuffisance, le
snapshot reste diagnostiquable ; le Journal garde sa dernière édition datée.
