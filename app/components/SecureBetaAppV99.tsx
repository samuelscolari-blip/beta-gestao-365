"use client";

import { useLayoutEffect } from "react";
import SecureBetaAppV97 from "./SecureBetaAppV97";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

type FleetSnapshot = {
  name: string;
  impact: string;
  downtime: string;
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const headerText = (cell: Element) => normalize(cell.textContent || "");

function fleetSnapshotMap(scope: ParentNode) {
  const map = new Map<string, FleetSnapshot>();

  scope
    .querySelectorAll<HTMLElement>(".machine-fleet-list > button")
    .forEach((row) => {
      const name =
        row.querySelector<HTMLElement>(".machine-row-main strong")?.textContent?.trim() ||
        "";
      if (!name) return;

      map.set(normalize(name), {
        name,
        impact:
          row
            .querySelector<HTMLElement>(".machine-row-finance strong")
            ?.textContent?.trim() || "R$ 0,00",
        downtime:
          row.querySelector<HTMLElement>(".machine-row-main small")?.textContent?.trim() ||
          "Sem parada ou perda registrada",
      });
    });

  return map;
}

function findSnapshot(
  snapshots: Map<string, FleetSnapshot>,
  machineName: string,
) {
  const normalizedName = normalize(machineName);
  const direct = snapshots.get(normalizedName);
  if (direct) return direct;

  return Array.from(snapshots.entries()).find(
    ([key]) => key.includes(normalizedName) || normalizedName.includes(key),
  )?.[1];
}

function findMachineTable(scope: ParentNode) {
  return Array.from(scope.querySelectorAll<HTMLTableElement>("table")).find(
    (table) => {
      const labels = Array.from(table.querySelectorAll("thead th")).map(headerText);
      return (
        labels.some((label) => label.includes("nome e modelo")) &&
        labels.some((label) => label === "status") &&
        labels.some((label) => label.includes("situacao do pagamento"))
      );
    },
  );
}

function ensureHeader(
  row: HTMLTableRowElement,
  marker: string,
  label: string,
) {
  let cell = row.querySelector<HTMLTableCellElement>(`th[data-v99="${marker}"]`);
  if (!cell) {
    cell = document.createElement("th");
    cell.dataset.v99 = marker;
    const actions = Array.from(row.cells).find(
      (candidate) => headerText(candidate) === "acoes",
    );
    row.insertBefore(cell, actions || null);
  }
  cell.textContent = label;
  return cell;
}

function ensureDataCell(
  row: HTMLTableRowElement,
  marker: string,
) {
  let cell = row.querySelector<HTMLTableCellElement>(`td[data-v99="${marker}"]`);
  if (!cell) {
    cell = document.createElement("td");
    cell.dataset.v99 = marker;
    const actions = row.lastElementChild;
    row.insertBefore(cell, actions);
  }
  return cell;
}

function renderMetricCell(
  cell: HTMLTableCellElement,
  primary: string,
  secondary: string,
) {
  const current = `${primary}||${secondary}`;
  if (cell.dataset.value === current) return;

  cell.dataset.value = current;
  cell.replaceChildren();

  const strong = document.createElement("strong");
  strong.textContent = primary;
  const small = document.createElement("small");
  small.textContent = secondary;
  cell.append(strong, small);
}

function syncUnifiedMachinesScreen() {
  const financialKpis = document.querySelector<HTMLElement>(
    ".machine-financial-kpis",
  );

  document
    .querySelectorAll<HTMLElement>(".machines-unified-active")
    .forEach((element) => {
      if (!financialKpis || !element.contains(financialKpis)) {
        element.classList.remove("machines-unified-active");
      }
    });

  if (!financialKpis) return;

  const scope = financialKpis.closest<HTMLElement>(".page-area") || document.body;
  scope.classList.add("machines-unified-active");

  const table = findMachineTable(scope);
  if (!table) return;

  table.classList.add("machines-unified-table");
  const headerRow = table.tHead?.rows[0];
  const body = table.tBodies[0];
  if (!headerRow || !body) return;

  const originalHeaders = Array.from(headerRow.cells).filter(
    (cell) => !cell.hasAttribute("data-v99"),
  );
  const labels = originalHeaders.map(headerText);
  const daysIndex = labels.findIndex((label) => label.includes("dias ficou parado"));
  const costIndex = labels.findIndex(
    (label) =>
      label.includes("valor total da locacao") ||
      label.includes("custo do periodo"),
  );

  ensureHeader(headerRow, "impact", "IMPACTO NO PERÍODO");
  ensureHeader(headerRow, "downtime", "PARADA / PERDA");

  const snapshots = fleetSnapshotMap(scope);

  Array.from(body.rows).forEach((row) => {
    if (!row.cells.length) return;

    const machineName = row.cells[0]?.textContent?.trim() || "";
    if (!machineName) return;

    const snapshot = findSnapshot(snapshots, machineName);
    const cost = costIndex >= 0 ? row.cells[costIndex]?.textContent?.trim() || "" : "";
    const days = daysIndex >= 0 ? row.cells[daysIndex]?.textContent?.trim() || "0" : "0";

    const impactCell = ensureDataCell(row, "impact");
    impactCell.className = "machine-unified-impact";
    renderMetricCell(
      impactCell,
      snapshot?.impact || cost || "R$ 0,00",
      snapshot ? "Locação, manutenção e ociosidade" : "Sem ocorrência adicional vinculada",
    );

    const downtimeCell = ensureDataCell(row, "downtime");
    downtimeCell.className = "machine-unified-downtime";

    if (snapshot) {
      const [primary, ...detail] = snapshot.downtime.split("•");
      renderMetricCell(
        downtimeCell,
        primary.trim() || `${days} dia(s) parado(s)`,
        detail.join("•").trim() || "Sem perda adicional registrada",
      );
    } else {
      const numericDays = Number(days.replace(/[^0-9,.-]/g, "").replace(",", "."));
      renderMetricCell(
        downtimeCell,
        `${Number.isFinite(numericDays) ? numericDays : 0} dia(s) parado(s)`,
        "Sem perda calculada na competência",
      );
    }
  });

  const tableCard = table.closest<HTMLElement>(".table-card");
  const toolbar = tableCard?.querySelector<HTMLElement>(".table-toolbar");
  if (toolbar && !toolbar.querySelector(".machine-unified-note")) {
    const note = document.createElement("span");
    note.className = "machine-unified-note";
    note.textContent = "Visão unificada: operação, custo e impacto na mesma tabela";
    toolbar.append(note);
  }
}

export default function SecureBetaAppV99(props: Props) {
  useLayoutEffect(() => {
    let frame = 0;

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncUnifiedMachinesScreen();
      });
    };

    syncUnifiedMachinesScreen();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return <SecureBetaAppV97 {...props} />;
}
