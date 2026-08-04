import { headers } from "next/headers";
import SecureBetaAppV100 from "./components/SecureBetaAppV100";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";

// Cadeia preservada: SecureBetaAppV100 → SecureBetaAppV97 → SecureBetaAppV66 → SecureBetaAppV65.
// A V100 unifica a tela de Máquinas sem alterar cálculos, acessos ou fluxos anteriores.
export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);
  const isAdmin = email === SOLE_ADMIN_EMAIL;
  const fullName = isAdmin ? "Samuel Scolari" : null;

  return (
    <SecureBetaAppV100
      userName={fullName}
      userEmail={email}
      isAdmin={isAdmin}
    />
  );
}
