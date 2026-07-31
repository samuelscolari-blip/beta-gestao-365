import { headers } from "next/headers";
import BetaAppV52 from "./components/BetaAppV52";
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

  return (
    <BetaAppV52 userName={fullName} userEmail={email} isAdmin={isAdmin} />
  );
}
