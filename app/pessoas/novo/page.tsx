"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 40);
}

function generatedCode(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();
  return normalizeCode(`${initials || "COLAB"}-${Date.now().toString().slice(-6)}`);
}

export default function NewEmployeePage() {
  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [work, setWork] = useState("");
  const [admissionDate, setAdmissionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [salary, setSalary] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const finalCode = useMemo(
    () => normalizeCode(employeeCode) || generatedCode(name),
    [employeeCode, name],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!name.trim()) {
      setError("Informe o nome completo do colaborador.");
      return;
    }
    if (!finalCode) {
      setError("Informe ou gere o código do colaborador.");
      return;
    }

    setBusy(true);
    try {
      const amount = Number(
        salary.replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""),
      );
      const payload = {
        employeeCode: finalCode,
        registration: finalCode,
        name: name.trim(),
        cpf: cpf.trim(),
        phone: phone.trim(),
        role: role.trim(),
        work: work.trim(),
        admissionDate,
        salary: Number.isFinite(amount) ? amount : 0,
        salaryType: "Mensal",
        contractType: "Prazo indeterminado",
        status: "Ativo",
        timeClockAccess: "Aguardando cadastro facial",
      };

      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          record: {
            module: "people",
            title: name.trim(),
            reference: finalCode,
            status: "Ativo",
            recordDate: admissionDate,
            amount: Number.isFinite(amount) ? amount : 0,
            source: "cadastro-administrativo-v131",
            payload,
          },
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        record?: { id?: number };
        error?: string;
      };
      if (!response.ok || !body.record) {
        throw new Error(
          body.error ||
            (response.status === 403
              ? "Entre como administrador para cadastrar o colaborador."
              : "Não foi possível salvar o colaborador."),
        );
      }

      setMessage("Colaborador cadastrado. Abrindo o cadastro facial no celular...");
      const parameters = new URLSearchParams({
        employeeCode: finalCode,
        employeeName: name.trim(),
        sourceRecordId: String(body.record.id || ""),
      });
      window.location.assign(`/ponto?${parameters.toString()}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível cadastrar o colaborador.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="new-employee-page">
      <style>{`
        * { box-sizing: border-box; }
        html { background: #eef3f9; }
        body { margin: 0; }
        .new-employee-page { min-height: 100dvh; padding: 22px; color: #172b4d; background: radial-gradient(circle at top right, #dbeafe 0, transparent 34%), #eef3f9; }
        .employee-shell { width: min(100%, 860px); margin: 0 auto; }
        .employee-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
        .employee-title { display: flex; gap: 13px; align-items: center; }
        .employee-icon { width: 54px; height: 54px; border-radius: 16px; background: #0b2b5f; color: white; display: grid; place-items: center; font-size: 24px; font-weight: 900; }
        h1 { margin: 0; color: #0b2b5f; font-size: clamp(24px, 5vw, 34px); }
        .subtitle { margin: 4px 0 0; color: #607089; }
        .back { border: 1px solid #cad7e6; background: white; color: #24446d; text-decoration: none; padding: 10px 14px; border-radius: 12px; font-weight: 800; }
        .card { background: rgba(255,255,255,.97); border: 1px solid #d7e2ef; border-radius: 22px; box-shadow: 0 16px 45px rgba(31,55,88,.08); padding: 22px; }
        .intro { margin: 0 0 18px; padding: 13px 14px; border-radius: 14px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e3a5f; line-height: 1.45; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        .field { display: grid; gap: 7px; }
        .field.wide { grid-column: 1 / -1; }
        label { font-size: 13px; font-weight: 850; color: #405571; }
        input { width: 100%; min-width: 0; border: 1px solid #c9d6e6; border-radius: 12px; padding: 12px 13px; background: white; color: #172b4d; outline: none; }
        input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.13); }
        .code-preview { margin-top: 6px; color: #5d6f89; font-size: 12px; }
        .code-preview strong { color: #0b2b5f; }
        .feedback { margin-top: 15px; border-radius: 13px; padding: 12px 13px; font-size: 14px; }
        .feedback.error { color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; }
        .feedback.success { color: #14532d; background: #ecfdf3; border: 1px solid #bbf7d0; }
        .actions { margin-top: 18px; display: flex; gap: 10px; justify-content: flex-end; }
        button { border: 0; border-radius: 13px; padding: 13px 18px; background: #1264d5; color: white; font-weight: 900; cursor: pointer; box-shadow: 0 10px 25px rgba(18,100,213,.22); }
        button:disabled { opacity: .6; cursor: not-allowed; }
        .flow { margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .flow div { background: #f7fafe; border: 1px solid #dbe5f0; border-radius: 13px; padding: 12px; color: #5a6b83; font-size: 13px; }
        .flow strong { display: block; color: #0b2b5f; margin-bottom: 4px; }
        @media (max-width: 680px) {
          .new-employee-page { padding: 12px; }
          .employee-header { align-items: flex-start; }
          .grid, .flow { grid-template-columns: 1fr; }
          .field.wide { grid-column: auto; }
          .card { padding: 16px; border-radius: 18px; }
          .back { padding: 9px 11px; font-size: 13px; }
        }
      `}</style>

      <div className="employee-shell">
        <header className="employee-header">
          <div className="employee-title">
            <div className="employee-icon">+</div>
            <div>
              <h1>Cadastrar colaborador</h1>
              <p className="subtitle">Cadastro do zero e liberação imediata para o ponto facial</p>
            </div>
          </div>
          <Link className="back" href="/">Voltar ao sistema</Link>
        </header>

        <form className="card" onSubmit={submit}>
          <p className="intro">
            Salve os dados básicos agora. Em seguida, o sistema abrirá o cadastro do rosto no celular e, após a validação, o colaborador já poderá bater o ponto.
          </p>

          <div className="grid">
            <div className="field wide">
              <label htmlFor="name">Nome completo *</label>
              <input id="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="code">Código ou matrícula</label>
              <input id="code" value={employeeCode} onChange={(event) => setEmployeeCode(normalizeCode(event.target.value))} placeholder="Gerado automaticamente" />
              <span className="code-preview">Código que será usado: <strong>{finalCode || "—"}</strong></span>
            </div>
            <div className="field">
              <label htmlFor="cpf">CPF</label>
              <input id="cpf" value={cpf} onChange={(event) => setCpf(event.target.value)} inputMode="numeric" autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="phone">Telefone</label>
              <input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} inputMode="tel" autoComplete="tel" />
            </div>
            <div className="field">
              <label htmlFor="role">Cargo</label>
              <input id="role" value={role} onChange={(event) => setRole(event.target.value)} placeholder="Ex.: Pedreiro" />
            </div>
            <div className="field">
              <label htmlFor="work">Obra / local de trabalho</label>
              <input id="work" value={work} onChange={(event) => setWork(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="admission">Data de admissão</label>
              <input id="admission" type="date" value={admissionDate} onChange={(event) => setAdmissionDate(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="salary">Salário mensal</label>
              <input id="salary" value={salary} onChange={(event) => setSalary(event.target.value)} inputMode="decimal" placeholder="Ex.: 2.500,00" />
            </div>
          </div>

          {error ? <div className="feedback error">{error}</div> : null}
          {message ? <div className="feedback success">{message}</div> : null}

          <div className="actions">
            <button type="submit" disabled={busy}>
              {busy ? "Salvando colaborador..." : "Salvar e cadastrar o rosto"}
            </button>
          </div>

          <div className="flow">
            <div><strong>1. Cadastro</strong>Nome, código, função e dados básicos.</div>
            <div><strong>2. Rosto</strong>Câmera frontal e prova de vida no celular.</div>
            <div><strong>3. Ponto liberado</strong>Entrada, intervalo, retorno e saída.</div>
          </div>
        </form>
      </div>
    </main>
  );
}
