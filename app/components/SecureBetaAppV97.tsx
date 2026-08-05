"use client";

import { useLayoutEffect } from "react";
import SecureBetaAppV66 from "./SecureBetaAppV66";
import {
  moduleDefinitions,
  moduleMap,
  moduleTips,
  navigationGroups,
  type ModuleDefinition,
} from "../lib/modules";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

const vacationsDefinition: ModuleDefinition = {
  id: "vacations",
  label: "Cálculo de Férias",
  shortLabel: "Cálculo de Férias",
  eyebrow: "RH • Férias",
  description:
    "Tela própria para organizar o colaborador, o período aquisitivo e a programação das férias. O cálculo será integrado aos dados salariais na próxima etapa.",
  color: "#1477c9",
  lightColor: "#edf7ff",
  titleField: "employeeName",
  referenceField: "vacationId",
  statusField: "status",
  dateField: "vacationStart",
  amountField: "estimatedAmount",
  spreadsheetSheets: [],
  tableColumns: [
    "employeeName",
    "acquisitionStart",
    "acquisitionEnd",
    "vacationStart",
    "vacationDays",
    "status",
  ],
  fields: [
    {
      key: "vacationId",
      label: "Código do registro",
      type: "text",
      required: true,
      placeholder: "Ex.: FER-2026-001",
    },
    {
      key: "employeeName",
      label: "Colaborador",
      type: "text",
      required: true,
      placeholder: "Nome completo do colaborador",
      help: "O vínculo direto com o cadastro e o salário será usado pelo motor de férias na próxima etapa.",
    },
    {
      key: "acquisitionStart",
      label: "Início do período aquisitivo",
      type: "date",
      required: true,
    },
    {
      key: "acquisitionEnd",
      label: "Fim do período aquisitivo",
      type: "date",
      required: true,
    },
    {
      key: "vacationStart",
      label: "Início previsto das férias",
      type: "date",
    },
    {
      key: "vacationDays",
      label: "Quantidade prevista de dias",
      type: "number",
      placeholder: "Ex.: 30",
    },
    {
      key: "status",
      label: "Situação",
      type: "select",
      required: true,
      options: [
        "Em preparação",
        "Aguardando cálculo",
        "Programada",
        "Concluída",
      ],
    },
    {
      key: "notes",
      label: "Observações",
      type: "textarea",
      wide: true,
      placeholder:
        "Registre informações para a futura conferência do cálculo de férias.",
    },
  ],
};

/*
 * Folga de Campo — 9 dias corridos em casa a cada 90 trabalhados, para quem
 * mora fora da cidade da obra.
 *
 * Tela própria, e não uma variação de Férias, porque as regras não se
 * parecem: férias têm período aquisitivo de 12 meses, 30 dias e terço
 * constitucional; a Folga de Campo tem 90 dias, 9 dias e é benefício da
 * empresa, sem reflexo no eSocial. Misturar as duas produziria número
 * errado nos dois lados.
 *
 * Quem tem direito é definido no Cadastro de Funcionários, pela marcação
 * "Residência fora da cidade da obra".
 */
const fieldLeaveDefinition: ModuleDefinition = {
  id: "field_leave",
  label: "Folga de Campo",
  shortLabel: "Folga de Campo",
  eyebrow: "RH • Folga de Campo",
  description:
    "Nove dias corridos em casa a cada noventa trabalhados, para quem mora fora da cidade da obra. Registra a viagem, o custo e a opção de compra da folga pela empresa.",
  color: "#0f766e",
  lightColor: "#effcf9",
  titleField: "employeeName",
  referenceField: "fieldLeaveId",
  statusField: "status",
  dateField: "leaveStart",
  amountField: "totalCost",
  spreadsheetSheets: [],
  tableColumns: [
    "employeeName",
    "homeCity",
    "leaveStart",
    "leaveEnd",
    "resolution",
    "status",
  ],
  fields: [
    { key: "fieldLeaveId", label: "Código do registro", type: "text", required: true, placeholder: "Ex.: FDC-2026-001" },
    { key: "employeeName", label: "Colaborador", type: "text", required: true, placeholder: "Nome completo", help: "Precisa estar marcado como residência fora da cidade da obra no Cadastro de Funcionários." },
    { key: "homeCity", label: "Cidade onde mora", type: "text", required: true, placeholder: "Ex.: Feira de Santana/BA", help: "Destino da viagem. Repita o que está no cadastro do colaborador." },
    { key: "countFrom", label: "Contagem dos 90 dias a partir de", type: "date", required: true, help: "Na primeira folga, a admissão. Nas seguintes, o dia em que ele voltou da folga anterior." },
    { key: "resolution", label: "Como a folga foi resolvida", type: "select", required: true, options: ["Folga concedida", "Comprada pela empresa"], help: "Comprada: a empresa paga o valor combinado e o colaborador segue na obra, sem viagem." },
    { key: "leaveStart", label: "Primeiro dia da folga", type: "date", showWhen: { field: "resolution", equals: "Folga concedida" }, help: "O sistema calcula o último dia: são 9 dias corridos contando este." },
    { key: "leaveEnd", label: "Último dia da folga", type: "date", showWhen: { field: "resolution", equals: "Folga concedida" }, help: "Confira contra o cálculo mostrado no resumo acima da lista." },
    { key: "ticketOut", label: "Passagem — ida", type: "number", showWhen: { field: "resolution", equals: "Folga concedida" } },
    { key: "ticketReturn", label: "Passagem — volta", type: "number", showWhen: { field: "resolution", equals: "Folga concedida" } },
    { key: "mealsOut", label: "Alimentação no percurso — ida", type: "number", showWhen: { field: "resolution", equals: "Folga concedida" } },
    { key: "mealsReturn", label: "Alimentação no percurso — volta", type: "number", showWhen: { field: "resolution", equals: "Folga concedida" } },
    { key: "hotel", label: "Hotel", type: "number", showWhen: { field: "resolution", equals: "Folga concedida" }, help: "Somente quando o trajeto exige parada. Deixe vazio se não houve." },
    { key: "purchaseAmount", label: "Valor pago pela compra", type: "number", showWhen: { field: "resolution", equals: "Comprada pela empresa" }, help: "Confirme com a contabilidade se este valor entra na base de INSS e IRRF antes de lançar na folha." },
    { key: "totalCost", label: "Custo total do registro", type: "number", help: "Some as despesas acima, ou o valor da compra. O resumo acima da lista confere o total." },
    { key: "status", label: "Situação", type: "select", required: true, options: ["Prevista", "Autorizada", "Em andamento", "Concluída", "Comprada"] },
    { key: "notes", label: "Observações", type: "textarea", wide: true, placeholder: "Trajeto, companhia aérea ou rodoviária, comprovantes e o que mais precisar ficar registrado." },
  ],
};

function ensureRhStructure() {
  const payroll = moduleMap.payroll;
  if (payroll) {
    Object.assign(payroll, {
      label: "Cálculo de Salário",
      shortLabel: "Cálculo de Salário",
      eyebrow: "RH • Motor de cálculo salarial",
      description:
        "Simulação mensal de salário com memória de cálculo, tributos, encargos e custo empresarial.",
    });
  }

  moduleTips.payroll =
    "Simule o salário, confira a memória de cálculo e valide com a contabilidade antes de qualquer fechamento oficial.";

  if (moduleTips.terminations) {
    moduleTips.terminations = moduleTips.terminations.replace(
      "Cálculo de Folha",
      "Cálculo de Salário",
    );
  }

  if (!moduleMap.vacations) {
    moduleDefinitions.push(vacationsDefinition);
    moduleMap.vacations = vacationsDefinition;
  } else {
    Object.assign(moduleMap.vacations, vacationsDefinition);
  }

  (moduleTips as Record<string, string>).vacations =
    "Organize o colaborador, o período aquisitivo e a programação. O motor de férias será conectado aos dados salariais na próxima etapa.";

  if (!moduleMap.field_leave) {
    moduleDefinitions.push(fieldLeaveDefinition);
    moduleMap.field_leave = fieldLeaveDefinition;
  } else {
    Object.assign(moduleMap.field_leave, fieldLeaveDefinition);
  }

  (moduleTips as Record<string, string>).field_leave =
    "Nove dias corridos em casa a cada noventa trabalhados, para quem mora fora da cidade da obra. Não é férias e não entra no período aquisitivo.";

  const rhGroup = navigationGroups.find(
    (group) =>
      group.label === "ADMINISTRATIVO E RH" || group.label === "PESSOAS",
  );

  if (!rhGroup) return;

  const orderedItems = rhGroup.items.filter(
    (item) => item !== "vacations" && item !== "field_leave",
  );
  const payrollIndex = orderedItems.indexOf("payroll");
  const terminationIndex = orderedItems.indexOf("terminations");
  const insertionIndex =
    payrollIndex >= 0
      ? payrollIndex + 1
      : terminationIndex >= 0
        ? terminationIndex
        : orderedItems.length;

  /* Folga de Campo logo depois de Férias: são os dois afastamentos. */
  orderedItems.splice(insertionIndex, 0, "vacations", "field_leave");
  rhGroup.items.splice(0, rhGroup.items.length, ...orderedItems);
}

ensureRhStructure();

function replaceLegacyPayrollLabel(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();

  while (current) {
    const parent = current.parentElement;
    if (
      parent &&
      !["SCRIPT", "STYLE", "NOSCRIPT"].includes(parent.tagName) &&
      current.nodeValue?.includes("Cálculo de Folha")
    ) {
      current.nodeValue = current.nodeValue.replaceAll(
        "Cálculo de Folha",
        "Cálculo de Salário",
      );
    }
    current = walker.nextNode();
  }
}

function markVacationsPage() {
  document
    .querySelectorAll<HTMLElement>(".page-stack.vacations-page")
    .forEach((page) => page.classList.remove("vacations-page"));

  /*
   * Localiza o cabeçalho pelo identificador do módulo.
   *
   * Antes, a busca comparava o TEXTO do <h1> com "Cálculo de Férias" e
   * dependia da classe global `.module-heading`. Eram duas fragilidades:
   * renomear o título da tela apagava a estilização em silêncio, e a
   * remoção da classe global — prevista nas próximas etapas — faria o
   * mesmo. O id do módulo não muda por decisão de texto.
   */
  const vacationsHeading = document.querySelector<HTMLElement>(
    `[data-ui="module-header"][data-module="${vacationsDefinition.id}"]`,
  );

  vacationsHeading?.parentElement?.classList.add("vacations-page");
}

export default function SecureBetaAppV97(props: Props) {
  // A configuração é idempotente e precisa ocorrer antes de cada renderização,
  // porque camadas anteriores também reorganizam os grupos do menu.
  ensureRhStructure();

  useLayoutEffect(() => {
    let scheduledFrame = 0;

    const sync = () => {
      scheduledFrame = 0;
      ensureRhStructure();
      replaceLegacyPayrollLabel(document.body);
      markVacationsPage();
    };

    const scheduleSync = () => {
      if (!scheduledFrame) scheduledFrame = window.requestAnimationFrame(sync);
    };

    sync();
    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (scheduledFrame) window.cancelAnimationFrame(scheduledFrame);
    };
  }, []);

  return <SecureBetaAppV66 {...props} />;
}
