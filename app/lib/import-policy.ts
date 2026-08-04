export type ImportFamilyId = "costs" | "machines" | "employees" | "works";

export type ImportFamilyDefinition = {
  id: ImportFamilyId;
  label: string;
  description: string;
  modules: string[];
};

export const importFamilies: ImportFamilyDefinition[] = [
  {
    id: "works",
    label: "Obras",
    description:
      "Cadastro e atualização de obras pelo código único, gestor, previsão, etapa e indicadores executivos.",
    modules: ["works"],
  },
  {
    id: "costs",
    label: "Custos",
    description:
      "Contas a pagar, cartões, aluguéis, alimentação, impostos e compras.",
    modules: [
      "expenses",
      "cards",
      "rentals",
      "food",
      "taxes",
      "purchases",
    ],
  },
  {
    id: "machines",
    label: "Máquinas",
    description:
      "Cadastro de máquinas, veículos, equipamentos, manutenções e ocorrências.",
    modules: ["assets", "asset_events"],
  },
  {
    id: "employees",
    label: "Funcionários",
    description:
      "Cadastro profissional de colaboradores, vínculos, status, férias e informações de RH.",
    modules: ["people"],
  },
];

const importFamilyByModule = new Map(
  importFamilies.flatMap((family) =>
    family.modules.map((moduleId) => [moduleId, family] as const),
  ),
);

export const allowedImportModuleIds = new Set(importFamilyByModule.keys());

export function isImportableModule(moduleId: string) {
  return allowedImportModuleIds.has(moduleId);
}

export function importFamilyForModule(moduleId: string) {
  return importFamilyByModule.get(moduleId) || null;
}

export function importFamilyLabelForModule(moduleId: string) {
  return importFamilyForModule(moduleId)?.label || "Não permitido";
}

export const importScopeDescription = importFamilies
  .map((family) => `${family.label}: ${family.description}`)
  .join(" ");
