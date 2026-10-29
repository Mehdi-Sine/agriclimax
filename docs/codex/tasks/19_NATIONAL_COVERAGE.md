# AgriclimaX — Task 19
## National Agricultural Zoning, Climate Aggregation & Low-Cost Storage

**Branch:** `codex/19-national-coverage`
**Baseline:** v0.2.0 — latest `main`
**Target:** National operational coverage, France métropolitaine + Corse
**Status:** To implement — do not merge automatically

---

# 0. Mission and strategic objective

AgriclimaX is an agricultural climate observation, monitoring, alerting and diagnostic platform.

The long-term objective is to provide climate-risk information for **50–100 agricultural productions**, including crops and livestock, across metropolitan France and Corsica. Overseas French territories (DOM) will be addressed later.

The user is not looking for farm-level or parcel-level forecasts.

The desired geographic hierarchy is:

1. France
2. Administrative regions
3. Departments
4. **Petites régions agricoles (PRA)** — finest supported diagnostic level

The 713 official PRA are the primary territorial units for storing and delivering climate diagnostics.

The central architectural principle is:

**Process climate data at scientifically appropriate source resolution, but store and serve compact, scientifically meaningful territorial aggregates.**

The platform must remain scientifically defensible, extensible and inexpensive to operate.

**Financial priority: target compatibility with the Supabase Free plan wherever technically feasible, without compromising data reliability, security or essential platform functionality.**

Do not interpret this as permission to eliminate essential scientific information.

---

# 1. Existing project baseline

AgriclimaX v0.2.0 already includes:

- Task 11 — Météo-France live ingestion
- Task 12 — ERA5-Land
- Task 13 — Wheat MVP
- Task 14 — Cattle THI MVP
- Task 15 — France coverage preparation
- Task 16 — Live risk integration
- Task 17 — Daily live pipeline
- Task 18 — v0.2 integration
- Diagnostic client minimization fix

Existing functionality includes:

- Map
- Diagnostic
- History
- Climate monitoring
- Desktop, tablet and mobile layouts
- Explicit live/demo distinction
- CI, security checks and Vercel deployment

Preserve existing v0.2.0 behavior.

Do not introduce new indicators or new production models during this Task.

---

# 2. Git workflow — mandatory

1. Start from the latest remote `main`.
2. Confirm the v0.2.0 reference commit/tag.
3. Create branch `codex/19-national-coverage`.
4. Configure Git identity:
   - `user.name = Mehdi-Sine`
   - `user.email = mehdi.sine@acta.asso.fr`
5. One Task = one branch = one PR.
6. Commit all source changes and migration files.
7. Open a single PR.
8. Do not merge.
9. Do not deploy production schema changes automatically.

Do not include unrelated refactoring.

---

# 3. Mandatory technical audit before implementation

Inspect the actual repository and current infrastructure.

Verify:

- Existing geographical schema.
- ERA5-Land grid and retrieval methods.
- Météo-France station architecture.
- Existing live data structures.
- Existing wheat and cattle models.
- Existing API endpoints.
- Existing ingestion orchestration.
- Supabase tables, indexes, views and RLS policies.
- Current database and object-storage usage, when accessible.
- GitHub Actions workflows, permissions and runtime limits.
- Vercel environment and build configuration.
- Existing migration conventions.
- Current testing infrastructure.

Produce an architecture audit documenting:

1. Components that can be reused unchanged.
2. Components requiring modification.
3. New components genuinely needed.
4. Existing data that must be preserved.
5. Potential breaking changes.
6. Estimated database footprint.
7. Scientific assumptions requiring explicit validation.

Prefer adaptation over replacement.

If infrastructure access is unavailable, explicitly identify that limitation instead of inventing measurements.

---

# 4. Official PRA geographic reference

## 4.1 Source

Use the official French agricultural geographic reference.

Preferred sources:

- Agreste — Régions agricoles / Petites régions agricoles
- French public geographic datasets published on data.gouv.fr, with traceable official provenance

Reference sources:

https://agreste.agriculture.gouv.fr/agreste-web/methodon/Z_PRA_2017/methodon/

https://www.data.gouv.fr/datasets/petites-regions-agricoles-source-ministere-de-lagriculture-2017

Expected official reference: 713 PRA in metropolitan France.

However, **verify the actual record count, unique identifiers, geometries and geographic coverage from the imported source**. Do not invent missing entities merely to reach 713.

## 4.2 Data model

Create or reuse a versioned geographic reference with:

- Stable PRA identifier
- Official PRA code
- PRA name
- Department code
- Department name
- Administrative region code
- Administrative region name
- Geometry
- Area in square kilometres
- Source name
- Source publication/version date
- Import/checksum metadata

Support multipart geometries where needed.

Be careful with Corse, coastal territories and administrative changes.

Do not assume a PRA is interchangeable with a municipality or independent of its department.

Preserve leading zeros in geographic codes.

## 4.3 Spatial quality controls

Validate:

- Geometry validity
- Coordinate reference system
- Unique identifiers
- Absence of unexpected overlaps
- Absence of unexplained geographic gaps
- Metropolitan coverage including Corsica
- Department and region consistency
- Correct handling of multipart geometries
- Reproducibility of the reference import

Do not simplify geographic boundaries destructively.

If simplified display geometries are needed, store them separately from authoritative geometries.

---

# 5. ERA5-Land to PRA spatial correspondence

## 5.1 Fundamental principle

Keep ERA5-Land source resolution at 0.1° × 0.1° for the relevant climatic computations.

Create a reproducible correspondence between native ERA5-Land cells and official PRA polygons.

The correspondence must allow several ERA5 cells to contribute to one PRA, and a boundary ERA5 cell to contribute to multiple PRA.

## 5.2 Spatial weights

For each ERA5/PRA intersection, define:

- ERA5 cell ID
- PRA ID
- Intersection area
- Intersection weight
- Weighting method
- Geometry/reference version
- Quality flags

Use an appropriate equal-area projection or geodesic area computation.

A basic acceptable weighting method is based on intersection area within each PRA.

Do not use latitude/longitude degree area directly as a surface measure.

If reliable agricultural land-use masks are already available, evaluate whether an agricultural-area weighting is scientifically justified.

Otherwise, use total-area weighting, label it explicitly and document this limitation.

Do not invent agricultural land-use weights.

Normalize weights consistently and report uncovered or invalid cells.

The correspondence must be deterministic and regenerable.

## 5.3 Geographic edge cases

Explicitly test:

- PRA smaller than one ERA5 grid cell
- PRA crossing multiple grid cells
- Coastal PRA
- Mountainous PRA
- Corsican PRA
- Multipart PRA
- Cell partly outside metropolitan France
- Cell with missing meteorological values

Do not create a false impression of fine-scale accuracy.

---

# 6. Scientific aggregation engine

This component is the scientific foundation of the new architecture.

## 6.1 Critical rule

**Never assume that every climate indicator can be computed from average PRA weather values.**

Some indicators can be derived from aggregated climate data.

Others, particularly threshold and extreme-event indicators, require calculations at native temporal/spatial resolution before aggregation.

Implement a framework that can support both methods with explicit metadata.

## 6.2 Aggregation families

Support at least the following generic mathematical families:

### A. Spatial means

For suitable variables:
- Mean temperature
- Mean humidity
- Other compatible continuous meteorological variables

Use documented weighting methods.

### B. Spatial extrema

When relevant:
- Maximum temperature
- Minimum temperature
- Maximum value of an existing approved risk indicator

Specify whether the statistic represents a maximum observed among contributing cells or another defined quantity.

### C. Temporal accumulations

When scientifically appropriate:
- Total precipitation
- Cumulative climatic exposure
- Duration of an event

Treat accumulated ERA5 variables using documented source conventions.

Never sum spatial cell precipitation amounts to produce a PRA precipitation depth.

### D. Threshold exposure

For threshold-based indicators:

1. Compute the relevant threshold condition at the appropriate source resolution.
2. Aggregate the affected spatial fraction or duration.
3. Store the resulting territorial exposure and its validity information.

Example: proportion of contributing PRA area experiencing an existing heat-risk threshold.

### E. Data completeness

For each aggregation, retain:

- Source
- Temporal period
- Valid contributing cell count
- Expected contributing cell count
- Valid weighted coverage fraction
- Missing-data status
- Aggregation method/version

Avoid unqualified complete-looking values when data are incomplete.

## 6.3 No new scientific assumptions

Do not create arbitrary agricultural thresholds or new crop/livestock risk models.

Reuse the validated existing wheat and cattle MVP logic.

If an indicator cannot be meaningfully aggregated with the current scientific definition, mark it as unsupported or requiring scientific validation.

No silent approximations.

## 6.4 Temporal conventions

Document and test:

- UTC timestamps
- Source time-zone conventions
- Daily aggregation windows
- Leap years
- Daylight-saving transitions
- ERA5-Land accumulated variables
- Missing hourly observations
- Data revisions and reprocessing

Avoid deriving daily risk values from incomplete hours without explicit completeness checks.

---

# 7. Storage architecture — Supabase minimal footprint

## 7.1 Primary rule

Supabase must primarily contain compact, useful territorial information.

Do not store full national hourly ERA5-Land history in PostgreSQL.

Do not introduce a separate weather time series for every future agricultural production.

Avoid unnecessary JSON duplication and redundant geographic attributes on every time-series record.

Use normalized references where appropriate.

## 7.2 Recommended logical layers

Design the minimum schema needed for:

### A. Geographic reference

- PRA
- Geographic reference version
- Department/region relations
- ERA5-to-PRA correspondence

### B. Climatic territorial data

Shared climatic variables or reusable climatic statistics by:
- PRA
- Date/period
- Variable or indicator
- Source
- Aggregation method

### C. Existing agricultural diagnostics

Store only the results necessary for application delivery.

Preserve indicator version and associated scientific model metadata.

### D. Climatology-ready structure

Prepare compatibility with 1991–2020 reference statistics.

Do not compute the national 30-year climatology during Task 19.

### E. Ingestion metadata

Track:
- Runs
- Batches
- Status
- Source and period
- Record counts
- Failures
- Last successful updates
- Storage impact

Keep operational logs compact and bounded.

## 7.3 Schema design

Evaluate a compact hybrid schema:

- Strongly typed commonly used fields where efficient.
- Normalized metadata for indicators and variables.
- Optional compact scalar observations for extensibility.
- No uncontrolled EAV table explosion.
- No one-table-per-production model.
- No repeated geometries in observations.

Avoid prematurely introducing a huge generalized schema for all 100 future productions.

The schema should allow new indicators to be added without destructive redesign.

## 7.4 Retention strategy

Propose and implement configurable retention policies.

Initial design target:

- 90 days of recent daily PRA climate data.
- Longer retention of scientifically useful summaries.
- Persistent reference climatologies when implemented later.
- Compact source provenance.
- Bounded operational logs.

Before activating any deletion:

- Identify downstream dependencies.
- Verify existing history functionality.
- Ensure required longer-period risk calculations remain possible.
- Provide a dry-run retention command.
- Document archival or recomputation strategy.

Never automatically purge existing v0.2.0 data.

## 7.5 Budget controls

Supabase Free currently provides a limited PostgreSQL database capacity.

Use **500 MB as the planning database limit**, but verify current pricing and limits before final deployment.

Create a measurable storage budget:

- Current database size
- Proposed geographic tables
- Spatial mapping tables
- Daily PRA records
- Indicator results
- Indexes
- Logs
- Expected growth at 90 days and one year

Propose warning levels at:

- 60% of free-tier database capacity
- 75%
- 90%

These are application planning thresholds, not vendor service limits.

Use at most 75% as the initial engineering target, leaving headroom for existing application data, maintenance and future changes.

Do not automatically upgrade Supabase.

Do not activate paid services.

Do not rely on GitHub Actions, Vercel or Supabase free-tier usage exceeding their published contractual limitations.

## 7.6 Historical data

Do not create a large permanent archive of ERA5-Land files inside Supabase by default.

Prefer:
- Reproducible retrieval parameters
- Source identifiers and version metadata
- Dataset checksums when applicable
- Recomputable intermediate products
- Compact persisted statistics

If recomputation is too expensive or source versions may become unavailable, document a low-cost compressed archive strategy.

Any external storage proposal must be optional and costed.

---

# 8. National climate ingestion

Extend, rather than replace, the existing ERA5-Land ingestion.

## 8.1 Pipeline stages

Implement a controlled process:

1. Identify required source variables.
2. Identify selected geographic/time batches.
3. Retrieve source data.
4. Validate units and completeness.
5. Perform required native-resolution calculations.
6. Aggregate valid results to PRA.
7. Validate aggregate output.
8. Upsert compact PRA results.
9. Record provenance and execution status.
10. Release temporary files according to a safe cleanup policy.

## 8.2 Execution constraints

Requirements:

- Small configurable batches
- Resumable operations
- Idempotent upserts
- Retry with backoff
- Controlled concurrency
- Bounded memory usage
- No unlimited downloads
- Explicit timeout handling
- No duplicate data after reruns
- Explicit source availability delays
- Safe termination and restart

Prefer existing GitHub Actions infrastructure if sufficient.

Avoid long-running Vercel functions for bulk data processing.

## 8.3 Dry-run mode

Provide a command that estimates:

- Number of PRA
- ERA5 cells involved
- Period requested
- Variables needed
- Expected records
- Expected storage
- Approximate source download volumes
- Number of batches
- Estimated workload

Dry-run must not download full datasets or modify production data.

## 8.4 Real-data validation

Use genuine ERA5-Land values for operational validation.

Synthetic fixtures are allowed for:
- Unit tests
- Edge cases
- Failure simulations
- CI

Synthetic fixtures must never be used as proof of national climate coverage.

---

# 9. Météo-France and live observation separation

Existing Météo-France observations are station-based, not a spatially continuous climate field.

Preserve this distinction.

Do not automatically spread station values across a PRA.

Do not silently combine Météo-France observations with ERA5-Land estimates into a synthetic homogeneous dataset.

A station may be geographically associated with a PRA for reference and display.

But station observations must retain:
- Station identifier
- Actual location
- Observation date/time
- Source
- Quality status

Where PRA-level live observational coverage is insufficient, return an explicit unavailable or partial status.

ERA5-Land is not a real-time forecast source.

Preserve clear separation between:
- Observation
- Reanalysis
- Forecast, if added later
- Demo/synthetic data

---

# 10. Operational APIs and geographic navigation

Adapt the application data interfaces to use PRA as the primary territorial diagnosis unit.

Support geographic queries for:

- PRA
- Department
- Region
- Metropolitan France

Department and region results should preferably be calculated from existing PRA aggregates or materialized efficiently when justified.

Do not create unnecessary permanent duplicates at every administrative level.

Provide:

- Stable geographic IDs
- Names
- Date/period
- Climate variables
- Existing agricultural indicators
- Data availability
- Data freshness
- Provenance
- Aggregation quality

Ensure that higher-level aggregated results respect indicator semantics.

For example, a national percentage of affected area must not be calculated as an unweighted mean of departmental percentages.

Preserve existing API compatibility where practical.

If compatibility-breaking changes are unavoidable, provide an adapter or explicit migration plan.

---

# 11. Frontend compatibility

Preserve the current v0.2.0 interface and user journeys.

Task 19 should provide the necessary territorial selection and data access without a full cartography redesign.

Minimum expectations:

- Metropolitan geographic scope including Corsica
- PRA lookup
- Department-level lookup
- Existing map and diagnostic flows still work
- Clear source provenance
- Missing data not presented as zero risk
- Existing live/demo distinction retained
- Mobile layout not broken

Do not redesign branding or full UX.

That belongs to Task 22.

---

# 12. Extensibility to 50–100 agricultural productions

The architecture must support future development without multiplying raw climate data storage.

Introduce reusable indicator metadata where useful:

- Indicator ID
- Version
- Units
- Computation method
- Required climate variables
- Temporal resolution requirement
- Spatial aggregation rules
- Applicable production families
- Scientific validation status

Separate:

1. Shared climate source data.
2. Reusable agroclimatic variables.
3. Production-specific risk models.
4. Territorial diagnostic output.

Do not calculate or store every indicator for every production and PRA unless actually needed.

Support sparse/on-demand indicator computation and storage when appropriate.

Make it possible to add new indicator definitions in Task 21 without major database reconstruction.

Preserve the possibility of accessing finer source climate data for indicators requiring hourly resolution or threshold calculations.

---

# 13. Monitoring and data quality

Implement a machine-readable and human-readable national coverage report.

Required metrics:

- Official PRA count imported
- Valid PRA geometry count
- Geographic coverage rate
- Number of PRA with available climate data
- Temporal completeness
- Number of PRA with supported wheat diagnostics
- Number of PRA with supported cattle diagnostics
- Number of PRA with missing inputs
- Last successful source ingestion
- Number of failed batches
- Source freshness
- Database size and estimated growth
- Storage warning status

Distinguish:

**Geographic coverage:** geographic reference exists.

**Climatic coverage:** appropriate source data are available and valid.

**Agricultural diagnostic coverage:** necessary data and approved models exist.

The report must not aggregate these into one misleading completion percentage.

---

# 14. Database migrations and security

If schema changes are required:

1. Follow the repository's existing Supabase migration conventions.
2. Generate versioned SQL migration files.
3. Avoid destructive table replacement.
4. Preserve v0.2.0 data.
5. Support staged transition where necessary.
6. Test migrations locally or in an authorized staging environment.
7. Report whether migrations were actually applied.
8. Do not apply production migrations automatically.
9. Provide rollback/restore guidance.

Review:

- RLS on exposed tables
- Explicit database privileges
- Indexes
- Views and security-invoker behavior
- Storage permissions
- Secret handling
- Service-role isolation
- Data API exposure

Do not assume an RLS policy alone grants access to a table.

Do not add new public write permissions.

Do not expose source ingestion credentials or privileged Supabase keys to browser code.

Use current Supabase documentation when selecting APIs and migration commands.

---

# 15. GitHub Actions and Vercel impacts

## GitHub Actions

Determine whether the current workflow can handle:

- PRA aggregation
- National batch execution
- Bounded memory/runtime
- Checkpoint/retry
- Daily updates
- Coverage reports

Minimize unnecessary workflow executions.

Avoid uncontrolled parallel jobs.

Preserve existing tests and security checks.

Do not start an automatic historical national backfill from CI or deployment events.

## Vercel

Preserve production build and existing routing.

Do not perform national bulk ingestion inside frontend requests or serverless request handlers.

Ensure browser requests return compact aggregated payloads.

Do not introduce new paid infrastructure.

If deployment configuration must change, document it without silently deploying.

---

# 16. Validation tests

Implement or extend tests covering:

## Geographic

- 713-PRA official reference consistency
- Stable IDs
- Department/regional hierarchy
- Corsica
- Coastlines
- Multipart polygons
- Small PRA
- Geometry validity
- ERA5-to-PRA intersection weights

## Scientific

- Weighted averages
- Spatial extrema
- Temporal accumulation
- Threshold exposures
- Missing-data propagation
- Area-weight normalization
- Incomplete hourly periods
- Precipitation accumulation semantics
- Units and conversions
- Reproducibility

## Data engineering

- Idempotent batch import
- Interrupted batch recovery
- Duplicate prevention
- Deterministic upserts
- Time-zone handling
- Storage growth limits
- Retention dry-run
- Provenance tracking

## Compatibility

- Existing wheat MVP
- Existing cattle THI MVP
- Existing daily pipeline
- Existing history view
- Existing live/demo separation
- Existing diagnostic APIs
- Desktop/tablet/mobile build

## Security

- RLS and database privileges
- No service-role exposure
- No unauthorized production migrations
- No secret leakage
- No unintended public writes

---

# 17. Progressive implementation and rollout

Use the following stages within the same Task and PR.

## Stage A — Audit and spatial reference

- Inspect architecture.
- Import/prepare official PRA reference.
- Create geographic correspondence.
- Validate geometry and count.
- Estimate storage and computation requirements.

## Stage B — Aggregation engine

- Implement scientific aggregation.
- Validate with deterministic fixtures.
- Preserve source provenance.
- Document aggregation methods.

## Stage C — Limited real-data pilot

Run authorized, bounded real-data tests covering contrasting geographic areas:

- Agricultural plain
- Mountain region
- Coastal region
- Corsica

Validate real ERA5 inputs and aggregated output.

## Stage D — National backfill mechanism

Implement resumable national processing for:

- Initial 30-day history
- Optional 90-day history

Do not initiate an unrestricted production run without explicit authorization.

## Stage E — Daily operation

Integrate controlled incremental updates with the existing pipeline, respecting actual source publication delays.

## Stage F — PR and validation report

Open one PR and present measured results.

Do not merge.

---

# 18. Acceptance criteria / Definition of Done

The PR is technically ready for review only when:

1. Existing v0.2.0 components have been audited.
2. Official PRA reference is integrated and validated.
3. ERA5/PRA correspondence is reproducible.
4. Spatial weights are correctly defined and tested.
5. Scientific aggregation methods are implemented and documented.
6. Compact PRA storage is operational.
7. Existing wheat and cattle diagnostics are preserved.
8. Real ERA5-Land ingestion has been demonstrated on bounded cases.
9. National batch processing is resumable and idempotent.
10. Missing data and provenance are correctly represented.
11. Supabase database footprint is measured or transparently estimated.
12. The proposed storage model fits the free-tier planning budget or deviations are explicitly justified.
13. Migrations are versioned and tested.
14. CI passes.
15. Vercel build passes.
16. Security checks pass.
17. No uncontrolled production changes have occurred.
18. Documentation and operational runbook are complete.

**Additional operational validation required before declaring national coverage complete:**

- Run national ingestion on real data through authorized execution.
- Verify PRA coverage and temporal completeness for the chosen 30-day period.
- Target at least 99% valid PRA coverage, with explicit justifications for any exclusions.
- Verify sufficient data for the existing approved diagnostics.
- Measure actual database footprint and execution cost.

Passing CI or generating all 713 polygons does not demonstrate national climate-data coverage.

If the national rollout has not been performed, report:

**CODE READY — NATIONAL OPERATIONAL VALIDATION PENDING.**

Do not claim full operational completion.

---

# 19. Deliverables

Provide:

1. Code changes.
2. Tests.
3. Versioned migration files, if needed.
4. Official PRA data source documentation.
5. ERA5/PRA correspondence documentation.
6. Scientific aggregation methodology.
7. Data model diagram or schema description.
8. Ingestion commands and dry-run examples.
9. National processing runbook.
10. Coverage-report command.
11. Storage and cost assessment.
12. Rollout and recovery procedures.
13. Limitations and scientific caveats.

Final Codex report must include:

- Branch
- Commit SHA
- PR number and URL
- Files modified
- Database tables added/modified
- Migrations created
- Migrations applied: yes/no, and environment
- Real-data tests executed
- Geographic coverage verified
- Number of PRA with validated data
- Database size before/after where measurable
- Estimated database size after 90 days
- GitHub Actions impact
- Vercel impact
- Security and CI outcomes
- Outstanding blockers
- Recommendation: READY FOR REVIEW / NOT READY

Explicitly separate verified measurements from theoretical estimates.

---

# 20. Preparation for Tasks 20, 21 and 22

## Task 20 — Climatology 1991–2020

Ensure that:

- PRA geographic IDs are stable and versioned.
- Historical ERA5-Land retrieval remains reproducible.
- Climatological statistics can be computed at suitable native resolution.
- Reference statistics can be stored compactly.
- Variability, extremes and threshold exposure can be retained.
- Climatology and recent conditions use compatible indicator definitions.

Do not execute full climatology processing in Task 19.

## Task 21 — New indicators and productions

Ensure that:

- New production types reuse common climate data.
- Indicator definitions have stable IDs and versions.
- Indicator calculation and aggregation are distinct.
- New thresholds/models can be introduced without duplicating source climate data.
- Expensive indicator combinations are computed selectively.
- Support for 50–100 productions is feasible without multiplying permanent storage linearly by all possible combinations.

Do not implement new scientific risk models in Task 19.

## Task 22 — UX and cartography

Prepare clean geographic APIs and lightweight map data for:

- France
- Regions
- Departments
- PRA

Keep authoritative and display-simplified geometries distinct.

Avoid unnecessary payload growth.

Do not redesign the UI in Task 19.

---

# 21. Final execution rules

- Work from the latest main.
- Reuse existing components.
- One branch, one PR.
- No automatic merge.
- No automatic production migration.
- No uncontrolled national backfill.
- No activation of paid services.
- No interpolation of station observations.
- No synthetic data presented as real.
- No unvalidated scientific risk threshold.
- No bulk hourly historical ERA5 storage in PostgreSQL.
- No uncontrolled expansion of Supabase database size.

The priority is a **reliable, scientifically defensible, low-cost and extensible PRA-based national agricultural climate platform**.

Proceed with the implementation using the existing repository architecture.

If a major architectural constraint prevents an essential requirement, document it in the PR and identify the safest alternative rather than silently changing the requirements.

Return the PR and complete verification report without merging.
