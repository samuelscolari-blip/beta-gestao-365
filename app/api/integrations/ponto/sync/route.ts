import {
  PointSyncError,
  syncOfficialDirectoryToPoint,
} from "../../../../lib/ponto-sync";
import { requireSoleAdmin } from "../../../../lib/server-access";

export async function POST(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      activateReal?: unknown;
    };
    const result = await syncOfficialDirectoryToPoint({
      activateReal: body.activateReal === true,
    });
    const environmentMessage =
      result.environmentAction === "ACTIVATED"
        ? "Ambiente ativado como BASE REAL."
        : result.environmentAction === "ALREADY_REAL"
          ? "O ambiente já estava em BASE REAL."
          : "O modo do ambiente não foi alterado.";
    return Response.json(
      {
        ...result,
        message:
          `${result.total} funcionários sincronizados com o Beta Ponto. ` +
          environmentMessage,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PointSyncError) {
      const status =
        error.stage === "configuration"
          ? 503
          : error.stage === "source"
            ? 409
            : error.stage === "validate"
              ? 422
              : 502;
      return Response.json(
        {
          ok: false,
          stage: error.stage,
          message: error.message,
          point: error.details,
        },
        { status },
      );
    }

    return Response.json(
      {
        ok: false,
        stage: "unknown",
        message: "Não foi possível sincronizar o Beta Gestão 365 com o Beta Ponto.",
      },
      { status: 502 },
    );
  }
}
