import {
  PointSyncError,
  syncOfficialDirectoryToPoint,
} from "../../../../lib/ponto-sync";
import { requireSoleAdmin } from "../../../../lib/server-access";

const EXPECTED_REAL_DIRECTORY_TOTAL = 42;

export async function POST(request: Request) {
  const denied = requireSoleAdmin(request);
  if (denied) return denied;

  try {
    /*
     * O Ponto já está em BASE REAL. Esta porta faz somente o snapshot:
     * não consulta, ativa nem altera o modo e não reaplica os gates antigos
     * de jornada ou credencial usados exclusivamente na primeira ativação.
     */
    const result = await syncOfficialDirectoryToPoint({ activateReal: false });
    const processed = result.created + result.updated;
    const snapshotCompleto = result.total === EXPECTED_REAL_DIRECTORY_TOTAL;

    return Response.json(
      {
        ...result,
        modoAlterado: false,
        snapshotCompleto,
        diagnostico: {
          esperados: EXPECTED_REAL_DIRECTORY_TOTAL,
          enviados: result.total,
          processados: processed,
          desativados: result.deactivated,
          semAcesso: result.semAcesso.length,
        },
        message:
          `${result.total} funcionários sincronizados com o Beta Ponto. ` +
          "O ambiente permaneceu em BASE REAL e nenhuma batida foi registrada." +
          (snapshotCompleto
            ? ""
            : ` Atenção: eram esperados ${EXPECTED_REAL_DIRECTORY_TOTAL} funcionários oficiais.`),
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
          modoAlterado: false,
          message: error.message,
          point: error.details,
        },
        { status, headers: { "cache-control": "no-store" } },
      );
    }

    return Response.json(
      {
        ok: false,
        stage: "unknown",
        modoAlterado: false,
        message: "Não foi possível sincronizar o Beta Gestão 365 com o Beta Ponto.",
      },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
