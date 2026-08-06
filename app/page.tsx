import { headers } from "next/headers";
import AccessGate from "./components/AccessGate";
import SecureBetaAppV131 from "./components/SecureBetaAppV131";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";
import {
  hasStaffSessionCookie,
  staffSessionFromHeaders,
} from "./lib/staff-access";

// Cadeia preservada pela V131: SecureBetaAppV100 → SecureBetaAppV97 →
// SecureBetaAppV66 → SecureBetaAppV65. A V131 adiciona o acesso fechado,
// conecta Pessoas ao cadastro facial e mantém o portal móvel de ponto.
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

  const staff = await staffSessionFromHeaders(requestHeaders);
  if (!staff) {
    return (
      <AccessGate
        nextPath="/"
        message="Sua sessão expirou. Entre novamente com matrícula e senha."
      />
    );
  }

  return (
    <SecureBetaAppV131
      userName={staff.name}
      userEmail={null}
      isAdmin={false}
      accessRole={staff.role}
      employeeCode={staff.registration}
    />
  );
}
