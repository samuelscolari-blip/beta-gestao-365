"use client";

import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SecureBetaAppV65 from "./SecureBetaAppV65";
import {
  approvedDecisionAmount,
  approvedDecisionModuleLabels,
  approvedDecisionModules,
  isApprovedDecision,
} from "../lib/approved-decisions";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback(response: GoogleCredentialResponse): void;
        ux_mode?: "popup" | "redirect";
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type?: "standard" | "icon";
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "large" | "medium" | "small";
          text?: "signin_with" | "signup_with" | "continue_with" | "signin";
          shape?: "rectangular" | "pill" | "circle" | "square";
          logo_alignment?: "left" | "center";
          locale?: string;
          width?: number;
        },
      ): void;
      prompt(): void;
      cancel(): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

type RecordView = {
  id: number;
  module: string;
  title: string;
  reference: string;
  status: string;
  recordDate: string;
  amount: number;
  payload: Record<string, unknown>;
  source: string;
  updatedAt?: string;
};

type PortalTargets = {
  center: HTMLElement | null;
  overview: HTMLElement | null;
  tabs: HTMLElement | null;
};

const GOOGLE_CLIENT_ID =
  "1029361062935-9kd7sr8srn91vu9r4ekt0fjudfqbv1pk.apps.googleusercontent.com";
const REMEMBERED_ADMIN_KEY = "beta-admin-device-v69";
const ADMIN_REQUIRED_EVENT = "beta:admin-required";

const decisionModules = approvedDecisionModules;
const moduleLabels = approvedDecisionModuleLabels;

function normalized(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isApproved(record: RecordView) {
  return isApprovedDecision(record);
}

function recordAmount(record: RecordView) {
  return approvedDecisionAmount(record);
}

function evidenceUrl(record: RecordView) {
  return String(
    record.payload.receiptUrl ||
      record.payload.invoiceUrl ||
      record.payload.documentUrl ||
      record.payload.documentsUrl ||
      "",
  ).trim();
}

function decisionOwner(record: RecordView) {
  return String(
    record.payload.managementDecisionBy ||
      record.payload.approvedBy ||
      record.payload.responsible ||
      record.payload.requester ||
      "Não informado",
  ).trim();
}

function decisionDate(record: RecordView) {
  const raw = String(
    record.payload.managementDecisionAt ||
      record.payload.approvalDate ||
      record.updatedAt ||
      record.recordDate ||
      "",
  );
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? "Data não informada"
    : new Intl.DateTimeFormat("pt-BR").format(date);
}

function AdminAccessControl({ isAdmin }: Props) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  const openLogin = useCallback(() => {
    if (!isAdmin) setIsOpen(true);
  }, [isAdmin]);

  const handleCredential = useCallback(
    async (credentialResponse: GoogleCredentialResponse) => {
      const credential = String(credentialResponse.credential || "").trim();
      if (!credential) {
        setMessage("O Google não retornou uma credencial válida.");
        return;
      }

      setIsLoading(true);
      setMessage("Validando sua conta Google...");

      try {
        const response = await fetch("/admin-google-login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential }),
        });

        let body: { message?: string } = {};
        try {
          body = (await response.json()) as { message?: string };
        } catch {
          body = {};
        }

        if (!response.ok) {
          throw new Error(
            body.message || "Não foi possível concluir o acesso administrativo.",
          );
        }

        window.localStorage.setItem(REMEMBERED_ADMIN_KEY, "1");
        window.location.replace("/");
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível concluir o login com Google.",
        );
        setIsLoading(false);
      }
    },
    [],
  );

  const initializeGoogle = useCallback(
    (attemptAutomaticLogin = false) => {
      if (!window.google) return;

      if (!initializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredential,
          ux_mode: "popup",
          auto_select: true,
          cancel_on_tap_outside: true,
        });
        initializedRef.current = true;
      }

      if (googleButtonRef.current) {
        googleButtonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
          shape: "rectangular",
          logo_alignment: "left",
          locale: "pt_BR",
          width: 260,
        });
      }

      if (attemptAutomaticLogin) {
        window.google.accounts.id.prompt();
      }
    },
    [handleCredential],
  );

  useEffect(() => {
    const url = new URL(window.location.href);
    const state = url.searchParams.get("admin");

    if (isAdmin) {
      window.localStorage.setItem(REMEMBERED_ADMIN_KEY, "1");
    } else if (state === "expirado") {
      window.localStorage.removeItem(REMEMBERED_ADMIN_KEY);
      setMessage("O acesso administrativo foi encerrado neste navegador.");
    } else if (state === "nao-autorizado") {
      setMessage("Esta conta Google não possui acesso administrativo.");
      setIsOpen(true);
    } else if (state === "configuracao-pendente") {
      setMessage("Entre novamente com a conta Google autorizada.");
      setIsOpen(true);
    }

    if (state) {
      url.searchParams.delete("admin");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [isAdmin]);

  useEffect(() => {
    const decorateAvatar = () => {
      const avatar = document.querySelector<HTMLElement>(".top-avatar");
      if (!avatar) return;

      avatar.dataset.adminEntry = isAdmin ? "active" : "login";
      avatar.title = isAdmin
        ? "Administrador autenticado"
        : "Entrar como administrador";

      if (isAdmin) {
        avatar.removeAttribute("role");
        avatar.removeAttribute("tabindex");
      } else {
        avatar.setAttribute("role", "button");
        avatar.setAttribute("tabindex", "0");
        avatar.setAttribute("aria-label", "Entrar como administrador");
      }
    };

    const handleClick = (event: Event) => {
      const target = event.target as Element | null;
      if (!isAdmin && target?.closest(".top-avatar")) openLogin();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (
        !isAdmin &&
        target?.closest(".top-avatar") &&
        (event.key === "Enter" || event.key === " ")
      ) {
        event.preventDefault();
        openLogin();
      }
      if (event.key === "Escape") setIsOpen(false);
    };

    const handleAdminRequired = () => openLogin();

    decorateAvatar();
    const observer = new MutationObserver(decorateAvatar);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener(ADMIN_REQUIRED_EVENT, handleAdminRequired);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener(ADMIN_REQUIRED_EVENT, handleAdminRequired);
    };
  }, [isAdmin, openLogin]);

  useEffect(() => {
    if (isAdmin) return;

    let disposed = false;
    const scriptSelector = 'script[data-beta-google-identity="true"]';
    const shouldAttemptAutomaticLogin =
      window.localStorage.getItem(REMEMBERED_ADMIN_KEY) === "1";

    const handleScriptReady = () => {
      if (!disposed) initializeGoogle(shouldAttemptAutomaticLogin);
    };
    const handleScriptError = () => {
      if (!disposed) {
        setMessage("Não foi possível carregar o login do Google.");
      }
    };

    const existingScript =
      document.querySelector<HTMLScriptElement>(scriptSelector);
    if (existingScript) {
      if (window.google) {
        handleScriptReady();
      } else {
        existingScript.addEventListener("load", handleScriptReady, { once: true });
        existingScript.addEventListener("error", handleScriptError, { once: true });
      }
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client?hl=pt-BR";
      script.async = true;
      script.defer = true;
      script.dataset.betaGoogleIdentity = "true";
      script.addEventListener("load", handleScriptReady, { once: true });
      script.addEventListener("error", handleScriptError, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      disposed = true;
      existingScript?.removeEventListener("load", handleScriptReady);
      existingScript?.removeEventListener("error", handleScriptError);
      window.google?.accounts.id.cancel();
    };
  }, [initializeGoogle, isAdmin]);

  useEffect(() => {
    if (!isOpen || isAdmin) return;
    initializeGoogle(false);
  }, [initializeGoogle, isAdmin, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (isAdmin || !isOpen) return null;

  return createPortal(
    <div
      className="v69-admin-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="v69-admin-title"
      data-v69-admin-login="open"
    >
      <button
        type="button"
        className="v69-admin-backdrop"
        aria-label="Fechar acesso administrativo"
        onClick={() => setIsOpen(false)}
      />
      <section className="v69-admin-card">
        <button
          type="button"
          className="v69-admin-close"
          aria-label="Fechar"
          onClick={() => setIsOpen(false)}
        >
          ×
        </button>
        <span className="v69-admin-icon" aria-hidden="true">G</span>
        <div className="v69-admin-copy">
          <small>ÁREA RESTRITA</small>
          <h2 id="v69-admin-title">Acesso administrativo</h2>
          <p>
            Entre com a conta Google autorizada. Este navegador ficará
            reconhecido por 30 dias, sem exibir avisos permanentes na tela.
          </p>
        </div>
        <div className="v69-google-login" aria-busy={isLoading}>
          <div ref={googleButtonRef} aria-label="Entrar com Google" />
          {isLoading ? <span>Validando sua conta...</span> : null}
        </div>
        {message ? <p className="v69-admin-message">{message}</p> : null}
        <small className="v69-admin-security">
          O acesso continua protegido e liberado somente para a conta
          administrativa cadastrada.
        </small>
      </section>
    </div>,
    document.body,
  );
}

function ApprovedDecisionFallback() {
  const [targets, setTargets] = useState<PortalTargets>({
    center: null,
    overview: null,
    tabs: null,
  });
  const [records, setRecords] = useState<RecordView[]>([]);
  const [showApproved, setShowApproved] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { records?: RecordView[] };
      setRecords(Array.isArray(body.records) ? body.records : []);
    } catch {
      // A tela principal permanece utilizável se a consulta auxiliar falhar.
    }
  }, []);

  useEffect(() => {
    const locate = () => {
      const center = document.querySelector<HTMLElement>(".management-center");
      const overview =
        center?.querySelector<HTMLElement>(".management-overview") || null;
      const tabs =
        center?.querySelector<HTMLElement>(".management-tabs") || null;

      setTargets((current) =>
        current.center === center &&
        current.overview === overview &&
        current.tabs === tabs
          ? current
          : { center, overview, tabs },
      );
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const center = targets.center;
    if (!center) return;

    center.classList.toggle("v65-show-approved", showApproved);
    const closeApproved = (event: Event) => {
      const element = event.target as Element | null;
      if (
        element?.closest(
          ".management-tabs button:not(.v66-approved-tab)",
        )
      ) {
        setShowApproved(false);
      }
    };

    center.addEventListener("click", closeApproved);
    return () => {
      center.classList.remove("v65-show-approved");
      center.removeEventListener("click", closeApproved);
    };
  }, [showApproved, targets.center]);

  const approved = useMemo(
    () =>
      records
        .filter(
          (record) =>
            decisionModules.has(record.module) &&
            isApproved(record),
        )
        .sort((a, b) =>
          String(b.updatedAt || b.recordDate).localeCompare(
            String(a.updatedAt || a.recordDate),
          ),
        ),
    [records],
  );

  const overviewPortal = targets.overview
    ? createPortal(
        <article
          className="approved v65-approved-overview v66-approved-overview"
          data-v66-approved="overview"
        >
          <span aria-hidden="true">✓</span>
          <div>
            <small>Aprovados</small>
            <strong>{approved.length}</strong>
            <em>com decisão registrada</em>
          </div>
        </article>,
        targets.overview,
      )
    : null;

  const tabPortal = targets.tabs
    ? createPortal(
        <button
          type="button"
          className={`v65-approved-tab v66-approved-tab ${
            showApproved ? "active" : ""
          }`}
          data-v66-approved="tab"
          onClick={() => setShowApproved(true)}
        >
          Aprovados <span>{approved.length}</span>
        </button>,
        targets.tabs,
      )
    : null;

  const listPortal = targets.center && showApproved
    ? createPortal(
        <div
          className="v65-approved-list"
          data-v66-approved="list"
          aria-live="polite"
        >
          {approved.length ? (
            approved.slice(0, 12).map((record) => {
              const proof = evidenceUrl(record);
              return (
                <article className="v65-approved-row" key={record.id}>
                  <span className="v65-approved-mark" aria-hidden="true">✓</span>
                  <div className="v65-approved-main">
                    <strong>{record.title}</strong>
                    <small>
                      {moduleLabels[record.module] || record.module} • Responsável: {decisionOwner(record)}
                    </small>
                    <em>Decisão registrada em {decisionDate(record)}</em>
                  </div>
                  <div className="v65-approved-value">
                    <strong>
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(recordAmount(record))}
                    </strong>
                    <small>Aprovado</small>
                  </div>
                  {proof ? (
                    <a href={proof} target="_blank" rel="noreferrer">
                      Ver documento ↗
                    </a>
                  ) : (
                    <span className="v65-no-proof">Sem documento vinculado</span>
                  )}
                </article>
              );
            })
          ) : (
            <div className="v65-approved-empty">
              <span aria-hidden="true">✓</span>
              <strong>Nenhuma decisão aprovada registrada</strong>
              <p>
                Quando um pedido real for aprovado, ele aparecerá aqui com
                responsável, data, valor e documento.
              </p>
            </div>
          )}
        </div>,
        targets.center,
      )
    : null;

  return <>{overviewPortal}{tabPortal}{listPortal}</>;
}

export default function SecureBetaAppV66(props: Props) {
  return (
    <>
      <SecureBetaAppV65 {...props} />
      {!props.isAdmin ? <ApprovedDecisionFallback /> : null}
      <AdminAccessControl {...props} />
    </>
  );
}
