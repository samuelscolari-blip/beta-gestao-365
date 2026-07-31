import { headers } from "next/headers";
import BetaApp from "./components/BetaApp";
import { SOLE_ADMIN_EMAIL } from "./lib/server-access";

export const dynamic = "force-dynamic";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedName)
      : null;

  const isAdmin = email?.trim().toLowerCase() === SOLE_ADMIN_EMAIL;

  return <BetaApp userName={fullName} userEmail={email} isAdmin={isAdmin} />;
}
