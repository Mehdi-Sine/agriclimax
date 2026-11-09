import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {personalAccess} from "../../../lib/personal-access";
import {personalEditions,personalReviews,personalAttempts} from "../../../lib/server/editorial-personal";
import {EditorialPreview} from "../../../features/editorial-ai/preview";
import {parisDate} from "../../../features/editorial/almanac";
import "../journal.css";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{date?:string;id?:string}>}) {
 if(!personalAccess(await headers())) notFound();
 const {date,id}=await searchParams;
 const [editions,reviews,attempts]=await Promise.all([personalEditions(),personalReviews(),personalAttempts()]);
 const edition=editions.find(a=>(!date||a.date===date)&&(!id||a.edition_id===id));
 const review=reviews.find(r=>r.archive_id===edition?.edition_id&&r.checksum===edition.checksum);
 const privateStatus=edition?.validation.status==="rejected"?`Texte OpenAI réel — contrôle scientifique bloquant : ${edition.validation.errors.join(", ")}. À examiner ; approbation et publication interdites.`:review?.decision==="approved"?"Approuvé éditorialement — la publication publique reste une opération distincte.":review?.decision==="rejected"?"Rejet éditorial — publication interdite.":"Vérifié techniquement — en attente de votre relecture éditoriale. Non publié publiquement.";
 const attempt=!edition&&attempts.find(r=>r.edition_date===(date??parisDate(new Date().toISOString()))&&["outcome_unknown","validation_failed"].includes(r.state));
 return <>{attempt&&<aside role="status"><p>La tentative de génération n’a pas produit de brouillon IA vérifié ({attempt.error??attempt.state}). Aucune relance payante automatique.</p><p>Les limites financières sont gérées dans le projet OpenAI. Cette tentative historique ne bloque pas un nouvel essai manuel. Le Journal public conserve sa dernière édition valide.</p></aside>}<EditorialPreview edition={edition} editions={editions} personalStatus={privateStatus}/></>;

}
