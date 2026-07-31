import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGET = process.env.DIAGNOSTIC_URL || "https://beta-gestao-365.scolarisamuel.workers.dev";
const PORT = Number(process.env.CHROME_DEBUG_PORT || 9222);
const WAIT_MS = Number(process.env.DIAGNOSTIC_WAIT_MS || 35_000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function json(path, options, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}${path}`, options);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw lastError || new Error(`Timeout no endpoint Chrome ${path}`);
}

const userDataDir = await mkdtemp(join(tmpdir(), "beta-chrome-"));
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
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

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

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiters.delete(id);
      reject(new Error(`Timeout CDP: ${method}`));
    }, 25_000);
    waiters.set(id, { method, resolve, reject, timer });
  });
}

function clipped(value, max = 900) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

try {
  await json("/json/version");
  const page = await json(`/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  if (!page.webSocketDebuggerUrl) throw new Error("Chrome não retornou o alvo da página.");

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("WebSocket da página não abriu")), 10_000);
    socket.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", reject);
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const waiter = waiters.get(message.id);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      waiters.delete(message.id);
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
      return;
    }
    if (method === "Runtime.exceptionThrown") {
      events.exceptions.push({
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
      events.responses.push({
        ...request,
        durationMs: request.started ? Math.round((params.timestamp - request.started) * 1000) : null,
        encodedDataLength: params.encodedDataLength,
      });
      requests.delete(params.requestId);
      return;
    }
    if (method === "Network.loadingFailed") {
      events.failed.push({
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
  await command("Page.navigate", { url: TARGET });

  const deadline = Date.now() + WAIT_MS;
  let state;
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
    state = result.result?.value;
    if (state && !state.loading && state.dashboard) break;
  }

  async function probe(path) {
    const result = await command("Runtime.evaluate", {
      expression: `(async () => {
        const started = performance.now();
        try {
          const response = await fetch(${JSON.stringify(path)}, { cache: 'no-store' });
          const text = await response.text();
          return { ok: response.ok, status: response.status, bytes: text.length, ms: Math.round(performance.now() - started), prefix: text.slice(0, 180) };
        } catch (error) {
          return { ok: false, error: String(error), ms: Math.round(performance.now() - started) };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    return result.result?.value;
  }

  const recordsProbe = await probe("/api/records");
  const taxProbe = await probe("/api/tax-profile");
  const relevantResponses = events.responses
    .filter((item) => item.url?.includes("scolarisamuel.workers.dev") || item.url?.includes("/api/"))
    .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));

  console.log("=== BETA LIVE BROWSER DIAGNOSTIC ===");
  console.log("STATE", JSON.stringify(state, null, 2));
  console.log("RECORDS_PROBE", JSON.stringify(recordsProbe, null, 2));
  console.log("TAX_PROBE", JSON.stringify(taxProbe, null, 2));
  console.log("CONSOLE", JSON.stringify(events.console, null, 2));
  console.log("EXCEPTIONS", JSON.stringify(events.exceptions, null, 2));
  console.log("FAILED", JSON.stringify(events.failed, null, 2));
  console.log("PENDING", JSON.stringify(Array.from(requests.values()), null, 2));
  console.log("RESPONSES", JSON.stringify(relevantResponses, null, 2));

  if (!state) throw new Error("Estado da página não pôde ser lido.");
  if (events.exceptions.length) throw new Error(`Exceções JavaScript: ${clipped(events.exceptions)}`);
  if (state.loading) {
    throw new Error(`Spinner persistiu. records=${clipped(recordsProbe)} tax=${clipped(taxProbe)}`);
  }
  if (!state.dashboard) throw new Error(`Painel não apareceu: ${clipped(state)}`);
} finally {
  try { socket?.close(); } catch {}
  chrome.kill("SIGKILL");
  await rm(userDataDir, { recursive: true, force: true });
  if (chromeStderr) console.error("CHROME_STDERR", chromeStderr.slice(-3000));
}
