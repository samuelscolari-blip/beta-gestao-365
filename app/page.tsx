import { headers } from "next/headers";
import SecureBetaAppV102 from "./components/SecureBetaAppV102";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";

// Cadeia preservada: SecureBetaAppV102 → SecureBetaAppV101 → SecureBetaAppV100 → SecureBetaAppV97 → SecureBetaAppV66 → SecureBetaAppV65.
// A V102 acrescenta somente a sincronização administrativa do cadastro oficial de funcionários com o Beta Ponto.
export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);
  const isAdmin = email === SOLE_ADMIN_EMAIL;
  const fullName = isAdmin ? "Samuel Scolari" : null;

  return (
    <SecureBetaAppV102
      userName={fullName}
      userEmail={email}
      isAdmin={isAdmin}
    />
  );
}
