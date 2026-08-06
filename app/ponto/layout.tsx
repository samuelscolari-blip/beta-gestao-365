import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import AccessGate from "../components/AccessGate";
import { masterPointSessionFromHeaders } from "../lib/master-point-access";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "../lib/server-access";

export const metadata: Metadata = {
  title: "Beta Ponto",
  description:
    "Registro móvel de ponto com horário, localização e funcionamento online ou offline.",
  manifest: "/ponto.webmanifest",
  applicationName: "Beta Ponto",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Beta Ponto",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b2b5f",
};

export default async function TimeClockLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestHeaders = await headers();
  const email = authenticatedEmailFromHeaders(requestHeaders);
  if (email === SOLE_ADMIN_EMAIL) return children;

  const masterSession = await masterPointSessionFromHeaders(requestHeaders);
  if (masterSession) return children;

  return (
    <AccessGate
      nextPath="/ponto"
      message="Entre com o CPF do colaborador e a senha master do encarregado."
    />
  );
}
