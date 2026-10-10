# Task 02 — moteur scientifique pur et traçable

Ajoute des primitives déterministes typées, fenêtres absolues/relatives, validation
des entrées et classification générique. La règle fictive existante est chargée
sans changement et produit un RiskResultV1 avec version exacte, provenance,
couverture, résolution, fraîcheur et flags ; les données incomplètes ou invalides
ne sont plus interprétées comme zéro risque.

- Contrats consommés : RiskResultV1 ; modèles Python existants. Contrats modifiés : aucun.
- Frontières affectées : moteur scientifique et tests ; documentation Task 02 ;
  configuration de build web pour corriger le dernier échec de make check.
- Configuration et seuils scientifiques : inchangés, statut exploratory conservé.
- Migrations : aucune. Sécurité : aucun accès cloud ni secret dans le moteur.
- Supabase, design system, carte, veille : aucun changement.
- Build : `apps/web/next.config.ts` sélectionne l’API TypeScript via
  `experimental.useTypeScriptCli: false` ; le sous-processus CLI produisait une
  sortie vide empêchant le parsing de `--showConfig` dans cet environnement.
  Vérification des types maintenue, dépendances et tsconfig inchangés.
- Validation finale : `make check` complet réussi (28 tests Python, contrats/config,
  lint, typecheck, 3 tests web et build Next.js). Journal : `make-check.log`.
- Maintenance : option Next expérimentale, à réévaluer lors d’une migration
  TypeScript sans API JavaScript.
- Tests : golden reproductible avec version exacte et validation JSON Schema,
  missing/stale/unknown/invalid/duplicate, propriétés GDD et percentiles,
  frontières des classes et paramètres invalides.
- Limites : adaptateur de règle disponible uniquement pour le compte de jours chauds
  existant ; autres primitives sans nouveaux seuils agronomiques. Confiance low
  faute de politique validée. Sources/métadonnées de gouvernance manquantes dans
  l'exemple existant, qui reste fictif. Voir engine/README.md.

PR en draft vers `main` ; aucun merge.
