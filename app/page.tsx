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
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedName)
      : null;

  const isAdmin = email === SOLE_ADMIN_EMAIL;

  return (
    <SecureBetaAppV52
      userName={fullName}
      userEmail={email}
      isAdmin={isAdmin}
    />
  );
}
