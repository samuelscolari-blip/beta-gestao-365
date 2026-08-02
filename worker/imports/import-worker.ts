import { ImportService } from './import.service';
import { ObraRepository } from './obra.repository';
import type { ImportQueuePayload, ImportWorkerEnv } from './types';

const IMPORT_PATH = '/api/importacoes/obras';
const DEFAULT_TENANT_ID = 'beta-construtora';
const MAX_FILE_SIZE = 250 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function authenticatedEmail(request: Request) {
  return String(request.headers.get('x-beta-authenticated-email') || '')
    .trim()
    .toLowerCase();
}

function tenantId(env: ImportWorkerEnv) {
  return String(env.IMPORT_TENANT_ID || DEFAULT_TENANT_ID).trim() || DEFAULT_TENANT_ID;
}

function originalFileName(request: Request) {
  const explicit = request.headers.get('x-file-name');
  if (explicit) return explicit.trim().slice(0, 180);

  const disposition = request.headers.get('content-disposition') || '';
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8).slice(0, 180);
    } catch {
      return utf8.slice(0, 180);
    }
  }

  const basic = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return (basic || 'obras.csv').trim().slice(0, 180);
}

function safeStorageName(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return normalized || 'obras.csv';
}

function isCsvRequest(request: Request, fileName: string) {
  const contentType = String(request.headers.get('content-type') || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  return (
    fileName.toLowerCase().endsWith('.csv') ||
    ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream'].includes(
      contentType,
    )
  );
}

async function receiveImport(request: Request, env: ImportWorkerEnv, actor: string) {
  if (!env.STORAGE_BUCKET || !env.IMPORT_QUEUE) {
    return json(
      {
        erro: 'Importação assíncrona ainda não ativada.',
        detalhe: 'Configure os bindings STORAGE_BUCKET e IMPORT_QUEUE na Cloudflare.',
      },
      503,
    );
  }

  if (!request.body) return json({ erro: 'Envie o arquivo CSV no corpo da requisição.' }, 400);

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_FILE_SIZE) {
    return json({ erro: 'Arquivo excede o limite de 250 MB.' }, 413);
  }

  const fileName = originalFileName(request);
  if (!isCsvRequest(request, fileName)) {
    return json({ erro: 'Formato não aceito. Envie um arquivo CSV.' }, 415);
  }

  const importId = crypto.randomUUID();
  const requestedAt = new Date().toISOString();
  const currentTenantId = tenantId(env);
  const storageKey = `importacoes/${currentTenantId}/${importId}/${safeStorageName(fileName)}`;
  const repo = new ObraRepository(env.DB, currentTenantId, actor);

  try {
    const stored = await env.STORAGE_BUCKET.put(storageKey, request.body, {
      httpMetadata: {
        contentType: request.headers.get('content-type') || 'text/csv; charset=utf-8',
      },
      customMetadata: {
        importId,
        tenantId: currentTenantId,
        requestedBy: actor,
        originalFileName: fileName,
      },
    });

    if (stored.size > MAX_FILE_SIZE) {
      await env.STORAGE_BUCKET.delete(storageKey);
      return json({ erro: 'Arquivo excede o limite de 250 MB.' }, 413);
    }

    await repo.iniciarImportacao(importId, fileName, storageKey);

    const payload: ImportQueuePayload = {
      importId,
      fileName: storageKey,
      originalFileName: fileName,
      tenantId: currentTenantId,
      requestedBy: actor,
      requestedAt,
    };
    await env.IMPORT_QUEUE.send(payload);

    return json(
      {
        mensagem: 'Arquivo recebido. O processamento foi colocado na fila.',
        import_id: importId,
        status: 'Na fila',
        consulta: `${IMPORT_PATH}/${importId}`,
      },
      202,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    try {
      await repo.registrarFalha(importId, 'Falhou', detail);
    } catch {
      // A falha original é a informação prioritária.
    }
    return json({ erro: 'Não foi possível colocar a importação na fila.', detalhe: detail }, 503);
  }
}

async function importStatus(importId: string, env: ImportWorkerEnv, actor: string) {
  const repo = new ObraRepository(env.DB, tenantId(env), actor);
  const result = await repo.buscarImportacao(importId);
  return result ? json(result) : json({ erro: 'Importação não encontrada.' }, 404);
}

export async function handleImportRequest(
  request: Request,
  env: ImportWorkerEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== IMPORT_PATH && !url.pathname.startsWith(`${IMPORT_PATH}/`)) {
    return null;
  }

  const actor = authenticatedEmail(request);
  if (!actor) return json({ erro: 'Acesso não autenticado.' }, 401);

  if (url.pathname === IMPORT_PATH) {
    if (request.method === 'POST') return receiveImport(request, env, actor);
    return json({ erro: 'Método não permitido. Use POST.' }, 405);
  }

  const importId = decodeURIComponent(url.pathname.slice(`${IMPORT_PATH}/`.length)).trim();
  if (!/^[0-9a-f-]{36}$/i.test(importId)) return json({ erro: 'Identificador inválido.' }, 400);
  if (request.method === 'GET') return importStatus(importId, env, actor);
  return json({ erro: 'Método não permitido. Use GET.' }, 405);
}

export async function processImportQueue(
  batch: MessageBatch<ImportQueuePayload>,
  env: ImportWorkerEnv,
) {
  for (const message of batch.messages) {
    const payload = message.body;
    const repo = new ObraRepository(env.DB, payload.tenantId, payload.requestedBy);

    try {
      if (!env.STORAGE_BUCKET) throw new Error('Binding STORAGE_BUCKET não configurado.');

      const file = await env.STORAGE_BUCKET.get(payload.fileName);
      if (!file?.body) throw new Error('Arquivo não encontrado no R2.');

      const service = new ImportService(repo);
      await service.processarArquivo(file.body, payload.importId);
      message.ack();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      try {
        await repo.registrarFalha(payload.importId, 'Falha temporária', detail);
      } catch {
        // A mensagem deve continuar seguindo a política de retentativa da Queue.
      }
      console.error('Erro ao processar importação de obras:', payload.importId, detail);
      message.retry();
    }
  }
}
