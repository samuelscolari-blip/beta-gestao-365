import {
  closeAssessment,
  deleteFiscalDocument,
  exportIbsCbsMemory,
  getAssessment,
  getIbsCbsConfig,
  getIbsCbsOverview,
  listFiscalDocuments,
  listIbsCbsAuditLogs,
  reopenAssessment,
  saveFiscalDocument,
  saveIbsCbsConfig,
} from "../../../db/ibs-cbs";
import { calculateIbsCbs, isIbsCbsApplicable, validateFiscalDocument } from "../../lib/ibs-cbs.js";
import {
  actorFrom,
  isSoleAdmin,
  requireSoleAdmin,
} from "../../lib/server-access";

function errorResponse(error: unknown, status = 400) {
  return Response.json(
    { error: error instanceof Error ? error.message : "Não foi possível concluir a ação." },
    { status },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") || "overview";
    const competence = url.searchParams.get("competence");
    const admin = isSoleAdmin(request);

    if (view === "config") {
      const config = await getIbsCbsConfig(undefined, url.searchParams.get("date") || competence);
      return Response.json({
        config: admin
          ? config
          : { ...config, createdBy: "", updatedBy: "", notes: "Parâmetros públicos de simulação." },
      });
    }
    if (view === "documents") {
      if (!admin) return Response.json({ documents: [], publicMode: true });
      return Response.json({ documents: await listFiscalDocuments(undefined, competence) });
    }
    if (view === "assessment") {
      if (!admin) return errorResponse(new Error("Apuração interna restrita ao administrador."), 403);
      return Response.json({ assessment: await getAssessment(competence || "2026-01") });
    }
    if (view === "audit") {
      if (!admin) return errorResponse(new Error("Acesso restrito."), 403);
      return Response.json({ audit: await listIbsCbsAuditLogs() });
    }
    if (view === "export") {
      if (!admin) return errorResponse(new Error("Acesso restrito."), 403);
      const target = competence || "2026-01";
      return new Response(await exportIbsCbsMemory(target), {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="memoria-ibs-cbs-${target}.csv"`,
        },
      });
    }

    const overview = await getIbsCbsOverview(undefined, competence);
    if (admin) return Response.json(overview);
    return Response.json({
      config: { ...overview.config, createdBy: "", updatedBy: "", notes: "Parâmetros públicos de simulação." },
      configHistory: [],
      documents: [],
      assessment: {
        competence: competence || "2026-01",
        status: "Consulta pública",
        documentCount: 0,
        ibsDebits: 0, ibsCredits: 0, ibsBalance: 0,
        cbsDebits: 0, cbsCredits: 0, cbsBalance: 0,
        blockedCredits: 0, pendingDocuments: 0, criticalIssues: 0,
      },
      summary: {
        documentsAnalyzed: 0, pendingDocuments: 0, possibleCredits: 0,
        blockedCredits: 0, periodDebits: 0, criticalIssues: 0,
      },
      publicMode: true,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "simulate");

    if (action === "simulate") {
      const storedConfig = await getIbsCbsConfig(undefined, String(body.issueDate || body.competence || ""));
      const config = {
        ...storedConfig,
        regime: body.regime ?? storedConfig.regime,
        incidenceEnabled: body.incidenceEnabled ?? storedConfig.incidenceEnabled,
        creditEnabled: body.creditEnabled ?? storedConfig.creditEnabled,
      };
      const applicable = isIbsCbsApplicable(config, String(body.issueDate || body.competence || ""));
      const calculation = calculateIbsCbs({
        ...body,
        ibsStateRate: body.ibsStateRate ?? config.ibsStateRate,
        ibsMunicipalRate: body.ibsMunicipalRate ?? config.ibsMunicipalRate,
        cbsRate: body.cbsRate ?? config.cbsRate,
        applicable,
        incidenceEnabled: applicable,
        creditEnabled: config.creditEnabled,
      });
      const validation = validateFiscalDocument(
        {
          ...body,
          fiscalKey: body.fiscalKey || "00000000000000000000000000000000000000000000",
          cst: body.cst || "000",
          cClassTrib: body.cClassTrib || "000001",
          itemCode: body.itemCode || "SIMULACAO",
          supplierTaxRegime: body.supplierTaxRegime || "Simulação",
          work: body.work || "Simulação",
          documentUrl: body.documentUrl || "simulacao://sem-persistencia",
          competence: body.competence || "2026-01",
        },
        config,
        [],
      );
      return Response.json({ calculation, validation, persisted: false });
    }

    const denied = requireSoleAdmin(request);
    if (denied) return denied;

    if (action === "document") {
      return Response.json(
        { document: await saveFiscalDocument(body, actorFrom(request)) },
        { status: 201 },
      );
    }
    if (action === "close") {
      return Response.json({
        assessment: await closeAssessment(
          String(body.competence || ""),
          actorFrom(request),
          body,
        ),
      });
    }
    if (action === "reopen") {
      return Response.json({
        assessment: await reopenAssessment(
          String(body.competence || ""),
          String(body.reason || ""),
          actorFrom(request),
        ),
      });
    }
    return errorResponse(new Error("Ação IBS/CBS inválida."));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const denied = requireSoleAdmin(request);
    if (denied) return denied;
    const body = (await request.json()) as Record<string, unknown>;
    return Response.json({ config: await saveIbsCbsConfig(body, actorFrom(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const denied = requireSoleAdmin(request);
    if (denied) return denied;
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return errorResponse(new Error("ID obrigatório."));
    return Response.json({ result: await deleteFiscalDocument(id, actorFrom(request)) });
  } catch (error) {
    return errorResponse(error);
  }
}
