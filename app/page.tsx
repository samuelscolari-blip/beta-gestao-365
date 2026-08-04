import { headers } from "next/headers";
import SecureBetaAppV99 from "./components/SecureBetaAppV99";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";

// SecureBetaAppV99 preserva toda a cadeia anterior e unifica a tela de Máquinas,
// incorporando impacto e parada à tabela principal sem alterar os cálculos.
export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);
  const isAdmin = email === SOLE_ADMIN_EMAIL;
  const fullName = isAdmin ? "Samuel Scolari" : null;

  return (
    <SecureBetaAppV99
      userName={fullName}
      userEmail={email}
      isAdmin={isAdmin}
    />
  );
}
