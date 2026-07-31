"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import "./v52-module-corrections";

const BetaAppV52 = dynamic(() => import("./BetaAppV52"), {
  ssr: false,
  loading: () => (
    <div className="loading-state">
      <span className="loading-mark" />
      <p>Carregando a central de gestão…</p>
    </div>
  ),
});

type ClientOnlyBetaAppV52Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

type ApiRecord = {
  module?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};

function withV52Fields(record: ApiRecord): ApiRecord {
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

function withLegacyAliases(record: ApiRecord): ApiRecord {
  const payload = { ...(record.payload || {}) };
  const moduleId = String(record.module || "");

  if (moduleId === "expenses") {
    payload.supplierCode = payload.supplierDocument || payload.supplierCode || "";
  }
  if (moduleId === "cards") {
    payload.holder = payload.cardName || payload.holder || "";
    payload.cardEnding = payload.merchantDocument || payload.cardEnding || "";
  }
  if (moduleId === "food") {
    payload.supplierCode = payload.supplierDocument || payload.supplierCode || "";
  }
  if (moduleId === "rentals") {
    payload.work = payload.landlordDocument || payload.work || "";
  }

  return { ...record, payload };
}

function recordsPath(input: RequestInfo | URL) {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  return url.includes("/api/records");
}

export default function ClientOnlyBetaAppV52(
  props: ClientOnlyBetaAppV52Props,
) {
  useEffect(() => {
    const previousFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      let nextInit = init;
      const method = String(init?.method || "GET").toUpperCase();

      if (
        recordsPath(input) &&
        ["POST", "PUT"].includes(method) &&
        typeof init?.body === "string"
      ) {
        const body = JSON.parse(init.body) as {
          record?: ApiRecord;
          records?: ApiRecord[];
          [key: string]: unknown;
        };
        const nextBody = Array.isArray(body.records)
          ? { ...body, records: body.records.map(withLegacyAliases) }
          : body.record
            ? { ...body, record: withLegacyAliases(body.record) }
            : withLegacyAliases(body);
        nextInit = { ...init, body: JSON.stringify(nextBody) };
      }

      const response = await previousFetch(input, nextInit);
      if (!recordsPath(input) || method !== "GET") return response;

      try {
        const body = (await response.clone().json()) as {
          records?: ApiRecord[];
          [key: string]: unknown;
        };
        if (!Array.isArray(body.records)) return response;
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        headers.set("content-type", "application/json; charset=utf-8");
        return new Response(
          JSON.stringify({
            ...body,
            records: body.records.map(withV52Fields),
          }),
          {
            status: response.status,
            statusText: response.statusText,
            headers,
          },
        );
      } catch {
        return response;
      }
    };

    const moveEnhancements = () => {
      const layer = document.querySelector<HTMLElement>(".v52-floating-layer");
      const pageArea = document.querySelector<HTMLElement>(".page-area");
      if (layer && pageArea && layer.parentElement !== pageArea) {
        pageArea.prepend(layer);
      }
    };

    moveEnhancements();
    const observer = new MutationObserver(moveEnhancements);
    observer.observe(document.body, { childList: true, subtree: true });

    const refreshTimer = window.setTimeout(() => {
      document
        .querySelector<HTMLButtonElement>(
          '.topbar button[aria-label="Atualizar dados"]',
        )
        ?.click();
    }, 250);

    return () => {
      window.clearTimeout(refreshTimer);
      observer.disconnect();
      window.fetch = previousFetch;
    };
  }, []);

  return <BetaAppV52 {...props} />;
}
