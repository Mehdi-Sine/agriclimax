# État actualisé — recette DEV du 9 novembre

Dossier partagé réel DEV du 9 novembre : snapshot 9a80aa650e29356b01095854d6ae4d546d1c7ad70ee42325805af3178c1f01c7, qualité fallback_valid, 12 faits T33. Cutoff 04:40 UTC /05:40 Paris ; gel réel 11:05:16.801 UTC /12:05 Paris : reconstruction tardive, pas nuit réussie. Prévision du 8 novembre 06Z ; historique jusqu'au 2 novembre, 15 jours, 10695 lignes, 713 PRA. Archive gzip privée editorial-inputs/319bce61de5d4be452186ac84997800706a065ca5c2e825f41d65e8d741c47c1.json.gz (4533471 octets), relue et SHA vérifié. Le preflight réel gpt-6.1-terra borne 55953 tokens entrée et 6000 sortie, provision 0,094549 € sous plafond 0,15 €. Ne pas confondre provision et facture.

Voir [ACCEPTANCE.md](ACCEPTANCE.md) pour les blocages et preuves actuels.

<details>
<summary>Conception et constat historique avant déploiement (supplantés par l’état ci-dessus)</summary>

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

</details>
