"use client";

import { useLayoutEffect } from "react";
import SecureBetaAppV100 from "./SecureBetaAppV100";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

function buttonLabel(button: HTMLButtonElement) {
  return normalize(button.textContent || "");
}

function closestSharedContainer(
  first: HTMLElement,
  second: HTMLElement,
  boundary: HTMLElement,
) {
  let current: HTMLElement | null = first.parentElement;
  while (current && current !== boundary) {
    if (current.contains(second)) return current;
    current = current.parentElement;
  }
  return null;
}

/**
 * Mantém um único caminho de importação por módulo.
 *
 * O botão canônico é o compacto "Importar" da barra da tabela, ao lado de
 * "Modelo". Ele chama `requestImport(activeModule.id)`, portanto já abre o
 * importador com Cadastro de Funcionários, Obras, Máquinas ou Custos como
 * destino explícito.
 *
 * A chamada antiga do cabeçalho repetia a mesma função em um cartão grande
 * "Modelo padrão". Duas entradas para a mesma ação davam a impressão de que
 * existiam dois importadores. O cartão é retirado, e o atalho repetido do
 * estado vazio também some quando a barra canônica está presente.
 */
export function keepSingleModuleImporter(scope: ParentNode = document) {
  scope
    .querySelectorAll<HTMLElement>('[data-ui="module-header"]')
    .forEach((header) => {
      const buttons = Array.from(
        header.querySelectorAll<HTMLButtonElement>("button"),
      );
      const download = buttons.find(
        (button) => buttonLabel(button) === "baixar modelo",
      );
      const duplicateImport = buttons.find(
        (button) => buttonLabel(button) === "importar planilha",
      );

      if (!download || !duplicateImport) return;
      const card = closestSharedContainer(download, duplicateImport, header);
      if (card) card.remove();
    });

  scope.querySelectorAll<HTMLElement>(".page-area").forEach((page) => {
    const canonicalImport = Array.from(
      page.querySelectorAll<HTMLButtonElement>(".table-toolbar button"),
    ).find((button) => buttonLabel(button) === "importar");

    if (!canonicalImport) return;

    page.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      if (button === canonicalImport || button.closest(".table-toolbar")) return;
      if (buttonLabel(button) === "importar planilha") button.remove();
    });
  });
}

export default function SecureBetaAppV101(props: Props) {
  useLayoutEffect(() => {
    let frame = 0;

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        keepSingleModuleImporter();
      });
    };

    keepSingleModuleImporter();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <SecureBetaAppV100 {...props} />;
}
