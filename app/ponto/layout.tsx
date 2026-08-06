import type { Metadata, Viewport } from "next";

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

export default function TimeClockLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
