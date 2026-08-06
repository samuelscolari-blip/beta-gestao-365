const CACHE_NAME = "beta-ponto-v131";
const DB_NAME = "beta-gestao-365-time-clock";
const DB_VERSION = 1;
const SHELL = ["/ponto", "/ponto.webmanifest", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("beta-ponto-") && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

function shouldCache(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  return (
    url.origin === self.location.origin ||
    url.hostname === "cdn.jsdelivr.net"
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!shouldCache(request)) return;

  const url = new URL(request.url);
  const isNavigation = request.mode === "navigate";
  const isClockShell = url.origin === self.location.origin && url.pathname.startsWith("/ponto");
  const isRuntimeAsset =
    url.hostname === "cdn.jsdelivr.net" ||
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/assets/");

  if (isNavigation || isClockShell) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("/ponto")) ||
            new Response("Beta Ponto indisponível offline.", {
              status: 503,
              headers: { "content-type": "text/plain; charset=utf-8" },
            })
          );
        }),
    );
    return;
  }

  if (isRuntimeAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      }),
    );
  }
});

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("profiles")) {
        database.createObjectStore("profiles", { keyPath: "employeeCode" });
      }
      if (!database.objectStoreNames.contains("events")) {
        const events = database.createObjectStore("events", {
          keyPath: "clientEventId",
        });
        events.createIndex("employeeCode", "employeeCode", { unique: false });
      }
      if (!database.objectStoreNames.contains("queue")) {
        const queue = database.createObjectStore("queue", { keyPath: "id" });
        queue.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readAll(storeName) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result || []);
    };
    request.onerror = () => {
      const error = request.error;
      database.close();
      reject(error);
    };
  });
}

async function read(storeName, key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => {
      database.close();
      resolve(request.result);
    };
    request.onerror = () => {
      const error = request.error;
      database.close();
      reject(error);
    };
  });
}

async function write(storeName, value) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      const error = transaction.error;
      database.close();
      reject(error);
    };
  });
}

async function remove(storeName, key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      const error = transaction.error;
      database.close();
      reject(error);
    };
  });
}

async function synchronize() {
  const items = (await readAll("queue")).sort((left, right) =>
    String(left.createdAt).localeCompare(String(right.createdAt)),
  );

  for (const item of items) {
    let response;
    try {
      response = await fetch(item.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(item.payload),
        cache: "no-store",
      });
    } catch {
      throw new Error("Ainda sem conexão.");
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) {
      if (response.status >= 400 && response.status < 500) {
        await remove("queue", item.id);
        if (item.kind === "punch") {
          const event = await read("events", item.id);
          if (event) await write("events", { ...event, syncStatus: "rejected" });
        } else {
          const code = String(item.payload.employeeCode || "");
          const profile = await read("profiles", code);
          if (profile) await write("profiles", { ...profile, syncStatus: "rejected" });
        }
        continue;
      }
      throw new Error("Servidor temporariamente indisponível.");
    }

    await remove("queue", item.id);
    if (item.kind === "punch") {
      const event = await read("events", item.id);
      if (event) {
        await write("events", {
          ...event,
          receivedAt: body.event?.receivedAt || new Date().toISOString(),
          syncStatus: "synced",
        });
      }
    } else {
      const code = String(item.payload.employeeCode || "");
      const profile = await read("profiles", code);
      if (profile) await write("profiles", { ...profile, syncStatus: "synced" });
    }
  }

  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  clients.forEach((client) => client.postMessage({ type: "BETA_CLOCK_SYNCED" }));
}

self.addEventListener("sync", (event) => {
  if (event.tag === "beta-time-clock-sync") {
    event.waitUntil(synchronize());
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "BETA_CLOCK_SYNC_NOW") {
    event.waitUntil(synchronize());
  }
});
