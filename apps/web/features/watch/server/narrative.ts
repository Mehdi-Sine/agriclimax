import 'server-only';
import type { EvidenceBundle } from '../model';
import { closeBundle } from './evidence';

export const TEMPLATE_VERSION = 'watch-facts/1.0';
export const TEMPLATE = 'Restituer uniquement les champs factuels du bundle fermé, avec evidence_id. Aucune causalité ni conclusion supplémentaire.';
export interface NarrativeSegment { evidence_id: string; text: string }
export interface NarrativeProposal { segments: NarrativeSegment[] }
export interface NarrativeProvider {
  readonly model: string;
  readonly assisted: boolean;
  generate(bundle: EvidenceBundle): Promise<NarrativeProposal>;
}
/** The allowed narrative language is deliberately bounded to verbatim field projections. */
function allowedSegments(bundle: EvidenceBundle): NarrativeSegment[] {
  return bundle.facts.map(({ evidence_id, result: r }) => ({
    evidence_id,
    text: `Territoire : ${r.cell_id} · production : ${r.production_id} · période : ${r.valid_date} · niveau : ${r.risk.level} · aléa : ${r.hazard.value ?? 'indisponible'} ${r.hazard.unit} · confiance : ${r.confidence.level} · statut : ${r.confidence.scientific_status} · fraîcheur : ${r.quality.freshness} · règle : ${r.rule.rule_id}@${r.rule.version} · sources : ${r.provenance.map(p => p.source_id).join(', ')}.`,
  }));
}
export class DeterministicTemplateProvider implements NarrativeProvider {
  readonly model = 'deterministic-template/1.0';
  readonly assisted = false;
  async generate(bundle: EvidenceBundle): Promise<NarrativeProposal> { return { segments: allowedSegments(closeBundle(bundle)) }; }
}
export type NarrativeState =
  | { state: 'disabled' | 'unavailable' }
  | { state: 'available'; segments: NarrativeSegment[]; audit: {
    bundle_id: string; factual_payload: EvidenceBundle; template_version: string;
    model: string; assisted: boolean; generated_at: string;
  } };
export async function narrate(input: EvidenceBundle, options: {
  enabled: boolean; provider?: NarrativeProvider; now?: () => Date;
}): Promise<NarrativeState> {
  if (!options.enabled) return { state: 'disabled' };
  try {
    const bundle = closeBundle(input);
    const provider = options.provider ?? new DeterministicTemplateProvider();
    const proposal = await provider.generate(bundle);
    // Reject added numbers, URLs, causal language, or unbound evidence wholesale.
    const expected = allowedSegments(bundle);
    if (JSON.stringify(proposal.segments) !== JSON.stringify(expected)) throw new Error('Narration hors preuves');
    return { state: 'available', segments: proposal.segments, audit: {
      bundle_id: bundle.bundle_id, factual_payload: bundle, template_version: TEMPLATE_VERSION,
      model: provider.model, assisted: provider.assisted,
      generated_at: (options.now?.() ?? new Date()).toISOString(),
    } };
  } catch { return { state: 'unavailable' }; }
}
