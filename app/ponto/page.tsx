"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DB_NAME = "beta-gestao-365-time-clock";
const DB_VERSION = 1;
const FACE_THRESHOLD = 0.5;
const HUMAN_SCRIPT =
  "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/dist/human.js";
const HUMAN_MODELS =
  "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/";
const OFFLINE_PUNCH_MESSAGE =
  "Sem conexão. O registro foi salvo neste celular e será sincronizado automaticamente quando a internet voltar.";
const OFFLINE_ENROLL_MESSAGE =
  "Sem conexão. O cadastro facial foi salvo neste celular e será sincronizado automaticamente quando a internet voltar.";

type FaceResult = {
  embedding?: number[];
  faceScore?: number;
  boxScore?: number;
  real?: number;
  live?: number;
};

type HumanDetection = {
  face?: FaceResult[];
  gesture?: Array<{ gesture?: string }> | Record<string, { gesture?: string }>;
};

type HumanInstance = {
  version?: string;
  load(): Promise<void>;
  warmup(): Promise<void>;
  detect(input: HTMLVideoElement): Promise<HumanDetection>;
  match: {
    similarity(
      first: number[],
      second: number[],
      options?: Record<string, number>,
    ): number;
  };
};

type HumanConstructor = new (config: Record<string, unknown>) => HumanInstance;

declare global {
  interface Window {
    Human?: { Human: HumanConstructor };
  }
}

type EmployeeOption = {
  code: string;
  name: string;
  sourceRecordId: string;
};

type LocalProfile = {
  employeeCode: string;
  employeeName: string;
  sourceRecordId: string;
  deviceToken: string;
  embedding: number[];
  referencePhoto: string;
  enrolledAt: string;
  syncStatus: "pending" | "synced" | "rejected";
};

type PunchEvent = {
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

type InstallPromptEvent = Event & {
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

function openClockDb() {
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

async function storePut<T>(storeName: string, value: T) {
  const database = await openClockDb();
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

async function storeGet<T>(storeName: string, key: IDBValidKey) {
  const database = await openClockDb();
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

async function storeGetAll<T>(storeName: string) {
  const database = await openClockDb();
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

async function storeDelete(storeName: string, key: IDBValidKey) {
  const database = await openClockDb();
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

async function registerBackgroundSync() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const syncRegistration = registration as ServiceWorkerRegistration & {
      sync?: { register(tag: string): Promise<void> };
    };
    await syncRegistration.sync?.register("beta-time-clock-sync");
  } catch {
    // O evento online da página continua sendo o fallback universal.
  }
}

async function sendQueueItem(item: QueueItem) {
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
        await storeDelete("queue", item.id);
        if (item.kind === "punch") {
          const event = await storeGet<PunchEvent>("events", item.id);
          if (event) {
            await storePut("events", { ...event, syncStatus: "rejected" });
          }
        }
      }
      return {
        ok: false,
        networkError: false,
        error: body.error || "O servidor rejeitou o registro.",
      };
    }

    await storeDelete("queue", item.id);
    if (item.kind === "punch") {
      const event = await storeGet<PunchEvent>("events", item.id);
      if (event) {
        await storePut("events", {
          ...event,
          receivedAt: body.event?.receivedAt || new Date().toISOString(),
          syncStatus: "synced",
        });
      }
    }
    if (item.kind === "enroll") {
      const employeeCode = String(item.payload.employeeCode || "");
      const profile = await storeGet<LocalProfile>("profiles", employeeCode);
      if (profile) {
        await storePut("profiles", { ...profile, syncStatus: "synced" });
      }
    }
    return { ok: true, networkError: false, error: "" };
  } catch {
    await registerBackgroundSync();
    return { ok: false, networkError: true, error: "" };
  }
}

async function syncQueue() {
  const items = (await storeGetAll<QueueItem>("queue")).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  let synced = 0;
  for (const item of items) {
    const result = await sendQueueItem(item);
    if (result.ok) synced += 1;
    if (result.networkError) break;
  }
  return { total: items.length, synced };
}

function averageEmbeddings(samples: number[][]) {
  const size = samples[0]?.length || 0;
  return Array.from({ length: size }, (_, index) =>
    samples.reduce((sum, sample) => sum + sample[index], 0) / samples.length,
  );
}

function eventLabel(value: string) {
  const labels: Record<string, string> = {
    ENTRADA: "Entrada",
    INICIO_INTERVALO: "Início do intervalo",
    FIM_INTERVALO: "Fim do intervalo",
    SAIDA: "Saída",
  };
  return labels[value] || value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value));
}

function formatClock(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function currentTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
}

export default function TimeClockPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const humanRef = useRef<HumanInstance | null>(null);
  const humanReadyRef = useRef(false);

  const [clock, setClock] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [employeeCode, setEmployeeCode] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [sourceRecordId, setSourceRecordId] = useState("");
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [events, setEvents] = useState<PunchEvent[]>([]);
  const [eventType, setEventType] = useState("ENTRADA");
  const [busy, setBusy] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [status, setStatus] = useState(
    "Selecione um colaborador e faça o cadastro facial no primeiro acesso.",
  );
  const [statusKind, setStatusKind] = useState<"info" | "success" | "warning" | "error">("info");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  const normalizedEmployeeCode = useMemo(
    () => normalizeCode(employeeCode),
    [employeeCode],
  );

  const refreshLocalState = useCallback(async (code = normalizedEmployeeCode) => {
    if (!code) {
      setProfile(null);
      setEvents([]);
      return;
    }
    const nextProfile = await storeGet<LocalProfile>("profiles", code);
    const allEvents = await storeGetAll<PunchEvent>("events");
    setProfile(nextProfile || null);
    setEvents(
      allEvents
        .filter((event) => event.employeeCode === code)
        .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)),
    );
  }, [normalizedEmployeeCode]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = async () => {
      setOnline(true);
      const result = await syncQueue();
      await refreshLocalState();
      if (result.synced > 0) {
        setStatus(`${result.synced} registro(s) sincronizado(s) sem duplicidade.`);
        setStatusKind("success");
      }
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshLocalState]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/ponto-sw.js", { scope: "/" }).catch(() => {
      setStatus("O portal abriu, mas a instalação offline ainda não foi ativada neste navegador.");
      setStatusKind("warning");
    });
  }, []);

  useEffect(() => {
    fetch("/api/records?module=people&page=1&pageSize=100", {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((body: { records?: Array<Record<string, unknown>> }) => {
        const options = (body.records || []).map((record) => {
          const payload =
            record.payload && typeof record.payload === "object"
              ? (record.payload as Record<string, unknown>)
              : {};
          const id = String(record.id || "");
          const rawCode = String(
            record.reference || payload.employeeCode || payload.registration || `COLAB-${id}`,
          );
          return {
            code: normalizeCode(rawCode) || `COLAB-${id}`,
            name: String(record.title || payload.employeeName || `Colaborador ${id}`),
            sourceRecordId: id,
          };
        });
        setEmployees(options);
      })
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    refreshLocalState();
  }, [refreshLocalState]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const chooseEmployee = (value: string) => {
    const selected = employees.find((employee) => employee.code === value);
    if (!selected) return;
    setEmployeeCode(selected.code);
    setEmployeeName(selected.name);
    setSourceRecordId(selected.sourceRecordId);
    setStatus("Colaborador selecionado. Continue com o cadastro facial ou a batida.");
    setStatusKind("info");
  };

  const loadHuman = async () => {
    if (humanRef.current && humanReadyRef.current) return humanRef.current;
    if (!window.Human) {
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          `script[src="${HUMAN_SCRIPT}"]`,
        );
        if (existing) {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error("Falha ao carregar o reconhecimento facial.")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = HUMAN_SCRIPT;
        script.async = true;
        script.crossOrigin = "anonymous";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Falha ao carregar o reconhecimento facial."));
        document.head.appendChild(script);
      });
    }
    if (!window.Human?.Human) {
      throw new Error("O mecanismo de reconhecimento facial não foi iniciado.");
    }
    if (!humanRef.current) {
      humanRef.current = new window.Human.Human({
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
    }
    setStatus("Carregando modelos de reconhecimento facial no celular...");
    setStatusKind("info");
    await humanRef.current.load();
    await humanRef.current.warmup();
    humanReadyRef.current = true;
    return humanRef.current;
  };

  const startCamera = async () => {
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
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      throw new Error("A imagem da câmera ainda não está pronta.");
    }
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível capturar a foto.");
    const sourceSize = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = (video.videoWidth - sourceSize) / 2;
    const sourceY = (video.videoHeight - sourceSize) / 2;
    canvas.width = 360;
    canvas.height = 360;
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(
      video,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    context.restore();
    return canvas.toDataURL("image/jpeg", 0.76);
  };

  const captureFace = async () => {
    await startCamera();
    const human = await loadHuman();
    const video = videoRef.current;
    if (!video) throw new Error("A câmera não foi preparada.");

    setStatus("Olhe para a câmera e pisque. Mantenha apenas um rosto no enquadramento.");
    setStatusKind("info");
    const startedAt = Date.now();
    const samples: number[][] = [];
    let livenessScore = 0;
    let blinkDetected = false;

    while (Date.now() - startedAt < 20_000 && samples.length < 3) {
      const detection = await human.detect(video);
      const faces = detection.face || [];
      const gestures = Array.isArray(detection.gesture)
        ? detection.gesture
        : Object.values(detection.gesture || {});
      const gestureNames = gestures.map((gesture) => String(gesture?.gesture || "").toLowerCase());
      blinkDetected =
        blinkDetected || gestureNames.some((gesture) => gesture.includes("blink"));
      const face = faces[0];
      const score = Number(face?.faceScore ?? face?.boxScore ?? 0);
      const real = Number(face?.real ?? 0.65);
      const live = Number(face?.live ?? 0.65);
      livenessScore = Math.max(livenessScore, Math.min(real, live));
      const embedding = face?.embedding;

      if (
        faces.length === 1 &&
        Array.isArray(embedding) &&
        embedding.length >= 64 &&
        score >= 0.55 &&
        real >= 0.45 &&
        live >= 0.45
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
    if (!blinkDetected && livenessScore < 0.55) {
      throw new Error("A prova de vida não foi confirmada. Pisque e tente novamente.");
    }

    return {
      embedding: averageEmbeddings(samples),
      photo: capturePhoto(),
      livenessScore,
    };
  };

  const readLocation = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
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

  const enrollFace = async () => {
    const code = normalizeCode(employeeCode);
    const name = employeeName.trim();
    if (!code || !name) {
      setStatus("Selecione um colaborador ou informe nome e código para o teste.");
      setStatusKind("error");
      return;
    }

    setBusy(true);
    try {
      const capture = await captureFace();
      const enrolledAt = new Date().toISOString();
      const deviceToken =
        profile?.deviceToken || `${crypto.randomUUID()}-${crypto.randomUUID()}`;
      const nextProfile: LocalProfile = {
        employeeCode: code,
        employeeName: name,
        sourceRecordId,
        deviceToken,
        embedding: capture.embedding,
        referencePhoto: capture.photo,
        enrolledAt,
        syncStatus: "pending",
      };
      await storePut("profiles", nextProfile);
      setEmployeeCode(code);
      setProfile(nextProfile);

      const queueItem: QueueItem = {
        id: `enroll-${code}`,
        kind: "enroll",
        endpoint: `${window.location.origin}/api/time-clock?action=enroll`,
        createdAt: enrolledAt,
        payload: {
          employeeCode: code,
          employeeName: name,
          sourceRecordId,
          deviceToken,
          embedding: capture.embedding,
          referencePhoto: capture.photo,
          enrolledAt,
        },
      };
      await storePut("queue", queueItem);
      const result = await sendQueueItem(queueItem);
      await refreshLocalState(code);

      if (result.ok) {
        setStatus("Rosto cadastrado com sucesso. Seu acesso ao ponto está liberado.");
        setStatusKind("success");
      } else if (result.networkError) {
        setStatus(`${OFFLINE_ENROLL_MESSAGE} O acesso ao ponto já foi liberado neste celular.`);
        setStatusKind("warning");
      } else {
        setStatus(result.error);
        setStatusKind("error");
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível cadastrar o rosto.");
      setStatusKind("error");
    } finally {
      stopCamera();
      setBusy(false);
    }
  };

  const punch = async () => {
    if (!profile) {
      setStatus("Cadastre o rosto deste colaborador antes de bater o ponto.");
      setStatusKind("error");
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
        throw new Error("O rosto capturado não corresponde ao cadastro deste colaborador.");
      }

      setStatus("Rosto confirmado. Obtendo a localização da batida...");
      setStatusKind("info");
      const position = await readLocation();
      const occurredAt = new Date().toISOString();
      const clientEventId = crypto.randomUUID();
      const timezone = currentTimezone();
      const nextEvent: PunchEvent = {
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
        evidencePhoto: capture.photo,
        onlineAtCapture: navigator.onLine,
        syncStatus: "pending",
      };
      await storePut("events", nextEvent);

      const queueItem: QueueItem = {
        id: clientEventId,
        kind: "punch",
        endpoint: `${window.location.origin}/api/time-clock?action=punch`,
        createdAt: occurredAt,
        payload: {
          clientEventId,
          employeeCode: profile.employeeCode,
          deviceToken: profile.deviceToken,
          eventType,
          occurredAt,
          timezone,
          timezoneOffsetMinutes: nextEvent.timezoneOffsetMinutes,
          latitude: nextEvent.latitude,
          longitude: nextEvent.longitude,
          accuracy: nextEvent.accuracy,
          embedding: capture.embedding,
          evidencePhoto: capture.photo,
          livenessScore: capture.livenessScore,
          onlineAtCapture: nextEvent.onlineAtCapture,
        },
      };
      await storePut("queue", queueItem);
      await refreshLocalState(profile.employeeCode);
      const result = await sendQueueItem(queueItem);
      await refreshLocalState(profile.employeeCode);

      const time = formatClock(new Date(occurredAt));
      if (result.ok) {
        setStatus(`Ponto registrado às ${time}.`);
        setStatusKind("success");
      } else if (result.networkError) {
        setStatus(`${OFFLINE_PUNCH_MESSAGE} Horário registrado: ${time}.`);
        setStatusKind("warning");
      } else {
        setStatus(result.error);
        setStatusKind("error");
      }
    } catch (error) {
      const message =
        error instanceof GeolocationPositionError
          ? "Autorize a localização do celular para registrar o ponto."
          : error instanceof Error
            ? error.message
            : "Não foi possível registrar o ponto.";
      setStatus(message);
      setStatusKind("error");
    } finally {
      stopCamera();
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    try {
      const result = await syncQueue();
      await refreshLocalState();
      setStatus(
        result.total === 0
          ? "Não há registros pendentes neste celular."
          : `${result.synced} de ${result.total} registro(s) sincronizado(s).`,
      );
      setStatusKind(result.synced === result.total ? "success" : "warning");
    } finally {
      setBusy(false);
    }
  };

  const installApp = async () => {
    if (!installPrompt) {
      setStatus("No celular, use o menu do navegador e escolha “Adicionar à tela inicial”.");
      setStatusKind("info");
      return;
    }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const statusClass = `status status-${statusKind}`;

  return (
    <main className="clock-page">
      <style>{`
        * { box-sizing: border-box; }
        html { background: #eef3f9; }
        body { margin: 0; }
        .clock-page { min-height: 100dvh; padding: 20px; color: #12213d; background: radial-gradient(circle at top right, #dbeafe 0, transparent 36%), #eef3f9; }
        .shell { width: min(100%, 980px); margin: 0 auto; }
        .topbar { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 18px; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-mark { width: 48px; height: 48px; border-radius: 15px; display: grid; place-items: center; background: #0b2b5f; color: white; font-weight: 900; font-size: 20px; box-shadow: 0 10px 28px rgba(11,43,95,.22); }
        .brand h1 { margin: 0; font-size: clamp(21px, 4vw, 30px); color: #0b2b5f; }
        .brand p { margin: 3px 0 0; color: #52627b; font-size: 14px; }
        .top-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .pill { border-radius: 999px; padding: 9px 13px; font-size: 13px; font-weight: 800; border: 1px solid #c8d5e6; background: white; color: #243b5e; }
        .pill.online { color: #166534; background: #ecfdf3; border-color: #bbf7d0; }
        .pill.offline { color: #9a3412; background: #fff7ed; border-color: #fed7aa; }
        button, input, select { font: inherit; }
        button { cursor: pointer; }
        button:disabled { cursor: not-allowed; opacity: .58; }
        .grid { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(300px, .85fr); gap: 18px; align-items: start; }
        .card { background: rgba(255,255,255,.96); border: 1px solid #d8e2ef; border-radius: 22px; box-shadow: 0 16px 45px rgba(31,55,88,.08); padding: 20px; }
        .clock-card { background: linear-gradient(145deg, #071d45, #123c76); color: white; overflow: hidden; position: relative; }
        .clock-card:after { content: ''; position: absolute; width: 220px; height: 220px; border-radius: 50%; right: -100px; top: -115px; background: rgba(255,255,255,.08); }
        .date { font-size: 14px; color: #cfe0f9; text-transform: capitalize; }
        .time { font-size: clamp(46px, 11vw, 82px); line-height: 1; letter-spacing: -3px; font-weight: 900; margin: 10px 0 8px; font-variant-numeric: tabular-nums; }
        .clock-note { color: #d9e7fb; font-size: 14px; }
        .section-title { margin: 0 0 14px; color: #0b2b5f; font-size: 18px; }
        .field { display: grid; gap: 6px; margin-bottom: 13px; }
        .field label { font-size: 13px; font-weight: 800; color: #445571; }
        .field input, .field select { width: 100%; border: 1px solid #cbd8e7; background: #fff; color: #172b4d; border-radius: 12px; padding: 12px 13px; outline: none; }
        .field input:focus, .field select:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.13); }
        .status { margin: 15px 0; border-radius: 14px; padding: 13px 14px; font-size: 14px; line-height: 1.4; border: 1px solid; }
        .status-info { color: #1e3a5f; background: #eff6ff; border-color: #bfdbfe; }
        .status-success { color: #14532d; background: #ecfdf3; border-color: #bbf7d0; }
        .status-warning { color: #9a3412; background: #fff7ed; border-color: #fed7aa; }
        .status-error { color: #991b1b; background: #fef2f2; border-color: #fecaca; }
        .camera-wrap { position: relative; aspect-ratio: 1 / 1; border-radius: 20px; overflow: hidden; background: #071426; border: 1px solid #263d5c; margin-bottom: 14px; }
        .camera-wrap video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        .camera-guide { position: absolute; inset: 13%; border: 3px solid rgba(255,255,255,.82); border-radius: 50% 50% 46% 46%; box-shadow: 0 0 0 999px rgba(1,8,20,.32); pointer-events: none; }
        .camera-placeholder { height: 100%; display: grid; place-items: center; text-align: center; padding: 30px; color: #b9c9df; }
        .camera-placeholder strong { display: block; color: white; font-size: 18px; margin-bottom: 7px; }
        .primary { width: 100%; border: 0; border-radius: 14px; padding: 14px 16px; background: #1264d5; color: white; font-weight: 900; box-shadow: 0 10px 25px rgba(18,100,213,.24); }
        .primary.enroll { background: #0b7a50; box-shadow: 0 10px 25px rgba(11,122,80,.22); }
        .secondary { border: 1px solid #cbd8e7; border-radius: 12px; padding: 10px 13px; background: white; color: #1f3b63; font-weight: 800; text-decoration: none; }
        .button-row { display: flex; gap: 10px; margin-top: 10px; }
        .button-row > * { flex: 1; }
        .profile-ok { display: flex; gap: 12px; align-items: center; padding: 12px; border-radius: 15px; background: #ecfdf3; border: 1px solid #bbf7d0; margin-bottom: 14px; }
        .profile-photo { width: 58px; height: 58px; border-radius: 50%; object-fit: cover; border: 3px solid white; box-shadow: 0 3px 12px rgba(0,0,0,.12); }
        .profile-ok strong { display: block; color: #14532d; }
        .profile-ok small { color: #397154; }
        .history { margin-top: 18px; }
        .history-list { display: grid; gap: 9px; }
        .history-item { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; border: 1px solid #dbe5f0; border-radius: 13px; padding: 11px 12px; background: #fbfdff; }
        .history-item strong { display: block; font-size: 14px; color: #19365d; }
        .history-item small { color: #61718a; }
        .sync { font-size: 11px; font-weight: 900; border-radius: 999px; padding: 6px 8px; text-transform: uppercase; }
        .sync-synced { color: #166534; background: #dcfce7; }
        .sync-pending { color: #9a3412; background: #ffedd5; }
        .sync-rejected { color: #991b1b; background: #fee2e2; }
        .empty { color: #64748b; font-size: 14px; padding: 12px 0; }
        .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 15px; }
        .step { border-radius: 12px; background: #f5f8fc; border: 1px solid #dbe5f0; padding: 10px; font-size: 12px; color: #52627b; }
        .step b { display: block; color: #0b2b5f; margin-bottom: 3px; }
        .footer-note { margin-top: 18px; color: #63738b; font-size: 12px; text-align: center; }
        canvas { display: none; }
        @media (max-width: 780px) {
          .clock-page { padding: 12px; }
          .topbar { align-items: flex-start; }
          .top-actions { max-width: 145px; }
          .grid { grid-template-columns: 1fr; }
          .card { padding: 16px; border-radius: 18px; }
          .time { letter-spacing: -2px; }
          .steps { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">B</div>
            <div>
              <h1>Beta Ponto</h1>
              <p>Cadastro facial e registro móvel</p>
            </div>
          </div>
          <div className="top-actions">
            <span className={`pill ${online ? "online" : "offline"}`}>
              {online ? "● Online" : "● Offline"}
            </span>
            <button className="pill" type="button" onClick={installApp}>
              Instalar PWA
            </button>
          </div>
        </header>

        <section className="card clock-card">
          <div className="date">
            {new Intl.DateTimeFormat("pt-BR", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              year: "numeric",
            }).format(clock)}
          </div>
          <div className="time">{formatClock(clock)}</div>
          <div className="clock-note">
            O horário real da batida é preservado mesmo quando a sincronização ocorre depois.
          </div>
        </section>

        <div className="grid" style={{ marginTop: 18 }}>
          <section className="card">
            <h2 className="section-title">1. Identificação do colaborador</h2>
            {employees.length > 0 && (
              <div className="field">
                <label htmlFor="employee-select">Cadastro existente no sistema</label>
                <select
                  id="employee-select"
                  value={employees.some((employee) => employee.code === normalizedEmployeeCode) ? normalizedEmployeeCode : ""}
                  onChange={(event) => chooseEmployee(event.target.value)}
                >
                  <option value="">Selecione um colaborador</option>
                  {employees.map((employee) => (
                    <option key={`${employee.sourceRecordId}-${employee.code}`} value={employee.code}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="field">
              <label htmlFor="employee-name">Nome</label>
              <input
                id="employee-name"
                value={employeeName}
                onChange={(event) => setEmployeeName(event.target.value)}
                placeholder="Nome do colaborador de teste"
                autoComplete="name"
              />
            </div>
            <div className="field">
              <label htmlFor="employee-code">Código, matrícula ou CPF</label>
              <input
                id="employee-code"
                value={employeeCode}
                onChange={(event) => setEmployeeCode(normalizeCode(event.target.value))}
                placeholder="Ex.: TESTE001"
                autoCapitalize="characters"
              />
            </div>

            {profile && (
              <div className="profile-ok">
                <img className="profile-photo" src={profile.referencePhoto} alt="Rosto cadastrado" />
                <div>
                  <strong>Cadastro facial ativo</strong>
                  <small>
                    {profile.employeeName} · {profile.syncStatus === "synced" ? "sincronizado" : "salvo neste celular"}
                  </small>
                </div>
              </div>
            )}

            <div className={statusClass} role="status" aria-live="polite">
              {status}
            </div>

            {!profile ? (
              <button className="primary enroll" type="button" disabled={busy} onClick={enrollFace}>
                {busy ? "Validando rosto..." : "Cadastrar rosto e liberar ponto"}
              </button>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="event-type">Tipo da batida</label>
                  <select id="event-type" value={eventType} onChange={(event) => setEventType(event.target.value)}>
                    <option value="ENTRADA">Entrada</option>
                    <option value="INICIO_INTERVALO">Início do intervalo</option>
                    <option value="FIM_INTERVALO">Fim do intervalo</option>
                    <option value="SAIDA">Saída</option>
                  </select>
                </div>
                <button className="primary" type="button" disabled={busy} onClick={punch}>
                  {busy ? "Confirmando identidade..." : `Bater ponto agora · ${formatClock(clock)}`}
                </button>
              </>
            )}

            <div className="button-row">
              <button className="secondary" type="button" disabled={busy} onClick={syncNow}>
                Sincronizar agora
              </button>
              <a className="secondary" href="/">
                Área administrativa
              </a>
            </div>

            <div className="steps">
              <div className="step"><b>Cadastro único</b>Rosto e celular ficam vinculados ao colaborador.</div>
              <div className="step"><b>Batida diária</b>Selfie, prova de vida, horário e localização.</div>
              <div className="step"><b>Sem internet</b>Fila local e envio posterior por clientEventId.</div>
            </div>
          </section>

          <aside className="card">
            <h2 className="section-title">Câmera e prova de vida</h2>
            <div className="camera-wrap">
              <video ref={videoRef} muted playsInline />
              {cameraActive ? (
                <div className="camera-guide" />
              ) : (
                <div className="camera-placeholder">
                  <div>
                    <strong>Câmera frontal</strong>
                    A imagem aparecerá somente durante o cadastro ou a batida.
                  </div>
                </div>
              )}
            </div>
            <canvas ref={canvasRef} />

            <div className="history">
              <h2 className="section-title">Batidas neste celular</h2>
              <div className="history-list">
                {events.length === 0 ? (
                  <div className="empty">Nenhuma batida registrada para este colaborador.</div>
                ) : (
                  events.slice(0, 10).map((event) => (
                    <div className="history-item" key={event.clientEventId}>
                      <div>
                        <strong>{eventLabel(event.eventType)}</strong>
                        <small>{formatDateTime(event.occurredAt)}</small>
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
                )}
              </div>
            </div>
          </aside>
        </div>

        <p className="footer-note">
          Beta Construtora · Ambiente operacional de teste do ponto eletrônico
        </p>
      </div>
    </main>
  );
}
