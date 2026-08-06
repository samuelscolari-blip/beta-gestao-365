import { headers } from "next/headers";
import { redirect } from "next/navigation";
import SecureBetaAppV131 from "./components/SecureBetaAppV131";
import SupervisorLoginGate from "./components/SupervisorLoginGate";
import { masterPointSessionFromHeaders } from "./lib/master-point-access";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";
import { businessStaffSessionFromHeaders } from "./lib/staff-business-access";

// O administrador acessa o sistema completo pelo Google autorizado.
// O encarregado passa por duas etapas antes de acessar somente o portal /ponto.
export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);

  if (email === SOLE_ADMIN_EMAIL) {
    return (
      <SecureBetaAppV131
        userName="Samuel Scolari"
        userEmail={email}
        isAdmin
        accessRole="administrador"
      />
    );
  }

  const masterSession = await masterPointSessionFromHeaders(requestHeaders);
  if (masterSession) redirect("/ponto");

  const supervisor = await businessStaffSessionFromHeaders(requestHeaders);
  if (supervisor?.role === "encarregado") redirect("/acesso-ponto");

  return <SupervisorLoginGate />;
}
