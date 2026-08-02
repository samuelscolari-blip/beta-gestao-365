import {
  authenticatedEmail,
  SOLE_ADMIN_EMAIL,
} from "../lib/server-access";

function redirectToHome(request: Request, state: string) {
  const destination = new URL("/", request.url);
  destination.searchParams.set("admin", state);
  return Response.redirect(destination, 302);
}

export async function GET(request: Request) {
  const email = authenticatedEmail(request);

  if (!email) {
    return redirectToHome(request, "configuracao-pendente");
  }

  if (email !== SOLE_ADMIN_EMAIL) {
    return redirectToHome(request, "nao-autorizado");
  }

  return redirectToHome(request, "ativo");
}
