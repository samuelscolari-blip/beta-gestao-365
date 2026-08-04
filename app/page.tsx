import { headers } from "next/headers";
import SecureBetaAppV97 from "./components/SecureBetaAppV97";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "./lib/server-access";

// SecureBetaAppV97 encapsula SecureBetaAppV66, que preserva SecureBetaAppV65,
// e acrescenta somente a separação das rotinas de salário e férias no RH.
export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);
  const isAdmin = email === SOLE_ADMIN_EMAIL;
  const fullName = isAdmin ? "Samuel Scolari" : null;

  return (
    <SecureBetaAppV97
      userName={fullName}
      userEmail={email}
      isAdmin={isAdmin}
    />
  );
}
