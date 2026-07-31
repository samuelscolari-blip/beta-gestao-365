import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../app/components/SecureBetaAppV52.tsx", import.meta.url),
  "utf8",
);

test("V52 interface observer does not rewrite the same text indefinitely", () => {
  assert.match(
    source,
    /title\s*&&\s*title\.textContent\s*!==\s*MANAGEMENT_TITLE/,
  );
  assert.match(
    source,
    /description\.textContent\s*!==\s*MANAGEMENT_DESCRIPTION/,
  );
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /if \(animationFrame !== null\) return/);
});

test("initial dashboard no longer triggers an automatic duplicate refresh", () => {
  assert.doesNotMatch(source, /refreshTimer/);
  assert.doesNotMatch(source, /Atualizar dados/);
});
