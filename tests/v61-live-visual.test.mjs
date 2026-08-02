import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const TARGET = "https://beta-gestao-365.scolarisamuel.workers.dev";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function chromePath() {
  for (const name of ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [name], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  return "";
}

async function waitJson(port, path, options = {}) {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
      if (response.ok) return response.json();
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw lastError || new Error("Chrome não respondeu");
}

async function inspect(attempt) {
  const executable = chromePath();
  assert.ok(executable, "Chrome indisponível");
  const port = 9950 + attempt;
  const profile = await mkdtemp(join(tmpdir(), "beta-v61-"));
  const chrome = spawn(executable, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--window-size=1700,1200",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });

  let socket;
  const pending = new Map();
  let id = 1;

  try {
    await waitJson(port, "/json/version");
    const page = await waitJson(
      port,
      `/json/new?${encodeURIComponent("about:blank")}`,
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
      const waiter = pending.get(message.id);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });

    const command = (method, params = {}, timeoutMs = 12_000) => {
      const currentId = id++;
      socket.send(JSON.stringify({ id: currentId, method, params }));
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(currentId);
          reject(new Error(`Timeout em ${method}`));
        }, timeoutMs);
        pending.set(currentId, { resolve, reject, timer });
      });
    };

    const evaluate = async (expression) => {
      const result = await command("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return result.result?.value;
    };

    await command("Runtime.enable");
    await command("Page.enable");
    await command("Page.navigate", {
      url: `${TARGET}/?verify_v61=${Date.now()}-${attempt}`,
    });
    await sleep(12_000);

    const clicked = await evaluate(`(() => {
      const normalize = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .toLowerCase();
      const button = [...document.querySelectorAll('.sidebar nav button')]
        .find((item) => normalize(item.textContent).includes('integracoes'));
      if (button) button.click();
      return Boolean(button);
    })()`);
    await sleep(3_000);

    return evaluate(`(() => ({
      clicked: ${JSON.stringify(Boolean(clicked))},
      loading: Boolean(document.querySelector('.page-area .loading-state')),
      text: document.querySelector('.integration-hero')?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      excelDetail: [...document.querySelectorAll('.service-card')]
        .find((item) => item.textContent.includes('Excel'))
        ?.textContent?.replace(/\\s+/g, ' ').trim() || '',
      bodyHasOldScope: document.body.textContent.includes('Importar Central Operacional'),
    }))()`);
  } finally {
    try { socket?.close(); } catch {}
    chrome.kill("SIGKILL");
    await sleep(400);
    try { await rm(profile, { recursive: true, force: true }); } catch {}
  }
}

test("V61 está publicada no site oficial", { timeout: 220_000 }, async () => {
  const deadline = Date.now() + 190_000;
  let attempt = 0;
  let state;
  let lastError;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      state = await inspect(attempt);
      const published =
        state?.clicked &&
        !state?.loading &&
        String(state?.text || "").includes("Custos, Máquinas e Funcionários") &&
        String(state?.text || "").includes("verticais, horizontais") &&
        String(state?.text || "").includes("matrizes de datas") &&
        String(state?.excelDetail || "").includes("Importador inteligente controlado") &&
        !state?.bodyHasOldScope;
      if (published) return;
    } catch (error) {
      lastError = error;
    }
    await sleep(12_000);
  }

  assert.fail(`V61 não confirmada. Estado=${JSON.stringify(state)} Erro=${String(lastError || "nenhum")}`);
});
