import {headers} from "next/headers";
import {notFound} from "next/navigation";
import {personalAccess} from "../../../lib/personal-access";
import {personalEditions,personalReviews} from "../../../lib/server/editorial-personal";
import {EditorialPreview} from "../../../features/editorial-ai/preview";
import "../journal.css";
export const dynamic="force-dynamic";
export const metadata={robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<{date?:string;id?:string}>}) {
 if(!personalAccess(await headers())) notFound();
 const {date,id}=await searchParams;
 const [editions,reviews]=await Promise.all([personalEditions(),personalReviews()]);
 const edition=editions.find(a=>(!date||a.date===date)&&(!id||a.edition_id===id));
 const review=reviews.find(r=>r.archive_id===edition?.edition_id&&r.checksum===edition.checksum);
 const privateStatus=review?.decision==="approved"?"Approuvé éditorialement — la publication publique reste une opération distincte.":review?.decision==="rejected"?"Rejet éditorial — publication interdite.":"Vérifié techniquement — en attente de votre relecture éditoriale. Non publié publiquement.";
 return <EditorialPreview edition={edition} editions={editions} personalStatus={privateStatus}/>;
}
