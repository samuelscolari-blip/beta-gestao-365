"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

const BetaAppV52 = dynamic(() => import("./BetaAppV52Ready"), {
  ssr: false,
  loading: () => (
    <div className="loading-state">
      <span className="loading-mark" />
      <p>Carregando a central de gestão…</p>
    </div>
  ),
});

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

type ApiRecord = {
  module?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

const MANAGEMENT_TITLE = "Documentos para decisão da gerência";
const MANAGEMENT_DESCRIPTION =
  "Compras, pagamentos, cartões e aluguéis documentados para a gerência conferir e decidir. O sistema não recomenda aprovação ou reprovação.";

function addVisibleFields(record: ApiRecord): ApiRecord {
  const payload = { ...(record.payload || {}) };
  const moduleId = String(record.module || "");
  if (moduleId === "expenses") {
    payload.supplierDocument ||= payload.supplierCode || "";
  }
  if (moduleId === "cards") {
    payload.cardName ||= payload.holder || "";
    payload.merchantDocument ||= payload.cardEnding || "";
  }
  if (moduleId === "food") {
    payload.supplierDocument ||= payload.supplierCode || "";
  }
  if (moduleId === "rentals") {
    payload.landlordDocument ||= payload.work || "";
  }
  return { ...record, payload };
}

function addLegacyAliases(record: ApiRecord): ApiRecord {
  const payload = { ...(record.payload || {}) };
  const moduleId = String(record.module || "");
  if (moduleId === "expenses") {
    payload.supplierCode = payload.supplierDocument || "";
  }
  if (moduleId === "cards") {
    payload.holder = payload.cardName || "";
    payload.cardEnding = payload.merchantDocument || "";
  }
  if (moduleId === "food") {
    payload.supplierCode = payload.supplierDocument || "";
  }
  if (moduleId === "rentals") {
    payload.work = payload.landlordDocument || "";
  }
  return { ...record, payload };
}

function urlOf(input: RequestInfo | URL) {
  return typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function isRecordsUrl(input: RequestInfo | URL) {
  return urlOf(input).includes("/api/records");
}

function securedInput(input: RequestInfo | URL): RequestInfo | URL {
  if (typeof input === "string") {
    return input.replace("/api/records", "/api/records-v52");
  }
  if (input instanceof URL) {
    return new URL(input.toString().replace("/api/records", "/api/records-v52"));
  }
  return input;
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function sidebarButton(label: string) {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(".sidebar nav button"),
  ).find((button) =>
    normalizeText(button.textContent).includes(normalizeText(label)),
  );
}

function openSupplierModule(create: boolean) {
  sidebarButton("Fornecedores")?.click();
  if (create) {
    window.setTimeout(() => {
      document
        .querySelector<HTMLButtonElement>(".module-heading .button.primary")
        ?.click();
    }, 100);
  }
}

export default function SecureBetaAppV52(props: Props) {
  useEffect(() => {
    const previousFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = String(init?.method || "GET").toUpperCase();
      let nextInit = init;

      if (
        isRecordsUrl(input) &&
        ["POST", "PUT"].includes(method) &&
        typeof init?.body === "string"
      ) {
        const body = JSON.parse(init.body) as {
          record?: ApiRecord;
          records?: ApiRecord[];
          [key: string]: unknown;
        };
        const securedBody = Array.isArray(body.records)
          ? { ...body, records: body.records.map(addLegacyAliases) }
          : body.record
            ? { ...body, record: addLegacyAliases(body.record) }
            : addLegacyAliases(body);
        nextInit = { ...init, body: JSON.stringify(securedBody) };
      }

      const protectedWrite = isRecordsUrl(input) && method !== "GET";
      const response = await previousFetch(
        protectedWrite ? securedInput(input) : input,
        nextInit,
      );

      if (!isRecordsUrl(input) || method !== "GET") return response;

      try {
        const body = (await response.json()) as {
          records?: ApiRecord[];
          [key: string]: unknown;
        };
        if (!Array.isArray(body.records)) {
          return new Response(JSON.stringify(body), {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        headers.set("content-type", "application/json; charset=utf-8");
        return new Response(
          JSON.stringify({ ...body, records: body.records.map(addVisibleFields) }),
          { status: response.status, statusText: response.statusText, headers },
        );
      } catch {
        return response;
      }
    };

    const enhanceInterface = () => {
      const layer = document.querySelector<HTMLElement>(".v52-floating-layer");
      const pageArea = document.querySelector<HTMLElement>(".page-area");
      if (layer?.hasAttribute("aria-hidden")) {
        layer.removeAttribute("aria-hidden");
      }
      if (layer && pageArea && layer.parentElement !== pageArea) {
        pageArea.prepend(layer);
      }

      const management = document.querySelector<HTMLElement>(".management-center");
      if (management) {
        const title = management.querySelector<HTMLElement>(".management-heading h2");
        const description = management.querySelector<HTMLElement>(".management-heading p");
        if (title && title.textContent !== MANAGEMENT_TITLE) {
          title.textContent = MANAGEMENT_TITLE;
        }
        if (
          description &&
          description.textContent !== MANAGEMENT_DESCRIPTION
        ) {
          description.textContent = MANAGEMENT_DESCRIPTION;
        }
      }

      const activeText = normalizeText(
        document.querySelector<HTMLButtonElement>(".sidebar nav button.active")
          ?.textContent,
      );
      const strip = document.querySelector<HTMLElement>(".v52-module-strip");
      if (
        activeText.includes("financeiro") &&
        strip &&
        !strip.querySelector(".v52-financial-links")
      ) {
        const links = document.createElement("div");
        links.className = "v52-financial-links";
        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.textContent = "Abrir fornecedores";
        openButton.onclick = () => openSupplierModule(false);
        const newButton = document.createElement("button");
        newButton.type = "button";
        newButton.textContent = "Cadastrar fornecedor";
        newButton.onclick = () => openSupplierModule(true);
        links.append(openButton, newButton);
        strip.append(links);
      }
    };

    let animationFrame: number | null = null;
    const scheduleEnhancement = () => {
      if (animationFrame !== null) return;
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        enhanceInterface();
      });
    };

    scheduleEnhancement();
    const observer = new MutationObserver(scheduleEnhancement);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      observer.disconnect();
      window.fetch = previousFetch;
    };
  }, []);

  return <BetaAppV52 {...props} />;
}
