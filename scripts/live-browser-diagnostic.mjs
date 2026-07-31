import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGET =
  process.env.DIAGNOSTIC_URL ||
  "https://beta-gestao-365.scolarisamuel.workers.dev";
const PORT = Number(process.env.CHROME_DEBUG_PORT || 9222);
const WAIT_MS = Number(process.env.DIAGNOSTIC_WAIT_MS || 35_000);

function executable() {
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
  throw new Error(`Chrome/Chromium não encontrado. Tentativas: ${candidates.join(", ")}`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForJson(path, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}${path}`);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw lastError || new Error(`Timeout ao acessar ${path}`);
}

const userDataDir = await mkdtemp(join(tmpdir(), "beta-chrome-"));
const chromePath = executable();
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-sync",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let chromeStderr = "";
chrome.stderr.on("data", (chunk) => {
  chromeStderr += String(chunk);
  if (chromeStderr.length > 20_000) chromeStderr = chromeStderr.slice(-20_000);
});

const events = {
  console: [],
  exceptions: [],
  failed: [],
  responses: [],
};
const requests = new Map();
let socket;
let nextId = 1;
const pending = new Map();

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout CDP: ${method}`));
    }, 20_000);
    pending.set(id, { resolve, reject, timer, method });
  });
}

function short(value, max = 700) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

try {
  const version = await waitForJson("/json/version");
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket CDP não abriu")), 10_000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", reject);
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${waiter.method}: ${message.error.message}`));
      else waiter.resolve(message.result);
      return;
    }

    const { method, params = {} } = message;
    if (method === "Runtime.consoleAPICalled") {
      events.console.push({
        type: params.type,
        values: (params.args || []).map((arg) => arg.value ?? arg.description ?? arg.type),
      });
    } else if (method === "Runtime.exceptionThrown") {
      events.exceptions.push({
        text: params.exceptionDetails?.text,
        description: params.exceptionDetails?.exception?.description,
        url: params.exceptionDetails?.url,
        line: params.exceptionDetails?.lineNumber,
        column: params.exceptionDetails?.columnNumber,
      });
    } else if (method === "Network.requestWillBeSent") {
      requests.set(params.requestId, {
        url: params.request?.url,
        method: params.request?.method,
        started: params.timestamp,
        type: params.type,
      });
    } else if (method === "Network.responseReceived") {
      const request = requests.get(params.requestId) || {};
      Object.assign(request, {
        status: params.response?.status,
        mimeType: params.response?.mimeType,
        protocol: params.response?.protocol,
        fromDiskCache: params.response?.fromDiskCache,
        fromServiceWorker: params.response?.fromServiceWorker,
        responseAt: params.timestamp,
      });
      requests.set(params.requestId, request);
    } else if (method === "Network.loadingFinished") {
      const request = requests.get(params.requestId) || {};
      const durationMs = request.started
        ? Math.round((params.timestamp - request.started) * 1000)
        : null;
      const item = {
        ...request,
        durationMs,
        encodedDataLength: params.encodedDataLength,
      };
      events.responses.push(item);
      requests.delete(params.requestId);
    } else if (method === "Network.loadingFailed") {
      const request = requests.get(params.requestId) || {};
      events.failed.push({
        ...request,
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
  await command("Log.enable");
  await command("Page.navigate", { url: TARGET });

  const deadline = Date.now() + WAIT_MS;
  let state = null;
  while (Date.now() < deadline) {
    await sleep(500);
    const result = await command("Runtime.evaluate", {
      expression: `(() => ({
        href: location.href,
        readyState: document.readyState,
        loading: Boolean(document.querySelector('.page-area .loading-state')),
        loadingText: document.querySelector('.page-area .loading-state')?.textContent?.trim() || '',
        dashboard: Boolean(document.querySelector('.dashboard-grid, .construction-executive, .page-stack')),
        pageText: document.querySelector('.page-area')?.textContent?.trim().slice(0, 500) || '',
        scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean),
        resources: performance.getEntriesByType('resource').map(r => ({
          name: r.name,
          duration: Math.round(r.duration),
          transferSize: r.transferSize,
          encodedBodySize: r.encodedBodySize,
          decodedBodySize: r.decodedBodySize,
          initiatorType: r.initiatorType,
        })).filter(r => r.name.includes('/api/') || r.name.includes('/assets/'))
      }))()`,
      returnByValue: true,
    });
    state = result.result?.value || null;
    if (state && !state.loading && state.dashboard) break;
  }

  const apiProbe = await command("Runtime.evaluate", {
    expression: `(async () => {
      const started = performance.now();
      try {
        const response = await fetch('/api/records', { cache: 'no-store' });
        const text = await response.text();
        return { ok: response.ok, status: response.status, bytes: text.length, ms: Math.round(performance.now() - started), prefix: text.slice(0, 160) };
      } catch (error) {
        return { ok: false, error: String(error), ms: Math.round(performance.now() - started) };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const taxProbe = await command("Runtime.evaluate", {
    expression: `(async () => {
      const started = performance.now();
      try {
        const response = await fetch('/api/tax-profile', { cache: 'no-store' });
        const text = await response.text();
        return { ok: response.ok, status: response.status, bytes: text.length, ms: Math.round(performance.now() - started), prefix: text.slice(0, 160) };
      } catch (error) {
        return { ok: false, error: String(error), ms: Math.round(performance.now() - started) };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  const pendingRequests = Array.from(requests.values()).map((request) => ({
    ...request,
    pendingMs: request.started
      ? Math.round((performance.now() / 1000 - request.started) * 1000)
      : null,
  }));

  const relevantResponses = events.responses
    .filter((item) => item.url?.includes(TARGET) || item.url?.includes("/api/"))
    .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));

  console.log("=== BETA LIVE BROWSER DIAGNOSTIC ===");
  console.log("TARGET", TARGET);
  console.log("STATE", JSON.stringify(state, null, 2));
  console.log("API_RECORDS_PROBE", JSON.stringify(apiProbe.result?.value, null, 2));
  console.log("API_TAX_PROFILE_PROBE", JSON.stringify(taxProbe.result?.value, null, 2));
  console.log("CONSOLE", JSON.stringify(events.console, null, 2));
  console.log("EXCEPTIONS", JSON.stringify(events.exceptions, null, 2));
  console.log("FAILED_REQUESTS", JSON.stringify(events.failed, null, 2));
  console.log("PENDING_REQUESTS", JSON.stringify(pendingRequests, null, 2));
  console.log("RELEVANT_RESPONSES", JSON.stringify(relevantResponses, null, 2));

  if (!state) throw new Error("Não foi possível ler o estado da página.");
  if (events.exceptions.length) {
    throw new Error(`Exceções JavaScript detectadas: ${short(events.exceptions)}`);
  }
  if (state.loading) {
    throw new Error(
      `A central permaneceu em carregamento. Probe records=${short(apiProbe.result?.value)}, tax=${short(taxProbe.result?.value)}`,
    );
  }
  if (!state.dashboard) {
    throw new Error(`O painel principal não apareceu. Estado: ${short(state)}`);
  }
} finally {
  try {
    socket?.close();
  } catch {}
  chrome.kill("SIGKILL");
  await rm(userDataDir, { recursive: true, force: true });
  if (chromeStderr) console.error("CHROME_STDERR", chromeStderr.slice(-4000));
}
