import { headers } from "next/headers";
import AccessGate from "../../components/AccessGate";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "../../lib/server-access";

export const dynamic = "force-dynamic";

export default async function NewEmployeeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);
  if (email === SOLE_ADMIN_EMAIL) return children;

  return (
    <AccessGate
      nextPath="/pessoas/novo"
      message="O cadastro de colaboradores é exclusivo do administrador."
    />
  );
}
