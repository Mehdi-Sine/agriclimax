import Link from 'next/link';
import {classLabel,type Palette} from './registry';
export function SemanticLegend({palette}:{palette:Palette}){
 return <div className="unified-legend semantic-legend" aria-label="Légende quantitative"><div className="legend-ramp">{palette.bounds.map((_,i)=><span key={i} style={{background:`var(${palette.tokens[i]})`}}><small>{classLabel(palette,i)}</small></span>)}</div><p>{palette.unit} · {palette.meaning} · classes fixes {palette.version}</p><p>{palette.missing}. {palette.partial}.</p><Link href={palette.documentation}>Comprendre cette carte</Link></div>;
}
