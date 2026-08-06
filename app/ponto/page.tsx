"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const DB_NAME = "beta-gestao-365-time-clock";
const DB_VERSION = 1;
const ACTOR_CACHE_KEY = "beta-clock-actor-v132";
const EMPLOYEES_CACHE_KEY = "beta-clock-employees-v132";
const SELECTED_CACHE_KEY = "beta-clock-selected-v132";
const OFFLINE_MESSAGE =
  "Sem conexão. O registro foi salvo neste celular e será sincronizado automaticamente quando a internet voltar.";

type AccessRole = "administrador" | "encarregado" | "colaborador";

type Actor = {
  registration: string;
  name: string;
  role: AccessRole;
};

type Employee = {
  registration: string;
  name: string;
  role: "encarregado" | "colaborador";
};

type ClockEvent = {
  clientEventId: string;
  employeeCode: string;
  employeeName: string;
  actorRegistration: string;
  actorName: string;
  actorRole: AccessRole;
  eventType: string;
  occurredAt: string;
  receivedAt?: string;
  timezone: string;
  timezoneOffsetMinutes: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  onlineAtCapture: boolean;
  syncStatus: "pending" | "synced" | "rejected";
};

type QueueItem = {
  id: string;
  kind: "punch";
  endpoint: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
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

async function put<T>(storeName: string, value: T) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
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

async function get<T>(storeName: string, key: IDBValidKey) {
  const database = await openDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => {
      database.close();
      resolve(request.result as T | undefined);
    };
    request.onerror = () => {
      const error = request.error;
      database.close();
      reject(error);
    };
  });
}

async function getAll<T>(storeName: string) {
  const database = await openDatabase();
  return new Promise<T[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => {
      database.close();
      resolve((request.result || []) as T[]);
    };
    request.onerror = () => {
      const error = request.error;
      database.close();
      reject(error);
    };
  });
}

async function remove(storeName: string, key: IDBValidKey) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
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

function safeParse<T>(value: string | null, fallback: T) {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncRegistration = registration as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    };
    await syncRegistration.sync?.register("beta-time-clock-sync");
  } catch {
    // O evento online da página é o fallback para iPhone e navegadores sem SyncManager.
  }
}

async function sendOnce(item: QueueItem) {
  try {
    const response = await fetch(item.endpoint, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item.payload),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      event?: Partial<ClockEvent>;
    };

    if (!response.ok || body.ok === false) {
      if (response.status === 401) {
        return {
          ok: false,
          networkError: false,
          authenticationError: true,
          error: body.error || "Entre novamente para sincronizar a batida.",
        };
      }
      if (response.status >= 400 && response.status < 500) {
        await remove("queue", item.id);
        const event = await get<ClockEvent>("events", item.id);
        if (event) await put("events", { ...event, syncStatus: "rejected" });
      }
      return {
        ok: false,
        networkError: false,
        authenticationError: false,
        error: body.error || "O servidor rejeitou o registro.",
      };
    }

    await remove("queue", item.id);
    const event = await get<ClockEvent>("events", item.id);
    if (event) {
      await put("events", {
        ...event,
        ...body.event,
        receivedAt: body.event?.receivedAt || new Date().toISOString(),
        syncStatus: "synced",
      });
    }
    return {
      ok: true,
      networkError: false,
      authenticationError: false,
      error: "",
    };
  } catch {
    await requestBackgroundSync();
    return {
      ok: false,
      networkError: true,
      authenticationError: false,
      error: "",
    };
  }
}

async function synchronizeQueue() {
  const items = (await getAll<QueueItem>("queue")).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  let synchronized = 0;
  let authenticationError = false;
  for (const item of items) {
    const result = await sendOnce(item);
    if (result.ok) synchronized += 1;
    if (result.authenticationError) {
      authenticationError = true;
      break;
    }
    if (result.networkError) break;
  }
  return { total: items.length, synchronized, authenticationError };
}

function formatTime(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function eventName(value: string) {
  return (
    {
      ENTRADA: "Entrada",
      INICIO_INTERVALO: "Início do intervalo",
      FIM_INTERVALO: "Fim do intervalo",
      SAIDA: "Saída",
    }[value] || value
  );
}

function roleName(role: AccessRole) {
  return role === "administrador"
    ? "Administrador"
    : role === "encarregado"
      ? "Encarregado"
      : "Colaborador";
}

function locationError(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return "Autorize a localização do celular para registrar o ponto.";
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível obter a localização.";
}

function readLocation() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Este celular não disponibiliza localização."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 30_000,
    });
  });
}

export default function TimeClockPage() {
  const [clock, setClock] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [actor, setActor] = useState<Actor | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [eventType, setEventType] = useState("ENTRADA");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Carregando sua identificação e os colaboradores disponíveis...",
  );
  const [messageType, setMessageType] = useState<
    "info" | "success" | "warning" | "error"
  >("info");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.registration === selectedCode),
    [employees, selectedCode],
  );
  const canChooseEmployee =
    actor?.role === "administrador" || actor?.role === "encarregado";

  const refreshEvents = useCallback(async (employeeCode = selectedCode) => {
    if (!employeeCode) {
      setEvents([]);
      return;
    }
    const allEvents = await getAll<ClockEvent>("events");
    setEvents(
      allEvents
        .filter((event) => event.employeeCode === employeeCode)
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
    );
  }, [selectedCode]);

  const loadAccess = useCallback(async () => {
    const cachedActor = safeParse<Actor | null>(
      localStorage.getItem(ACTOR_CACHE_KEY),
      null,
    );
    const cachedEmployees = safeParse<Employee[]>(
      localStorage.getItem(EMPLOYEES_CACHE_KEY),
      [],
    );
    if (cachedActor) setActor(cachedActor);
    if (cachedEmployees.length) setEmployees(cachedEmployees);

    try {
      const response = await fetch("/api/time-clock?action=employees", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        actor?: Actor;
        employees?: Employee[];
      };
      if (!response.ok || !body.actor || !body.employees) {
        if (response.status === 401 && !cachedActor) {
          window.location.replace("/acesso?next=/ponto&message=Entre para usar o ponto.");
          return;
        }
        throw new Error(body.error || "Não foi possível carregar os acessos do ponto.");
      }

      setActor(body.actor);
      setEmployees(body.employees);
      localStorage.setItem(ACTOR_CACHE_KEY, JSON.stringify(body.actor));
      localStorage.setItem(EMPLOYEES_CACHE_KEY, JSON.stringify(body.employees));

      const savedSelection = localStorage.getItem(SELECTED_CACHE_KEY) || "";
      const ownCode = body.actor.registration;
      const nextSelection =
        body.actor.role === "colaborador"
          ? ownCode
          : body.employees.some(
                (employee) => employee.registration === savedSelection,
              )
            ? savedSelection
            : body.employees.some((employee) => employee.registration === ownCode)
              ? ownCode
              : body.employees[0]?.registration || "";
      setSelectedCode(nextSelection);
      localStorage.setItem(SELECTED_CACHE_KEY, nextSelection);
      setMessage(
        body.actor.role === "encarregado"
          ? "Selecione quem está batendo o ponto. O lançamento ficará identificado em seu nome."
          : body.actor.role === "colaborador"
            ? "Seu acesso está vinculado à sua matrícula. Registre o próprio ponto."
            : "Selecione o colaborador e registre a batida.",
      );
      setMessageType("info");
    } catch (error) {
      if (cachedActor && cachedEmployees.length) {
        const ownCode = cachedActor.registration;
        const savedSelection = localStorage.getItem(SELECTED_CACHE_KEY) || "";
        const nextSelection =
          cachedActor.role === "colaborador"
            ? ownCode
            : cachedEmployees.some(
                  (employee) => employee.registration === savedSelection,
                )
              ? savedSelection
              : cachedEmployees[0]?.registration || "";
        setSelectedCode(nextSelection);
        setMessage(
          "Modo offline ativado. A identificação salva neste celular será usada para a batida.",
        );
        setMessageType("warning");
        return;
      }
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível identificar o usuário.",
      );
      setMessageType("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    void loadAccess();
    const connected = async () => {
      setOnline(true);
      await loadAccess();
      const result = await synchronizeQueue();
      await refreshEvents();
      if (result.authenticationError) {
        setMessage(
          "Há batidas pendentes. Entre novamente para concluir a sincronização.",
        );
        setMessageType("warning");
      } else if (result.synchronized > 0) {
        setMessage(
          `${result.synchronized} registro(s) sincronizado(s) sem duplicidade.`,
        );
        setMessageType("success");
      }
    };
    const disconnected = () => {
      setOnline(false);
      setMessage(
        "Modo offline ativado. As próximas batidas serão salvas neste celular.",
      );
      setMessageType("warning");
    };
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, [loadAccess, refreshEvents]);

  useEffect(() => {
    void refreshEvents(selectedCode);
  }, [refreshEvents, selectedCode]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/ponto-sw.js", { scope: "/" }).catch(() => {
      setMessage(
        "O ponto abriu, mas a instalação offline não foi ativada neste navegador.",
      );
      setMessageType("warning");
    });
  }, []);

  function chooseEmployee(value: string) {
    if (!canChooseEmployee) return;
    setSelectedCode(value);
    localStorage.setItem(SELECTED_CACHE_KEY, value);
  }

  async function punch() {
    if (!actor || !selectedEmployee) {
      setMessage("Selecione um colaborador válido antes de registrar o ponto.");
      setMessageType("error");
      return;
    }
    if (
      actor.role === "colaborador" &&
      selectedEmployee.registration !== actor.registration
    ) {
      setMessage("O colaborador só pode registrar o próprio ponto.");
      setMessageType("error");
      return;
    }

    setBusy(true);
    const occurredAt = new Date().toISOString();
    try {
      setMessage("Obtendo a localização do celular...");
      setMessageType("info");
      const position = await readLocation();
      const clientEventId = crypto.randomUUID();
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
      const clockEvent: ClockEvent = {
        clientEventId,
        employeeCode: selectedEmployee.registration,
        employeeName: selectedEmployee.name,
        actorRegistration: actor.registration,
        actorName: actor.name,
        actorRole: actor.role,
        eventType,
        occurredAt,
        timezone,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        onlineAtCapture: navigator.onLine,
        syncStatus: "pending",
      };
      await put("events", clockEvent);

      const queueItem: QueueItem = {
        id: clientEventId,
        kind: "punch",
        endpoint: `${window.location.origin}/api/time-clock?action=punch`,
        createdAt: occurredAt,
        payload: {
          clientEventId,
          employeeCode: selectedEmployee.registration,
          eventType,
          occurredAt,
          timezone,
          timezoneOffsetMinutes: clockEvent.timezoneOffsetMinutes,
          latitude: clockEvent.latitude,
          longitude: clockEvent.longitude,
          accuracy: clockEvent.accuracy,
          onlineAtCapture: clockEvent.onlineAtCapture,
        },
      };
      await put("queue", queueItem);
      await refreshEvents(selectedEmployee.registration);

      const result = await sendOnce(queueItem);
      await refreshEvents(selectedEmployee.registration);
      const actingForAnother =
        actor.registration !== selectedEmployee.registration;

      if (result.ok) {
        setMessage(
          actingForAnother
            ? `Ponto de ${selectedEmployee.name} registrado às ${formatTime(occurredAt)} por ${actor.name}.`
            : `Ponto registrado às ${formatTime(occurredAt)}.`,
        );
        setMessageType("success");
      } else if (result.networkError) {
        setMessage(
          `${OFFLINE_MESSAGE} Horário registrado: ${formatTime(occurredAt)}.`,
        );
        setMessageType("warning");
      } else if (result.authenticationError) {
        setMessage(
          "A batida foi preservada neste celular. Entre novamente para sincronizá-la.",
        );
        setMessageType("warning");
      } else {
        setMessage(result.error);
        setMessageType("error");
      }
    } catch (error) {
      setMessage(locationError(error));
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    try {
      const result = await synchronizeQueue();
      await refreshEvents();
      if (result.authenticationError) {
        setMessage(
          "Entre novamente para sincronizar as batidas pendentes deste celular.",
        );
        setMessageType("warning");
      } else if (result.total === 0) {
        setMessage("Não há registros pendentes neste celular.");
        setMessageType("info");
      } else {
        setMessage(
          `${result.synchronized} de ${result.total} registro(s) sincronizado(s).`,
        );
        setMessageType(
          result.synchronized === result.total ? "success" : "warning",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    if (!installPrompt) {
      setMessage(
        "No celular, abra o menu do navegador e escolha “Adicionar à tela inicial”.",
      );
      setMessageType("info");
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/staff-logout", {
        method: "POST",
        credentials: "same-origin",
      });
      localStorage.removeItem(ACTOR_CACHE_KEY);
      localStorage.removeItem(EMPLOYEES_CACHE_KEY);
      localStorage.removeItem(SELECTED_CACHE_KEY);
    } finally {
      window.location.replace("/acesso?message=Sessão encerrada neste celular.");
    }
  }

  return (
    <main className="ponto-page">
      <style>{`
        * { box-sizing: border-box; }
        html { background: #edf3fa; }
        body { margin: 0; }
        .ponto-page { min-height: 100dvh; padding: 18px; color: #172b4d; background: radial-gradient(circle at top right, #dbeafe 0, transparent 35%), #edf3fa; }
        .ponto-shell { width: min(100%, 980px); margin: 0 auto; }
        .ponto-top { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 16px; }
        .ponto-brand { display: flex; align-items: center; gap: 12px; }
        .ponto-logo { width: 50px; height: 50px; border-radius: 15px; display: grid; place-items: center; background: #0b2b5f; color: white; font-size: 22px; font-weight: 900; box-shadow: 0 10px 28px rgba(11,43,95,.22); }
        .ponto-brand h1 { margin: 0; color: #0b2b5f; font-size: clamp(23px, 5vw, 32px); }
        .ponto-brand p { margin: 3px 0 0; color: #607089; font-size: 13px; }
        .top-buttons { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        button, select { font: inherit; }
        button { cursor: pointer; }
        button:disabled { opacity: .58; cursor: not-allowed; }
        .pill { border: 1px solid #c8d6e6; background: white; color: #24446d; border-radius: 999px; padding: 9px 12px; font-size: 12px; font-weight: 850; }
        .pill.online { color: #166534; background: #ecfdf3; border-color: #bbf7d0; }
        .pill.offline { color: #9a3412; background: #fff7ed; border-color: #fed7aa; }
        .clock { border-radius: 22px; padding: 22px; color: white; background: linear-gradient(145deg, #071d45, #123c76); box-shadow: 0 18px 45px rgba(13,45,91,.2); }
        .clock-date { color: #cfe0f9; text-transform: capitalize; font-size: 14px; }
        .clock-time { font-size: clamp(48px, 12vw, 84px); line-height: 1; letter-spacing: -3px; font-weight: 950; font-variant-numeric: tabular-nums; margin: 9px 0; }
        .clock small { color: #d9e7fb; }
        .ponto-grid { display: grid; grid-template-columns: minmax(0, 1.08fr) minmax(300px, .92fr); gap: 17px; margin-top: 17px; align-items: start; }
        .card { background: rgba(255,255,255,.97); border: 1px solid #d7e2ef; border-radius: 21px; box-shadow: 0 16px 45px rgba(31,55,88,.08); padding: 19px; }
        .card h2 { margin: 0 0 13px; color: #0b2b5f; font-size: 18px; }
        .session { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 13px; margin-bottom: 14px; border-radius: 14px; background: #f5f9ff; border: 1px solid #cfe0f2; }
        .session strong { display: block; color: #0b2b5f; }
        .session small { color: #61748d; }
        .role { border-radius: 999px; padding: 6px 9px; color: #174a7e; background: #dbeafe; font-size: 11px; font-weight: 900; text-transform: uppercase; }
        .field { display: grid; gap: 6px; margin-bottom: 13px; }
        .field label { font-size: 13px; font-weight: 850; color: #405571; }
        .field select { width: 100%; border: 1px solid #c9d6e6; border-radius: 12px; padding: 12px 13px; color: #172b4d; background: white; outline: none; }
        .field select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.13); }
        .fixed-person { padding: 14px; margin-bottom: 13px; border-radius: 14px; border: 1px solid #bbf7d0; background: #ecfdf3; }
        .fixed-person strong { display: block; color: #14532d; font-size: 16px; }
        .fixed-person small { color: #397154; }
        .delegation { margin: 0 0 13px; padding: 11px 12px; border: 1px solid #fed7aa; border-radius: 12px; color: #9a3412; background: #fff7ed; font-size: 13px; line-height: 1.4; }
        .message { margin: 13px 0; padding: 12px 13px; border-radius: 13px; border: 1px solid; line-height: 1.42; font-size: 14px; }
        .message-info { color: #1e3a5f; background: #eff6ff; border-color: #bfdbfe; }
        .message-success { color: #14532d; background: #ecfdf3; border-color: #bbf7d0; }
        .message-warning { color: #9a3412; background: #fff7ed; border-color: #fed7aa; }
        .message-error { color: #991b1b; background: #fef2f2; border-color: #fecaca; }
        .primary { width: 100%; border: 0; border-radius: 14px; padding: 15px 16px; background: #1264d5; color: white; font-weight: 900; box-shadow: 0 10px 25px rgba(18,100,213,.24); }
        .secondary-row { display: flex; gap: 9px; margin-top: 9px; }
        .secondary-row > * { flex: 1; }
        .secondary { min-height: 42px; border: 1px solid #c9d6e6; border-radius: 12px; padding: 10px; background: white; color: #24446d; font-weight: 850; text-align: center; text-decoration: none; }
        .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 17px; }
        .summary div { padding: 12px; border: 1px solid #dbe5f0; border-radius: 13px; background: #f8fbff; }
        .summary strong { display: block; color: #0b2b5f; font-size: 20px; }
        .summary small { color: #61748d; }
        .history-list { display: grid; gap: 8px; }
        .history-item { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 10px 11px; border: 1px solid #dbe5f0; background: #fbfdff; border-radius: 12px; }
        .history-item strong { display: block; color: #19365d; font-size: 14px; }
        .history-item small { display: block; color: #607089; margin-top: 2px; }
        .history-actor { color: #7a5a12 !important; }
        .sync { border-radius: 999px; padding: 5px 7px; font-size: 10px; font-weight: 900; text-transform: uppercase; }
        .sync-synced { color: #166534; background: #dcfce7; }
        .sync-pending { color: #9a3412; background: #ffedd5; }
        .sync-rejected { color: #991b1b; background: #fee2e2; }
        .empty { color: #687990; font-size: 13px; padding: 8px 0; }
        .footer { margin: 16px 0 0; color: #687990; font-size: 12px; text-align: center; }
        @media (max-width: 780px) {
          .ponto-page { padding: 11px; }
          .ponto-top { align-items: flex-start; }
          .top-buttons { max-width: 145px; }
          .ponto-grid { grid-template-columns: 1fr; }
          .card { padding: 15px; border-radius: 18px; }
          .clock { padding: 18px; border-radius: 18px; }
          .clock-time { letter-spacing: -2px; }
        }
      `}</style>

      <div className="ponto-shell">
        <header className="ponto-top">
          <div className="ponto-brand">
            <div className="ponto-logo">B</div>
            <div>
              <h1>Beta Ponto</h1>
              <p>Horário, localização e funcionamento online ou offline</p>
            </div>
          </div>
          <div className="top-buttons">
            <span className={`pill ${online ? "online" : "offline"}`}>
              {online ? "● Online" : "● Offline"}
            </span>
            <button className="pill" type="button" onClick={install}>
              Instalar PWA
            </button>
          </div>
        </header>

        <section className="clock">
          <div className="clock-date">
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            }).format(clock)}
          </div>
          <div className="clock-time">{formatTime(clock)}</div>
          <small>
            A batida preserva este horário mesmo quando a sincronização ocorrer depois.
          </small>
        </section>

        <div className="ponto-grid">
          <section className="card">
            <h2>Registrar ponto</h2>

            {actor ? (
              <div className="session">
                <div>
                  <strong>{actor.name}</strong>
                  <small>Matrícula {actor.registration}</small>
                </div>
                <span className="role">{roleName(actor.role)}</span>
              </div>
            ) : null}

            {canChooseEmployee ? (
              <div className="field">
                <label htmlFor="employee-select">Quem está batendo o ponto?</label>
                <select
                  id="employee-select"
                  value={selectedCode}
                  onChange={(event) => chooseEmployee(event.target.value)}
                >
                  <option value="">Selecione o colaborador</option>
                  {employees.map((employee) => (
                    <option
                      key={employee.registration}
                      value={employee.registration}
                    >
                      {employee.name} · {employee.registration}
                    </option>
                  ))}
                </select>
              </div>
            ) : selectedEmployee ? (
              <div className="fixed-person">
                <strong>{selectedEmployee.name}</strong>
                <small>
                  Matrícula {selectedEmployee.registration} · identidade fixa nesta sessão
                </small>
              </div>
            ) : null}

            {actor?.role === "encarregado" && selectedEmployee ? (
              <p className="delegation">
                {actor.registration === selectedEmployee.registration
                  ? "Você está registrando o próprio ponto."
                  : `Você está registrando o ponto de ${selectedEmployee.name}. O lançamento ficará identificado como realizado por ${actor.name}.`}
              </p>
            ) : null}

            <div className="field">
              <label htmlFor="event-type">Tipo da batida</label>
              <select
                id="event-type"
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                <option value="ENTRADA">Entrada</option>
                <option value="INICIO_INTERVALO">Início do intervalo</option>
                <option value="FIM_INTERVALO">Fim do intervalo</option>
                <option value="SAIDA">Saída</option>
              </select>
            </div>

            <div
              className={`message message-${messageType}`}
              role="status"
              aria-live="polite"
            >
              {message}
            </div>

            <button
              className="primary"
              type="button"
              disabled={busy || !selectedEmployee}
              onClick={punch}
            >
              {busy
                ? "Registrando ponto..."
                : `Bater ponto agora · ${formatTime(clock)}`}
            </button>

            <div className="secondary-row">
              <button
                className="secondary"
                type="button"
                disabled={busy}
                onClick={syncNow}
              >
                Sincronizar agora
              </button>
              <button
                className="secondary"
                type="button"
                disabled={busy}
                onClick={logout}
              >
                Encerrar sessão
              </button>
            </div>
          </section>

          <aside className="card">
            <h2>Batidas neste celular</h2>
            <div className="summary">
              <div>
                <strong>{events.length}</strong>
                <small>Total exibido</small>
              </div>
              <div>
                <strong>
                  {events.filter((event) => event.syncStatus === "pending").length}
                </strong>
                <small>Pendentes</small>
              </div>
            </div>
            <div className="history-list">
              {events.length ? (
                events.slice(0, 15).map((event) => (
                  <div className="history-item" key={event.clientEventId}>
                    <div>
                      <strong>{eventName(event.eventType)}</strong>
                      <small>{formatDateTime(event.occurredAt)}</small>
                      {event.actorRegistration !== event.employeeCode ? (
                        <small className="history-actor">
                          Registrado por {event.actorName}
                        </small>
                      ) : null}
                    </div>
                    <span className={`sync sync-${event.syncStatus}`}>
                      {event.syncStatus === "synced"
                        ? "Sincronizado"
                        : event.syncStatus === "rejected"
                          ? "Rejeitado"
                          : "Pendente"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty">
                  Nenhuma batida registrada para este colaborador neste celular.
                </div>
              )}
            </div>
          </aside>
        </div>

        <p className="footer">
          Beta Construtora · Ponto eletrônico operacional sem reconhecimento facial
        </p>
      </div>
    </main>
  );
}
