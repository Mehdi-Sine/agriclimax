import 'server-only';
import { ApiError } from '../../lib/server/query';
import { DailyRepository, type DailyPublication } from './daily';
import type { WheatPortfolio } from '../wheat/model';
import type { WeatherStation } from '../../lib/server/station-weather';
import { liveContext } from './context';

export async function loadLive(context: ReturnType<typeof liveContext>) {
  let stations: WeatherStation[] = [], portfolios: WheatPortfolio[] = [];
  let cattle: {state:string; station:string; start:string; end:string; product:string; stations:WeatherStation[]; results:DailyPublication['cattle']} | null = null;
  let publication:DailyPublication|null=null, latest:DailyPublication|null=null, failure='';
  const catalogueFailure=false;
  if (!context.valid) return {stations,portfolios,cattle,publication,latest,failure:'Contexte invalide : production, indicateur, station et période terminée de 1 à 366 jours requis.',catalogueFailure};
  try {
    const daily=await new DailyRepository().read(context.explicitPeriod?context.start:null,context.explicitPeriod?context.end:null);
    latest=daily.latest; publication=daily.selected;
    if (!context.explicitPeriod && latest) {
      context.start=latest.start; context.end=latest.end;
      context.query.set('start',context.start); context.query.set('end',context.end);
    }
    if(publication) {
      stations=publication.wheat.map(p=>({id:p.station_id,name:p.station_name,latitude:p.latitude,longitude:p.longitude,altitude_m:0,metadata:{},retrieved_at:p.computed_at}));
      // The daily pipeline publishes calendar windows with its default parameters.
      // Explicit incompatible parameters stay absent, never replaced by a nearby result.
      if (!context.query.get('stage') && (!context.query.has('fingerprint') || context.query.get('fingerprint')===publication.wheat[0].parameter_fingerprint)) {
        if(context.production==='wheat') portfolios=publication.wheat;
        else if(context.product!=='observations') {
          const station=context.station??'';
          cattle={state:'available',station,start:context.start,end:context.end,product:context.product,stations,
            results:publication.cattle.filter(c=>c.station_id===station)};
        }
      }
    }
  } catch (error) { failure=error instanceof ApiError && error.code==='NOT_CONFIGURED'
    ? 'Le service de données n’est pas configuré. Les résultats live sont temporairement indisponibles. Contactez l’équipe AgriclimaX.'
    : 'Publication quotidienne indisponible. Aucun instantané ni fixture de remplacement.'; }
  return {stations,portfolios,cattle,publication,latest,failure,catalogueFailure};
}
