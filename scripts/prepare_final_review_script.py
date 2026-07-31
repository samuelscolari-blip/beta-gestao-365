from pathlib import Path

path = Path("scripts/apply_final_system_review.py")
text = path.read_text(encoding="utf-8")


def replace_exact(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: esperado exatamente 1 trecho, encontrado {count}."
        )
    return source.replace(old, new, 1)


old_write = r"""raw_write = r'''          payload.record || payload,
          actorFrom(request),'''
if route.count(raw_write) != 2:
    raise RuntimeError(
        f"Validação das gravações individuais: esperado 2 usos, encontrado {route.count(raw_write)}."
    )
route = route.replace(
    raw_write,
    r'''          normalizeRecordForWrite(payload.record || payload),
          actorFrom(request),''',
)"""
new_write = r"""route = replace_once(
    route,
    r'''          payload.record || payload,
          actorFrom(request),''',
    r'''          normalizeRecordForWrite(payload.record || payload),
          actorFrom(request),''',
    "Validação da criação individual",
)
route = replace_once(
    route,
    r'''        payload.record || payload,
        actorFrom(request),''',
    r'''        normalizeRecordForWrite(payload.record || payload),
        actorFrom(request),''',
    "Validação da atualização individual",
)"""
text = replace_exact(
    text,
    old_write,
    new_write,
    "Ajuste separado das gravações POST e PUT",
)

old_icon = r"""module_block = replace_once(
    module_block,
    r'''<Icon name={module.id} size={26} />''',
    r'''<Icon name={presentationModule.id} size={26} />''',
    "Ícone do cabeçalho financeiro",
)"""
new_icon = r"""module_block = replace_once(
    module_block,
    r'''style={{
              color: presentationModule.color,
              backgroundColor: presentationModule.lightColor,
            }}
          >
            <Icon name={module.id} size={26} />''',
    r'''style={{
              color: presentationModule.color,
              backgroundColor: presentationModule.lightColor,
            }}
          >
            <Icon name={presentationModule.id} size={26} />''',
    "Ícone específico do cabeçalho financeiro",
)"""
text = replace_exact(
    text,
    old_icon,
    new_icon,
    "Marcador específico do ícone financeiro",
)

old_d1_end = (
    "    }\n"
    "  }\n\n"
    "  const demoWorkerCounts = new Map(''',\n"
    "    \"Normalização dos status no D1\",\n"
    ")"
)
new_d1_end = (
    "    }\n"
    "  }''',\n"
    "    \"Normalização dos status no D1\",\n"
    ")"
)
text = replace_exact(
    text,
    old_d1_end,
    new_d1_end,
    "Delimitador final da normalização do D1",
)

financial_name_count = text.count("financialStatusBackfills")
if financial_name_count != 5:
    raise RuntimeError(
        f"Nome do backfill financeiro: esperado 5 usos, encontrado {financial_name_count}."
    )
text = text.replace("financialStatusBackfills", "pendingStatusBackfills")

section_marker = "# ---------------------------------------------------------------------------\n# 4. Central Financeira e painel executivo de obras\n# ---------------------------------------------------------------------------"
modules_block = r"""# ---------------------------------------------------------------------------
# 4. Opções-base do fluxo financeiro
# ---------------------------------------------------------------------------
modules_path = "app/lib/modules.ts"
modules = read(modules_path)
modules = replace_once(
    modules,
    r'''const statusFinanceiro = [
  "Pendente",
  "Aguardando aprovação",
  "Aprovado",
  "Vencido",
  "Pago",
  "Reprovado",
  "Cancelado",
];''',
    r'''const statusFinanceiro = [
  "Aguardando validação",
  "Reprovado",
  "Pago",
];''',
    "Opções-base do status financeiro",
)
write(modules_path, modules)


# ---------------------------------------------------------------------------
# 5. Central Financeira e painel executivo de obras
# ---------------------------------------------------------------------------"""
text = replace_exact(
    text,
    section_marker,
    modules_block,
    "Inserção da configuração-base financeira",
)

path.write_text(text, encoding="utf-8")
print("Transformação principal ajustada com validações e compatibilidade.")
