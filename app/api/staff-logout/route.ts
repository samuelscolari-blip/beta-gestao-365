import {
  clearStaffSessionCookie,
  deleteStaffSession,
} from "../../lib/staff-access";

export async function POST(request: Request) {
  try {
    await deleteStaffSession(request.headers);
  } catch {
    // O navegador encerra a sessão local mesmo se a limpeza remota falhar.
  }

  return Response.json(
    { ok: true, message: "Sessão encerrada." },
    {
      headers: {
        "cache-control": "no-store",
        "set-cookie": clearStaffSessionCookie(),
      },
    },
  );
}
