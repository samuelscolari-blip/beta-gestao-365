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

      {!isAdmin && accessRole === "encarregado" ? (
        <aside
          className="v131-staff-session"
          aria-label="Sessão do encarregado"
        >
          <style>{`
            .v131-staff-session {
              position: fixed;
              z-index: 1300;
              left: 20px;
              bottom: 18px;
              width: min(420px, calc(100vw - 40px));
              display: grid;
              grid-template-columns: minmax(0, 1fr) auto;
              gap: 12px;
              align-items: center;
              padding: 13px 14px;
              border: 1px solid #bcd2e9;
              border-radius: 17px;
              background: rgba(255,255,255,.98);
              box-shadow: 0 17px 45px rgba(21,50,84,.2);
              color: #17345c;
            }
            .v131-staff-session strong {
              display: block;
              color: #0b2b5f;
              font-size: 14px;
            }
            .v131-staff-session small {
              display: block;
              margin-top: 3px;
              color: #61748d;
              font-size: 11px;
            }
            .v131-staff-links {
              display: flex;
              gap: 7px;
            }
            .v131-staff-links a,
            .v131-staff-links button {
              min-height: 37px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 10px;
              padding: 8px 11px;
              font: inherit;
              font-size: 12px;
              font-weight: 850;
              text-decoration: none;
              cursor: pointer;
            }
            .v131-staff-links a {
              color: white;
              background: #1264d5;
              border: 1px solid #1264d5;
            }
            .v131-staff-links button {
              color: #24446d;
              background: white;
              border: 1px solid #c8d7e8;
            }
            .v131-staff-links button:disabled {
              opacity: .6;
              cursor: not-allowed;
            }
            @media (max-width: 660px) {
              .v131-staff-session {
                left: 12px;
                bottom: 12px;
                width: calc(100vw - 24px);
                grid-template-columns: 1fr;
              }
              .v131-staff-links > * { flex: 1; }
            }
          `}</style>
          <div>
            <strong>{userName || "Encarregado"}</strong>
            <small>
              Perfil encarregado · matrícula {employeeCode || "não informada"} · acesso limitado
            </small>
          </div>
          <div className="v131-staff-links">
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
          <style>{`
            .v131-people-actions {
              position: fixed;
              z-index: 1200;
              right: 28px;
              bottom: 24px;
              width: min(390px, calc(100vw - 32px));
              padding: 16px;
              border: 1px solid #bfd4ec;
              border-radius: 18px;
              background: rgba(255,255,255,.98);
              box-shadow: 0 18px 50px rgba(20,48,84,.2);
              color: #17345c;
            }
            .v131-people-actions strong {
              display: block;
              color: #0b2b5f;
              font-size: 16px;
              margin-bottom: 4px;
            }
            .v131-people-actions p {
              margin: 0 0 12px;
              color: #5b6f8a;
              font-size: 13px;
              line-height: 1.4;
            }
            .v131-people-actions div {
              display: flex;
              gap: 8px;
            }
            .v131-people-actions a {
              flex: 1;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              min-height: 42px;
              padding: 10px 12px;
              border-radius: 12px;
              text-decoration: none;
              font-size: 13px;
              font-weight: 850;
              text-align: center;
            }
            .v131-people-actions a:first-of-type {
              color: white;
              background: #1264d5;
              box-shadow: 0 9px 20px rgba(18,100,213,.24);
            }
            .v131-people-actions a:last-of-type {
              color: #1f456f;
              border: 1px solid #c8d7e8;
              background: #f8fbff;
            }
            @media (max-width: 720px) {
              .v131-people-actions {
                right: 16px;
                bottom: 16px;
              }
              .v131-people-actions div { flex-direction: column; }
            }
          `}</style>
          <strong>Cadastro de colaborador e ponto</strong>
          <p>
            Cadastre a pessoa do zero e siga diretamente para a captura do rosto no celular.
          </p>
          <div>
            <Link href="/pessoas/novo">Cadastrar colaborador</Link>
            <Link href="/ponto">Abrir portal de ponto</Link>
          </div>
        </aside>
      ) : null}
    </>
  );
}
