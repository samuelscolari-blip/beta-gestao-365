import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGET =
  process.env.DIAGNOSTIC_URL ||
  "https://beta-gestao-365.scolarisamuel.workers.dev/";
const WAIT_MS = Number(process.env.DIAGNOSTIC_WAIT_MS || 45_000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  for (const candidate of [
    process.env.CHROME_PATH,
    "google-chrome-stable",
    "google-chrome",
    "chromium",
    "chromium-browser",
  ].filter(Boolean)) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("Chrome/Chromium não encontrado para o diagnóstico largo.");
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForJson(url, options) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw lastError || new Error(`Timeout ao acessar ${url}`);
}

const port = await availablePort();
const userDataDir = await mkdtemp(join(tmpdir(), "beta-fleet-wide-"));
const chrome = spawn(
  findChrome(),
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-extensions",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

let socket;
let nextId = 1;
const waiters = new Map();

function command(method, params = {}, timeoutMs = 12_000) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(id);
      reject(new Error(`Timeout CDP: ${method}`));
    }, timeoutMs);
    waiters.set(id, { resolve, reject, timer });
  });
}

try {
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const page = await waitForJson(
    `http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" },
  );

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket não abriu")), 10_000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", reject);
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = waiters.get(message.id);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    waiters.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });

  await command("Runtime.enable");
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const targetUrl = new URL(TARGET);
  targetUrl.searchParams.set("__beta_fleet_wide", String(Date.now()));
  await command("Page.navigate", { url: targetUrl.href });

  const deadline = Date.now() + WAIT_MS;
  let layout;
  while (Date.now() < deadline) {
    await sleep(600);
    const result = await command("Runtime.evaluate", {
      expression: `(() => {
        const row = document.querySelector('.construction-machine-row');
        if (!row) return null;
        const bounds = (element) => {
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          };
        };
        const parts = [
          ['main', row.querySelector('.construction-machine-main')],
          ['operation', row.querySelector('.construction-machine-operation')],
          ['stop', row.querySelector('.construction-machine-stop')],
          ['impact', row.querySelector('.construction-machine-total-impact')],
          ['priority', row.querySelector('.construction-machine-priority')],
          ['arrow', row.querySelector(':scope > svg')],
        ].map(([name, element]) => ({ name, ...bounds(element) }));
        return {
          readyState: document.readyState,
          row: bounds(row),
          table: bounds(document.querySelector('.construction-machine-table')),
          gridTemplateAreas: getComputedStyle(row).gridTemplateAreas,
          gridTemplateColumns: getComputedStyle(row).gridTemplateColumns,
          parts,
        };
      })()`,
      returnByValue: true,
    });
    layout = result.result?.value;
    if (layout?.readyState === "complete" && layout.parts?.every((part) => part.width)) {
      break;
    }
  }

  console.log("=== BETA FLEET WIDE DIAGNOSTIC ===");
  console.log(JSON.stringify(layout, null, 2));

  if (!layout?.row || !layout?.table) {
    throw new Error("A tabela real de máquinas não apareceu no desktop largo.");
  }
  if (layout.table.clientWidth <= 1040) {
    throw new Error(`O teste não atingiu a grade larga: ${JSON.stringify(layout.table)}`);
  }
  if (layout.gridTemplateAreas !== "none") {
    throw new Error(
      `Desktop largo recebeu áreas responsivas indevidas: ${layout.gridTemplateAreas}`,
    );
  }
  if (layout.row.scrollWidth > layout.row.clientWidth + 1) {
    throw new Error(`Linha larga excedeu o cartão: ${JSON.stringify(layout.row)}`);
  }

  const parts = layout.parts;
  for (const part of parts) {
    if (part.left < layout.row.left - 2 || part.right > layout.row.right + 2) {
      throw new Error(`Célula ${part.name} saiu da linha: ${JSON.stringify(part)}`);
    }
    if (part.scrollWidth > part.clientWidth + 2) {
      throw new Error(`Célula ${part.name} cortou conteúdo: ${JSON.stringify(part)}`);
    }
  }

  for (let index = 1; index < parts.length; index += 1) {
    const previous = parts[index - 1];
    const current = parts[index];
    if (current.left < previous.right - 2) {
      throw new Error(
        `Células sobrepostas: ${previous.name} e ${current.name}. ${JSON.stringify(parts)}`,
      );
    }
  }

  const tops = parts.map((part) => part.top);
  if (Math.max(...tops) - Math.min(...tops) > 24) {
    throw new Error(`Colunas da frota perderam alinhamento vertical: ${JSON.stringify(parts)}`);
  }
} finally {
  for (const waiter of waiters.values()) {
    clearTimeout(waiter.timer);
    waiter.reject(new Error("Diagnóstico encerrado."));
  }
  try {
    socket?.close();
  } catch {}
  if (chrome.exitCode === null) {
    chrome.kill("SIGTERM");
    await Promise.race([once(chrome, "exit"), sleep(1_500)]);
    if (chrome.exitCode === null) chrome.kill("SIGKILL");
  }
  await rm(userDataDir, { recursive: true, force: true });
}
