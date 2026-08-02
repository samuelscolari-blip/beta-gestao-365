import { headers } from "next/headers";
import SecureBetaAppV52 from "./components/SecureBetaAppV52";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);
  const isAdmin = email === SOLE_ADMIN_EMAIL;
  const fullName = isAdmin ? "Samuel Scolari" : null;

  return (
    <SecureBetaAppV52
      userName={fullName}
      userEmail={email}
      isAdmin={isAdmin}
    />
  );
}
