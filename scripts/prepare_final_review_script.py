from pathlib import Path

path = Path("scripts/apply_final_system_review.py")
text = path.read_text(encoding="utf-8")
old = r"""raw_write = r'''          payload.record || payload,
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
new = r"""route = replace_once(
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
if text.count(old) != 1:
    raise RuntimeError(
        f"Trecho da validação individual não localizado exatamente uma vez: {text.count(old)}"
    )
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Script principal ajustado para POST e PUT com indentações independentes.")
