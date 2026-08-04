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

let configured = false;

function configureRhStructure() {
  if (configured) return;
  configured = true;

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

  const vacations: ModuleDefinition = {
    id: "vacations",
    label: "Cálculo de Férias",
    shortLabel: "Cálculo de Férias",
    eyebrow: "RH • Férias",
    description:
      "Tela separada para organizar colaborador, período aquisitivo e programação. As regras e os valores do cálculo serão definidos na próxima etapa.",
    color: "#0f766e",
    lightColor: "#ecfdf5",
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

  if (!moduleMap.vacations) {
    moduleDefinitions.push(vacations);
    moduleMap.vacations = vacations;
  } else {
    Object.assign(moduleMap.vacations, vacations);
  }

  (moduleTips as Record<string, string>).vacations =
    "Organize o período aquisitivo e a programação. O motor de cálculo de férias será implementado e validado na próxima etapa.";

  const rhGroup = navigationGroups.find(
    (group) =>
      group.label === "ADMINISTRATIVO E RH" || group.label === "PESSOAS",
  );

  if (rhGroup && !rhGroup.items.includes("vacations")) {
    const payrollIndex = rhGroup.items.indexOf("payroll");
    rhGroup.items.splice(payrollIndex >= 0 ? payrollIndex + 1 : 1, 0, "vacations");
  }
}

configureRhStructure();

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

export default function SecureBetaAppV97(props: Props) {
  useLayoutEffect(() => {
    let scheduledFrame = 0;

    const sync = () => {
      scheduledFrame = 0;
      replaceLegacyPayrollLabel(document.body);
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
