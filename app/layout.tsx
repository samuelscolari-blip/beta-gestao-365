import type { Metadata } from "next";
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
import "./v67.css";
import "./v66.css";
import "./v72-executive-panel.css";
import "./v73-pr36-followup.css";
import "./v74-production-audit.css";
import "./v75-demo-data.css";
import "./v77-consolidated-engines.css";
import "./v78-status-colors.css";
import "./v79-executive-dark-theme.css";
import "./v84-hybrid-executive-theme.css";
import "./v86-shared-ui-system.css";
import "./v86-machine-priority-responsive.css";
import "./v88-payroll-color-standard.css";

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
        className="v86-root antialiased"
        style={{
          fontFamily:
            'Inter, "Segoe UI Variable", "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
