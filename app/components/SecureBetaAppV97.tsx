"use client";

import { useLayoutEffect } from "react";
import SecureBetaAppV66 from "./SecureBetaAppV66";
import {
  moduleMap,
  moduleTips,
  navigationGroups,
} from "../lib/modules";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

/*
 * A definição vem de `app/lib/modules.ts` — o arquivo que o SERVIDOR também
 * lê. Enquanto ela morava aqui, no cliente, a tela abria, preenchia e não
 * salvava: `validateRecordPayload` recusa módulo sem definição.
 *
 * Ler o id daqui, em vez de escrever "vacations" na busca abaixo, mantém a
 * marcação amarrada à definição: renomear o módulo quebra a compilação, em
 * vez de apagar a estilização em silêncio.
 */
const vacationsDefinition = moduleMap.vacations;


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


  (moduleTips as Record<string, string>).vacations =
    "Organize o colaborador, o período aquisitivo e a programação. O motor de férias será conectado aos dados salariais na próxima etapa.";



  (moduleTips as Record<string, string>).trainings =
    "Integrações, NRs e reciclagens por colaborador. A situação vem das datas: o que venceu, o que vence em 30 dias e o que nunca foi agendado aparecem no topo.";

  (moduleTips as Record<string, string>).field_leave =
    "Nove dias corridos em casa a cada noventa trabalhados, para quem mora fora da cidade da obra. Não é férias e não entra no período aquisitivo.";

  const rhGroup = navigationGroups.find(
    (group) =>
      group.label === "ADMINISTRATIVO E RH" || group.label === "PESSOAS",
  );

  if (!rhGroup) return;

  /*
   * Treinamentos NÃO entra aqui: mora no grupo "Operação & Documentos", ao
   * lado de Documentos. Continua sendo filtrado do grupo de RH para o caso de
   * alguma camada anterior tê-lo posto aqui.
   */
  const orderedItems = rhGroup.items.filter(
    (item) =>
      item !== "vacations" && item !== "field_leave" && item !== "trainings",
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
