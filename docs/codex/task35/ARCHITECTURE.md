# T35 — Architecture

Frontières : T33 fournit `EditorialBriefingBundle`, T34 fournit des publications collectées en amont, le registre conserve les indicateurs qualifiés. Aucun calcul climatique, moteur temporel, collecteur ou workflow de production n'est modifié.

`features/editorial-ai/` sépare contrat (`model`, JSON Schemas), instructions (`prompt`), configuration et tarifs (`config`), transport REST Responses officiel (`provider`), orchestration (`generate`), vérification indépendante (`validate`), repli (`fallback`) et stockage local/DEV (`archive`). Les modules manipulant la configuration ou les écritures portent `server-only`.

Le batch manuel consomme un dossier déjà construit. Une réservation financière durable précède l'unique POST. La validation précède l'archivage ; les erreurs produisent un repli déterministe sans nouvel appel. Une seule génération couvre conférence, rédaction et rubriques.

La lecture `/journal/preview` réutilise CSS, classes éditoriales et composant PRA de T32B. Le Journal public reste inchangé. Le lecteur utilise un manifeste explicite de deux archives de recette et des cartes figées. Ni fournisseur ni générateur ne sont importés par les routes de lecture. Aucun secret, tarif serveur ou fichier de configuration complet n'est sérialisé.

T35 utilise exclusivement le disque local/DEV. Pas de migration, écriture Supabase, cron, déclencheur de production ou publication automatique. Le stockage durable partagé et le remplacement atomique du manifeste de publication seront raccordés dans T36.
