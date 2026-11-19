import { WORKFLOW, type Report } from "./report";

const colors = {
  navy:"#142a43", canvas:"#edf2f7", paper:"#ffffff", ink:"#142a43", muted:"#40586c", line:"#dae4ed",
  status:{VERT:["#e6f5ed","#145739"],ORANGE:["#fff1db","#7e430a"],ROUGE:["#fce8e9","#91252d"]},
  stripes:["#24496f","#32739b","#5da1bd","#a4cbd5","#e5e3d1","#edbd9d","#db815f","#af453d"],
};
const esc = (value: string) => value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const rows = (items: string[][]) => items.map(([label,value])=>
  `<tr><th scope="row" align="left" style="font-weight:600;padding:4px 10px 4px 0;vertical-align:top">${esc(label)}</th><td style="padding:4px 0;color:${colors.muted}">${esc(value)}</td></tr>`).join("");
const table = (body: string) => `<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.4">${body}</table>`;
const section = (label: string, content: string) =>
  `<tr><td style="padding:15px 18px;border-top:1px solid ${colors.line}"><h2 style="font-size:15px;margin:0 0 7px">${label}</h2>${content}</td></tr>`;
const link = (url: string, label: string) => `<a style="color:#205e8a;font-weight:600" href="${esc(url)}">${label}</a>`;
const excerpt = (value: string) => {
  const text=value.trim().replace(/\s+/g," ");
  return text.length<=180 ? text : text.slice(0,177).replace(/\s+\S*$/,"")+"…";
};
export function renderReport(report: Report) {
  const {edition,status,summary,subject}=report;
  const [background,foreground]=colors.status[status];
  const article = edition ? [
    edition.title, excerpt(edition.lead),
    edition.maps===null ? "Sélection de cartes non renseignée" : `${edition.maps} carte${edition.maps===1?"":"s"} sélectionnée${edition.maps===1?"":"s"}`,
  ] : [];
  const editionContent = `<p style="margin:0;color:${colors.muted}">${esc(report.steps)}</p>` +
    (edition ? `<p style="margin:6px 0 2px"><strong>${esc(article[0])}</strong></p><p style="margin:0;color:${colors.muted}">${esc(article[1])}</p>
      <p style="margin:6px 0 0">${esc(article[2])} · ${link(report.link!,"Lire l’édition")}</p>` : "") +
    (report.thumbnail ? `<a href="${esc(report.link!)}"><img width="210" alt="Carte principale de l’édition" src="cid:climacta-carte" style="display:block;max-width:100%;height:auto;margin-top:8px;border:0"></a>` : "");
  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;background:${colors.canvas};color:${colors.ink};font:14px/1.45 Arial,sans-serif;overflow-wrap:anywhere">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.canvas}"><tr><td align="center" style="padding:12px 8px">
<!--[if mso]><table role="presentation" width="580"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" bgcolor="${colors.paper}" style="max-width:580px">
<tr><td bgcolor="${colors.navy}" style="padding:15px 18px;color:white"><h1 style="font-size:23px;margin:0">Climacta</h1>
<p style="margin:2px 0 0">Rapport quotidien · ${esc(report.date)}</p></td></tr>
<tr><td><table role="presentation" aria-hidden="true" width="100%" cellpadding="0" cellspacing="0"><tr>${colors.stripes.map(c=>`<td bgcolor="${c}" height="5" style="font-size:0;line-height:0">&nbsp;</td>`).join("")}</tr></table></td></tr>
<tr><td bgcolor="${background}" style="color:${foreground};padding:10px 18px"><strong>${status}</strong> · ${esc(summary)}</td></tr>
${section("Indicateurs clés",table(rows(report.metrics)))}
${section("Acquisition",table(rows(report.sourceRows)))}
${section("Édition quotidienne",editionContent)}
${section("Maintenance",`<p style="margin:0;color:${colors.muted}">${report.maintenance.map(esc).join(" · ")}</p>
<p style="margin:4px 0 7px"><strong>${esc(report.action)}</strong></p>${link(WORKFLOW,"Workflow nocturne et contrôles")}`)}
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
  const text = [
    `Climacta · Rapport quotidien · ${report.date}`, `${status} · ${summary}`, "",
    "Indicateurs clés", ...report.metrics.map(row=>row.join(" — ")), "",
    "Acquisition", ...report.sourceRows.map(row=>row.join(" — ")), "",
    "Édition quotidienne", report.steps, ...article, ...(report.link ? [report.link] : []), "",
    "Maintenance", ...report.maintenance, report.action, WORKFLOW,
  ].join("\n");
  return {subject,html,text};
}
