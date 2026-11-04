'use client';
import type { IndicatorDefinition, TerritorialValue } from '../unified/model';
import { useAgriculturalData } from './explorer';
import type { PraAgriculturalContext } from './model';

const fmt = (value: number | null | undefined) => value == null ? 'Indisponible' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);
export function WheatContext({ pra, climate, indicator, start, end, threshold }: {
  pra: string; climate: TerritorialValue | undefined; indicator: IndicatorDefinition;
  start: string; end: string; threshold: number;
}) {
  const context = useAgriculturalData<PraAgriculturalContext>(pra ? `/api/agriculture?action=wheat-context&pra=${encodeURIComponent(pra)}` : null);
  const wheat = context.data?.data;
  return <>
    <h3>B. Contexte agricole · blé tendre</h3>
    {context.error ? <p role="status">Contexte RPG inaccessible. L’aléa climatique reste consultable.</p> : !context.data ? <p role="status">Chargement des surfaces RPG…</p> : wheat?.area_ha == null ? <p>Surface RPG 2025 de blé tendre indisponible dans les lots acquis. Aucune surface n’est déduite de la couverture climatique.</p> : <><p><strong>{fmt(wheat.area_ha)} ha</strong> de blé tendre déclarés en {context.data.year} · {fmt(wheat.share == null ? null : wheat.share * 100)} % des surfaces RPG acquises de cette PRA.</p><p>{wheat.status === 'partial' ? `Couverture agricole partielle : ${context.data.source.completed_regions?.length ?? 0}/13 régions acquises. Ces hectares et cette part ne décrivent que les lots traités.` : 'Surfaces RPG déclarées à la PAC ; ce ne sont pas toutes les surfaces agricoles.'}</p></>}
    <h3>C. Lecture descriptive · références {context.data?.year ?? 2025} / {end.slice(0, 4)}</h3>
    <p>{wheat?.area_ha != null && climate?.value != null ? `Cette PRA comportait au moins ${fmt(wheat.area_ha)} ha de blé tendre déclarés dans les lots RPG ${context.data?.year} acquis ; du ${start} au ${end}, l’indicateur « ${indicator.label}${indicator.operator === 'above' ? ` (${threshold} °C)` : ''} » vaut ${fmt(climate.value)} ${indicator.unit}, sur ${climate.observedDays}/${climate.expectedDays} jours renseignés.` : 'Le croisement descriptif nécessite une surface RPG et un indicateur climatique disponibles. Les deux couvertures sont indépendantes.'}</p>
    <p>Contexte climatique territorial, sans mesure à la parcelle. Aucun stade, dommage, rendement, vulnérabilité ou surface effectivement touchée n’est déduit.</p>
    {context.data && <details><summary>Source et limites agricoles</summary><p>IGN / ASP · RPG {context.data.year}, niveau 1 ouvert et anonymisé. Règle {context.data.source.rule_version}, acquisition {context.data.source.acquired_at}. Les surfaces sont géométriques en EPSG:3035 ; elles ne sont pas les surfaces effectivement touchées par un aléa.</p><p>Les contrôles de recouvrement entre identifiants distincts de régions différentes restent à compléter. La couverture des lots et celle du climat sont indépendantes.</p><a href={context.data.source.url} target="_blank" rel="noreferrer">Source officielle RPG ↗</a></details>}
  </>;
}
