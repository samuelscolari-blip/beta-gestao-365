import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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

async function inspectPublishedPage(chromePath, attempt) {
  const port = 9300 + attempt;
  const profile = await mkdtemp(join(tmpdir(), "beta-live-"));
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  let socket;
  const pending = new Map();
  let nextId = 1;

  try {
    await waitJson(port, "/json/version");
    const page = await waitJson(
      port,
      `/json/new?${encodeURIComponent("about:blank")}`,
      { method: "PUT" },
    );
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WebSocket do Chrome não abriu")), 10_000);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
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
    await command("Page.navigate", {
      url: `${TARGET}/?live_verify=${Date.now()}-${attempt}`,
    });
    await sleep(12_000);

    const result = await command(
      "Runtime.evaluate",
      {
        expression: `(() => ({
          readyState: document.readyState,
          loading: Boolean(document.querySelector('.page-area .loading-state')),
          loadingText: document.querySelector('.page-area .loading-state')?.textContent?.trim() || '',
          sidebar: Boolean(document.querySelector('.sidebar')),
          pageArea: Boolean(document.querySelector('.page-area')),
          pageText: document.querySelector('.page-area')?.textContent?.trim().slice(0, 600) || ''
        }))()`,
        returnByValue: true,
      },
      8_000,
    );
    return result.result?.value;
  } finally {
    try {
      socket?.close();
    } catch {}
    chrome.kill("SIGKILL");
    await rm(profile, { recursive: true, force: true });
  }
}

test("build normalizes the actual V52 observer and pending status", async () => {
  const v52 = await readFile("app/components/BetaAppV52.tsx", "utf8");
  const modules = await readFile("app/lib/modules.ts", "utf8");
  const demo = await readFile("db/demo-records.ts", "utf8");
  const records = await readFile("db/records.ts", "utf8");

  assert.match(v52, /topTitle\.textContent\s*!==\s*"Visão Executiva Geral"/);
  assert.match(v52, /new MutationObserver\(scheduleEnhancement\)/);
  assert.match(v52, /if \(disposed \|\| animationFrame !== null\) return/);
  assert.match(v52, /observer\.disconnect\(\);\s*try \{\s*enhance\(\);\s*\} finally/);
  assert.match(v52, /disposed = true/);
  assert.match(v52, /cancelAnimationFrame\(animationFrame\)/);
  assert.doesNotMatch(modules, /"Vence em 7 dias",/);
  assert.doesNotMatch(demo, /"Vence em 7 dias"/);
  assert.match(records, /const pendingStatusBackfills/);
});

test(
  "published Cloudflare page leaves the loading state in a real browser",
  {
    timeout: 240_000,
    skip:
      process.env.RUN_LIVE_BROWSER_TEST === "1"
        ? false
        : "verificação ao vivo executada somente após a publicação",
  },
  async () => {
    const chromePath = findChrome();
    assert.ok(chromePath, "Chrome/Chromium não está disponível no runner");

    const deadline = Date.now() + 210_000;
    let attempt = 0;
    let lastState;
    let lastError;

    while (Date.now() < deadline) {
      attempt += 1;
      try {
        lastState = await inspectPublishedPage(chromePath, attempt);
        if (
          lastState?.readyState === "complete" &&
          lastState?.pageArea &&
          lastState?.sidebar &&
          !lastState?.loading &&
          String(lastState?.pageText || "").length > 80
        ) {
          return;
        }
      } catch (error) {
        lastError = error;
      }
      await sleep(12_000);
    }

    assert.fail(
      `O site continuou preso. Estado=${JSON.stringify(lastState)} Erro=${String(lastError || "nenhum")}`,
    );
  },
);
