"use client";

import { useLayoutEffect } from "react";
import SecureBetaAppV101 from "./SecureBetaAppV101";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

const BUTTON_MARKER = "beta-point-sync-button";

function peopleToolbar() {
  const tabs = document.querySelector<HTMLElement>(".people-status-tabs");
  if (!tabs) return null;
  const page = tabs.closest<HTMLElement>(".page-stack") || tabs.parentElement;
  return page?.querySelector<HTMLElement>(".table-toolbar") || null;
}

function installPointSyncButton(isAdmin: boolean) {
  if (!isAdmin) return;
  const toolbar = peopleToolbar();
  if (!toolbar || toolbar.querySelector(`[data-ui="${BUTTON_MARKER}"]`)) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button secondary compact-button";
  button.dataset.ui = BUTTON_MARKER;
  button.textContent = "Sincronizar com Ponto";
  button.title =
    "Envia ao Beta Ponto apenas matrícula, nome, função, status, obra, jornada e perfil. Documentos pessoais não são enviados.";

  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const original = button.textContent || "Sincronizar com Ponto";
    button.disabled = true;
    button.textContent = "Sincronizando…";
    try {
      const response = await fetch("/api/integrations/ponto/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const result = (await response.json()) as {
        ok?: boolean;
        total?: number;
        created?: number;
        updated?: number;
        semAcesso?: string[];
        message?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Não foi possível sincronizar com o Beta Ponto.");
      }
      button.textContent = `Ponto sincronizado (${result.total || 0})`;
      window.alert(
        `${result.message || "Sincronização concluída."}\n\n` +
          `Novos: ${result.created || 0}\n` +
          `Atualizados: ${result.updated || 0}\n` +
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
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        installPointSyncButton(props.isAdmin);
      });
    };

    installPointSyncButton(props.isAdmin);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [props.isAdmin]);

  return <SecureBetaAppV101 {...props} />;
}
