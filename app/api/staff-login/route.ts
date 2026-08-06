export async function POST() {
  return Response.json(
    {
      ok: false,
      message:
        "O acesso individual foi desativado nesta etapa. Use o CPF do colaborador e a senha master do encarregado.",
    },
    { status: 410, headers: { "cache-control": "no-store" } },
  );
}
