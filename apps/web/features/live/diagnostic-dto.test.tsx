import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
vi.mock('server-only',()=>({}));
import publication from '../../../../tests/e2e/daily-publication.synthetic.json';
import { validateDaily } from './daily';
import { diagnosticDto } from './diagnostic-dto';
import { LiveDiagnostic } from './diagnostic';

describe('Diagnostic browser-visible allowlist',()=>{
  it('projects only the selected wheat indicator and displayed metadata',()=>{
    const p=validateDaily(publication)!;
    const portfolio=p.wheat[0], result=portfolio.results[0];
    const dto=diagnosticDto({production:'wheat',portfolio,result});
    expect(dto).toEqual({production:'wheat',rule_id:result.rule_id,rule_version:result.rule_version,
      scientific_status:result.scientific_status,quality_flags:result.quality_flags,limits:result.limits,
      available_days:result.available_days,expected_days:result.expected_days,
      parameter_fingerprint:portfolio.parameter_fingerprint,scientific_sources:result.scientific_sources,grid_cell:portfolio.grid_cell});
    expect(JSON.stringify(dto)).not.toMatch(/provenance|retrieved_at|parameters|results|daily|series/);
  });
  it('projects cattle method and selected threshold without series or unused provenance',()=>{
    const r=validateDaily(publication)!.cattle[0];
    const dto=diagnosticDto({production:'cattle',result:r});
    expect(dto).toEqual({production:'cattle',rule_id:r.rule_id,rule_version:r.rule_version,
      scientific_status:r.scientific_status,quality_flags:r.quality_flags,limits:r.limits,formula:r.formula,
      scientific_source:{url:r.scientific_source.url,title:r.scientific_source.title,year:r.scientific_source.year,scope:r.scientific_source.scope},
      threshold:r.metrics[0].threshold,notice:r.notice});
    expect(JSON.stringify(dto)).not.toMatch(/provenance|retrieved_at|metrics|night_recovery|anomaly|series|"daily"/);
    expect(renderToStaticMarkup(<LiveDiagnostic data={dto} />)).not.toContain('<pre>');
  });
  it('keeps missing selections explicit',()=>{
    for(const dto of [diagnosticDto({production:'wheat',portfolio:undefined,result:undefined}),diagnosticDto({production:'cattle',result:undefined})]) {
      expect(dto).toBeNull();
      expect(renderToStaticMarkup(<LiveDiagnostic data={dto} />)).toContain('Diagnostic indisponible');
    }
  });
});
