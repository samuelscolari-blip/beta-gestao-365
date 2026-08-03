export const SOLE_ADMIN_EMAIL = "scolarisamuel@gmail.com";

export type HeaderReader = {
  get(name: string): string | null;
};

function localDevelopmentAutoLogin(headers: HeaderReader) {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.BETA_DEV_AUTO_LOGIN !== "1") return false;

  const host = String(
    headers.get("x-forwarded-host") || headers.get("host") || "",
  )
    .split(":")[0]
    .trim()
    .toLowerCase();

  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function authenticatedEmailFromHeaders(headers: HeaderReader) {
  const authenticated = headers
    .get("x-beta-authenticated-email")
    ?.trim()
    .toLowerCase();
  if (authenticated) return authenticated;

  // O atalho só existe fora de produção, em host local e após ativação
  // deliberada por BETA_DEV_AUTO_LOGIN=1. UI e APIs usam a mesma identidade.
  return localDevelopmentAutoLogin(headers) ? SOLE_ADMIN_EMAIL : null;
}

export function authenticatedEmail(request: Request) {
  return authenticatedEmailFromHeaders(request.headers);
}

export function isSoleAdmin(request: Request) {
  return authenticatedEmail(request) === SOLE_ADMIN_EMAIL;
}

export function actorFrom(request: Request) {
  return authenticatedEmail(request) || "administrador autenticado";
}

export function requireSoleAdmin(request: Request) {
  if (isSoleAdmin(request)) return null;

  return Response.json(
    {
      error:
        "Esta ação exige autenticação com o usuário administrador do sistema.",
      code: "ADMIN_REQUIRED",
    },
    { status: authenticatedEmail(request) ? 403 : 401 },
  );
}
