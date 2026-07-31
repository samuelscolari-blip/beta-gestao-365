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

function addVisibleFields(record: ApiRecord): ApiRecord {
  const payload = { ...(record.payload || {}) };
  const moduleId = String(record.module || "");
  if (moduleId === "expenses") payload.supplierDocument ||= payload.supplierCode || "";
  if (moduleId === "cards") {
    payload.cardName ||= payload.holder || "";
    payload.merchantDocument ||= payload.cardEnding || "";
  }
  if (moduleId === "food") payload.supplierDocument ||= payload.supplierCode || "";
  if (moduleId === "rentals") payload.landlordDocument ||= payload.work || "";
  return { ...record, payload };
}

function addLegacyAliases(record: ApiRecord): ApiRecord {
  const payload = { ...(record.payload || {}) };
  const moduleId = String(record.module || "");
  if (moduleId === "expenses") payload.supplierCode = payload.supplierDocument || "";
  if (moduleId === "cards") {
    payload.holder = payload.cardName || "";
    payload.cardEnding = payload.merchantDocument || "";
  }
  if (moduleId === "food") payload.supplierCode = payload.supplierDocument || "";
  if (moduleId === "rentals") payload.work = payload.landlordDocument || "";
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
        const body = (await response.clone().json()) as {
          records?: ApiRecord[];
          [key: string]: unknown;
        };
        if (!Array.isArray(body.records)) return response;
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

    const moveLayer = () => {
      const layer = document.querySelector<HTMLElement>(".v52-floating-layer");
      const pageArea = document.querySelector<HTMLElement>(".page-area");
      if (layer && pageArea && layer.parentElement !== pageArea) pageArea.prepend(layer);
    };

    moveLayer();
    const observer = new MutationObserver(moveLayer);
    observer.observe(document.body, { childList: true, subtree: true });
    const refreshTimer = window.setTimeout(() => {
      document.querySelector<HTMLButtonElement>('.topbar button[aria-label="Atualizar dados"]')?.click();
    }, 250);

    return () => {
      window.clearTimeout(refreshTimer);
      observer.disconnect();
      window.fetch = previousFetch;
    };
  }, []);

  return <BetaAppV52 {...props} />;
}
