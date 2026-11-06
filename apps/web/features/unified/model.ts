import type { Geometry } from 'geojson';
import { DAYS, NATIONAL, type ClimateContextRow, type ClimateVariable } from '../national/model';
import { calendarDays, isCalendarDate, trailingStart, withinAvailable } from '../national/daily-availability';
export type Space = 'climat' | 'productions' | 'analyse';
export type ValueStatus = 'available' | 'partial' | 'unavailable' | 'not_applicable' | 'source_error';
export interface TerritorySelection { type: 'pra' | 'department' | 'station'; id: string; name: string; geometry?: Geometry; attachments: string[] }
export interface SourceInfo { provider: string; sourceId: string; temporalResolution: string; spatialResolution: string; range: string[]; license: string | null; retrievedAt: string | null; publishedAt: string | null; limitations: string[] }
export interface IndicatorDefinition { id: string; label: string; family: 'meteo' | 'agrometeo'; variable: ClimateVariable; unit: string; operator: 'mean' | 'sum' | 'above' | 'below' | 'gdd'; parameter?: number; reference: boolean; scale: 'sequential' | 'diverging'; method: string; version: string; scales: readonly ['pra']; source: string; admissiblePeriod: readonly [string, string] }
export interface TerritorialValue { observed_value?:number|null; territoryId: string; value: number | null; normal: number | null; anomaly: number | null; coverage: number | null; observedDays: number; expectedDays: number; status: ValueStatus; dataScale: 'pra'; datasetVersion: string; freshness: string; rule_version: string; provenance: string; quality_flags: string[] }
export interface ProductionDefinition { id: string; label: string; variables: { id: string; label: string; unit: string }[]; source: SourceInfo; connected: boolean }
export interface AgroclimaticRule { id: string; production: string; indicator: string; label: string; status: 'exploratory' | 'validated'; support: 'pra'; restitution: string; source: string; admissiblePeriod: readonly [string, string] }
const indicatorBase = { scales: ['pra'] as const, source: 'ERA5-Land · pra-native-1', admissiblePeriod: [NATIONAL.start, NATIONAL.end] as const };
export const INDICATORS: IndicatorDefinition[] = [
  {...indicatorBase,id:'temperature',label:'Température moyenne',family:'meteo',variable:'temperature',unit:'°C',operator:'mean',reference:true,scale:'sequential',method:'Moyenne spatiale ERA5-Land, puis moyenne des jours disponibles.',version:'pra-period-1'},
  {...indicatorBase,id:'temperature_min',label:'Température minimale',family:'meteo',variable:'temperature_min',unit:'°C',operator:'mean',reference:true,scale:'sequential',method:'Minimum des cellules par jour ; moyenne des minima pour une période. Ce n’est pas une station.',version:'pra-period-1'},
  {...indicatorBase,id:'temperature_max',label:'Température maximale',family:'meteo',variable:'temperature_max',unit:'°C',operator:'mean',reference:true,scale:'sequential',method:'Maximum des cellules par jour ; moyenne des maxima pour une période.',version:'pra-period-1'},
  {...indicatorBase,id:'rain',label:'Cumul de pluie',family:'meteo',variable:'precipitation',unit:'mm',operator:'sum',reference:true,scale:'sequential',method:'Somme des profondeurs moyennes spatiales quotidiennes ; somme partielle si jours manquants.',version:'pra-period-1'},
  {...indicatorBase,id:'hot',label:'Jours chauds · Tmax > seuil',family:'agrometeo',variable:'temperature_max',unit:'jours',operator:'above',parameter:25,reference:false,scale:'sequential',method:'Nombre de jours disponibles dont le maximum des cellules dépasse strictement le seuil. Descriptif, sans stade ni impact estimé.',version:'pra-period-1'},
  {...indicatorBase,id:'frost',label:'Jours de gel · Tmin < 0 °C',family:'agrometeo',variable:'temperature_min',unit:'jours',operator:'below',parameter:0,reference:false,scale:'sequential',method:'Nombre de jours disponibles dont le minimum des cellules est strictement négatif.',version:'pra-period-1'},
  {...indicatorBase,id:'gdd',label:'Degrés-jours · base paramétrée',family:'agrometeo',variable:'temperature',unit:'°C·j',operator:'gdd',parameter:0,reference:false,scale:'sequential',method:'Somme de max(0, Tmoy − base). Aucune normale dérivée des moyennes quotidiennes.',version:'pra-period-1'},
];
export const AGRICULTURE: ProductionDefinition[] = [{id:'wheat',label:'Blé tendre',connected:false,variables:[{id:'area',label:'Surface',unit:'ha'},{id:'yield',label:'Rendement',unit:'q/ha'},{id:'volume',label:'Production',unit:'t'}],source:{provider:'Agreste / SSP',sourceId:'https://www.data.gouv.fr/datasets/agreste-statistique-agricole-annuelle-saa',temporalResolution:'annuelle',spatialResolution:'département',range:[],license:null,retrievedAt:null,publishedAt:null,limitations:['Source structurée, licence et millésime à qualifier avant connexion. Aucune valeur départementale attribuée aux PRA.']}}];
export const RULES: AgroclimaticRule[] = ['hot','rain','frost','gdd'].map(id=>({id:`wheat-${id}`,production:'wheat',indicator:id,label:INDICATORS.find(i=>i.id===id)!.label,status:'exploratory',support:'pra',restitution:'Aléa descriptif ; exposition et sensibilité non quantifiées.',source:'ERA5-Land · pra-native-1',admissiblePeriod:[NATIONAL.start,NATIONAL.end]}));
export type UnifiedState = { pra: string; date: string; start: string; period: boolean; indicator: string; mode: 'value' | 'normal' | 'anomaly'; threshold: number; production: string; variable: string };
export function parseState(params: URLSearchParams, space: Space, availableDays: string[] = DAYS): { state: UnifiedState; errors: string[] } {
  const errors: string[]=[];
  const date=params.get('date') ?? availableDays.at(-1)!;
  const defaultStart=isCalendarDate(date)?availableDays.find(d=>d>=trailingStart(date,30)&&d<=date)??date:availableDays[0];
  const start=params.get('start') ?? defaultStart;
  const length=calendarDays(start,date).length;
  if(!withinAvailable(date,availableDays)||!withinAvailable(start,availableDays)||!length||length>30) errors.push('Dates hors des données disponibles ou période de plus de 30 jours.');
  const pra=params.get('pra') ?? '';
  if(pra&&!/^pra:[0-9AB]{4,8}$/.test(pra)) errors.push('Identifiant PRA invalide.');
  const indicator=params.get('indicateur') ?? (space==='analyse'?'hot':'temperature');
  const def=INDICATORS.find(i=>i.id===indicator);
  if(!def) errors.push('Indicateur inconnu.');
  const mode=params.get('mode') ?? 'value';
  if(!['value','normal','anomaly'].includes(mode)||(!def?.reference&&mode!=='value')) errors.push('Lecture non disponible pour cet indicateur.');
  const threshold=Number(params.get('seuil') ?? def?.parameter ?? 25);
  if(!Number.isFinite(threshold)||threshold< -30||threshold>60) errors.push('Seuil attendu entre −30 et 60 °C.');
  const production=params.get('production') ?? 'wheat', variable=params.get('variable') ?? 'area';
  if(space==='analyse' && !RULES.some(r=>r.production===production&&r.indicator===indicator)) errors.push('Indicateur non proposé pour cette production.');
  if(!AGRICULTURE.some(p=>p.id===production&&p.variables.some(v=>v.id===variable))) errors.push('Production ou variable agricole inconnue.');
  for(const key of params.keys()) if(params.getAll(key).length>1) errors.push('Paramètre répété : '+key);
  if(params.has('periode')&&!['jour','periode'].includes(params.get('periode')!)) errors.push('Type de période invalide.');
  return {state:{pra,date,start,period:(params.get('periode') ?? (space==='analyse'?'periode':'jour'))==='periode',indicator:def?.id ?? 'temperature',mode:mode as UnifiedState['mode'],threshold,production,variable},errors};
}
export function aggregate(rows: ClimateContextRow[], definition: IndicatorDefinition, expectedDays: number, threshold: number): TerritorialValue {
  const observed=rows.filter(r=>r.current_value!==null);
  const apply=(v:number)=>definition.operator==='above'?Number(v>threshold):definition.operator==='below'?Number(v<0):definition.operator==='gdd'?Math.max(0,v-threshold):v;
  const sum=observed.reduce((n,r)=>n+apply(r.current_value!),0);
  const value=observed.length ? (definition.operator==='mean'?sum/observed.length:sum):null;
  // Compare only identical, complete sets of days; threshold-derived normals are invalid.
  const complete=observed.length===expectedDays&&observed.every(r=>r.current_status==='available'&&r.current_coverage!==null&&r.current_coverage>=0.9999);
  const normal=complete&&definition.reference&&rows.length===expectedDays&&rows.every(r=>r.normal_1991_2020!==null)&&observed.length===expectedDays ? rows.reduce((n,r)=>n+r.normal_1991_2020!,0)/(definition.operator==='mean'?expectedDays:1):null;
  return {territoryId:rows[0]?.pra_id ?? '',value,normal,anomaly:value!==null&&normal!==null?value-normal:null,coverage:rows.length&&rows.every(r=>r.current_coverage!==null)?rows.reduce((n,r)=>n+r.current_coverage!,0)/expectedDays:null,observedDays:observed.length,expectedDays,status:value===null?(rows.some(r=>r.current_status==='partial'&&r.current_coverage!==null&&r.current_coverage>0)?'partial':'unavailable'):complete?'available':'partial',dataScale:'pra',datasetVersion:NATIONAL.dataset,freshness:'Archive ERA5-Land · septembre–octobre 2026',rule_version:definition.version,provenance:'ERA5-Land · pra-native-1',quality_flags:complete?[]:['incomplete_spatial_or_temporal_coverage']};
}
