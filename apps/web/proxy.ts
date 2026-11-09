import {NextResponse,type NextRequest} from "next/server";
import {personalAccess,personalAccessDenied} from "./lib/personal-access";
export function proxy(request:NextRequest) {
 if(!personalAccess(request.headers)) return personalAccessDenied();
 const response=NextResponse.next();response.headers.set("Cache-Control","private, no-store");
 response.headers.set("X-Robots-Tag","noindex, nofollow");return response;
}
export const config={matcher:["/journal/personnel/:path*","/api/journal/personnel/:path*"]};
