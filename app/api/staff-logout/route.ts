import {
  clearMasterPointSessionCookie,
  deleteMasterPointSession,
} from "../../lib/master-point-access";
import {
  clearStaffSessionCookie,
  deleteStaffSession,
} from "../../lib/staff-access";

export async function POST(request: Request) {
  await Promise.allSettled([
    deleteStaffSession(request.headers),
    deleteMasterPointSession(request.headers),
  ]);

  const headers = new Headers({ "cache-control": "no-store" });
  headers.append("set-cookie", clearStaffSessionCookie());
  headers.append("set-cookie", clearMasterPointSessionCookie());

  return Response.json(
    { ok: true, message: "Sessão encerrada neste celular." },
    { headers },
  );
}
