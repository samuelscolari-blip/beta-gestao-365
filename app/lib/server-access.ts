export const SOLE_ADMIN_EMAIL = "scolarisamuel@gmail.com";

export function authenticatedEmail(request: Request) {
  return request.headers
    .get("oai-authenticated-user-email")
    ?.trim()
    .toLowerCase() || null;
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
