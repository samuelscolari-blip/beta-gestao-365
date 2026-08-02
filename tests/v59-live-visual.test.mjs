import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const TARGET = "https://beta-gestao-365.scolarisamuel.workers.dev";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  for (const name of ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [name], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  return "";
}

async function waitJson(port, path, options = {}, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw lastError || new Error(`Chrome não respondeu em ${path}`);
}

async function inspect(attempt) {
  const chromePath = findChrome();
  assert.ok(chromePath, "Chrome/Chromium não está disponível no runner");
  const port = 9800 + attempt;
  const profile = await mkdtemp(join(tmpdir(), "beta-v59-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--window-size=1700,1200",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });

  let socket;
  const pending = new Map();
  let nextId = 1;

  try {
    await waitJson(port, "/json/version");
    const page = await waitJson(port, `/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WebSocket do Chrome não abriu")), 10_000);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); });
      socket.addEventListener("error", reject);
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const waiter = pending.get(message.id);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });

    const command = (method, params = {}, timeoutMs = 12_000) => {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timeout CDP em ${method}`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
      });
    };

    await command("Runtime.enable");
    await command("Page.enable");
    await command("Page.navigate", { url: `${TARGET}/?verify_v59=${Date.now()}-${attempt}` });
    await sleep(12_000);

    await command("Runtime.evaluate", {
      expression: `(() => {
        const wanted = 'execucao da obra';
        const normalize = (value) => String(value || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
        const button = [...document.querySelectorAll('.sidebar nav button')].find((item) => normalize(item.textContent).includes(wanted));
        if (button) button.click();
        return Boolean(button);
      })()`,
      returnByValue: true,
    });
    await sleep(4_000);

    const result = await command("Runtime.evaluate", {
      expression: `(() => {
        const pick = (selector) => document.querySelector(selector);
        const style = (selector) => {
          const element = pick(selector);
          return element ? getComputedStyle(element) : null;
        };
        const kpis = [...document.querySelectorAll('.construction-kpi-row-v56 > article')];
        return {
          loading: Boolean(pick('.page-area .loading-state')),
          dashboard: Boolean(pick('.construction-dashboard-v56')),
          roadmap: Boolean(pick('.construction-stage-roadmap')),
          workforce: Boolean(pick('.construction-workforce-card')),
          loss: Boolean(pick('.construction-loss-card')),
          fleet: Boolean(pick('.construction-fleet-v2')),
          kpiCount: kpis.length,
          dashboardBackground: style('.construction-dashboard-v56')?.backgroundImage || '',
          roadmapBackground: style('.construction-stage-roadmap')?.backgroundImage || '',
          workforceBackground: style('.construction-workforce-card')?.backgroundImage || '',
          lossBackground: style('.construction-loss-card')?.backgroundImage || '',
          fleetBackground: style('.construction-fleet-v2')?.backgroundImage || '',
          dashboardTitleSize: Number.parseFloat(style('.construction-dashboard-heading-v56 h3')?.fontSize || '0'),
          roadmapTitleSize: Number.parseFloat(style('.construction-stage-roadmap h3')?.fontSize || '0'),
          stageTitleSize: Number.parseFloat(style('.construction-stage-card-v56 h3')?.fontSize || '0'),
          budgetValueSize: Number.parseFloat(style('.construction-budget-card-v56 h3')?.fontSize || '0'),
          kpiValueColors: kpis.map((item) => getComputedStyle(item.querySelector(':scope > strong')).color),
          kpiOverflowWrap: kpis.map((item) => getComputedStyle(item.querySelector(':scope > strong')).overflowWrap),
          bodyText: pick('.construction-executive-v2')?.textContent?.replace(/\\s+/g, ' ').trim().slice(0, 500) || '',
        };
      })()`,
      returnByValue: true,
    });
    return result.result?.value;
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGKILL");
    await sleep(500);
    try { await rm(profile, { recursive: true, force: true }); } catch {}
  }
}

test("V59 está publicada e consistente no site oficial", { timeout: 240_000 }, async () => {
  const deadline = Date.now() + 210_000;
  let attempt = 0;
  let state;
  let lastError;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      state = await inspect(attempt);
      const gradients = [
        state?.dashboardBackground,
        state?.roadmapBackground,
        state?.workforceBackground,
        state?.lossBackground,
        state?.fleetBackground,
      ];
      const published =
        !state?.loading &&
        state?.dashboard &&
        state?.roadmap &&
        state?.workforce &&
        state?.loss &&
        state?.fleet &&
        state?.kpiCount === 4 &&
        gradients.every((value) => String(value).includes("gradient")) &&
        state?.dashboardTitleSize >= 23 &&
        state?.roadmapTitleSize >= 23 &&
        state?.stageTitleSize >= 28 &&
        state?.budgetValueSize >= 29 &&
        state?.kpiValueColors.every((value) => value === "rgb(255, 255, 255)") &&
        state?.kpiOverflowWrap.every((value) => value === "anywhere") &&
        String(state?.bodyText || "").includes("PAINEL EXECUTIVO DA OBRA");
      if (published) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(12_000);
  }

  assert.fail(`A V59 não foi confirmada no site oficial. Estado=${JSON.stringify(state)} Erro=${String(lastError || "nenhum")}`);
});
