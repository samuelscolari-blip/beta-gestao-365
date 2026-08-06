"use client";

import { useLayoutEffect, useState } from "react";
import SecureBetaAppV100 from "./SecureBetaAppV100";

type Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

function peopleScreenIsVisible() {
  return Boolean(
    document.querySelector(
      '[data-ui="module-header"][data-module="people"]',
    ),
  );
}

export default function SecureBetaAppV131(props: Props) {
  const [showPeopleActions, setShowPeopleActions] = useState(false);

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

  return (
    <>
      <SecureBetaAppV100 {...props} />
      {props.isAdmin && showPeopleActions ? (
        <aside className="v131-people-actions" aria-label="Ações do cadastro de colaboradores">
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
            <a href="/pessoas/novo">Cadastrar colaborador</a>
            <a href="/ponto">Abrir portal de ponto</a>
          </div>
        </aside>
      ) : null}
    </>
  );
}
