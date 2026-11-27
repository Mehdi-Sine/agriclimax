export type SourceState = "success" | "degraded" | "no_new_data" | "retryable_failure" |
  "permanent_failure" | "running" | "pending" | "expired";
export type Forecast = { model: string; valid_dates: string[] };
export interface Edition {
  mode: "live" | "fallback";
  title: string;
  lead: string;
  maps: number | null;
  hero: string | null;
  published_at: string | null;
}
export interface Diagnostics {
  snapshot: {quality: string; era5_date?: string; forecasts: Forecast[]} | null;
  acquisitions: {source: string; state: SourceState; attempts: number; advice?: boolean}[];
  era5_date: string | null;
  model_horizons?: Record<string,string> | null;
  sim: {state: SourceState; latest: string | null; persisted: boolean; attempts: number} | null;
  preparation: string | null;
  execution: string | null;
  awaiting_ai: boolean;
  security_stop: boolean;
  cost: number | null;
  cost_partial: boolean;
  runner_seconds: number | null;
  failures: number;
  redundant: number;
  verified: {id: string; checksum: string} | null;
}
export const WORKFLOW = "https://github.com/Mehdi-Sine/agriclimax/actions/workflows/operational-journal.yml";
const dateFormat = new Intl.DateTimeFormat("fr-FR", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"});
const timeFormat = new Intl.DateTimeFormat("fr-FR", {hour:"2-digit",minute:"2-digit",timeZone:"Europe/Paris"});
const amountFormat = new Intl.NumberFormat("fr-FR", {style:"currency",currency:"EUR",maximumFractionDigits:5});
const statuses = {
  success: "OK", degraded: "Partiel", no_new_data: "Pas de nouvelle donnée",
  retryable_failure: "Indisponible", permanent_failure: "En échec", running: "En cours",
  pending: "En attente", expired: "Interrompu",
} satisfies Record<SourceState,string>;
const stageLabel = (stage: string | null) => ({
  running: "en cours", failed: "en échec", completed: "terminée", no_op: "non exécutée",
})[stage ?? ""] ?? "en attente";
const latest = (values: (string | null | undefined)[]) => values.filter((v): v is string => Boolean(v)).sort().at(-1);
const shortDate = (value: string) => dateFormat.format(new Date(value));
const attempts = (count: number) => count > 1 ? ` · ${count} tentatives` : "";
export function buildReport(date: string, data: Diagnostics, edition: Edition | null, origin: string, thumbnail?: boolean) {
  const acquisition = new Map(data.acquisitions.map(a=>[a.source,a]));
  const era = latest([data.era5_date, data.snapshot?.era5_date]);
  const sim = data.sim;
  const forecasts = (["AROME","ARPEGE","IFS"] as const).map(label=>{
    const dates = data.snapshot?.forecasts.filter(c=>c.model.toUpperCase().split("-")[0]===label).flatMap(c=>c.valid_dates) ?? [];
    const selected = latest(dates);
    const available = latest(Object.entries(data.model_horizons ?? {})
      .filter(([model])=>model.toUpperCase().split("-")[0]===label).map(([,end])=>end));
    return {label, end:selected ?? available, selected:Boolean(selected)};
  });
  const acquired = ["era5","forecast","stations","observations","news"].filter(source=>acquisition.get(source)?.state==="success").length + Number(sim?.state==="success");
  const describe = (source: string) => {
    const value = acquisition.get(source);
    return value ? (statuses[value.state] ?? "État inconnu") + attempts(value.attempts) : "Non renseigné";
  };
  const permanent = [...acquisition].filter(([,value])=>value.advice);
  const sourceLabels: Record<string,string> = {era5:"ERA5-Land",forecast:"Prévisions",stations:"Stations météo",observations:"Observations récentes",news:"Actualités"};
  const persistent = [
    ...permanent.map(([source])=>`${sourceLabels[source] ?? source} en échec persistant`),
    ...(data.awaiting_ai ? ["Résultat OpenAI incertain"] : []),
    ...(data.security_stop ? ["Arrêt d’urgence actif"] : []),
  ];
  const critical = !edition || data.security_stop || data.awaiting_ai || permanent.length > 0;
  const normal = acquired===6 && forecasts.every(f=>f.end) && data.snapshot?.quality==="fresh" && edition?.mode==="live" && !data.awaiting_ai;
  const status: "VERT" | "ORANGE" | "ROUGE" = critical ? "ROUGE" : normal ? "VERT" : "ORANGE";
  const summary = !edition ? "Édition indisponible" : critical ? "Édition consultable · intervention requise" :
    normal ? "Édition consultable" : "Édition consultable en mode dégradé";
  const sourceRows = [
    ["ERA5-Land", describe("era5") + (era ? ` · ${shortDate(era)} (J−${(Date.parse(date)-Date.parse(era))/86400000})` : " · dernière date inconnue")],
    ["Prévisions", describe("forecast")],
    ...forecasts.map(f=>[f.label, f.end ? `${f.selected ? "Qualifié" : "Disponible"} · jusqu’au ${shortDate(f.end)}` : "Horizon non qualifié"]),
    ["SAFRAN/SIM", sim ? statuses[sim.state]+attempts(sim.attempts)+(sim.latest ? ` · ${shortDate(sim.latest)}` : "")+
      (sim.persisted ? " · copie privée vérifiée" : " · persistance privée non vérifiée") : "Non renseigné"],
    ["Stations météo", describe("stations")],
    ["Observations récentes", describe("observations")],
    ["Actualités", describe("news")],
  ];
  const failures = data.failures ? `${data.failures} échec${data.failures===1?"":"s"} significatif${data.failures===1?"":"s"}` : "0 échec significatif";
  const maintenance = [failures,
    ...(data.redundant ? [`${data.redundant} relance${data.redundant===1?"":"s"} sans travail restant`] : []), ...persistent];
  const action = data.security_stop ? "Examiner l’arrêt d’urgence et les diagnostics avant toute reprise." :
    !edition ? "Vérifier la consultation publique et l’archive du jour avant toute reprise." :
    permanent.length ? "Examiner les accès ou les erreurs des sources signalées." :
    data.awaiting_ai ? "Vérifier le reçu OpenAI avant toute relance." : "Aucune intervention nécessaire";
  const seconds = Math.round(data.runner_seconds ?? 0);
  return {
    date: shortDate(date), subject: `Climacta · ${status} · ${date}`, status, summary, sourceRows, maintenance, action,
    metrics: [
      ["Consultation vérifiée (Paris)",edition ? edition.published_at ? timeFormat.format(new Date(edition.published_at)) : "Heure inconnue" : "En attente"],
      ["Sources récupérées", `${acquired}/6`],
      ...(data.runner_seconds===null ? [] : [["Runner mesuré", `${Math.floor(seconds/60)} min ${seconds%60} s`]]),
      ["OpenAI", data.cost===null ? "Coût indisponible" : data.cost===0 && !data.cost_partial ? "0 €" :
        `${amountFormat.format(data.cost)} (${data.cost_partial ? "estimation partielle" : "estimé sur usage"})`],
    ],
    steps: [
      `Briefing ${data.snapshot ? "archivé" : stageLabel(data.preparation)}`,
      data.awaiting_ai ? "Résultat OpenAI incertain" : data.cost !== null && data.cost > 0 ? "Usage OpenAI enregistré" : "Usage OpenAI sans coût établi",
      `Traitement éditorial ${stageLabel(data.execution)}`,
      edition?.mode === "fallback" ? "Secours factuel · archive vérifiée" : edition ? "Archive IA vérifiée" : "Consultation publique non vérifiée",
    ].join(" · "),
    edition, thumbnail: Boolean(thumbnail && edition?.hero),
    link: edition ? new URL(`/journal?date=${date}`,origin).href : null,
  };
}
export type Report = ReturnType<typeof buildReport>;
