import { parseCsvStream } from './csv-stream';
import { ObraRepository } from './obra.repository';
import type {
  ImportProgress,
  ImportResult,
  ImportValidationError,
  ImportedWork,
} from './types';

const BATCH_SIZE = 1000;

function normalizeKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizedRow(row: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value.trim()]),
  );
}

function firstValue(row: Record<string, string>, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias]?.trim();
    if (value) return value;
  }
  return '';
}

function validIsoDate(year: string, month: string, day: string) {
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() + 1 === Number(month) &&
    date.getUTCDate() === Number(day)
  );
}

function normalizeDate(value: string) {
  const text = value.trim();
  if (!text) return '';

  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const month = iso[2].padStart(2, '0');
    const day = iso[3].padStart(2, '0');
    return validIsoDate(iso[1], month, day)
      ? `${iso[1]}-${month}-${day}`
      : null;
  }

  const brazilian = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (brazilian) {
    const day = brazilian[1].padStart(2, '0');
    const month = brazilian[2].padStart(2, '0');
    return validIsoDate(brazilian[3], month, day)
      ? `${brazilian[3]}-${month}-${day}`
      : null;
  }

  const serial = Number(text.replace(',', '.'));
  if (Number.isFinite(serial) && serial >= 20_000 && serial <= 80_000) {
    const date = new Date(Math.round((serial - 25569) * 86_400_000));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  return null;
}

type ValidationResult =
  | { valid: true; obra: ImportedWork }
  | { valid: false; motivo: string };

export class ImportService {
  constructor(private readonly repo: ObraRepository) {}

  async processarArquivo(
    stream: ReadableStream<Uint8Array>,
    importId: string,
  ): Promise<ImportResult> {
    let batchValidos: ImportedWork[] = [];
    let batchErros: ImportValidationError[] = [];
    const progress: ImportProgress = {
      processados: 0,
      validos: 0,
      invalidos: 0,
    };

    await this.repo.atualizarImportacao(importId, 'Processando', progress, {
      startedAt: new Date().toISOString(),
    });

    for await (const parsed of parseCsvStream(stream)) {
      progress.processados += 1;
      const validation = this.validar(parsed.row);

      if (validation.valid) {
        progress.validos += 1;
        batchValidos.push(validation.obra);
      } else {
        progress.invalidos += 1;
        batchErros.push({
          linha: parsed.lineNumber,
          payload: parsed.row,
          motivo: validation.motivo,
        });
      }

      if (
        batchValidos.length >= BATCH_SIZE ||
        batchErros.length >= BATCH_SIZE
      ) {
        await this.flush(importId, batchValidos, batchErros, progress);
        batchValidos = [];
        batchErros = [];
      }
    }

    await this.flush(importId, batchValidos, batchErros, progress);

    const finalStatus =
      progress.invalidos > 0 ? 'Concluída com erros' : 'Concluída';

    await this.repo.atualizarImportacao(importId, finalStatus, progress, {
      completedAt: new Date().toISOString(),
      resultado:
        progress.invalidos > 0
          ? 'Existem linhas rejeitadas para revisão.'
          : 'Todas as linhas válidas foram processadas.',
    });

    return { importId, ...progress };
  }

  private validar(rawRow: Record<string, string>): ValidationResult {
    const row = normalizedRow(rawRow);
    const codigo = firstValue(row, [
      'codigo',
      'codigo_obra',
      'cod_obra',
      'id_obra',
      'obra_codigo',
    ]);

    if (!codigo) return { valid: false, motivo: 'Código da obra ausente' };
    if (codigo.length > 80) {
      return { valid: false, motivo: 'Código da obra excede 80 caracteres' };
    }
    if (!/^[\p{L}\p{N}._/\- ]+$/u.test(codigo)) {
      return {
        valid: false,
        motivo: 'Código da obra contém caracteres não permitidos',
      };
    }

    const nome =
      firstValue(row, ['nome', 'nome_obra', 'obra', 'descricao_obra']) || codigo;
    const gestor = firstValue(row, [
      'gestor',
      'responsavel',
      'engenheiro',
      'encarregado',
    ]);
    const rawDate = firstValue(row, [
      'data_previsao',
      'previsao',
      'previsao_conclusao',
      'data_prevista',
      'data_fim_prevista',
    ]);
    const dataPrevisao = normalizeDate(rawDate);

    if (rawDate && dataPrevisao === null) {
      return {
        valid: false,
        motivo: 'Data de previsão inválida; use DD/MM/AAAA ou AAAA-MM-DD',
      };
    }

    return {
      valid: true,
      obra: {
        codigo: codigo.trim(),
        nome: nome.trim(),
        gestor: gestor.trim(),
        dataPrevisao: dataPrevisao || '',
        payload: rawRow,
      },
    };
  }

  private async flush(
    importId: string,
    validos: ImportedWork[],
    erros: ImportValidationError[],
    progress: ImportProgress,
  ) {
    if (!validos.length && !erros.length) return;

    await this.repo.bulkUpsert(validos);
    await this.repo.registrarErros(importId, erros);
    await this.repo.atualizarImportacao(importId, 'Processando', progress, {
      lastBatchAt: new Date().toISOString(),
    });
  }
}
