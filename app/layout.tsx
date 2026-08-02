import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./ibs-cbs.css";
import "./v52.css";
import "./v52-integrations.css";
import "./construction-v54.css";
import "./construction-v56.css";
import "./cost-map-readability-v58.css";
import "./construction-executive-v59.css";
import "./v60.css";
import "./v61.css";
import "./professional-layout-v64.css";
import "./v65.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Beta Gestão 365",
  description:
    "Central operacional da Beta Construtora para finanças, pessoas, máquinas, compras e Microsoft 365.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
