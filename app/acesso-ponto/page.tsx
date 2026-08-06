import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AccessGate from "../components/AccessGate";
import SupervisorLoginGate from "../components/SupervisorLoginGate";
import { masterPointSessionFromHeaders } from "../lib/master-point-access";
import { businessStaffSessionFromHeaders } from "../lib/staff-business-access";

export const dynamic = "force-dynamic";

export default async function PointAccessPage() {
  const requestHeaders = await headers();
  const master = await masterPointSessionFromHeaders(requestHeaders);
  if (master) redirect("/ponto");

  const supervisor = await businessStaffSessionFromHeaders(requestHeaders);
  if (!supervisor || supervisor.role !== "encarregado") {
    return (
      <SupervisorLoginGate message="Identifique o encarregado antes de selecionar os colaboradores." />
    );
  }

  return (
    <AccessGate
      nextPath="/ponto"
      message={`Etapa 2 de 2: ${supervisor.name}, matrícula ${supervisor.registration}, foi identificado. Confirme a senha master uma única vez para liberar todos os colaboradores nesta sessão.`}
    />
  );
}
