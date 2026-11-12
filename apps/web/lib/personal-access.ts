// Node-only authentication boundary for the personal Journal. Never imported by client components.
import {createHash,timingSafeEqual} from "node:crypto";
export function personalAccess(headers: Headers, secret=process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
 if(!secret) return false;
 let supplied=headers.get("x-vercel-protection-bypass")??"";
 const auth=headers.get("authorization");
 if(!supplied && auth?.startsWith("Basic ")) {
  const decoded=Buffer.from(auth.slice(6),"base64").toString("utf8");
  if(decoded.startsWith("owner:")) supplied=decoded.slice(6);
 }
 return timingSafeEqual(createHash("sha256").update(secret).digest(),createHash("sha256").update(supplied).digest());
}
export function personalAccessDenied() {
 return new Response("Accès personnel requis.",{status:401,headers:{"WWW-Authenticate":'Basic realm="Climacta personnel", charset="UTF-8"',"Cache-Control":"private, no-store"}});
}
