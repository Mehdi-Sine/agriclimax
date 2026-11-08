# Mémoire des épisodes

Un épisode est une séquence sur UNE PRA, un phénomène et une signature scientifique. L'algorithme suit chaque journée consécutive ; un trou, un support partiel ou une nouvelle signature interrompt le rapprochement. Les séquences sèches de moins de trois jours ne sont pas retenues. Une journée négative compatible immédiatement suivante confirme la fin ; sinon la continuité est non démontrée, ou l'épisode est en cours au cutoff de l'archive.

L'identité hashée dépend de PRA, phénomène, début documenté et signature. `left_censored` indique que le début réel peut précéder l'archive. La durée est un minimum documenté. Chaque observation conserve sa date, valeur et fact_id ; les références de lots, fraîcheur, qualité et version sont archivées.

`extendEpisode` rapproche explicitement deux fragments de même signature, PRA, nature et phénomène, avec chevauchement ou contiguïté exacte. Il refuse un épisode déjà clos, les trous et les observations divergentes ; il conserve l'identité et le début du premier fragment. Pas d'association par seule ressemblance de catégorie, pas de fusion entre PRA, pas de fusion prévision/réanalyse.

Le batch reconstruit la fenêtre disponible à partir des archives et écrit une mémoire immuable complète. Il ne prétend pas reconstituer les jours absents avant octobre ou assurer une mémoire nationale persistante en production. T35 devra charger le dernier état archivé puis appliquer l'extension contrôlée, avec une politique explicite de révision.

Archive : `climate-episode-memory-1`, schéma strict partagé. Le SHA-256 couvre les octets UTF-8 décompressés, vérifiés côté Python. Les 2 734 épisodes sont des épisodes PRA, pas 2 734 phénomènes nationaux indépendants. Aucune sécheresse agricole, conséquence sur culture ou surface touchée n'est déduite.
