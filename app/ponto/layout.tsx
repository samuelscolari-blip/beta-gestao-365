import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import AccessGate from "../components/AccessGate";
import StaffPointIdentityLock from "../components/StaffPointIdentityLock";
import {
  authenticatedEmailFromHeaders,
  SOLE_ADMIN_EMAIL,
} from "../lib/server-access";
import {
  hasStaffSessionCookie,
  staffSessionFromHeaders,
} from "../lib/staff-access";

export const metadata: Metadata = {
  title: "Beta Ponto",
  description:
    "Registro móvel de ponto com reconhecimento facial, horário, localização e modo offline.",
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

  if (!hasStaffSessionCookie(requestHeaders)) {
    return <AccessGate nextPath="/ponto" />;
  }

  const staff = await staffSessionFromHeaders(requestHeaders);
  if (!staff) {
    return (
      <AccessGate
        nextPath="/ponto"
        message="Sua sessão expirou. Entre novamente para usar o ponto."
      />
    );
  }

  return (
    <>
      <StaffPointIdentityLock
        registration={staff.registration}
        name={staff.name}
      />
      {children}
    </>
  );
}
