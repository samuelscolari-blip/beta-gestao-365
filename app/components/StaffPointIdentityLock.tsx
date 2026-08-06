"use client";

import { useEffect } from "react";

type Props = {
  registration: string;
  name: string;
};

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function StaffPointIdentityLock({ registration, name }: Props) {
  useEffect(() => {
    const apply = () => {
      const nameInput = document.querySelector<HTMLInputElement>("#employee-name");
      const codeInput = document.querySelector<HTMLInputElement>("#employee-code");
      const select = document.querySelector<HTMLSelectElement>("#employee-select");

      if (nameInput && nameInput.dataset.staffLocked !== "true") {
        setInputValue(nameInput, name);
        nameInput.readOnly = true;
        nameInput.dataset.staffLocked = "true";
        nameInput.title = "Identidade vinculada à sessão do encarregado";
      }
      if (codeInput && codeInput.dataset.staffLocked !== "true") {
        setInputValue(codeInput, registration);
        codeInput.readOnly = true;
        codeInput.dataset.staffLocked = "true";
        codeInput.title = "Matrícula vinculada à sessão do encarregado";
      }
      if (select) {
        select.disabled = true;
        select.title = "O encarregado só pode registrar o próprio ponto";
      }

      const newPerson = document.querySelector<HTMLElement>(".new-person");
      if (newPerson) newPerson.style.display = "none";
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [name, registration]);

  return (
    <aside className="staff-point-lock" aria-label="Identidade vinculada ao ponto">
      <style>{`
        .staff-point-lock {
          position: fixed;
          z-index: 1500;
          right: 14px;
          top: 14px;
          max-width: min(360px, calc(100vw - 28px));
          padding: 10px 12px;
          border: 1px solid #bbf7d0;
          border-radius: 13px;
          color: #14532d;
          background: rgba(236,253,243,.97);
          box-shadow: 0 12px 32px rgba(20,83,45,.14);
          font-size: 12px;
          line-height: 1.35;
        }
        .staff-point-lock strong { display: block; font-size: 13px; }
        @media (max-width: 780px) {
          .staff-point-lock {
            position: static;
            margin: 10px auto 0;
            width: calc(100% - 22px);
            max-width: 980px;
          }
        }
      `}</style>
      <strong>{name}</strong>
      Matrícula {registration} · ponto vinculado a esta sessão
    </aside>
  );
}
