import {EditorialHeader} from "../../components/navigation/editorial-header";
import {DocumentationExplorer} from "../../components/documentation/explorer";
export default function Page(){return <><EditorialHeader active="documentation"/><main className="ux01-doc">
<p className="ux01-kicker">AGRICLIMAX · RÉFÉRENTIEL D’USAGE</p><h1>Aide et documentation</h1>
<p className="ux01-deck">Comprendre les cartes et les indicateurs, vérifier les sources, retrouver les méthodes et les limites d’interprétation. La documentation reste liée aux référentiels scientifiques de l’application.</p>
<DocumentationExplorer/>
</main></>}
