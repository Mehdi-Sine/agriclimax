import 'server-only';
import type { WheatIndicator, WheatPortfolio } from '../wheat/model';
import type { ThiResult } from '../cattle/thi';

type Common = { rule_id:string; rule_version:string; scientific_status:string; quality_flags:string[]; limits:string[] };
export type DiagnosticDto = (Common & (
  { production:'wheat'; available_days:number; expected_days:number; parameter_fingerprint:string; scientific_sources:string[]; grid_cell:string|null }
  | { production:'cattle'; formula:string; scientific_source:{url:string; title:string; year:number; scope:string}; threshold:number|undefined; notice:string }
)) | null;

// Explicit allowlist: never spread a repository result into browser-visible data.
// Full publications, daily series and detailed provenance remain on the server.
export function diagnosticDto(input:
  {production:'wheat'; portfolio:WheatPortfolio|undefined; result:WheatIndicator|undefined}
  | {production:'cattle'; result:ThiResult|undefined}
):DiagnosticDto {
  const r=input.result;
  if (!r) return null;
  const common:Common={rule_id:r.rule_id,rule_version:r.rule_version,scientific_status:r.scientific_status,
    quality_flags:[...r.quality_flags],limits:[...r.limits]};
  if(input.production==='wheat') {
    if(!input.portfolio || !input.result) return null;
    return {...common,production:'wheat',available_days:input.result.available_days,expected_days:input.result.expected_days,
      parameter_fingerprint:input.portfolio.parameter_fingerprint,scientific_sources:[...input.result.scientific_sources],grid_cell:input.portfolio.grid_cell};
  }
  const cattle=input.result;
  if(!cattle) return null;
  return {...common,production:'cattle',formula:cattle.formula,
    scientific_source:{url:cattle.scientific_source.url,title:cattle.scientific_source.title,year:cattle.scientific_source.year,scope:cattle.scientific_source.scope},
    threshold:cattle.metrics[0]?.threshold,notice:cattle.notice};
}
