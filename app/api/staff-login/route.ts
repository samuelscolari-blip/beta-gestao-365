import {
  createStaffSession,
  staffSessionCookie,
  verifyStaffCredentials,
} from "../../lib/staff-access";

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

  let registration = "";
  let password = "";
  try {
    const body = (await request.json()) as {
      registration?: unknown;
      password?: unknown;
    };
    registration = String(body.registration ?? "");
    password = String(body.password ?? "");
  } catch {
    return Response.json(
      { ok: false, message: "Solicitação de login inválida." },
      { status: 400 },
    );
  }

  const verified = await verifyStaffCredentials(registration, password);
  if (!verified.ok) {
    return Response.json(
      { ok: false, message: verified.error },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const session = await createStaffSession(verified.account);
  return Response.json(
    {
      ok: true,
      message: "Acesso de encarregado liberado neste celular.",
      user: verified.account,
      expiresAt: session.expiresAt,
    },
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "set-cookie": staffSessionCookie(session.token, session.maxAge),
      },
    },
  );
}
