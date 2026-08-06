import { headers } from "next/headers";
import SecureBetaAppV131 from "./components/SecureBetaAppV131";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";

// Cadeia preservada: V131 → V100 → V97 → V66 → V65.
// A V131 conecta Pessoas ao cadastro facial e ao portal móvel de ponto.
export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);
  const isAdmin = email === SOLE_ADMIN_EMAIL;
  const fullName = isAdmin ? "Samuel Scolari" : null;

  return (
    <SecureBetaAppV131
      userName={fullName}
      userEmail={email}
      isAdmin={isAdmin}
    />
  );
}
