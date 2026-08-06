import { formatCpf, registrationFromCpf } from "./employee-registration";

export type PointEmployee = {
  cpf: string;
  formattedCpf: string;
  registration: string;
  name: string;
  role: "encarregado" | "colaborador";
};

const SOURCE_EMPLOYEES = [
  {
    cpf: "34135084079",
    name: "Carlos Eduardo",
    role: "encarregado",
  },
  {
    cpf: "25804152033",
    name: "Ricardo Lima",
    role: "colaborador",
  },
  {
    cpf: "74509305010",
    name: "João Ferreira",
    role: "colaborador",
  },
] as const;

export const POINT_TEST_EMPLOYEES: readonly PointEmployee[] =
  SOURCE_EMPLOYEES.map((employee) => ({
    ...employee,
    formattedCpf: formatCpf(employee.cpf),
    registration: registrationFromCpf(employee.cpf),
  }));

export function pointEmployeeByCpf(value: unknown) {
  const cpf = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  return POINT_TEST_EMPLOYEES.find((employee) => employee.cpf === cpf) || null;
}

export function pointEmployeeByRegistration(value: unknown) {
  const registration = String(value ?? "").replace(/\D/g, "").slice(0, 5);
  return (
    POINT_TEST_EMPLOYEES.find(
      (employee) => employee.registration === registration,
    ) || null
  );
}
