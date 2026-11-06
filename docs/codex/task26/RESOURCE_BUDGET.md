# Task26D — mesures et conservation24mois

Aucune dépendance reversionnée pour contourner le proxy, aucun abonnement ni service payant ajouté. Les ressources existantes GitHub/SupabaseDEV/VercelPreview sont utilisées avec TLS normal.

| Opération | Requêtes source | Octets source | Durée |
|---|---:|---:|---:|
|Cycle national initial00UTC Task26C|413|95182413|694,65s|
|Nouvelle publication06UTC Task26D|93|9774447|136,99s|
|Masques officiels MF statiques|2|1984659|voirrun42216548574|
|Comparaison RH/Td bornée|4|3752|voirrun42220117693|
|Sensibilité terrestre depuis caches|0|0|voirrun42220846519|
|ERA31 premier lot|8|307949|380,63s|
|ERA31 dernier stade|21|1105506|837,98s|

Le stade intermédiaire ERA a atteint22minutes ; ses volumes et échecs ne sont pas présentés comme un cycle réussi. Les cache/checkpoints ont été repris, pas réacquis systématiquement. La limite source globale demeure128MiB ;4GiB de mémoire,448MiB de workspace et tailles unitaires bornées restent contrôlés.

## Conservation mesurée

Cycle06UTC562520octets ; journéeERA31singleton284028octets. Projection quotidienne730jours : **617980040octets** pour ces deux composants. Le support quotidien compressé mesure8198octets ; le blob géographique unique983425octets et les masques officiels14934octets. Projection730jours incluant ces objets : **624962939octets (596,01MiB)**, hors petit catalogue et publications de cycles supplémentaires conservées. Ce scénario suppose un cycle météo/jour et un masque stable ; quatre cycles/jour porteraient la composante météo seule à1,64GB et dépasseraient le budget. La garde ne supprime pas les anciennes archives : un changement de cadence/conservation exige une décision explicite. La gardeStorage900MiB est indépendante de la gardeDB375Mo ; les grilles brutes n'y sont pas publiées.

Le manifeste courant ne transporte que le dernier cycle, la dernière archive et les dates connues ;1685octets après ERA31/masques ; catalogue2676octets. Storage réel :11objets,3504682octets ; somme des objets indexés hors catalogue/manifeste3500321octets. PostgreSQL164533939octets,32136lignes quotidiennes et521916normales, empreintes scientifiques inchangées ; la variation de taille physique32768octets depuis le relevé précédent ne correspond à aucune nouvelle ligneERA31 (archive-only). Le catalogue complet est mis en cache15minutes. Cela limite les lectures répétées de l'index24mois ; les réponses cartographiques restent713lignes/date/variable, historiquePRA≤45lignes météo. Les coûts d'egress et de démarrages serverless restent fonction du trafic, pas une garantie d'usage gratuit illimité.

InventaireGitHub en lecture seule :1805artefacts actifs,2204833386octets logiques existants, dont287037048octets de checkpoints météo à l'instant de mesure. Aucun artefact supprimé. Ces tailles ne prouvent pas le quota de facturation disponible du compte ; le dépôt est public (`main` branche par défaut). Les runners standards GitHub hébergés des dépôts publics sont gratuits selon la documentation officielle ; cela ne prouve pas le quota de stockage/artefacts disponible ni les limites des autres services. Les compteurs doivent être vérifiés avant activation. Les futurs checkpoints météo et ERA ne sont conservés que3jours ; l'exportERA ne contient que la journée courante,6,96Mo non compressés dans l'essai31octobre. Les anciennes preuves ne sont pas effacées.

Le tempsCDS dépend des files fournisseur. Trois stages bornés au maximum couvrent une reprise difficile, sans augmenter les plafonds. Les30emprises2° nationales demandent normalement30requêtesCDS,60au changement de mois. Dimensionner les minutes sur cette réalité, les installations et les CI, pas sur le seul petit préflight. Après fusion, surveiller la première exécution et les compteurs réels avant de maintenir le drapeau quotidien.

Références : [Supabase stockage/egress](https://supabase.com/docs/guides/storage/serving/bandwidth), [GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions), [limitesVercel](https://vercel.com/docs/functions/limitations). Aucun plafond de service augmenté automatiquement.
