import { requireSoleAdmin } from "../../lib/server-access";
import { provisionStaffAccount } from "../../lib/staff-account-provisioning";

export async function POST(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  try {
    const body = (await request.json()) as {
      name?: unknown;
      cpf?: unknown;
      role?: unknown;
    };
    const result = await provisionStaffAccount(body);
    return Response.json(
      {
        ok: true,
        account: {
          registration: result.registration,
          name: result.name,
          role: result.role,
        },
        temporaryPassword: result.temporaryPassword,
        message:
          "Acesso criado. Copie a senha temporária agora; ela não será exibida novamente.",
      },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Não foi possível criar o acesso.",
      },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
}
