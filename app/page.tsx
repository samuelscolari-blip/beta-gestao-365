import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AccessGate from "./components/AccessGate";
import SecureBetaAppV131 from "./components/SecureBetaAppV131";
import { masterPointSessionFromHeaders } from "./lib/master-point-access";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";

// O administrador acessa o sistema completo pelo Google autorizado.
// A senha master do encarregado libera somente o portal /ponto.
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

  return <AccessGate nextPath="/" />;
}
