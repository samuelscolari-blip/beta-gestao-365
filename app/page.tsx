import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AccessGate from "./components/AccessGate";
import SecureBetaAppV131 from "./components/SecureBetaAppV131";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";
import {
  businessStaffSessionFromHeaders,
  hasStaffSessionCookie,
} from "./lib/staff-business-access";

// Cadeia preservada pela V131: SecureBetaAppV100 → SecureBetaAppV97 →
// SecureBetaAppV66 → SecureBetaAppV65. O administrador mantém o sistema
// completo, o encarregado recebe o painel limitado e o colaborador acessa
// somente o próprio ponto.
export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);
  const isAdmin = email === SOLE_ADMIN_EMAIL;

  if (isAdmin) {
    return (
      <SecureBetaAppV131
        userName="Samuel Scolari"
        userEmail={email}
        isAdmin
        accessRole="administrador"
      />
    );
  }

  if (!hasStaffSessionCookie(requestHeaders)) {
    return <AccessGate nextPath="/" />;
  }

  const staff = await businessStaffSessionFromHeaders(requestHeaders);
  if (!staff) {
    return (
      <AccessGate
        nextPath="/"
        message="Sua sessão expirou. Entre novamente com matrícula e senha."
      />
    );
  }

  if (staff.role === "colaborador") {
    redirect("/ponto");
  }

  return (
    <SecureBetaAppV131
      userName={staff.name}
      userEmail={null}
      isAdmin={false}
      accessRole="encarregado"
      employeeCode={staff.registration}
    />
  );
}
