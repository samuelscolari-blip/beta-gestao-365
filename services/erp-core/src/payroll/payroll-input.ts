import {
  normalizePayrollInput,
  payrollRules2026,
  type PayrollInput,
} from "../../../../packages/payroll-core/src/index";
import type { employees } from "../database/schema";

type EmployeeRecord = typeof employees.$inferSelect;

export function buildPayrollInputSnapshot(
  employee: EmployeeRecord,
  competence: string,
): PayrollInput {
  const profile =
    (employee.payrollProfile || {}) as Record<string, unknown>;

  return normalizePayrollInput({
    employeeName: employee.name,
    employeeCode: employee.employeeCode,
    role: employee.role,
    workName: String(profile.workName || ""),
    competence,
    baseSalary: Number(employee.baseSalary),
    monthlyHours: Number(employee.monthlyHours),
    overtimeHours: Number(profile.overtimeHours || 0),
    overtimePercent: Number(profile.overtimePercent || 50),
    additionalType:
      profile.additionalType === "INSALUBRITY" ||
      profile.additionalType === "HAZARD"
        ? profile.additionalType
        : "NONE",
    insalubrityDegree: Number(
      profile.insalubrityDegree || 20,
    ) as 10 | 20 | 40,
    insalubrityBase: Number(
      profile.insalubrityBase || payrollRules2026.minimumWage,
    ),
    taxableAdditions: Number(profile.taxableAdditions || 0),
    nonTaxableEarnings: Number(profile.nonTaxableEarnings || 0),
    dependents: Number(profile.dependents || 0),
    pensionDeduction: Number(profile.pensionDeduction || 0),
    salaryAdvance: Number(profile.salaryAdvance || 0),
    consignments: Number(profile.consignments || 0),
    unionContribution: Number(profile.unionContribution || 0),
    otherDeductions: Number(profile.otherDeductions || 0),
    fgtsCategory:
      profile.fgtsCategory === "APPRENTICE"
        ? "APPRENTICE"
        : "STANDARD",
    employerInssPercent: Number(profile.employerInssPercent || 20),
    ratPercent: Number(profile.ratPercent || 2),
    fapFactor: Number(profile.fapFactor || 1),
    thirdPartiesPercent: Number(profile.thirdPartiesPercent || 5.8),
    employerParameterSource:
      profile.employerParameterSource === "COMPANY_PROFILE"
        ? "COMPANY_PROFILE"
        : "ESTIMATE",
  });
}
