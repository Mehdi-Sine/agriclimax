# Task 28 — Preview acceptance receipt

The application from commit `20c60495b420f9947f6a98f052f1024a0b84162f`
has passed real protected-Preview acceptance on desktop, tablet and mobile:
13 indicators × 3 viewports, three recent-mode checks, shared PRA/canvas/URL,
coastal territories, calculable and unavailable THI, and official-scale SAA context.

This receipt is documentation only. It also places the completed acceptance
record within the Vercel project root so the final PR commit can receive its own
Preview. No executable application code, formula, threshold, weather acquisition,
national batch replay, workflow or production deployment is changed.

The Idele CAICalor article and its linked Vinet et al. (2023) paper have been
consulted; the equation matches the existing daily synthetic THI. Parameters and
scientific status remain exploratory.

See [the final decision](../../docs/codex/task28/FINAL_DECISION.md),
[the scientific comparison](../../docs/codex/task28/THI_IDELE_REVIEW.md), and
[Preview evidence](../../docs/codex/task28/evidence/preview/).
The final head/deployment/check attestation is recorded in PR #56 after publication.

## Coastal historical correction

The observed-support rule `agroclimatic-1.1.0` restores qualified daily and
stable-period mean/GDD/rain values from the existing Task26D exports. The strict
`1.0.0` remains queryable. On 27–31 October, 681 PRA values and 31 portion-only
values are available for these indicators; Crozon stays NULL. Missing support
exports before 27 October keep the seven/thirty-day partial-PRA totals
unavailable, and extrema are not inferred from mean temperature. This is not a
713/713 historical success. See
[the targeted coastal report](../../docs/codex/task28/COASTAL_HISTORICAL_FIX.md).
