import { authorizedReport, deliverReport } from "../../../../features/admin-report/delivery";

export const runtime = "nodejs";
export const maxDuration = 45;
const headers = {"Cache-Control":"no-store"};

export async function POST(request: Request) {
  if(!authorizedReport(request.headers.get("authorization"))) return new Response(null,{status:404,headers});
  try {
    return Response.json({status:await deliverReport()},{headers});
  } catch (error) {
    const code = error instanceof Error && /^ADMIN_REPORT_[A-Z_]+$/.test(error.message) ? error.message : "ADMIN_REPORT_FAILED";
    console.error(code);
    return Response.json({error:code},{status:503,headers});
  }
}
