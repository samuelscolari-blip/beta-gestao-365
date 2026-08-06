"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const GOOGLE_CLIENT_ID =
  "1029361062935-9kd7sr8srn91vu9r4ekt0fjudfqbv1pk.apps.googleusercontent.com";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentityApi = {
  accounts: {
    id: {
      initialize(config: {
        client_id: string;
        callback(response: GoogleCredentialResponse): void;
        ux_mode?: "popup" | "redirect";
      }): void;
      renderButton(
        parent: HTMLElement,
        options: {
          type?: "standard" | "icon";
          theme?: "outline" | "filled_blue" | "filled_black";
          size?: "large" | "medium" | "small";
          text?: "signin_with" | "continue_with" | "signin";
          shape?: "rectangular" | "pill" | "circle" | "square";
          locale?: string;
          width?: number;
        },
      ): void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

type Props = {
  message?: string;
};

export default function SupervisorLoginGate({ message = "" }: Props) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const initializedGoogle = useRef(false);
  const [registration, setRegistration] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(message);
  const [feedbackType, setFeedbackType] = useState<
    "info" | "error" | "success"
  >(message ? "info" : "info");

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      const credential = String(response.credential || "").trim();
      if (!credential) {
        setFeedback("O Google não retornou uma credencial válida.");
        setFeedbackType("error");
        return;
      }

      setBusy(true);
      setFeedback("Validando o acesso do administrador...");
      setFeedbackType("info");
      try {
        const loginResponse = await fetch("/admin-google-login", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ credential }),
        });
        const body = (await loginResponse.json().catch(() => ({}))) as {
          message?: string;
        };
        if (!loginResponse.ok) {
          throw new Error(
            body.message || "Esta conta não possui acesso administrativo.",
          );
        }
        window.location.replace("/");
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? error.message
            : "Não foi possível concluir o acesso administrativo.",
        );
        setFeedbackType("error");
        setBusy(false);
      }
    },
    [],
  );

  const initializeGoogle = useCallback(() => {
    if (!window.google || !googleButtonRef.current) return;
    if (!initializedGoogle.current) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        ux_mode: "popup",
      });
      initializedGoogle.current = true;
    }
    googleButtonRef.current.replaceChildren();
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      locale: "pt_BR",
      width: 300,
    });
  }, [handleGoogleCredential]);

  useEffect(() => {
    const selector = 'script[data-beta-supervisor-google="true"]';
    const existing = document.querySelector<HTMLScriptElement>(selector);
    const ready = () => initializeGoogle();
    const failed = () => {
      setFeedback("Não foi possível carregar o acesso Google.");
      setFeedbackType("error");
    };

    if (existing) {
      if (window.google) ready();
      else {
        existing.addEventListener("load", ready, { once: true });
        existing.addEventListener("error", failed, { once: true });
      }
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client?hl=pt-BR";
      script.async = true;
      script.defer = true;
      script.dataset.betaSupervisorGoogle = "true";
      script.addEventListener("load", ready, { once: true });
      script.addEventListener("error", failed, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      existing?.removeEventListener("load", ready);
      existing?.removeEventListener("error", failed);
    };
  }, [initializeGoogle]);

  async function loginSupervisor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("Conferindo a identidade do encarregado...");
    setFeedbackType("info");

    try {
      const response = await fetch("/api/staff-login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ registration, password }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
        user?: { name?: string };
      };
      if (!response.ok) {
        throw new Error(body.message || "Matrícula ou senha inválida.");
      }
      setFeedback(
        `${body.user?.name || "Encarregado"} identificado. Abrindo a seleção de colaboradores...`,
      );
      setFeedbackType("success");
      window.location.replace("/acesso-ponto");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Não foi possível entrar.",
      );
      setFeedbackType("error");
      setBusy(false);
    }
  }

  return (
    <main className="supervisor-page">
      <style>{`
        * { box-sizing: border-box; }
        html { background: #edf3fa; }
        body { margin: 0; }
        .supervisor-page { min-height: 100dvh; display: grid; place-items: center; padding: 20px; color: #152b4d; background: radial-gradient(circle at 90% 5%, #dbeafe 0, transparent 34%), radial-gradient(circle at 10% 95%, #d1fae5 0, transparent 29%), #edf3fa; }
        .supervisor-shell { width: min(100%, 940px); display: grid; grid-template-columns: .9fr 1.1fr; border: 1px solid #d4e0ee; border-radius: 26px; overflow: hidden; background: rgba(255,255,255,.97); box-shadow: 0 28px 80px rgba(22,50,88,.17); }
        .supervisor-brand { padding: 34px; color: white; background: linear-gradient(150deg, #071d45, #123f7c); display: flex; flex-direction: column; justify-content: space-between; min-height: 560px; }
        .supervisor-logo { width: 62px; height: 62px; border-radius: 19px; display: grid; place-items: center; background: white; color: #0b2b5f; font-size: 29px; font-weight: 950; box-shadow: 0 12px 30px rgba(0,0,0,.18); }
        .supervisor-brand h1 { margin: 25px 0 10px; font-size: clamp(31px, 5vw, 46px); line-height: 1.04; }
        .supervisor-brand p { color: #d6e5fa; font-size: 15px; line-height: 1.55; margin: 0; }
        .security-list { display: grid; gap: 10px; margin-top: 30px; }
        .security-list div { padding: 12px 13px; border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.08); border-radius: 13px; font-size: 13px; color: #e6f0ff; }
        .supervisor-card { padding: 34px; display: flex; flex-direction: column; justify-content: center; }
        .supervisor-card > small { color: #1264d5; font-weight: 900; letter-spacing: .08em; }
        .supervisor-card h2 { margin: 8px 0 7px; color: #0b2b5f; font-size: 28px; }
        .supervisor-card > p { margin: 0 0 20px; color: #63748b; line-height: 1.45; }
        .supervisor-form { display: grid; gap: 13px; }
        .field { display: grid; gap: 6px; }
        label { color: #405571; font-size: 13px; font-weight: 850; }
        input { width: 100%; border: 1px solid #c9d6e6; border-radius: 12px; padding: 13px 14px; color: #172b4d; background: white; outline: none; font-size: 16px; }
        input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.13); }
        .password-wrap { position: relative; }
        .password-wrap input { padding-right: 84px; }
        .password-toggle { position: absolute; right: 8px; top: 7px; bottom: 7px; border: 0; border-radius: 9px; padding: 0 10px; background: #edf4fc; color: #24446d; font-weight: 850; cursor: pointer; }
        .login-button { border: 0; border-radius: 13px; padding: 14px; color: white; background: #1264d5; font-weight: 900; cursor: pointer; box-shadow: 0 11px 26px rgba(18,100,213,.24); }
        button:disabled { opacity: .6; cursor: not-allowed; }
        .feedback { margin: 14px 0 0; padding: 11px 12px; border: 1px solid; border-radius: 12px; font-size: 13px; line-height: 1.4; }
        .feedback-info { color: #1e3a5f; background: #eff6ff; border-color: #bfdbfe; }
        .feedback-error { color: #991b1b; background: #fef2f2; border-color: #fecaca; }
        .feedback-success { color: #14532d; background: #ecfdf3; border-color: #bbf7d0; }
        .divider { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin: 23px 0 17px; color: #8b99ab; font-size: 12px; font-weight: 800; }
        .divider::before, .divider::after { content: ""; height: 1px; background: #dce5ef; }
        .admin-area { display: grid; gap: 9px; }
        .admin-area strong { color: #314968; font-size: 13px; }
        .google-button { min-height: 44px; }
        .footnote { margin-top: 18px !important; font-size: 12px; color: #78879a !important; }
        @media (max-width: 760px) {
          .supervisor-page { padding: 10px; place-items: start center; }
          .supervisor-shell { grid-template-columns: 1fr; border-radius: 20px; }
          .supervisor-brand { min-height: auto; padding: 24px; }
          .security-list { display: none; }
          .supervisor-card { padding: 24px; }
        }
      `}</style>

      <div className="supervisor-shell">
        <section className="supervisor-brand">
          <div>
            <div className="supervisor-logo">B</div>
            <h1>Beta Gestão 365</h1>
            <p>
              Primeira camada de segurança do ponto. Somente um encarregado
              identificado pode avançar para a seleção dos colaboradores.
            </p>
          </div>
          <div className="security-list">
            <div>✓ Matrícula formada pelos cinco primeiros dígitos do CPF</div>
            <div>✓ Senha individual do encarregado</div>
            <div>✓ Segunda confirmação pela senha master</div>
          </div>
        </section>

        <section className="supervisor-card">
          <small>ETAPA 1 DE 2</small>
          <h2>Identificar o encarregado</h2>
          <p>
            Digite os cinco primeiros dígitos do seu CPF e sua senha individual.
          </p>

          <form className="supervisor-form" onSubmit={loginSupervisor}>
            <div className="field">
              <label htmlFor="supervisor-registration">Matrícula do encarregado</label>
              <input
                id="supervisor-registration"
                value={registration}
                onChange={(event) =>
                  setRegistration(event.target.value.replace(/\D/g, "").slice(0, 5))
                }
                inputMode="numeric"
                autoComplete="username"
                placeholder="5 primeiros dígitos do CPF"
                minLength={5}
                maxLength={5}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="supervisor-password">Senha individual</label>
              <div className="password-wrap">
                <input
                  id="supervisor-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
            <button className="login-button" type="submit" disabled={busy}>
              {busy ? "Validando encarregado..." : "Continuar para os colaboradores"}
            </button>
          </form>

          {feedback ? (
            <p className={`feedback feedback-${feedbackType}`} role="status">
              {feedback}
            </p>
          ) : null}

          <div className="divider">ADMINISTRADOR</div>
          <div className="admin-area">
            <strong>Samuel Scolari — conta Google autorizada</strong>
            <div ref={googleButtonRef} className="google-button" />
          </div>
          <p className="footnote">
            Após esta etapa, o encarregado ainda precisará informar a senha
            master para liberar o ponto dos colaboradores.
          </p>
        </section>
      </div>
    </main>
  );
}
