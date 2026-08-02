import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TARGET = process.env.DIAGNOSTIC_URL;
if (!TARGET) throw new Error("DIAGNOSTIC_URL é obrigatório.");

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
  throw new Error("Chrome/Chromium não encontrado.");
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && typeof address === "object" ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
    server.once("error", reject);
  });
}

async function getJson(port, path, options, timeoutMs = 20_000) {
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
    await sleep(250);
  }
  throw lastError || new Error(`Timeout em ${path}`);
}

async function stop(processHandle) {
  if (!processHandle || processHandle.exitCode !== null) return;
  processHandle.kill("SIGTERM");
  const exited = await Promise.race([
    once(processHandle, "exit").then(() => true),
    sleep(1500).then(() => false),
  ]);
  if (!exited && processHandle.exitCode === null) processHandle.kill("SIGKILL");
}

const port = await availablePort();
const profile = await mkdtemp(join(tmpdir(), "beta-v74-audit-"));
const chrome = spawn(
  findChrome(),
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);

let stderr = "";
chrome.stderr.on("data", (chunk) => {
  stderr += String(chunk);
  if (stderr.length > 8000) stderr = stderr.slice(-8000);
});

let socket;
const waiters = new Map();
let nextId = 1;

function command(method, params = {}, timeoutMs = 15_000) {
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
  await getJson(port, "/json/version");
  const page = await getJson(
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
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const target = new URL(TARGET);
  target.searchParams.set("__v74_audit", String(Date.now()));
  await command("Page.navigate", { url: target.href });

  let report;
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await sleep(750);
    const result = await command(
      "Runtime.evaluate",
      {
        expression: `(() => {
          const executive = document.querySelector('.construction-executive-v2');
          const dashboard = document.querySelector('.construction-dashboard-v56');
          const loading = document.querySelector('.page-area .loading-state');
          if (!executive || !dashboard || loading) return null;

          const rect = (element) => {
            if (!element) return null;
            const box = element.getBoundingClientRect();
            return {
              x: Math.round(box.x),
              y: Math.round(box.y),
              width: Math.round(box.width),
              height: Math.round(box.height),
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
            const light = Math.max(luminance(foreground), luminance(background));
            const dark = Math.min(luminance(foreground), luminance(background));
            return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
          };
          const style = (element) => element ? getComputedStyle(element) : null;
          const executiveStyle = style(executive);
          const kpiValues = Array.from(document.querySelectorAll('.construction-kpi-v56 > strong'));
          const costValue = kpiValues[3] || null;
          const costStyle = style(costValue);
          const stageTrack = document.querySelector('.construction-stage-track');
          const stageStyle = style(stageTrack);
          const emptyFleet = document.querySelector('.construction-machine-empty');
          const emptyStrong = emptyFleet?.querySelector('strong, h3, h4');
          const emptyParagraph = emptyFleet?.querySelector('p');
          const emptyBackground = emptyFleet ? style(emptyFleet).backgroundColor : null;
          const emptyStrongColor = emptyStrong ? style(emptyStrong).color : null;
          const emptyParagraphColor = emptyParagraph ? style(emptyParagraph).color : null;
          return {
            href: location.href,
            title: document.title,
            readyState: document.readyState,
            horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
            executive: {
              rect: rect(executive),
              backgroundColor: executiveStyle.backgroundColor,
              backgroundImage: executiveStyle.backgroundImage,
              display: executiveStyle.display,
              gap: executiveStyle.gap,
            },
            dashboard: rect(dashboard),
            kpiColumns: style(document.querySelector('.construction-kpi-row-v56')).gridTemplateColumns.split(/\\s+/).filter(Boolean).length,
            kpiValues: kpiValues.map((element) => ({
              text: element.textContent.trim(),
              rect: rect(element),
              whiteSpace: style(element).whiteSpace,
              fontSize: style(element).fontSize,
              visible: element.getClientRects().length > 0,
            })),
            costValue: costValue ? {
              text: costValue.textContent.trim(),
              rect: rect(costValue),
              whiteSpace: costStyle.whiteSpace,
              overflowWrap: costStyle.overflowWrap,
              wordBreak: costStyle.wordBreak,
            } : null,
            timeline: stageTrack ? {
              rect: rect(stageTrack),
              columns: stageStyle.gridTemplateColumns.split(/\\s+/).filter(Boolean).length,
              display: stageStyle.display,
              itemCount: stageTrack.children.length,
            } : null,
            emptyFleet: emptyFleet ? {
              rect: rect(emptyFleet),
              background: emptyBackground,
              strongColor: emptyStrongColor,
              paragraphColor: emptyParagraphColor,
              strongContrast: contrast(emptyStrongColor, emptyBackground),
              paragraphContrast: contrast(emptyParagraphColor, emptyBackground),
            } : null,
            stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => ({
              href: link.href,
              loaded: Boolean(link.sheet),
            })),
          };
        })()`,
        returnByValue: true,
      },
      10_000,
    );
    report = result.result?.value;
    if (report) break;
  }

  if (!report) throw new Error("Painel executivo não apareceu dentro do prazo.");

  const apiResult = await command(
    "Runtime.evaluate",
    {
      expression: `(async () => {
        const paths = ['/api/records', '/api/tax-profile'];
        const entries = [];
        for (const path of paths) {
          const started = performance.now();
          try {
            const response = await fetch(path, { cache: 'no-store' });
            const text = await response.text();
            entries.push({ path, ok: response.ok, status: response.status, bytes: text.length, ms: Math.round(performance.now() - started) });
          } catch (error) {
            entries.push({ path, ok: false, error: String(error), ms: Math.round(performance.now() - started) });
          }
        }
        return entries;
      })()`,
      awaitPromise: true,
      returnByValue: true,
    },
    20_000,
  );
  report.apis = apiResult.result?.value || [];

  const screenshot = await command("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    fromSurface: true,
  });
  await writeFile("audit-v74.png", Buffer.from(screenshot.data, "base64"));
  await writeFile("audit-v74.json", JSON.stringify(report, null, 2));

  const failures = [];
  if (report.horizontalOverflow > 1) failures.push(`rolagem horizontal: ${report.horizontalOverflow}px`);
  if (!report.executive.backgroundImage || report.executive.backgroundImage === "none") failures.push("painel externo sem gradiente escuro");
  if (report.executive.rect.scrollWidth > report.executive.rect.clientWidth + 1) failures.push("painel externo cortado");
  if (!report.costValue) failures.push("valor de custo projetado ausente");
  else {
    if (report.costValue.whiteSpace !== "nowrap") failures.push(`custo com white-space ${report.costValue.whiteSpace}`);
    if (report.costValue.rect.scrollWidth > report.costValue.rect.clientWidth + 1) failures.push("custo projetado cortado");
  }
  if (report.timeline) {
    if (report.timeline.rect.scrollWidth > report.timeline.rect.clientWidth + 1) failures.push("timeline cortada");
    if (report.timeline.display !== "grid") failures.push(`timeline usando ${report.timeline.display}`);
  }
  if (report.emptyFleet) {
    if (report.emptyFleet.strongContrast < 4.5) failures.push(`contraste do título da frota: ${report.emptyFleet.strongContrast}`);
    if (report.emptyFleet.paragraphContrast < 4.5) failures.push(`contraste da descrição da frota: ${report.emptyFleet.paragraphContrast}`);
  }
  for (const api of report.apis) {
    if (!api.ok) failures.push(`${api.path} retornou ${api.status || api.error}`);
  }

  console.log(JSON.stringify(report, null, 2));
  if (failures.length) throw new Error(`Auditoria V74 falhou: ${failures.join("; ")}`);
} finally {
  try { socket?.close(); } catch {}
  await stop(chrome);
  await rm(profile, { recursive: true, force: true });
  if (stderr) console.error(stderr.slice(-3000));
}
