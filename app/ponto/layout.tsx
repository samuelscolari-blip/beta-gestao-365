import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import AccessGate from "../components/AccessGate";
import SupervisorLoginGate from "../components/SupervisorLoginGate";
import { masterPointSessionFromHeaders } from "../lib/master-point-access";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "../lib/server-access";
import { businessStaffSessionFromHeaders } from "../lib/staff-business-access";

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

  const supervisor = await businessStaffSessionFromHeaders(requestHeaders);
  if (!supervisor || supervisor.role !== "encarregado") {
    return (
      <SupervisorLoginGate message="Identifique o encarregado antes de acessar o ponto." />
    );
  }

  return (
    <AccessGate
      nextPath="/ponto"
      message={`Etapa 2 de 2: ${supervisor.name}, matrícula ${supervisor.registration}, foi identificado. Confirme a senha master uma única vez para liberar todos os colaboradores nesta sessão.`}
    />
  );
}
