"use client";

import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import SecureBetaAppV100 from "./SecureBetaAppV100";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
  accessRole?: "administrador" | "encarregado";
  employeeCode?: string;
};

function peopleScreenIsVisible() {
  return Boolean(
    document.querySelector(
      '[data-ui="module-header"][data-module="people"]',
    ),
  );
}

export default function SecureBetaAppV131({
  userName,
  userEmail,
  isAdmin,
  accessRole = isAdmin ? "administrador" : "encarregado",
  employeeCode = "",
}: Props) {
  const [showPeopleActions, setShowPeopleActions] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useLayoutEffect(() => {
    let frame = 0;
    const refresh = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setShowPeopleActions(peopleScreenIsVisible());
      });
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-module"],
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  async function logoutStaff() {
    setLoggingOut(true);
    try {
      await fetch("/api/staff-logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      window.location.replace("/acesso?message=Sessão encerrada neste celular.");
    }
  }

  return (
    <>
      <SecureBetaAppV100
        userName={userName}
        userEmail={userEmail}
        isAdmin={isAdmin}
      />

      <style>{`
        .v131-session-card,
        .v131-people-actions {
          position: fixed;
          z-index: 1300;
          padding: 15px;
          border: 1px solid #bfd4ec;
          border-radius: 18px;
          background: rgba(255,255,255,.98);
          box-shadow: 0 18px 50px rgba(20,48,84,.2);
          color: #17345c;
        }
        .v131-session-card {
          left: 20px;
          bottom: 18px;
          width: min(430px, calc(100vw - 40px));
          display: grid;
          grid-template-columns: minmax(0,1fr) auto;
          gap: 12px;
          align-items: center;
        }
        .v131-people-actions {
          right: 28px;
          bottom: 24px;
          width: min(390px, calc(100vw - 32px));
        }
        .v131-session-card strong,
        .v131-people-actions strong {
          display: block;
          color: #0b2b5f;
          font-size: 15px;
          margin-bottom: 3px;
        }
        .v131-session-card small,
        .v131-people-actions p {
          color: #61748d;
          font-size: 12px;
          line-height: 1.4;
        }
        .v131-people-actions p { margin: 0 0 12px; }
        .v131-actions {
          display: flex;
          gap: 8px;
        }
        .v131-actions a,
        .v131-actions button {
          flex: 1;
          min-height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 11px;
          padding: 9px 11px;
          font: inherit;
          font-size: 12px;
          font-weight: 850;
          text-decoration: none;
          text-align: center;
          cursor: pointer;
        }
        .v131-actions a:first-child {
          color: white;
          border: 1px solid #1264d5;
          background: #1264d5;
        }
        .v131-actions a:not(:first-child),
        .v131-actions button {
          color: #24446d;
          border: 1px solid #c8d7e8;
          background: white;
        }
        .v131-actions button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }
        @media (max-width: 720px) {
          .v131-session-card,
          .v131-people-actions {
            left: 12px;
            right: 12px;
            bottom: 12px;
            width: auto;
          }
          .v131-session-card { grid-template-columns: 1fr; }
          .v131-actions { flex-direction: column; }
        }
      `}</style>

      {!isAdmin && accessRole === "encarregado" ? (
        <aside className="v131-session-card" aria-label="Sessão do encarregado">
          <div>
            <strong>{userName || "Encarregado"}</strong>
            <small>
              Perfil encarregado · matrícula {employeeCode || "não informada"}. No ponto, você pode registrar para si ou para os colaboradores.
            </small>
          </div>
          <div className="v131-actions">
            <Link href="/ponto">Abrir ponto</Link>
            <button type="button" disabled={loggingOut} onClick={logoutStaff}>
              {loggingOut ? "Saindo..." : "Encerrar"}
            </button>
          </div>
        </aside>
      ) : null}

      {isAdmin && showPeopleActions ? (
        <aside
          className="v131-people-actions"
          aria-label="Ações do cadastro de colaboradores"
        >
          <strong>Colaboradores e ponto eletrônico</strong>
          <p>
            Cadastre o colaborador e abra o portal de ponto por matrícula, senha, horário e localização.
          </p>
          <div className="v131-actions">
            <Link href="/pessoas/novo">Cadastrar colaborador</Link>
            <Link href="/ponto">Abrir portal de ponto</Link>
          </div>
        </aside>
      ) : null}
    </>
  );
}
