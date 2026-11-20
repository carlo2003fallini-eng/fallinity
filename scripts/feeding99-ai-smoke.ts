import fs from "node:fs";
import assert from "node:assert/strict";
import { alimentazioneRouter } from "../server/domains/feeding/router";
import { getDb } from "../server/db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import type { TrpcContext } from "../server/_core/context";
import { dryMatter, nutrientOnDm } from "../shared/feeding/math";
const state = JSON.parse(
  fs.readFileSync("/home/ubuntu/feeding99-ui-private.json", "utf8")
);
const db = await getDb();
if (!db) throw new Error("Database non disponibile");
const [user] = await db
  .select()
  .from(users)
  .where(eq(users.id, state.sessions[0].userId));
const caller = alimentazioneRouter.createCaller({
  user,
  req: { protocol: "https", headers: {} } as TrpcContext["req"],
  res: {} as TrpcContext["res"],
});
const before = await caller.data({ scope: state.companyId });
console.log("Upload originale PDF di test…");
const uploaded = await caller.uploadNirDocument({
  productId: state.productIds[0],
  name: "referto-test.pdf",
  mime: "application/pdf",
  base64: fs
    .readFileSync("/home/ubuntu/feeding99-tests/referto-test.pdf")
    .toString("base64"),
});
const blocked = await fetch(
  "http://127.0.0.1:3000/manus-storage/" + uploaded.documentKey,
  { redirect: "manual" }
);
assert.equal(blocked.status, 403);
console.log("Estrazione IA di cinque parametri misurati nel PDF sintetico…");
const extracted = await caller.extractNir({
  productId: state.productIds[0],
  documentKey: uploaded.documentKey,
});
assert.equal(dryMatter(extracted.params), 34);
assert.equal(nutrientOnDm(extracted.params, "proteina"), 8.1);
assert.equal(nutrientOnDm(extracted.params, "ndf"), 42);
assert.equal(nutrientOnDm(extracted.params, "amido"), 32);
const afterExtraction = await caller.data({ scope: state.companyId });
assert.equal(afterExtraction.nirAnalyses.length, before.nirAnalyses.length);
assert.equal(afterExtraction.runs.length, before.runs.length);
assert.deepEqual(
  afterExtraction.products.map(p => ({ id: p.id, q: p.quantity })),
  before.products.map(p => ({ id: p.id, q: p.quantity }))
);
console.log("Intelligence con dati aziendali soltanto di test…");
const answer = await caller.intelligence({
  question:
    "Solo test informatico: indica i dati mancanti prima di valutare efficienza, IOFC e la ricetta di Primo. Non prescrivere una nuova razione e non inventare produzione latte.",
  groupId: state.groupIds[0],
});
assert.ok(answer.answer.length > 30);
const after = await caller.data({ scope: state.companyId });
assert.equal(after.recipes.length, before.recipes.length);
assert.equal(after.runs.length, before.runs.length);
assert.equal(after.comparisons.length, before.comparisons.length);
fs.writeFileSync(
  "/home/ubuntu/feeding99-tests/ai-report.json",
  JSON.stringify(
    {
      model: "gpt-6.1-sol",
      parameters: extracted.params,
      notes: extracted.notes,
      intelligence: answer,
      privateProxyStatus: blocked.status,
      noOperationalWrites: true,
    },
    null,
    2
  )
);
console.log(
  "Upload privato, estrazione verificata e Intelligence senza modifiche operative: PASS"
);
process.exit(0);
