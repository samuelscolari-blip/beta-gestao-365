import { POINT_TEST_EMPLOYEES } from "../../lib/point-test-employees";

export async function GET() {
  return Response.json(
    {
      ok: true,
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
