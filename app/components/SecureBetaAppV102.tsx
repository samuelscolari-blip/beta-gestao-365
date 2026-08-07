"use client";

import { useLayoutEffect } from "react";
import { exportHtmlTableToPdf } from "../lib/pdf-export";
import SecureBetaAppV101 from "./SecureBetaAppV101";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

const BUTTON_MARKER = "beta-point-sync-button";
const PDF_BUTTON_MARKER = "beta-pdf-export-button";
const AUTO_SYNC_DELAY_MS = 600;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function buttonLabel(button: HTMLButtonElement) {
  return normalize(button.textContent || "");
}

function setButtonLabel(button: HTMLButtonElement, label: string) {
  const textNode = Array.from(button.childNodes).find(
    (node) => node.nodeType === Node.TEXT_NODE,
  );
  const nextLabel = ` ${label}`;
  if (textNode) {
    if (textNode.textContent !== nextLabel) textNode.textContent = nextLabel;
  } else {
    button.append(document.createTextNode(nextLabel));
  }
}

function moduleTitle(toolbar: HTMLElement) {
  const page = toolbar.closest<HTMLElement>(".page-stack");
  const headerTitle = page
    ?.querySelector<HTMLElement>('[data-ui="module-header"] h1')
    ?.textContent?.trim();
  const activeNavigation = document
    .querySelector<HTMLElement>(".sidebar button.active span:last-child")
    ?.textContent?.trim();
  return headerTitle || activeNavigation || "Relatório";
}

function installPdfExportButtons(isAdmin: boolean) {
  if (!isAdmin) return;

  document
    .querySelectorAll<HTMLElement>(".table-toolbar")
    .forEach((toolbar) => {
      const buttons = Array.from(
        toolbar.querySelectorAll<HTMLButtonElement>("button"),
      );
      const pdfButton = buttons.find(
        (candidate) =>
          candidate.dataset.ui === PDF_BUTTON_MARKER ||
          buttonLabel(candidate) === "modelo",
      );
      if (!pdfButton) return;

      pdfButton.dataset.ui = PDF_BUTTON_MARKER;
      pdfButton.type = "button";
      pdfButton.title =
        "Exportar os registros exibidos nesta tabela em um arquivo PDF.";
      pdfButton.setAttribute(
        "aria-label",
        "Exportar os registros exibidos em Arquivo PDF",
      );
      setButtonLabel(pdfButton, "Arquivo PDF");

      if (pdfButton.dataset.pdfExportReady !== "true") {
        pdfButton.dataset.pdfExportReady = "true";
        pdfButton.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            const currentToolbar = pdfButton.closest<HTMLElement>(
              ".table-toolbar",
            );
            const table = currentToolbar
              ?.closest<HTMLElement>(".table-card")
              ?.querySelector<HTMLTableElement>("table");
            if (!table || !currentToolbar) {
              window.alert("A tabela desta tela não foi encontrada para o PDF.");
              return;
            }

            const title = moduleTitle(currentToolbar);
            try {
              exportHtmlTableToPdf(table, {
                title,
                fileName: `Beta Construtora - ${title}`,
              });
            } catch (error) {
              window.alert(
                error instanceof Error
                  ? error.message
                  : "Não foi possível gerar o Arquivo PDF.",
              );
            }
          },
          { capture: true },
        );
      }

      const importButton = buttons.find(
        (candidate) => buttonLabel(candidate) === "importar",
      );
      const excelButton = buttons.find(
        (candidate) => buttonLabel(candidate) === "excel",
      );
      if (
        importButton?.parentElement === toolbar &&
        excelButton?.parentElement === toolbar &&
        pdfButton.parentElement === toolbar
      ) {
        /*
         * `insertBefore` remove e reinsere o nó mesmo quando ele já ocupa a
         * posição pedida. Como esta rotina é chamada por um MutationObserver,
         * a movimentação incondicional criava um ciclo contínuo de mutações.
         * Os botões mudavam de lugar entre o pressionar e o soltar do mouse,
         * então o navegador não concluía o clique de PDF nem o de Excel.
         *
         * Só tocamos no DOM quando a ordem realmente estiver incorreta.
         */
        if (excelButton.nextElementSibling !== importButton) {
          toolbar.insertBefore(excelButton, importButton);
        }
        if (pdfButton.nextElementSibling !== excelButton) {
          toolbar.insertBefore(pdfButton, excelButton);
        }
      }
    });
}

function peopleToolbar() {
  const tabs = document.querySelector<HTMLElement>(".people-status-tabs");
  if (!tabs) return null;
  const page = tabs.closest<HTMLElement>(".page-stack") || tabs.parentElement;
  return page?.querySelector<HTMLElement>(".table-toolbar") || null;
}

async function requestPointSync(
  fetcher: typeof window.fetch,
  activateReal = false,
) {
  const response = await fetcher("/api/integrations/ponto/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ activateReal }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    total?: number;
    created?: number;
    updated?: number;
    deactivated?: number;
    semAcesso?: string[];
    message?: string;
  };
  if (!response.ok || !result.ok) {
    throw new Error(
      result.message || "Não foi possível sincronizar com o Beta Ponto.",
    );
  }
  return result;
}

function recordMutationAffectsPoint(
  input: RequestInfo | URL,
  init?: RequestInit,
): boolean {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const pathname = new URL(url, window.location.origin).pathname;
  if (pathname !== "/api/records") return false;

  const method = String(
    init?.method || (input instanceof Request ? input.method : "GET"),
  ).toUpperCase();
  if (!new Set(["POST", "PUT", "DELETE"]).has(method)) return false;
  if (method === "DELETE") return true;

  const body = init?.body;
  if (typeof body !== "string") {
    // Corpo não inspecionável: sincronizar é mais seguro do que deixar uma
    // alteração de Pessoas/Obras passar sem chegar ao Ponto.
    return true;
  }

  try {
    const parsed = JSON.parse(body) as {
      record?: { module?: unknown };
      records?: Array<{ module?: unknown }>;
      module?: unknown;
    };
    const modules = [
      parsed.module,
      parsed.record?.module,
      ...(parsed.records || []).map((record) => record.module),
    ];
    return modules.some((moduleId) =>
      moduleId === "people" || moduleId === "works",
    );
  } catch {
    return true;
  }
}

/*
 * Sincronização automática do cadastro.
 *
 * A aplicação inteira já escreve Pessoas e Obras por `/api/records`. Em vez
 * de espalhar chamadas ao Ponto por cada formulário, observamos essa única
 * fronteira: uma gravação oficial bem-sucedida agenda um snapshot completo.
 * Várias alterações feitas em sequência viram um único envio por debounce.
 *
 * O salvamento no Gestão 365 não é revertido se o Ponto estiver fora do ar.
 * O botão manual continua disponível e, ao abrir a área administrativa, há
 * ainda uma sincronização silenciosa de recuperação.
 */
function installAutomaticPointSync(isAdmin: boolean) {
  if (!isAdmin) return () => undefined;

  const originalFetch = window.fetch.bind(window);
  let timer = 0;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = 0;
      void requestPointSync(originalFetch, false).catch((error) => {
        console.error("Sincronização automática com o Beta Ponto pendente.", error);
      });
    }, AUTO_SYNC_DELAY_MS);
  };

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const affectsPoint = recordMutationAffectsPoint(input, init);
    const response = await originalFetch(input, init);
    if (affectsPoint && response.ok) schedule();
    return response;
  }) as typeof window.fetch;

  // Recupera qualquer alteração feita enquanto o Ponto ou a rede estavam
  // indisponíveis, sem depender do clique manual.
  schedule();

  return () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
    window.fetch = originalFetch;
  };
}

function installPointSyncButton(isAdmin: boolean) {
  if (!isAdmin) return;
  const toolbar = peopleToolbar();
  if (!toolbar || toolbar.querySelector(`[data-ui="${BUTTON_MARKER}"]`)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button secondary compact-button";
  button.dataset.ui = BUTTON_MARKER;
  button.textContent = "Ativar / sincronizar Ponto";
  button.title =
    "Sincroniza o cadastro oficial. Se o Ponto ainda estiver em demonstração, ativa a BASE REAL somente após validar quadro, obra, jornada e credenciais.";

  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const original = button.textContent || "Ativar / sincronizar Ponto";
    button.disabled = true;
    button.textContent = "Sincronizando…";
    try {
      const result = await requestPointSync(window.fetch.bind(window), true);
      button.textContent = `Ponto sincronizado (${result.total || 0})`;
      window.alert(
        `${result.message || "Sincronização concluída."}\n\n` +
          `Novos: ${result.created || 0}\n` +
          `Atualizados: ${result.updated || 0}\n` +
          `Desativados: ${result.deactivated || 0}\n` +
          `Sem credencial de acesso ainda: ${result.semAcesso?.length || 0}`,
      );
      window.setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 3500);
    } catch (error) {
      button.textContent = "Sincronização pendente";
      window.alert(
        error instanceof Error
          ? error.message
          : "Não foi possível sincronizar com o Beta Ponto.",
      );
      window.setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, 3500);
    }
  });

  const importButton = Array.from(
    toolbar.querySelectorAll<HTMLButtonElement>("button"),
  ).find((candidate) =>
    (candidate.textContent || "").toLowerCase().includes("importar"),
  );
  if (importButton?.nextSibling) {
    toolbar.insertBefore(button, importButton.nextSibling);
  } else {
    toolbar.append(button);
  }
}

export default function SecureBetaAppV102(props: Props) {
  useLayoutEffect(() => {
    let frame = 0;
    const stopAutomaticSync = installAutomaticPointSync(props.isAdmin);
    const enhanceToolbar = () => {
      installPdfExportButtons(props.isAdmin);
      installPointSyncButton(props.isAdmin);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        enhanceToolbar();
      });
    };

    enhanceToolbar();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    return () => {
      stopAutomaticSync();
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [props.isAdmin]);

  return <SecureBetaAppV101 {...props} />;
}
