import { cattleRule } from '../cattle/thi';
export const PALETTE_VERSION = 'semantic-1.0.0';
export interface Palette {
  indicator:string; id: string; family: string; nature: 'absolute'|'anomaly'|'cumulative'|'occurrence'|'category';
  unit: string; bounds: number[]; tokens: string[]; classification: 'fixed-upper-inclusive';
  reference: string|null; meaning: string; justification: string; documentation: string;
  version: string; missing: string; partial: string;
}
const thermal=['--map-cool','--map-cool-light','--map-mid','--map-warm-light','--map-warm'];
const rain=[1,2,3,4,5].map(i=>`--map-rain-${i}`);
const dry=[1,2,3,4,5].map(i=>`--map-dry-${i}`);
const cold=[...rain];
const agriculture=[1,2,3,4,5].map(i=>`--map-agri-${i}`);
function definition(id:string,family:string,nature:Palette['nature'],unit:string,bounds:number[],tokens:string[],meaning:string,reference:string|null=null):Palette {
 return {indicator:id,id,family,nature,unit,bounds,tokens,meaning,reference,classification:'fixed-upper-inclusive',version:PALETTE_VERSION,
 justification:'Convention éditoriale stable ; ces classes ne sont pas des seuils de dommage.',
 documentation:`/aide/cartes#${id}`,missing:'Gris : NULL distinct de zéro',partial:'Hachures et support renseigné ; reconstruction indiquée séparément'};
}
export function semanticPalette(indicator:string,unit:string,days=1,mode='value'):Palette {
 return {...resolvePalette(indicator,unit,days,mode),indicator};
}
function resolvePalette(indicator:string,unit:string,days:number,mode:string):Palette {
 const temperature=['temperature','temperature_min','temperature_max','temperature_mean'].includes(indicator);
 if(mode==='anomaly')return temperature
  ? definition('temperature-anomaly','temperature','anomaly','°C',[-3,-1,1,3,Infinity],thermal,'Bleu : froid ; classe neutre centrée sur 0 °C ; chaud : orange/rouge','Normale homologue ERA5-Land 1991–2020 validée')
  : definition('rain-departure','precipitation','anomaly','mm',[-50,-10,10,50,Infinity],[...dry.slice(3).reverse(),'--map-mid',...rain.slice(3)],'Déficit sec, référence neutre, excédent bleu ; écart absolu, jamais sécheresse des sols','Normale homologue 1991–2020 validée');
 if(indicator==='frost_min')return definition('frost-minimum','cold','absolute','°C',[-10,-5,0,5,Infinity],[...cold].reverse(),'Bleu intense pour les températures les plus basses ; température absolue, sans dommage inféré');
 if(temperature)return definition('temperature-absolute','temperature','absolute','°C',[0,10,20,30,Infinity],thermal,'Température absolue, sans comparaison implicite à la normale');
 if(['dry','dry_sequence'].includes(indicator))return definition('dry-sequence','precipitation','occurrence','jours',[0,2,4,6,Infinity],dry,'Durée sans pluie significative (< 1 mm/j), pas sécheresse agricole');
 if(['frost','frost_sequence'].includes(indicator))return definition('frost-days','cold','occurrence','jours',[0,1,3,5,Infinity],cold,'Bleu croissant : jours de gel, sans dommage inféré');
 if(indicator==='thi')return definition('thi','heat','absolute','THI',[cattleRule.thresholds[0],75,80,85,Infinity],dry,'THI synthétique ; seuil descriptif strict > 72, variante Bohmanova 2005',cattleRule.source.url);
 if(['hot','hot_sequence','cattle_heat','thi_days','thi_sequence'].includes(indicator))return definition('heat-days','heat','occurrence','jours',[0,1,3,5,Infinity],dry,'Dépassements thermiques descriptifs, pas de risque de dommage');
 if(indicator==='heavy_rain')return definition('heavy-rain-days','precipitation','occurrence','jours',[0,1,3,5,Infinity],rain,'Nombre de jours de pluie au-dessus du seuil choisi');
 if(indicator==='gdd')return definition('gdd','accumulated-heat','cumulative','°C·j',[50,150,300,600,Infinity],[1,2,3,4,5].map(i=>`--map-gdd-${i}`),'Chaleur accumulée, sans qualification de stress');
 if(indicator==='humidity')return definition('humidity','humidity','absolute','%',[20,40,60,80,Infinity],rain,'Humidité relative estimée');
 if(unit==='mm'){
 const window=days===1?'day':days<=7?'week':'month';
 return definition(`rain-${window}`,'precipitation','cumulative','mm',days===1?[1,5,10,20,Infinity]:days<=7?[5,20,40,70,Infinity]:[10,50,100,200,Infinity],rain,'Précipitations faibles claires, cumuls élevés bleu soutenu');
 }
 const bounds=unit==='ha'?[100,1000,10000,100000,Infinity]:unit==='q/ha'?[10,30,60,90,Infinity]:unit==='t'?[1000,10000,100000,1000000,Infinity]:[10,100,1000,10000,Infinity];
 return definition(`agriculture-${unit.replace(/[^a-z]/gi,'')||'count'}`,'agriculture','absolute',unit,bounds,agriculture,'Quantité agricole descriptive ; classes fixes, sans alerte');
}
export function classIndex(value:number|null|undefined,palette:Palette):number {
 return value==null||!Number.isFinite(value)?-1:palette.bounds.findIndex(b=>value<=b);
}
export function classLabel(palette:Palette,index:number):string {
 const f=(v:number)=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(v);
 return index===0?`≤ ${f(palette.bounds[0])}`:index===palette.bounds.length-1?`> ${f(palette.bounds[index-1])}`:`> ${f(palette.bounds[index-1])} à ${f(palette.bounds[index])}`;
}
export const PALETTES=[semanticPalette('temperature','°C'),semanticPalette('temperature','°C',1,'anomaly'),semanticPalette('rain','mm',1,'anomaly'),...[1,7,30].map(d=>semanticPalette('rain','mm',d)),...['frost_min','dry','frost','hot','heavy_rain','gdd','thi','humidity'].map(id=>semanticPalette(id,id==='thi'?'THI':id==='gdd'?'°C·j':'jours')), ...['ha','q/ha','t','têtes'].map(u=>semanticPalette('agriculture',u))];
