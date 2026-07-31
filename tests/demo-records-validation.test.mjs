import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";

test("all demonstration records satisfy the server-side module validation", async () => {
  const server = await createServer({
    configFile: false,
    appType: "custom",
    server: { middlewareMode: true },
  });

  try {
    const { demoRecords } = await server.ssrLoadModule("/db/demo-records.ts");
    const { validateRecordPayload } = await server.ssrLoadModule(
      "/app/lib/record-validation.ts",
    );

    const failures = demoRecords.flatMap((record) => {
      const issues = validateRecordPayload(record.module, record.payload);
      return issues.length
        ? [
            {
              module: record.module,
              reference: record.reference,
              title: record.title,
              issues,
            },
          ]
        : [];
    });

    assert.deepEqual(failures, []);
  } finally {
    await server.close();
  }
});
