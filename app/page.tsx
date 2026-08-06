import { headers } from "next/headers";
import SecureBetaAppV101 from "./components/SecureBetaAppV101";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";

// Cadeia preservada: SecureBetaAppV101 → SecureBetaAppV100 → SecureBetaAppV97 → SecureBetaAppV66 → SecureBetaAppV65.
// A V101 mantém apenas o importador canônico da barra da tabela e retira os atalhos duplicados.
export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);
  const isAdmin = email === SOLE_ADMIN_EMAIL;
  const fullName = isAdmin ? "Samuel Scolari" : null;

  return (
    <SecureBetaAppV101
      userName={fullName}
      userEmail={email}
      isAdmin={isAdmin}
    />
  );
}
