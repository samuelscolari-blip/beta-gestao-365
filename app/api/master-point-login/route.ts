import {
  createMasterPointSession,
  masterPointSessionCookie,
  verifyMasterPointAccess,
} from "../../lib/master-point-access";
import { businessStaffSessionFromHeaders } from "../../lib/staff-business-access";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json(
      { ok: false, message: "Origem de login inválida." },
      { status: 403 },
    );
  }

  const supervisor = await businessStaffSessionFromHeaders(request.headers);
  if (!supervisor || supervisor.role !== "encarregado") {
    return Response.json(
      {
        ok: false,
        message:
          "Identifique primeiro o encarregado com matrícula e senha individual.",
      },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  let cpf = "";
  let password = "";
  try {
    const body = (await request.json()) as {
      cpf?: unknown;
      password?: unknown;
    };
    cpf = String(body.cpf ?? "");
    password = String(body.password ?? "");
  } catch {
    return Response.json(
      { ok: false, message: "Solicitação de login inválida." },
      { status: 400 },
    );
  }

  const verified = await verifyMasterPointAccess({ cpf, password });
  if (!verified.ok) {
    return Response.json(
      { ok: false, message: verified.error },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const session = await createMasterPointSession(verified.employee, {
    registration: supervisor.registration,
    name: supervisor.name,
    role: "encarregado",
  });
  return Response.json(
    {
      ok: true,
      message:
        "Senha master confirmada. A sessão do encarregado foi liberada para todos os colaboradores.",
      supervisor: {
        registration: supervisor.registration,
        name: supervisor.name,
      },
      selectedEmployee: {
        registration: verified.employee.registration,
        name: verified.employee.name,
      },
      expiresAt: session.expiresAt,
    },
    {
      headers: {
        "cache-control": "no-store",
        "set-cookie": masterPointSessionCookie(session.token, session.maxAge),
      },
    },
  );
}
