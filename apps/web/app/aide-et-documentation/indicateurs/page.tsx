import Link from "next/link";
import {EditorialHeader} from "../../../components/navigation/editorial-header";
import {RULES} from "../../../features/agroclimatic/catalogue";
import {PRODUCTIONS} from "../../../features/multiproduction/registry";
export default function Page(){return <><EditorialHeader active="documentation"/><main className="ux01-doc">
<p className="ux01-kicker">Méthodes scientifiques · catalogue versionné</p><h1>Lire les indicateurs</h1>
<p className="ux01-deck">Les 13 indicateurs historiques et la température moyenne ajoutée au catalogue : 14 règles descriptives exploratoires. Aucun de ces indicateurs ne démontre un dommage ou un risque agronomique.</p>
<p>Chaque carte indique sa période, sa nature (observation, réanalyse ou prévision), sa source et sa fraîcheur. Une édition datée du jour peut contenir une réanalyse ancienne. Une observation de station ne devient pas automatiquement une moyenne PRA.</p>
<h2>Couverture et valeurs absentes</h2><p>713 PRA, dont six en Corse. Gris : valeur absente, distincte de zéro. Hachures : portion renseignée, sans extrapolation. Le seuil surfacique de 90 % concerne seulement une estimation autorisée par la famille de calcul, avec méthode certifiée et masque admissible. Il ne suffit jamais à lui seul. Les portions descriptives sont exclues des chiffres clés du Journal.</p>
<p>Une journée manquante ou une rupture de source, de cycle ou de support interdit un cumul ou une séquence de période complète. Le THI reste absent sans couple température–humidité qualifié.</p>
<nav aria-label="Indicateurs">{RULES.map(r=><p key={r.id}><a href={`#${r.id}`}>{r.label}</a></p>)}</nav>
{RULES.map(r=><section id={r.id} key={r.id}><h2>{r.label}</h2><p><code>{r.id}</code> · {r.version} · {r.unit} · exploratoire</p><dl>
<dt>Définition</dt><dd>{r.formula}</dd><dt>Seuil par défaut</dt><dd>{r.threshold===null?"Aucun seuil de comptage":`${r.threshold} (comparaison stricte, selon la formule)`}</dd>
<dt>Période</dt><dd>{r.admissible_period}</dd><dt>Source des données</dt><dd>{r.meteorological_source}</dd><dt>Référence méthodologique</dt><dd><a href={r.source}>{r.source}</a></dd>
<dt>Valeurs manquantes</dt><dd>{r.unavailable}</dd><dt>Interprétation</dt><dd>{r.description} {r.limits}</dd></dl>
{PRODUCTIONS.filter(p=>p.indicators.includes(r.id)).map(p=><p key={p.id}><strong>{p.label} :</strong> {p.limits}</p>)}</section>)}
<p><Link href="/aide/cartes">Palettes, seuils de légende et méthodes cartographiques</Link> · <Link href="/aide-et-documentation">Retour à l’aide</Link></p>
</main></>;}
