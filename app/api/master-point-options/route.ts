import { POINT_TEST_EMPLOYEES } from "../../lib/point-test-employees";
import { businessStaffSessionFromHeaders } from "../../lib/staff-business-access";

export async function GET(request: Request) {
  const supervisor = await businessStaffSessionFromHeaders(request.headers);
  if (!supervisor || supervisor.role !== "encarregado") {
    return Response.json(
      {
        ok: false,
        message:
          "Identifique primeiro o encarregado para consultar os colaboradores.",
      },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  return Response.json(
    {
      ok: true,
      supervisor: {
        registration: supervisor.registration,
        name: supervisor.name,
      },
      employees: POINT_TEST_EMPLOYEES.map((employee) => ({
        cpf: employee.cpf,
        formattedCpf: employee.formattedCpf,
        registration: employee.registration,
        name: employee.name,
        role: employee.role,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
