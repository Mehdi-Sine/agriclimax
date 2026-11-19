import type { Diagnostics, Edition } from "./report";

export const date = "2026-11-19";
const nominal: Diagnostics = {
  snapshot:{quality:"fresh",era5_date:"2026-11-13",forecasts:[
    {model:"arome-0p025",valid_dates:[date]},
    {model:"arpege-0p1",valid_dates:["2026-11-22"]},
    {model:"ifs-oper-0p25",valid_dates:["2026-11-25"]},
  ]},
  acquisitions:["era5","forecast","stations","observations","news"].map(source=>({source,state:"success",attempts:1})),
  era5_date:"2026-11-13",sim:{state:"success",latest:"2026-11-17",persisted:true,attempts:1},
  preparation:"completed",execution:"completed",awaiting_ai:false,security_stop:false,
  cost:0.01376,cost_partial:false,runner_seconds:998,failures:0,redundant:0,verified:null,
};
const edition: Edition = {
  mode:"live",title:"Les premières gelées se précisent dans le Nord-Est",
  lead:"Les prévisions signalent un refroidissement nocturne dans le Nord-Est. La pluie attendue sur la façade atlantique limite le risque de gel local.",
  maps:4,hero:null,published_at:"2026-11-19T05:18:00Z",
};
export const scenarios: Record<string,{data:Diagnostics;edition:Edition|null}> = {
  nominal:{data:nominal,edition},
  "source-secondaire":{
    data:{...nominal,failures:1,acquisitions:nominal.acquisitions.map(a=>a.source==="news" ? {...a,state:"retryable_failure",attempts:3} : a)},edition,
  },
  "secours-factuel":{
    data:nominal,
    edition:{...edition,mode:"fallback",title:"Gel, précipitations et humidité des sols au 19 novembre",
      lead:"Voici les faits disponibles pour cette édition. Les observations et les prévisions sont présentées avec leurs périodes respectives."},
  },
  "edition-absente":{
    data:{...nominal,snapshot:null,preparation:"running",execution:null,cost:0,runner_seconds:null,failures:1,
      acquisitions:nominal.acquisitions.slice(0,3).map(a=>a.source==="era5" ? {...a,state:"retryable_failure",attempts:2} : a)},
    edition:null,
  },
};
