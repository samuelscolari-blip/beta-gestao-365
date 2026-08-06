import {
  clearMasterPointSessionCookie,
  deleteMasterPointSession,
} from "../../lib/master-point-access";

export async function POST(request: Request) {
  try {
    await deleteMasterPointSession(request.headers);
  } catch {
    // O cookie local é removido mesmo se a limpeza remota falhar.
  }

  return Response.json(
    { ok: true, message: "Sessão do ponto encerrada." },
    {
      headers: {
        "cache-control": "no-store",
        "set-cookie": clearMasterPointSessionCookie(),
      },
    },
  );
}
