export type CapabilityState = "OPERATIONAL" | "READY_FOR_CONNECTOR" | "PLANNED";

export type ErpCapability = {
  id: string;
  title: string;
  description: string;
  state: CapabilityState;
  detail: string;
};

export const boundedContexts = [
  {
    id: "engineering",
    title: "Engenharia & Máquinas",
    description:
      "Atividades executadas, equipe própria, equipamentos, veículos, uso, ociosidade e manutenção.",
    modules: ["assets", "asset_events"],
  },
  {
    id: "people",
    title: "Pessoas & Folha",
    description:
      "Cadastro de Funcionários, jornada contratual, prévias individuais e processamento em lote.",
    modules: ["people", "payroll"],
  },
  {
    id: "compliance",
    title: "Fiscal & Compliance",
    description:
      "Catálogo de regras por vigência e preparação de eventos eSocial, EFD-Reinf e CNO.",
    modules: ["compliance", "rules", "taxes"],
  },
  {
    id: "finance",
    title: "Financeiro & Suprimentos",
    description:
      "Contas a pagar, cartões, compras, fornecedores, documentos e rastreabilidade.",
    modules: ["expenses", "cards", "purchases", "suppliers"],
  },
] as const;

export const erpCapabilities: ErpCapability[] = [
  {
    id: "tenant-scope",
    title: "Escopo por empresa",
    description:
      "Todos os registros persistentes recebem a identificação da empresa e são consultados dentro desse escopo.",
    state: "OPERATIONAL",
    detail: "Tenant Beta Construtora ativo no banco D1.",
  },
  {
    id: "audit-chain",
    title: "Auditoria imutável",
    description:
      "Eventos de inclusão, alteração, importação e exclusão são encadeados por hash e bloqueados contra edição.",
    state: "OPERATIONAL",
    detail: "Trilha append-only com SHA-256 e proteção por gatilhos do banco.",
  },
  {
    id: "batch-payroll",
    title: "Folha em lote",
    description:
      "Processamento server-side dos colaboradores ativos, com totais e memória por competência e obra.",
    state: "OPERATIONAL",
    detail: "Lotes controlados de até 500 colaboradores por execução.",
  },
  {
    id: "rule-engine",
    title: "Catálogo de regras versionado",
    description:
      "Cadastro de regras por domínio, vigência, região, sindicato, CNAE e versão de leiaute.",
    state: "OPERATIONAL",
    detail: "Catálogo persistente e auditável; ativação exige homologação.",
  },
  {
    id: "government-transport",
    title: "Transmissão eSocial / Reinf",
    description:
      "Porta de integração preparada para XML, protocolo, recibo e retorno de processamento.",
    state: "READY_FOR_CONNECTOR",
    detail:
      "Exige certificado ICP-Brasil A1/A3, procuração, credenciais e serviço seguro de assinatura.",
  },
  {
    id: "distributed-workers",
    title: "Fila distribuída de alta escala",
    description:
      "Núcleo NestJS com BullMQ/Redis, PostgreSQL com RLS e workers dedicados, separado do portal Cloudflare.",
    state: "READY_FOR_CONNECTOR",
    detail:
      "Código, contêineres, migrações, autenticação HMAC e ponte D1 preparados; falta provisionar o provedor externo.",
  },
];

export const complianceSources = [
  {
    label: "eSocial • documentação técnica",
    version: "Leiaute S-1.3",
    url: "https://www.gov.br/esocial/pt-br/documentacao-tecnica",
  },
  {
    label: "EFD-Reinf • leiaute vigente",
    version: "Versão 2.1.2b",
    url: "https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/documentos-tecnicos/sped/documentos-tecnicos-efd-reinf/versao-atual",
  },
  {
    label: "Receita Federal • CNO",
    version: "Cadastro Nacional de Obras",
    url: "https://www.gov.br/receitafederal/pt-br/assuntos/construcao-civil/cno",
  },
] as const;

export function capabilityLabel(state: CapabilityState) {
  if (state === "OPERATIONAL") return "Operacional";
  if (state === "READY_FOR_CONNECTOR") return "Conector pendente";
  return "Próxima infraestrutura";
}
