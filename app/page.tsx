import { headers } from "next/headers";
import SecureBetaAppV65 from "./components/SecureBetaAppV65";
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
    <SecureBetaAppV65
      userName={fullName}
      userEmail={email}
      isAdmin={isAdmin}
    />
  );
}
