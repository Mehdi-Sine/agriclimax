import { authorizedReport, deliverReport } from "../../../../features/admin-report/delivery";
import { verifyAdminSmtp } from "../../../../features/admin-report/smtp";

export const runtime = "nodejs";
export const maxDuration = 45;
const headers = {"Cache-Control":"no-store"};

export async function POST(request: Request) {
  if(!authorizedReport(request.headers.get("authorization"))) return new Response(null,{status:404,headers});
  try {
    const query = new URL(request.url).searchParams;
    if (query.has("verify")) {
      if (query.get("verify") !== "smtp") return new Response(null,{status:404,headers});
      await verifyAdminSmtp();
      return Response.json({status:"smtp_verified"},{headers});
    }
    return Response.json({status:await deliverReport()},{headers});
  } catch (error) {
    const code = error instanceof Error && /^ADMIN_REPORT_[A-Z_]+$/.test(error.message) ? error.message : "ADMIN_REPORT_FAILED";
    console.error(code);
    return Response.json({error:code},{status:503,headers});
  }
}
