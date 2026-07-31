import {
  erpCoreConfiguration,
  erpCoreRequest,
} from "../../../lib/erp-core-client";

type CoreCapabilities = {
  fiscal?: {
    certificateProvider?: string;
    xmlSigning?: string;
    governmentTransmission?: string;
  };
  runtime?: Record<string, string>;
  checkedAt?: string;
};

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await erpCoreConfiguration();
  const base = {
    configured: state.configured,
    connected: false,
    mode: "PORTAL_D1",
    checkedAt: new Date().toISOString(),
    checks: {
      portal: true,
      postgres: false,
      redis: false,
      worker: false,
      xmlSigner: false,
    },
    missing: state.missing,
  };
  if (!state.configured) {
    return Response.json({
      ...base,
      message:
        "O código do núcleo está preparado; faltam provisionar a infraestrutura e registrar os segredos de conexão.",
    }, {
      headers: { "cache-control": "no-store" },
    });
  }

  try {
    const readyResponse = await fetch(
      `${state.configuration.baseUrl}/health/ready`,
      {
        signal: AbortSignal.timeout(5_000),
        headers: { accept: "application/json" },
      },
    );
    const readiness = (await readyResponse.json()) as {
      status?: string;
      checks?: {
        postgres?: boolean;
        redis?: boolean;
        worker?: boolean;
      };
    };
    const capabilities = await erpCoreRequest<CoreCapabilities>(
      "/v1/capabilities",
      {
        actor: "portal:status",
        timeoutMs: 5_000,
      },
    );
    const connected =
      readyResponse.ok && readiness.status === "READY";
    return Response.json({
      ...base,
      configured: true,
      connected,
      mode: connected ? "ERP_CORE_CONNECTED" : "ERP_CORE_NOT_READY",
      checks: {
        portal: true,
        postgres: Boolean(readiness.checks?.postgres),
        redis: Boolean(readiness.checks?.redis),
        worker: Boolean(readiness.checks?.worker),
        xmlSigner:
          capabilities.fiscal?.xmlSigning === "CONFIGURED",
      },
      certificateProvider:
        capabilities.fiscal?.certificateProvider || "DISABLED",
      governmentTransmission:
        capabilities.fiscal?.governmentTransmission ||
        "PENDING_HOMOLOGATION",
      runtime: capabilities.runtime || {},
      checkedAt:
        capabilities.checkedAt || new Date().toISOString(),
      message: connected
        ? "Portal e núcleo ERP estão conectados."
        : "O núcleo respondeu, mas algum componente ainda não está pronto.",
    }, {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return Response.json({
      ...base,
      configured: true,
      mode: "ERP_CORE_UNREACHABLE",
      message:
        "A conexão foi configurada, mas o núcleo ERP não respondeu à verificação.",
    }, {
      headers: { "cache-control": "no-store" },
    });
  }
}
