import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGET =
  process.env.DIAGNOSTIC_URL ||
  "https://beta-gestao-365.scolarisamuel.workers.dev";
const WAIT_MS = positiveNumber(process.env.DIAGNOSTIC_WAIT_MS, 35_000);
const COMMAND_TIMEOUT_MS = positiveNumber(
  process.env.DIAGNOSTIC_COMMAND_TIMEOUT_MS,
  15_000,
);
const PROBE_TIMEOUT_MS = positiveNumber(
  process.env.DIAGNOSTIC_PROBE_TIMEOUT_MS,
  10_000,
);
const MAX_EVENTS = 250;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function assertRuntime() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  const supportsStableWebSocket =
    major > 22 || (major === 22 && minor >= 4);

  if (!supportsStableWebSocket || typeof WebSocket !== "function") {
    throw new Error(
      `Node.js 22.4+ é necessário para o WebSocket global estável. Versão atual: ${process.versions.node}.`,
    );
  }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "google-chrome-stable",
    "google-chrome",
    "chromium",
    "chromium-browser",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }

  throw new Error(`Chrome/Chromium não encontrado: ${candidates.join(", ")}`);
}

async function availablePort() {
  const configured = Number(process.env.CHROME_DEBUG_PORT);
  if (Number.isInteger(configured) && configured > 0 && configured <= 65_535) {
    return configured;
  }

  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port =
        address && typeof address === "object" ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else if (!port) reject(new Error("Não foi possível reservar uma porta local."));
        else resolve(port);
      });
    });
  });
}

async function json(port, path, options, timeoutMs = 15_000) {
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

  throw lastError || new Error(`Timeout no endpoint Chrome ${path}`);
}

function clipped(value, max = 900) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function pushLimited(array, value) {
  array.push(value);
  if (array.length > MAX_EVENTS) array.shift();
}

async function terminate(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;

  processHandle.kill("SIGTERM");
  const exited = await Promise.race([
    once(processHandle, "exit").then(() => true),
    sleep(1_500).then(() => false),
  ]);
  if (exited || processHandle.exitCode !== null) return;

  processHandle.kill("SIGKILL");
  await Promise.race([
    once(processHandle, "exit"),
    sleep(1_500),
  ]);
}

assertRuntime();
new URL(TARGET);

const port = await availablePort();
const userDataDir = await mkdtemp(join(tmpdir(), "beta-chrome-"));
const targetUrl = new URL(TARGET);
targetUrl.searchParams.set("__beta_diagnostic", `${Date.now()}`);
const targetOrigin = targetUrl.origin;

const chrome = spawn(
  findChrome(),
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

let chromeSpawnError;
chrome.once("error", (error) => {
  chromeSpawnError = error;
});

let chromeStderr = "";
chrome.stderr.on("data", (chunk) => {
  chromeStderr += String(chunk);
  if (chromeStderr.length > 12_000) chromeStderr = chromeStderr.slice(-12_000);
});

let socket;
let nextId = 1;
const waiters = new Map();
const requests = new Map();
const events = { console: [], exceptions: [], failed: [], responses: [] };

function rejectWaiters(error) {
  for (const waiter of waiters.values()) {
    clearTimeout(waiter.timer);
    waiter.reject(error);
  }
  waiters.clear();
}

function command(method, params = {}, timeoutMs = COMMAND_TIMEOUT_MS) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error(`WebSocket indisponível para ${method}.`));
  }

  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(id);
      reject(new Error(`Timeout CDP: ${method}`));
    }, timeoutMs);
    waiters.set(id, { method, resolve, reject, timer });
  });
}

try {
  await json(port, "/json/version");
  if (chromeSpawnError) throw chromeSpawnError;

  const page = await json(
    port,
    `/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" },
  );
  if (!page.webSocketDebuggerUrl) {
    throw new Error("Chrome não retornou o alvo da página.");
  }

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("WebSocket da página não abriu")),
      10_000,
    );
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", (event) => {
      clearTimeout(timer);
      reject(new Error(`Falha no WebSocket da página: ${String(event.type)}`));
    });
  });

  socket.addEventListener("close", () => {
    rejectWaiters(new Error("WebSocket do Chrome foi encerrado."));
  });

  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch (error) {
      pushLimited(events.exceptions, {
        text: "Resposta CDP inválida",
        description: String(error),
      });
      return;
    }

    if (message.id) {
      const waiter = waiters.get(message.id);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      waiters.delete(message.id);
      if (message.error) {
        waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
      } else {
        waiter.resolve(message.result);
      }
      return;
    }

    const { method, params = {} } = message;
    if (method === "Runtime.consoleAPICalled") {
      pushLimited(events.console, {
        type: params.type,
        values: (params.args || []).map(
          (argument) => argument.value ?? argument.description ?? argument.type,
        ),
      });
      return;
    }

    if (method === "Runtime.exceptionThrown") {
      pushLimited(events.exceptions, {
        text: params.exceptionDetails?.text,
        description: params.exceptionDetails?.exception?.description,
        url: params.exceptionDetails?.url,
        line: params.exceptionDetails?.lineNumber,
        column: params.exceptionDetails?.columnNumber,
      });
      return;
    }

    if (method === "Network.requestWillBeSent") {
      requests.set(params.requestId, {
        url: params.request?.url,
        method: params.request?.method,
        started: params.timestamp,
        type: params.type,
      });
      return;
    }

    if (method === "Network.responseReceived") {
      const request = requests.get(params.requestId) || {};
      Object.assign(request, {
        status: params.response?.status,
        mimeType: params.response?.mimeType,
        protocol: params.response?.protocol,
        fromDiskCache: params.response?.fromDiskCache,
        responseAt: params.timestamp,
      });
      requests.set(params.requestId, request);
      return;
    }

    if (method === "Network.loadingFinished") {
      const request = requests.get(params.requestId) || {};
      pushLimited(events.responses, {
        ...request,
        durationMs: request.started
          ? Math.round((params.timestamp - request.started) * 1000)
          : null,
        encodedDataLength: params.encodedDataLength,
      });
      requests.delete(params.requestId);
      return;
    }

    if (method === "Network.loadingFailed") {
      pushLimited(events.failed, {
        ...(requests.get(params.requestId) || {}),
        errorText: params.errorText,
        canceled: params.canceled,
        blockedReason: params.blockedReason,
      });
      requests.delete(params.requestId);
    }
  });

  await command("Runtime.enable");
  await command("Network.enable", { maxTotalBufferSize: 20_000_000 });
  await command("Page.enable");
  await command("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await command("Page.navigate", { url: targetUrl.href });

  const deadline = Date.now() + WAIT_MS;
  let state;
  let stateError;

  while (Date.now() < deadline) {
    await sleep(500);
    try {
      const result = await command(
        "Runtime.evaluate",
        {
          expression: `(() => {
            const rect = (selector) => {
              const element = document.querySelector(selector);
              if (!element) return null;
              const bounds = element.getBoundingClientRect();
              return {
                width: Math.round(bounds.width),
                clientWidth: element.clientWidth,
                scrollWidth: element.scrollWidth,
              };
            };
            const rgb = (value) => (value.match(/[\\d.]+/g) || []).slice(0, 3).map(Number);
            const luminance = (value) => {
              const channels = rgb(value).map((channel) => {
                const normalized = channel / 255;
                return normalized <= 0.03928
                  ? normalized / 12.92
                  : ((normalized + 0.055) / 1.055) ** 2.4;
              });
              return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
            };
            const contrast = (foreground, background) => {
              const lighter = Math.max(luminance(foreground), luminance(background));
              const darker = Math.min(luminance(foreground), luminance(background));
              return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
            };
            const construction = rect('.construction-executive');
            const cost = rect('.cost-composition-card');
            const fleetRowElement = document.querySelector('.construction-machine-row');
            const fleetTextElement = fleetRowElement?.querySelector('.construction-machine-main strong');
            const fleetRowStyle = fleetRowElement ? getComputedStyle(fleetRowElement) : null;
            const fleetTextStyle = fleetTextElement ? getComputedStyle(fleetTextElement) : null;
            const kpiColumns = getComputedStyle(
              document.querySelector('.construction-kpi-row-v56') || document.body,
            ).gridTemplateColumns.split(/\\s+/).filter(Boolean).length;
            const footerItems = Array.from(document.querySelectorAll('.cost-chart-footer > *'))
              .map((element) => Math.round(element.getBoundingClientRect().width));
            return ({
            href: location.href,
            readyState: document.readyState,
            loading: Boolean(document.querySelector('.page-area .loading-state')),
            loadingText: document.querySelector('.page-area .loading-state')?.textContent?.trim() || '',
            dashboard: Boolean(document.querySelector('.dashboard-grid, .construction-executive, .page-stack')),
            sidebar: Boolean(document.querySelector('.sidebar')),
            pageText: document.querySelector('.page-area')?.textContent?.trim().slice(0, 500) || '',
            layout: {
              viewportWidth: innerWidth,
              documentClientWidth: document.documentElement.clientWidth,
              documentScrollWidth: document.documentElement.scrollWidth,
              horizontalOverflow: Math.max(
                0,
                document.documentElement.scrollWidth - document.documentElement.clientWidth,
              ),
              cost,
              construction,
              costToConstructionRatio: cost && construction
                ? Number((cost.width / construction.width).toFixed(2))
                : 0,
              kpiColumns,
              fleetRow: rect('.construction-machine-row'),
              fleetContrast: fleetRowStyle && fleetTextStyle
                ? contrast(fleetTextStyle.color, fleetRowStyle.backgroundColor)
                : 0,
              costFooterWidths: footerItems,
              costFooterRatio: footerItems.length === 2
                ? Number((Math.max(...footerItems) / Math.max(1, Math.min(...footerItems))).toFixed(2))
                : 0,
            },
            resources: performance.getEntriesByType('resource').map(r => ({
              name: r.name,
              duration: Math.round(r.duration),
              transferSize: r.transferSize,
              encodedBodySize: r.encodedBodySize,
              decodedBodySize: r.decodedBodySize,
              initiatorType: r.initiatorType,
            })).filter(r => r.name.includes('/api/') || r.name.includes('/assets/'))
          });
          })()`,
          returnByValue: true,
        },
        8_000,
      );
      state = result.result?.value;
      if (state && !state.loading && state.dashboard && state.sidebar) break;
    } catch (error) {
      stateError = error;
      break;
    }
  }

  async function probe(path) {
    try {
      const result = await command(
        "Runtime.evaluate",
        {
          expression: `(async () => {
            const started = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), ${PROBE_TIMEOUT_MS});
            try {
              const response = await fetch(${JSON.stringify(path)}, {
                cache: 'no-store',
                signal: controller.signal
              });
              const text = await response.text();
              return {
                ok: response.ok,
                status: response.status,
                bytes: text.length,
                ms: Math.round(performance.now() - started),
                prefix: text.slice(0, 180)
              };
            } catch (error) {
              return {
                ok: false,
                error: String(error),
                ms: Math.round(performance.now() - started)
              };
            } finally {
              clearTimeout(timeoutId);
            }
          })()`,
          awaitPromise: true,
          returnByValue: true,
        },
        PROBE_TIMEOUT_MS + 5_000,
      );
      return result.result?.value;
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  const recordsProbe = await probe("/api/records");
  const taxProbe = await probe("/api/tax-profile");

  const relevantResponses = events.responses
    .filter(
      (item) =>
        item.url?.startsWith(targetOrigin) || item.url?.includes("/api/"),
    )
    .sort((left, right) => (right.durationMs || 0) - (left.durationMs || 0));

  console.log("=== BETA LIVE BROWSER DIAGNOSTIC ===");
  console.log("TARGET", targetUrl.href);
  console.log("NODE", process.versions.node);
  console.log("STATE", JSON.stringify(state, null, 2));
  console.log("STATE_ERROR", stateError ? String(stateError) : "");
  console.log("RECORDS_PROBE", JSON.stringify(recordsProbe, null, 2));
  console.log("TAX_PROBE", JSON.stringify(taxProbe, null, 2));
  console.log("CONSOLE", JSON.stringify(events.console, null, 2));
  console.log("EXCEPTIONS", JSON.stringify(events.exceptions, null, 2));
  console.log("FAILED", JSON.stringify(events.failed, null, 2));
  console.log("PENDING", JSON.stringify(Array.from(requests.values()), null, 2));
  console.log("RESPONSES", JSON.stringify(relevantResponses, null, 2));

  if (!state) {
    throw new Error(
      `Estado da página não pôde ser lido. ${stateError ? String(stateError) : ""}`,
    );
  }
  if (String(state.href || "").startsWith("chrome-error://")) {
    throw new Error(
      `O Chrome não conseguiu abrir ${targetOrigin}. Falhas=${clipped(events.failed)}`,
    );
  }
  if (events.exceptions.length) {
    throw new Error(`Exceções JavaScript: ${clipped(events.exceptions)}`);
  }
  if (state.loading) {
    throw new Error(
      `Spinner persistiu. records=${clipped(recordsProbe)} tax=${clipped(taxProbe)}`,
    );
  }
  if (!state.dashboard || !state.sidebar) {
    throw new Error(`Painel não apareceu: ${clipped(state)}`);
  }
  if (state.layout?.horizontalOverflow > 1) {
    throw new Error(`Layout criou rolagem horizontal: ${clipped(state.layout)}`);
  }
  if (state.layout?.costToConstructionRatio < 0.9) {
    throw new Error(`Painéis executivos ficaram desalinhados: ${clipped(state.layout)}`);
  }
  if (state.layout?.kpiColumns > 2) {
    throw new Error(`KPIs não responderam à área útil: ${clipped(state.layout)}`);
  }
  if (state.layout?.fleetRow?.scrollWidth > state.layout?.fleetRow?.clientWidth + 1) {
    throw new Error(`Linha da frota foi cortada: ${clipped(state.layout)}`);
  }
  if (state.layout?.fleetContrast < 4.5) {
    throw new Error(`Contraste da frota insuficiente: ${clipped(state.layout)}`);
  }
  if (state.layout?.costFooterRatio > 1.12) {
    throw new Error(`Rodapé financeiro ficou desproporcional: ${clipped(state.layout)}`);
  }
} finally {
  rejectWaiters(new Error("Diagnóstico encerrado."));
  try {
    socket?.close();
  } catch {}
  await terminate(chrome);
  await rm(userDataDir, { recursive: true, force: true });
  if (chromeStderr) console.error("CHROME_STDERR", chromeStderr.slice(-3_000));
}
