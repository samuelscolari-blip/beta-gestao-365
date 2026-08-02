import { headers } from "next/headers";
import SecureBetaAppV66 from "./components/SecureBetaAppV66";
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
    <SecureBetaAppV66
      userName={fullName}
      userEmail={email}
      isAdmin={isAdmin}
    />
  );
}
