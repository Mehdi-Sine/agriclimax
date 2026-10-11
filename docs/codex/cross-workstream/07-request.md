# Task 07 — point d’intégration du shell

La veille métier est disponible à `/watch` (mode demo par défaut, explicitement
fictif). Elle consomme les composants et tokens Task 05 sans modifier
`components/shell`, `components/ui`, `styles`, les contrats, le moteur ou l’API.

Pour Task 10 / owner du shell : remplacer l’emplacement de veille et la navigation
`/?view=watch` par `/watch`, en conservant production/indicator/date/territory/
compare et les sélecteurs live. Le parcours inverse carte/diagnostic depuis un
signal est déjà conservé dans l’URL canonique. Les vues carte/diagnostic restent
les emplacements des Tasks 06 et 08 ; aucune carte ni explication métier ajoutée.

`SignalCard` Task 05 contient une date et un marqueur demo codés pour son catalogue.
`WatchSignalCard` compose donc les mêmes badges et classes CSS avec les faits du
signal, plutôt que de modifier le composant primaire de Task 05.

Le seam `StructuredEventSource` accepte uniquement des événements de résultats
structurés. Aucun adaptateur live n’est configuré dans cette tâche. Un branchement
doit fournir evidence_id, recorded_at UTC et mode avec le résultat contractuel,
sans fallback démo. Le service narratif n’accepte qu’un EvidenceBundle fermé.

La vérification axe WCAG 2.1 AA a détecté `label-content-name-mismatch` sur
`BrandLockup` (son aria-label masque la signature visible). Task 07 compose le
symbole et les classes de marque avec un lien au nom accessible naturel,
sans modifier le composant primaire Task 05. À généraliser par son owner.
