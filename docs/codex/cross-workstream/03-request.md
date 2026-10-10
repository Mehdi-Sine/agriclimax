# Task 03 → Task 04 : intégration persistance

Aucun changement de `supabase/`, repositories web ou `contracts/`.
Le pipeline prend une interface interne `ObservationRepository.persist(DayBatch) -> bool`.
SQLite sert uniquement de référence locale et de cible de tests.

Pour un futur adapter serveur Task 04 / intégration : proposer ensemble un contrat
météo partagé via `contract-change/*` avant de rendre ce modèle interne public.

Sémantique à préserver : partition unique `(source_id, valid_date UTC)` ; remplacement
atomique de la partition et de ses observations après validation, jamais append à
chaque rejeu ; unicité observation `(source_id, cell_id, variable, observed_at UTC)`.
Un payload identique (hors retrieved_at) est sans effet. Révision publiée plus
ancienne rejetée. Conserver la première provenance de téléchargement lors d'un
rejeu identique et tracer les nouveaux essais dans les manifests.

Lots invalides en quarantaine, jamais à la place d'une partition valide. Les lots
missing/partial sont explicites. Stocker unités, timezone source, publication,
récupération, checksum, marqueur demo, version normalizer, statut/fraîcheur/flags.
Les sources brutes restent dans un stockage fichiers/objet séparé de Postgres.
Le namespace démo doit rester isolé des observations production.

La clé serveur Supabase reste en variables d'environnement du processus serveur,
jamais dans le navigateur. Les credentials ne sont pas nécessaires à Task 03.
