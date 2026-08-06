"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DB_NAME = "beta-gestao-365-time-clock";
const DB_VERSION = 1;
const HUMAN_SCRIPT =
  "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.js";
const HUMAN_MODELS =
  "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/";
const FACE_THRESHOLD = 0.5;
const OFFLINE_MESSAGE =
  "Sem conexão. O registro foi salvo neste celular e será sincronizado automaticamente quando a internet voltar.";

type Face = {
  embedding?: number[];
  faceScore?: number;
  boxScore?: number;
  real?: number;
  live?: number;
};

type Detection = {
  face?: Face[];
  gesture?: Array<{ gesture?: string }> | Record<string, { gesture?: string }>;
};

type HumanApi = {
  load(): Promise<void>;
  warmup(): Promise<void>;
  detect(video: HTMLVideoElement): Promise<Detection>;
  match: {
    similarity(
      first: number[],
      second: number[],
      options?: Record<string, number>,
    ): number;
  };
};

type HumanConstructor = new (config: Record<string, unknown>) => HumanApi;

declare global {
  interface Window {
    Human?: { Human: HumanConstructor };
  }
}

type Employee = {
  code: string;
  name: string;
  sourceRecordId: string;
};

type Profile = {
  employeeCode: string;
  employeeName: string;
  sourceRecordId: string;
  deviceToken: string;
  embedding: number[];
  referencePhoto: string;
  enrolledAt: string;
  syncStatus: "pending" | "synced" | "rejected";
};

type ClockEvent = {
  clientEventId: string;
  employeeCode: string;
  employeeName: string;
  eventType: string;
  occurredAt: string;
  receivedAt?: string;
  timezone: string;
  timezoneOffsetMinutes: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  similarity: number;
  livenessScore: number;
  evidencePhoto: string;
  onlineAtCapture: boolean;
  syncStatus: "pending" | "synced" | "rejected";
};

type QueueItem = {
  id: string;
  kind: "enroll" | "punch";
  endpoint: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
}

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
        const store = database.createObjectStore("events", {
          keyPath: "clientEventId",
        });
        store.createIndex("employeeCode", "employeeCode", { unique: false });
      }
      if (!database.objectStoreNames.contains("queue")) {
        const store = database.createObjectStore("queue", { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
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

async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncRegistration = registration as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    };
    await syncRegistration.sync?.register("beta-time-clock-sync");
  } catch {
    // O evento online continua sendo o fallback em iPhone e navegadores sem SyncManager.
  }
}

async function sendOnce(item: QueueItem) {
  try {
    const response = await fetch(item.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(item.payload),
      cache: "no-store",
    });
    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      event?: { receivedAt?: string };
    };

    if (!response.ok || body.ok === false) {
      if (response.status >= 400 && response.status < 500) {
        await remove("queue", item.id);
        if (item.kind === "punch") {
          const event = await get<ClockEvent>("events", item.id);
          if (event) await put("events", { ...event, syncStatus: "rejected" });
        }
        if (item.kind === "enroll") {
          const code = String(item.payload.employeeCode || "");
          const profile = await get<Profile>("profiles", code);
          if (profile) await put("profiles", { ...profile, syncStatus: "rejected" });
        }
      }
      return {
        ok: false,
        networkError: false,
        error: body.error || "O servidor rejeitou o registro.",
      };
    }

    await remove("queue", item.id);
    if (item.kind === "punch") {
      const event = await get<ClockEvent>("events", item.id);
      if (event) {
        await put("events", {
          ...event,
          receivedAt: body.event?.receivedAt || new Date().toISOString(),
          syncStatus: "synced",
        });
      }
    } else {
      const code = String(item.payload.employeeCode || "");
      const profile = await get<Profile>("profiles", code);
      if (profile) await put("profiles", { ...profile, syncStatus: "synced" });
    }
    return { ok: true, networkError: false, error: "" };
  } catch {
    await requestBackgroundSync();
    return { ok: false, networkError: true, error: "" };
  }
}

async function synchronizeQueue() {
  const items = (await getAll<QueueItem>("queue")).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  let synchronized = 0;
  for (const item of items) {
    const result = await sendOnce(item);
    if (result.ok) synchronized += 1;
    if (result.networkError) break;
  }
  return { total: items.length, synchronized };
}

function average(samples: number[][]) {
  const length = samples[0]?.length || 0;
  return Array.from({ length }, (_, index) =>
    samples.reduce((total, sample) => total + sample[index], 0) /
    samples.length,
  );
}

function time(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

function dateTime(value: string) {
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

function geolocationError(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return "Autorize a localização do celular para registrar o ponto.";
  }
  return error instanceof Error ? error.message : "Não foi possível obter a localização.";
}

export default function TimeClockPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const humanRef = useRef<HumanApi | null>(null);
  const humanLoadingRef = useRef<Promise<HumanApi> | null>(null);

  const [clock, setClock] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeCode, setEmployeeCode] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [sourceRecordId, setSourceRecordId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [eventType, setEventType] = useState("ENTRADA");
  const [busy, setBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState(
    "Selecione um colaborador. No primeiro acesso, cadastre o rosto para liberar o ponto.",
  );
  const [messageType, setMessageType] = useState<
    "info" | "success" | "warning" | "error"
  >("info");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  const code = useMemo(() => normalizeCode(employeeCode), [employeeCode]);

  const refresh = useCallback(async (selectedCode = code) => {
    if (!selectedCode) {
      setProfile(null);
      setEvents([]);
      return;
    }
    const nextProfile = await get<Profile>("profiles", selectedCode);
    const localEvents = await getAll<ClockEvent>("events");
    setProfile(nextProfile || null);
    setEvents(
      localEvents
        .filter((item) => item.employeeCode === selectedCode)
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
    );
  }, [code]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const parameterCode = normalizeCode(parameters.get("employeeCode") || "");
    const parameterName = parameters.get("employeeName") || "";
    const parameterRecord = parameters.get("sourceRecordId") || "";
    if (parameterCode) setEmployeeCode(parameterCode);
    if (parameterName) setEmployeeName(parameterName);
    if (parameterRecord) setSourceRecordId(parameterRecord);
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const connected = async () => {
      setOnline(true);
      const result = await synchronizeQueue();
      await refresh();
      if (result.synchronized > 0) {
        setMessage(
          `${result.synchronized} registro(s) sincronizado(s) sem duplicidade.`,
        );
        setMessageType("success");
      }
    };
    const disconnected = () => {
      setOnline(false);
      setMessage("Modo offline ativado. As próximas batidas serão salvas neste celular.");
      setMessageType("warning");
    };
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, [refresh]);

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
      setMessage("O portal abriu, mas a instalação PWA não foi ativada neste navegador.");
      setMessageType("warning");
    });
  }, []);

  useEffect(() => {
    fetch("/api/records?module=people&page=1&pageSize=200", {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((body: { records?: Array<Record<string, unknown>> }) => {
        const options = (body.records || []).map((record) => {
          const payload =
            record.payload && typeof record.payload === "object"
              ? (record.payload as Record<string, unknown>)
              : {};
          const recordId = String(record.id || "");
          const recordCode = normalizeCode(
            String(
              record.reference ||
                payload.employeeCode ||
                payload.registration ||
                `COLAB-${recordId}`,
            ),
          );
          return {
            code: recordCode || `COLAB-${recordId}`,
            name: String(record.title || payload.name || `Colaborador ${recordId}`),
            sourceRecordId: recordId,
          };
        });
        setEmployees(options);
        if (code && !employeeName) {
          const selected = options.find((item) => item.code === code);
          if (selected) {
            setEmployeeName(selected.name);
            setSourceRecordId(selected.sourceRecordId);
          }
        }
      })
      .catch(() => setEmployees([]));
  }, [code, employeeName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function selectEmployee(selectedCode: string) {
    const selected = employees.find((item) => item.code === selectedCode);
    if (!selected) return;
    setEmployeeCode(selected.code);
    setEmployeeName(selected.name);
    setSourceRecordId(selected.sourceRecordId);
    setMessage("Colaborador selecionado. Continue com o cadastro facial ou a batida.");
    setMessageType("info");
  }

  async function loadHuman() {
    if (humanRef.current) return humanRef.current;
    if (humanLoadingRef.current) return humanLoadingRef.current;

    humanLoadingRef.current = (async () => {
      if (!window.Human?.Human) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>(
            `script[src="${HUMAN_SCRIPT}"]`,
          );
          if (existing) {
            if (window.Human?.Human) resolve();
            else {
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener(
                "error",
                () => reject(new Error("Falha ao carregar o reconhecimento facial.")),
                { once: true },
              );
            }
            return;
          }
          const script = document.createElement("script");
          script.src = HUMAN_SCRIPT;
          script.async = true;
          script.crossOrigin = "anonymous";
          script.onload = () => resolve();
          script.onerror = () =>
            reject(new Error("Falha ao carregar o reconhecimento facial."));
          document.head.appendChild(script);
        });
      }

      if (!window.Human?.Human) {
        throw new Error("O mecanismo facial não foi iniciado.");
      }
      const human = new window.Human.Human({
        backend: "webgl",
        modelBasePath: HUMAN_MODELS,
        cacheSensitivity: 0,
        filter: { enabled: true, equalization: true },
        face: {
          enabled: true,
          detector: { rotation: true, return: true, maxDetected: 1 },
          description: { enabled: true },
          iris: { enabled: true },
          antispoof: { enabled: true },
          liveness: { enabled: true },
          emotion: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: true },
      });
      setMessage("Carregando o reconhecimento facial no celular...");
      setMessageType("info");
      await human.load();
      await human.warmup();
      humanRef.current = human;
      return human;
    })();

    try {
      return await humanLoadingRef.current;
    } finally {
      humanLoadingRef.current = null;
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador não permite usar a câmera.");
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 720 },
        height: { ideal: 720 },
      },
    });
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) throw new Error("A câmera não foi preparada.");
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    await video.play();
    setCameraActive(true);
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  function photo() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      throw new Error("A imagem da câmera ainda não está pronta.");
    }
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível capturar a foto.");
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = (video.videoWidth - size) / 2;
    const sourceY = (video.videoHeight - size) / 2;
    canvas.width = 360;
    canvas.height = 360;
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(
      video,
      sourceX,
      sourceY,
      size,
      size,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    context.restore();
    return canvas.toDataURL("image/jpeg", 0.76);
  }

  async function captureFace() {
    await startCamera();
    const human = await loadHuman();
    const video = videoRef.current;
    if (!video) throw new Error("A câmera não foi preparada.");

    setMessage("Olhe para a câmera e pisque. Mantenha somente um rosto no quadro.");
    setMessageType("info");
    const startedAt = Date.now();
    const samples: number[][] = [];
    let blink = false;
    let livenessScore = 0;

    while (Date.now() - startedAt < 18_000 && samples.length < 3) {
      const detection = await human.detect(video);
      const faces = detection.face || [];
      const gestures = Array.isArray(detection.gesture)
        ? detection.gesture
        : Object.values(detection.gesture || {});
      blink =
        blink ||
        gestures.some((item) =>
          String(item?.gesture || "").toLowerCase().includes("blink"),
        );
      const face = faces[0];
      const embedding = face?.embedding;
      const confidence = Number(face?.faceScore ?? face?.boxScore ?? 0);
      const real = Number(face?.real ?? 0.6);
      const live = Number(face?.live ?? 0.6);
      livenessScore = Math.max(livenessScore, Math.min(real, live));

      if (
        faces.length === 1 &&
        Array.isArray(embedding) &&
        embedding.length >= 64 &&
        confidence >= 0.5 &&
        real >= 0.4 &&
        live >= 0.4
      ) {
        samples.push([...embedding]);
      }
      if (samples.length < 3) {
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }
    }

    if (samples.length < 3) {
      throw new Error(
        "Não foi possível validar o rosto. Melhore a iluminação, centralize o rosto e tente novamente.",
      );
    }
    if (!blink && livenessScore < 0.5) {
      throw new Error("A prova de vida não foi confirmada. Pisque e tente novamente.");
    }

    return {
      embedding: average(samples),
      evidencePhoto: photo(),
      livenessScore,
    };
  }

  function location() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Este celular não disponibiliza localização."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      });
    });
  }

  async function enroll() {
    const selectedCode = normalizeCode(employeeCode);
    const selectedName = employeeName.trim();
    if (!selectedCode || !selectedName) {
      setMessage("Selecione um colaborador ou cadastre uma pessoa do zero.");
      setMessageType("error");
      return;
    }

    setBusy(true);
    try {
      const capture = await captureFace();
      const enrolledAt = new Date().toISOString();
      const deviceToken =
        profile?.deviceToken || `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      const nextProfile: Profile = {
        employeeCode: selectedCode,
        employeeName: selectedName,
        sourceRecordId,
        deviceToken,
        embedding: capture.embedding,
        referencePhoto: capture.evidencePhoto,
        enrolledAt,
        syncStatus: "pending",
      };
      await put("profiles", nextProfile);
      setProfile(nextProfile);

      const item: QueueItem = {
        id: `enroll-${selectedCode}`,
        kind: "enroll",
        endpoint: "/api/time-clock?action=enroll",
        createdAt: enrolledAt,
        payload: {
          employeeCode: selectedCode,
          employeeName: selectedName,
          sourceRecordId,
          deviceToken,
          embedding: capture.embedding,
          referencePhoto: capture.evidencePhoto,
          enrolledAt,
        },
      };
      await put("queue", item);
      const result = await sendOnce(item);
      await refresh(selectedCode);

      if (result.ok) {
        setMessage(
          "Rosto cadastrado com sucesso. Seu acesso ao ponto está liberado.",
        );
        setMessageType("success");
      } else if (result.networkError) {
        setMessage(
          `${OFFLINE_MESSAGE} O acesso já está liberado neste celular.`,
        );
        setMessageType("warning");
      } else {
        setMessage(result.error);
        setMessageType("error");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Não foi possível cadastrar o rosto.",
      );
      setMessageType("error");
    } finally {
      stopCamera();
      setBusy(false);
    }
  }

  async function punch() {
    if (!profile) {
      setMessage("Cadastre o rosto antes de bater o ponto.");
      setMessageType("error");
      return;
    }

    setBusy(true);
    try {
      const capture = await captureFace();
      const human = humanRef.current;
      if (!human) throw new Error("O reconhecimento facial não foi iniciado.");
      const similarity = human.match.similarity(
        profile.embedding,
        capture.embedding,
        { order: 2, multiplier: 25, min: 0.2, max: 0.8 },
      );
      if (similarity < FACE_THRESHOLD) {
        throw new Error("O rosto capturado não corresponde ao cadastro do colaborador.");
      }

      setMessage("Rosto confirmado. Obtendo a localização da batida...");
      setMessageType("info");
      const position = await location();
      const occurredAt = new Date().toISOString();
      const clientEventId = crypto.randomUUID();
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
      const clockEvent: ClockEvent = {
        clientEventId,
        employeeCode: profile.employeeCode,
        employeeName: profile.employeeName,
        eventType,
        occurredAt,
        timezone,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        similarity,
        livenessScore: capture.livenessScore,
        evidencePhoto: capture.evidencePhoto,
        onlineAtCapture: navigator.onLine,
        syncStatus: "pending",
      };
      await put("events", clockEvent);

      const item: QueueItem = {
        id: clientEventId,
        kind: "punch",
        endpoint: "/api/time-clock?action=punch",
        createdAt: occurredAt,
        payload: {
          clientEventId,
          employeeCode: profile.employeeCode,
          deviceToken: profile.deviceToken,
          eventType,
          occurredAt,
          timezone,
          timezoneOffsetMinutes: clockEvent.timezoneOffsetMinutes,
          latitude: clockEvent.latitude,
          longitude: clockEvent.longitude,
          accuracy: clockEvent.accuracy,
          embedding: capture.embedding,
          evidencePhoto: capture.evidencePhoto,
          livenessScore: capture.livenessScore,
          onlineAtCapture: clockEvent.onlineAtCapture,
        },
      };
      await put("queue", item);
      await refresh(profile.employeeCode);
      const result = await sendOnce(item);
      await refresh(profile.employeeCode);

      if (result.ok) {
        setMessage(`Ponto registrado às ${time(occurredAt)}.`);
        setMessageType("success");
      } else if (result.networkError) {
        setMessage(`${OFFLINE_MESSAGE} Horário registrado: ${time(occurredAt)}.`);
        setMessageType("warning");
      } else {
        setMessage(result.error);
        setMessageType("error");
      }
    } catch (error) {
      setMessage(geolocationError(error));
      setMessageType("error");
    } finally {
      stopCamera();
      setBusy(false);
    }
  }

  async function syncNow() {
    setBusy(true);
    try {
      const result = await synchronizeQueue();
      await refresh();
      if (result.total === 0) {
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

  const selectedExists = employees.some((item) => item.code === code);

  return (
    <main className="ponto-page">
      <style>{`
        * { box-sizing: border-box; }
        html { background: #eef3f9; }
        body { margin: 0; }
        .ponto-page { min-height: 100dvh; padding: 18px; color: #172b4d; background: radial-gradient(circle at top right, #dbeafe 0, transparent 35%), #eef3f9; }
        .ponto-shell { width: min(100%, 980px); margin: 0 auto; }
        .ponto-top { display: flex; justify-content: space-between; align-items: center; gap: 14px; margin-bottom: 16px; }
        .ponto-brand { display: flex; align-items: center; gap: 12px; }
        .ponto-logo { width: 50px; height: 50px; border-radius: 15px; display: grid; place-items: center; background: #0b2b5f; color: white; font-size: 22px; font-weight: 900; box-shadow: 0 10px 28px rgba(11,43,95,.22); }
        .ponto-brand h1 { margin: 0; color: #0b2b5f; font-size: clamp(23px, 5vw, 32px); }
        .ponto-brand p { margin: 3px 0 0; color: #607089; font-size: 13px; }
        .top-buttons { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        button, input, select { font: inherit; }
        button { cursor: pointer; }
        button:disabled { opacity: .58; cursor: not-allowed; }
        .pill { border: 1px solid #c8d6e6; background: white; color: #24446d; border-radius: 999px; padding: 9px 12px; font-size: 12px; font-weight: 850; }
        .pill.online { color: #166534; background: #ecfdf3; border-color: #bbf7d0; }
        .pill.offline { color: #9a3412; background: #fff7ed; border-color: #fed7aa; }
        .clock { border-radius: 22px; padding: 22px; color: white; background: linear-gradient(145deg, #071d45, #123c76); box-shadow: 0 18px 45px rgba(13,45,91,.2); }
        .clock-date { color: #cfe0f9; text-transform: capitalize; font-size: 14px; }
        .clock-time { font-size: clamp(48px, 12vw, 84px); line-height: 1; letter-spacing: -3px; font-weight: 950; font-variant-numeric: tabular-nums; margin: 9px 0; }
        .clock small { color: #d9e7fb; }
        .ponto-grid { display: grid; grid-template-columns: minmax(0, 1.12fr) minmax(300px, .88fr); gap: 17px; margin-top: 17px; align-items: start; }
        .card { background: rgba(255,255,255,.97); border: 1px solid #d7e2ef; border-radius: 21px; box-shadow: 0 16px 45px rgba(31,55,88,.08); padding: 19px; }
        .card h2 { margin: 0 0 13px; color: #0b2b5f; font-size: 18px; }
        .field { display: grid; gap: 6px; margin-bottom: 12px; }
        .field label { font-size: 13px; font-weight: 850; color: #405571; }
        .field input, .field select { width: 100%; min-width: 0; border: 1px solid #c9d6e6; border-radius: 12px; padding: 12px 13px; color: #172b4d; background: white; outline: none; }
        .field input:focus, .field select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.13); }
        .new-person { display: block; margin: -2px 0 14px; text-align: center; text-decoration: none; border: 1px dashed #8eb2db; color: #1253a4; background: #f4f9ff; border-radius: 12px; padding: 10px; font-size: 13px; font-weight: 850; }
        .profile { display: flex; align-items: center; gap: 11px; margin-bottom: 13px; padding: 11px; border: 1px solid #bbf7d0; background: #ecfdf3; border-radius: 14px; }
        .profile img { width: 56px; height: 56px; object-fit: cover; border-radius: 50%; border: 3px solid white; }
        .profile strong { display: block; color: #14532d; }
        .profile small { color: #397154; }
        .message { margin: 13px 0; padding: 12px 13px; border-radius: 13px; border: 1px solid; line-height: 1.42; font-size: 14px; }
        .message-info { color: #1e3a5f; background: #eff6ff; border-color: #bfdbfe; }
        .message-success { color: #14532d; background: #ecfdf3; border-color: #bbf7d0; }
        .message-warning { color: #9a3412; background: #fff7ed; border-color: #fed7aa; }
        .message-error { color: #991b1b; background: #fef2f2; border-color: #fecaca; }
        .primary { width: 100%; border: 0; border-radius: 14px; padding: 14px 16px; background: #1264d5; color: white; font-weight: 900; box-shadow: 0 10px 25px rgba(18,100,213,.24); }
        .primary.enroll { background: #0b7a50; box-shadow: 0 10px 25px rgba(11,122,80,.22); }
        .secondary-row { display: flex; gap: 9px; margin-top: 9px; }
        .secondary-row > * { flex: 1; }
        .secondary { min-height: 42px; border: 1px solid #c9d6e6; border-radius: 12px; padding: 10px; background: white; color: #24446d; font-weight: 850; text-align: center; text-decoration: none; }
        .camera { position: relative; aspect-ratio: 1 / 1; overflow: hidden; border-radius: 19px; background: #071426; border: 1px solid #263d5c; }
        .camera video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        .camera-guide { position: absolute; inset: 13%; border: 3px solid rgba(255,255,255,.84); border-radius: 50% 50% 46% 46%; box-shadow: 0 0 0 999px rgba(1,8,20,.32); pointer-events: none; }
        .camera-empty { position: absolute; inset: 0; display: grid; place-items: center; padding: 28px; text-align: center; color: #b9c9df; }
        .camera-empty strong { display: block; color: white; font-size: 18px; margin-bottom: 5px; }
        .history { margin-top: 17px; }
        .history-list { display: grid; gap: 8px; }
        .history-item { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; padding: 10px 11px; border: 1px solid #dbe5f0; background: #fbfdff; border-radius: 12px; }
        .history-item strong { display: block; color: #19365d; font-size: 14px; }
        .history-item small { color: #607089; }
        .sync { border-radius: 999px; padding: 5px 7px; font-size: 10px; font-weight: 900; text-transform: uppercase; }
        .sync-synced { color: #166534; background: #dcfce7; }
        .sync-pending { color: #9a3412; background: #ffedd5; }
        .sync-rejected { color: #991b1b; background: #fee2e2; }
        .empty { color: #687990; font-size: 13px; padding: 8px 0; }
        canvas { display: none; }
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
              <p>Rosto, horário, localização e funcionamento offline</p>
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
          <div className="clock-time">{time(clock)}</div>
          <small>
            A batida mantém este horário mesmo quando for sincronizada depois.
          </small>
        </section>

        <div className="ponto-grid">
          <section className="card">
            <h2>Colaborador</h2>
            {employees.length ? (
              <div className="field">
                <label htmlFor="employee-select">Cadastro existente</label>
                <select
                  id="employee-select"
                  value={selectedExists ? code : ""}
                  onChange={(event) => selectEmployee(event.target.value)}
                >
                  <option value="">Selecione o colaborador</option>
                  {employees.map((employee) => (
                    <option
                      key={`${employee.sourceRecordId}-${employee.code}`}
                      value={employee.code}
                    >
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <a className="new-person" href="/pessoas/novo">
              + Cadastrar colaborador do zero
            </a>

            <div className="field">
              <label htmlFor="employee-name">Nome</label>
              <input
                id="employee-name"
                value={employeeName}
                onChange={(event) => setEmployeeName(event.target.value)}
                placeholder="Nome do colaborador"
                autoComplete="name"
              />
            </div>
            <div className="field">
              <label htmlFor="employee-code">Código ou matrícula</label>
              <input
                id="employee-code"
                value={employeeCode}
                onChange={(event) => setEmployeeCode(normalizeCode(event.target.value))}
                placeholder="Ex.: TESTE001"
                autoCapitalize="characters"
              />
            </div>

            {profile ? (
              <div className="profile">
                <img src={profile.referencePhoto} alt="Rosto cadastrado" />
                <div>
                  <strong>Cadastro facial ativo</strong>
                  <small>
                    {profile.employeeName} · {profile.syncStatus === "synced"
                      ? "sincronizado"
                      : profile.syncStatus === "rejected"
                        ? "cadastro rejeitado"
                        : "salvo neste celular"}
                  </small>
                </div>
              </div>
            ) : null}

            <div
              className={`message message-${messageType}`}
              role="status"
              aria-live="polite"
            >
              {message}
            </div>

            {!profile ? (
              <button
                className="primary enroll"
                type="button"
                disabled={busy}
                onClick={enroll}
              >
                {busy ? "Validando o rosto..." : "Cadastrar rosto e liberar ponto"}
              </button>
            ) : (
              <>
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
                <button
                  className="primary"
                  type="button"
                  disabled={busy}
                  onClick={punch}
                >
                  {busy ? "Confirmando identidade..." : `Bater ponto agora · ${time(clock)}`}
                </button>
              </>
            )}

            <div className="secondary-row">
              <button
                className="secondary"
                type="button"
                disabled={busy}
                onClick={syncNow}
              >
                Sincronizar agora
              </button>
              <a className="secondary" href="/">
                Área administrativa
              </a>
            </div>
          </section>

          <aside className="card">
            <h2>Câmera e prova de vida</h2>
            <div className="camera">
              <video ref={videoRef} muted playsInline />
              {cameraActive ? (
                <div className="camera-guide" />
              ) : (
                <div className="camera-empty">
                  <div>
                    <strong>Câmera frontal</strong>
                    Ela será ativada somente no cadastro ou na batida.
                  </div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} />

            <div className="history">
              <h2>Batidas neste celular</h2>
              <div className="history-list">
                {events.length ? (
                  events.slice(0, 10).map((item) => (
                    <div className="history-item" key={item.clientEventId}>
                      <div>
                        <strong>{eventName(item.eventType)}</strong>
                        <small>{dateTime(item.occurredAt)}</small>
                      </div>
                      <span className={`sync sync-${item.syncStatus}`}>
                        {item.syncStatus === "synced"
                          ? "Sincronizado"
                          : item.syncStatus === "rejected"
                            ? "Rejeitado"
                            : "Pendente"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="empty">Nenhuma batida registrada.</div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <p className="footer">
          Beta Construtora · Portal móvel de ponto eletrônico
        </p>
      </div>
    </main>
  );
}
