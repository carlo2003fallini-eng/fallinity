import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import type { Pool } from "mysql2";
import { getDb } from "./db";
import {
  companies,
  users,
  companyMemberships,
  userModulePermissions,
  gruppi,
  animali,
  gruppiAnimali,
  eventiAnimale,
  prodotti,
  movimentiMagazzino,
  feedingRecipes,
  feedingRuns,
  feedingDistributions,
  feedingLeftovers,
  feedingNirAnalyses,
  feedingContainers,
  feedingSettings,
  feedingComparisons,
  feedingCorrections,
  datiStallaRilevazioni,
  acquisizioniFatture,
  righeFattureAcquisite,
  documentiFinanziari,
  registrazioniEconomiche,
  allegatiFinanziari,
  scadenzeFinanziarie,
  regoleClassificazioneFatture,
  soggetti,
  categorieFinanziarie,
  categorieCentriCosto,
  categorieCentroSottocategorie,
  centriDiCosto,
  type User,
} from "../drizzle/schema";
import { withCreate, type ActorContext } from "./domains/_core";
import type { TrpcContext } from "./_core/context";
import { alimentazioneRouter } from "./domains/feeding/router";
import { livestockService } from "./domains/livestock/service";
import { invoiceService } from "./domains/finance/invoice.service";
import { invoiceRepository } from "./domains/finance/invoice.repository";
import { confermaFatturaAcquisitaInput } from "./domains/finance/validators";
import {
  buildInvoiceDocumentHash,
  decodeInvoiceBase64,
  parseFatturaPaXml,
  FATTURA_XML_PARSER_VERSION,
} from "./domains/finance/invoice-xml";
import {
  calculateComparison,
  calculateRecipe,
  dryMatter,
  kgFactor,
  weightedCost,
} from "../shared/feeding/math";
import type {
  ComparisonSide,
  DistributionInput,
  FeedData,
  LeftoverInput,
  LoadInput,
  NirParams,
  RecipeInput,
} from "../shared/feeding/types";

/**
 * F99: integrazione reale, NON una simulazione di repository/transazioni.
 *
 * Esecuzione intenzionale, soltanto su DB di test già migrato:
 * RUN_FEEDING_INTEGRATION99=1 FEEDING_INTEGRATION_DATABASE_URL='mysql://…/test'
 *   pnpm exec vitest run server/feeding.integration99.test.ts
 *
 * Senza opt-in locale i 12 test DB vengono dichiarati SKIPPED, mai PASS. In CI
 * vengono abilitati: un URL di test mancante/DB indisponibile fallisce, non salta.
 * Il test puro
 * dell'helper acquisti continua a essere eseguibile senza rete/DB. La suite non
 * applica migrazioni, non usa utenti esistenti, storage, IA, browser o mock DB.
 * L'URL operativo DATABASE_URL non è un fallback: occorre un URL di test diverso
 * (host/porta/database), salvo opt-in ALLOW_FEEDING_SANDBOX_TENANTS99=1 del parent
 * per i soli tenant UUID temporanei nell’anteprima autorizzata. Nessun record
 * operativo esistente viene usato o aggiornato. Il pool è chiuso nel cleanup.
 * Le 2 aziende e tutti gli utenti sono UUID nuovi. Ogni test usa entità nuove;
 * nessun test dipende dai risultati del precedente. Cleanup anche dei soft-delete.
 */
const RUN_DB =
  process.env.RUN_FEEDING_INTEGRATION99 === "1" ||
  ["true", "1"].includes(process.env.CI ?? "");
const TEST_URL = process.env.FEEDING_INTEGRATION_DATABASE_URL;
const COMPANY_IDS = [randomUUID(), randomUUID()] as const;
const COMPANY_ID = COMPANY_IDS[0];
const OTHER_COMPANY_ID = COMPANY_IDS[1];
const USER_UUIDS = Array.from({ length: 4 }, () => randomUUID());
const DAY = 86_400_000;
let previousDatabaseUrl: string | undefined;
let changedDatabaseUrl = false;
let db: NonNullable<Awaited<ReturnType<typeof getDb>>> | undefined;
let manager: User;
let operator: User;
let viewer: User;
let outsider: User;
let actor: ActorContext;
let caller: ReturnType<typeof alimentazioneRouter.createCaller>;
let operatorCaller: ReturnType<typeof alimentazioneRouter.createCaller>;
let viewerCaller: ReturnType<typeof alimentazioneRouter.createCaller>;
let otherCaller: ReturnType<typeof alimentazioneRouter.createCaller>;
let groupId = "";
let otherGroupId = "";
let productId = "";
let secondProductId = "";
let animalIds: string[] = [];
let recipeId = "";
let at = 0;

// Include tutte le tabelle scritte direttamente o dai servizi richiamati; ordine
// figli -> genitori. Comprende anche conferma fattura, categoria e centro fixture.
const cleanupTables = [
  feedingCorrections,
  feedingLeftovers,
  feedingDistributions,
  feedingRuns,
  feedingComparisons,
  feedingNirAnalyses,
  feedingContainers,
  feedingSettings,
  datiStallaRilevazioni,
  feedingRecipes,
  movimentiMagazzino,
  eventiAnimale,
  gruppiAnimali,
  animali,
  gruppi,
  righeFattureAcquisite,
  acquisizioniFatture,
  allegatiFinanziari,
  scadenzeFinanziarie,
  registrazioniEconomiche,
  documentiFinanziari,
  regoleClassificazioneFatture,
  prodotti,
  soggetti,
  categorieCentroSottocategorie,
  centriDiCosto,
  categorieFinanziarie,
  categorieCentriCosto,
  userModulePermissions,
  companyMemberships,
] as const;

function connectionIdentity(raw: string) {
  const url = new URL(raw);
  if (!["mysql:", "mysql2:"].includes(url.protocol) || !url.pathname.slice(1))
    throw new Error("F99 richiede un URL MySQL con database di test esplicito");
  return `${url.hostname}:${url.port || "3306"}${url.pathname}`;
}
function database() {
  if (!db) throw new Error("F99 setup DB non completato");
  return db;
}
function makeCaller(user: User) {
  return alimentazioneRouter.createCaller({
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  });
}
function params(ss: number): NirParams {
  return {
    ss: { value: ss, unit: "%", basis: "TQ" },
    umidita: { value: 100 - ss, unit: "%", basis: "TQ" },
    ndf: { value: 42, unit: "%", basis: "SS" },
    amido: { value: 32, unit: "%", basis: "SS" },
    proteina: { value: 8.1, unit: "%", basis: "SS" },
  };
}
function loadInput(overrides: Partial<LoadInput> = {}): LoadInput {
  return {
    key: randomUUID(),
    groupId,
    recipeId,
    at,
    ingredients: [{ productId, actualKg: 100 }],
    confirm: true,
    ...overrides,
  };
}
async function readData(client = caller): Promise<FeedData> {
  return client.data();
}
async function stock(id = productId, companyId = COMPANY_ID) {
  const [row] = await database()
    .select()
    .from(prodotti)
    .where(and(eq(prodotti.id, id), eq(prodotti.companyId, companyId)));
  expect(row, "Prodotto fixture presente nel proprio tenant").toBeTruthy();
  return row!;
}
async function movements(id?: string) {
  return database()
    .select()
    .from(movimentiMagazzino)
    .where(
      and(
        eq(movimentiMagazzino.companyId, COMPANY_ID),
        id ? eq(movimentiMagazzino.prodottoId, id) : undefined
      )
    );
}
async function run(id: string) {
  const [row] = await database()
    .select()
    .from(feedingRuns)
    .where(and(eq(feedingRuns.id, id), eq(feedingRuns.companyId, COMPANY_ID)));
  expect(row).toBeTruthy();
  return row!;
}
async function loadedAndDistributed() {
  const loaded = await caller.confirmLoad(loadInput());
  const input: DistributionInput = {
    key: randomUUID(),
    runId: loaded.id,
    groupId,
    kg: 100,
    at: at + 1000,
    confirm: true,
  };
  const distribution = await caller.distribute(input);
  return { loaded, distribution };
}
async function activeNir(ss: number, product = productId) {
  const saved = await caller.saveNir({
    productId: product,
    at,
    params: params(ss),
    activate: false,
    responsible: "TEST F99 alimentarista",
    confirm: true,
  });
  await caller.activateNir({ id: saved.id, confirm: true });
  return saved;
}
async function saveActiveRecipe(ingredients: RecipeInput["ingredients"]) {
  const saved = await caller.saveRecipe({
    groupId,
    nome: `TEST F99 razione ${randomUUID()}`,
    ingredients,
    confirm: true,
  });
  await caller.activateRecipe({
    id: saved.id,
    validFrom: Date.now(),
    confirm: true,
  });
  recipeId = saved.id;
  return saved;
}
// Fixture già acquisita: parser e repository REALI, nessun upload/classificatore
// IA. invoiceService.confirm è lo stesso percorso chiamato dall'API Finanza.
async function invoiceFixture(receiptId?: string, residual?: number) {
  const categoryId = randomUUID(),
    centerCategoryId = randomUUID(),
    centerId = randomUUID();
  const code = `F99-${randomUUID().slice(0, 12)}`;
  await database()
    .insert(categorieFinanziarie)
    .values(
      withCreate(actor, {
        id: categoryId,
        codice: code,
        nome: "TEST F99 acquisto alimenti",
        tipo: "uscita" as const,
      })
    );
  await database()
    .insert(categorieCentriCosto)
    .values(
      withCreate(actor, {
        id: centerCategoryId,
        codice: code,
        nome: "TEST F99 allevamento",
      })
    );
  await database()
    .insert(centriDiCosto)
    .values(
      withCreate(actor, {
        id: centerId,
        codice: code,
        nome: "TEST F99 stalla",
        categoriaCentroId: centerCategoryId,
      })
    );
  await database()
    .insert(categorieCentroSottocategorie)
    .values(
      withCreate(actor, {
        categoriaCentroId: centerCategoryId,
        sottocategoriaId: categoryId,
      })
    );
  const date = new Date(at).toISOString().slice(0, 10);
  const number = `F99-${randomUUID()}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
<FatturaElettronicaHeader><DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>00000000099</IdCodice></IdTrasmittente><ProgressivoInvio>F99</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>0000000</CodiceDestinatario></DatiTrasmissione>
<CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>00000000099</IdCodice></IdFiscaleIVA><Anagrafica><Denominazione>TEST F99 fornitore fixture</Denominazione></Anagrafica><RegimeFiscale>RF01</RegimeFiscale></DatiAnagrafici><Sede><Indirizzo>TEST fixture</Indirizzo><CAP>00000</CAP><Comune>TEST</Comune><Nazione>IT</Nazione></Sede></CedentePrestatore>
<CessionarioCommittente><DatiAnagrafici><Anagrafica><Denominazione>TEST F99 azienda fixture</Denominazione></Anagrafica></DatiAnagrafici></CessionarioCommittente></FatturaElettronicaHeader>
<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>${date}</Data><Numero>${number}</Numero><ImportoTotaleDocumento>2000.00</ImportoTotaleDocumento></DatiGeneraliDocumento></DatiGenerali>
<DatiBeniServizi><DettaglioLinee><NumeroLinea>1</NumeroLinea><Descrizione>TEST F99 silomais ${productId}</Descrizione><Quantita>200.00</Quantita><UnitaMisura>q</UnitaMisura><PrezzoUnitario>10.00</PrezzoUnitario><PrezzoTotale>2000.00</PrezzoTotale><AliquotaIVA>0.00</AliquotaIVA></DettaglioLinee><DatiRiepilogo><AliquotaIVA>0.00</AliquotaIVA><ImponibileImporto>2000.00</ImponibileImporto><Imposta>0.00</Imposta></DatiRiepilogo></DatiBeniServizi>
<DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>MP05</ModalitaPagamento><DataScadenzaPagamento>${date}</DataScadenzaPagamento><ImportoPagamento>2000.00</ImportoPagamento></DettaglioPagamento></DatiPagamento></FatturaElettronicaBody></p:FatturaElettronica>`;
  const bytes = Buffer.from(xml);
  const file = {
    nomeFile: `${number}.xml`,
    mimeType: "application/xml",
    contenutoBase64: bytes.toString("base64"),
    dimensione: bytes.length,
  };
  const decoded = decodeInvoiceBase64(file.contenutoBase64, file.dimensione);
  const parsed = parseFatturaPaXml(decoded.xml);
  const acquisition = await invoiceRepository.insertAcquisition(
    actor,
    {
      stato: "da_verificare",
      nomeFile: file.nomeFile,
      mimeType: file.mimeType,
      dimensione: bytes.length,
      fileKey: `fixture-no-upload/${COMPANY_ID}/${number}.xml`,
      fileUrl: `https://example.invalid/${number}.xml`,
      hashFile: decoded.hashFile,
      hashDocumento: buildInvoiceDocumentHash(parsed),
      parserVersion: FATTURA_XML_PARSER_VERSION,
      numeroDocumento: parsed.numeroDocumento,
      dataDocumento: parsed.dataDocumento,
      tipoDocumento: parsed.tipoDocumento,
      tipoMovimento: "uscita",
      fornitoreRagioneSociale: parsed.fornitore.ragioneSociale,
      fornitorePartitaIva: parsed.fornitore.partitaIva,
      imponibile: parsed.imponibile,
      importoIva: parsed.importoIva,
      totale: parsed.totale,
      riepiloghiIvaJson: parsed.riepiloghiIva,
    },
    parsed.righe.map(line => ({
      ...line,
      categoriaId: categoryId,
      centroCostoId: centerId,
      prodottoId: productId,
      aggiornaMagazzino: true,
    }))
  );
  const detail = await invoiceRepository.getDetail(COMPANY_ID, acquisition.id);
  expect(detail!.lines).toHaveLength(1);
  const confirmInput = confermaFatturaAcquisitaInput.parse({
    acquisizioneId: acquisition.id,
    dataCompetenza: date,
    scadenze: [{ dataScadenza: date, importo: parsed.totale }],
    righe: [
      {
        rigaId: detail!.lines[0].id,
        categoriaId: categoryId,
        centroCostoId: centerId,
        destinazione: "magazzino",
        aggiornaMagazzino: true,
        prodottoId: productId,
        creaProdotto: false,
        ricevimentoMagazzinoId: receiptId,
        quantitaRicevutaResidua: residual,
      },
    ],
  });
  return {
    acquisition,
    file,
    confirmInput,
    lineId: detail!.lines[0].id,
    parsed,
  };
}
async function assertInvoiceRetry(
  fixture: Awaited<ReturnType<typeof invoiceFixture>>,
  documentId: string
) {
  const before = await stock();
  const beforeMoves = await movements(productId);
  const docs = await database()
    .select()
    .from(documentiFinanziari)
    .where(eq(documentiFinanziari.companyId, COMPANY_ID));
  const economic = await database()
    .select()
    .from(registrazioniEconomiche)
    .where(eq(registrazioniEconomiche.companyId, COMPANY_ID));
  const replay = await invoiceService.confirm(actor, fixture.confirmInput);
  expect(replay).toMatchObject({
    documentoId: documentId,
    giaRegistrata: true,
    movimentiMagazzino: 0,
  });
  const reimport = await invoiceService.acquire(actor, fixture.file); // hash già registrato: nessun storage/IA.
  expect(reimport.id).toBe(fixture.acquisition.id);
  expect(reimport.riutilizzata).toBe(true);
  const changedBytes = Buffer.from(
    `${Buffer.from(fixture.file.contenutoBase64, "base64").toString("utf8")}\n`
  );
  const sameDocument = await invoiceService.acquire(actor, {
    ...fixture.file,
    contenutoBase64: changedBytes.toString("base64"),
    dimensione: changedBytes.length,
  });
  expect(sameDocument.id).toBe(fixture.acquisition.id);
  expect(sameDocument.riutilizzata).toBe(true);
  expect(await stock()).toEqual(before);
  expect(await movements(productId)).toEqual(beforeMoves);
  expect(
    await database()
      .select()
      .from(documentiFinanziari)
      .where(eq(documentiFinanziari.companyId, COMPANY_ID))
  ).toEqual(docs);
  expect(
    await database()
      .select()
      .from(registrazioniEconomiche)
      .where(eq(registrazioniEconomiche.companyId, COMPANY_ID))
  ).toEqual(economic);
}
async function foreignFixture() {
  const foreignActor: ActorContext = {
    companyId: OTHER_COMPANY_ID,
    userId: outsider.id,
    userUuid: outsider.uuid,
  };
  const foreignGroup = randomUUID();
  const foreignProduct = randomUUID();
  await database()
    .insert(gruppi)
    .values(
      withCreate(foreignActor, {
        id: foreignGroup,
        nome: "TEST F99 gruppo altra azienda",
        tipologia: "lattazione" as const,
      })
    );
  await database()
    .insert(animali)
    .values(
      withCreate(foreignActor, {
        id: randomUUID(),
        matricola: `F99-${randomUUID()}`,
        gruppoId: foreignGroup,
      })
    );
  await database()
    .insert(prodotti)
    .values(
      withCreate(foreignActor, {
        id: foreignProduct,
        nome: "TEST F99 alimento altra azienda",
        categoria: "Alimenti",
        unitaMisura: "kg",
        quantita: "1000.000",
        costoMedioUnitario: "0.090000",
      })
    );
  const foreignRecipe = await otherCaller.saveRecipe({
    groupId: foreignGroup,
    nome: "TEST F99 ricetta altra azienda",
    ingredients: [{ productId: foreignProduct, kgPerHead: 10, order: 0 }],
    confirm: true,
  });
  await otherCaller.activateRecipe({ id: foreignRecipe.id, confirm: true });
  await otherCaller.configureFrequency({
    groupId: foreignGroup,
    runsPerDay: 1,
    confirm: true,
  });
  const foreignNir = await otherCaller.saveNir({
    productId: foreignProduct,
    at,
    params: params(30),
    confirm: true,
  });
  const foreignRun = await otherCaller.confirmLoad({
    key: randomUUID(),
    groupId: foreignGroup,
    recipeId: foreignRecipe.id,
    at,
    ingredients: [{ productId: foreignProduct, actualKg: 10 }],
    confirm: true,
  });
  const foreignDist = await otherCaller.distribute({
    key: randomUUID(),
    runId: foreignRun.id,
    groupId: foreignGroup,
    at: at + 1000,
    kg: 10,
    confirm: true,
  });
  return {
    foreignGroup,
    foreignProduct,
    foreignRecipe,
    foreignNir,
    foreignRun,
    foreignDist,
  };
}

// Helper effettivamente importato da finance/invoice.repository.ts per l'acquisto.
// Non sostituisce una verifica DB della fattura/reimportazione: è esplicitamente puro.
describe("F99 — acquisto ponderato: helper produzione senza DB", () => {
  it("converte 200 q in kg, valorizza solo il residuo e non inventa costi mancanti", () => {
    const incomingKg = 200 * kgFactor("q")!;
    const incomingPriceKg = 10 / kgFactor("q")!;
    const mean = weightedCost(42_000, 9 / 100, incomingKg, incomingPriceKg);
    expect(42_000 + incomingKg).toBe(62_000);
    expect(mean).toBeCloseTo((42_000 * 0.09 + 20_000 * 0.1) / 62_000, 12);
    expect(mean! * 100).toBeCloseTo(9.322580645, 8);
    expect(weightedCost(42_000, null, incomingKg, incomingPriceKg)).toBeNull();
    expect(weightedCost(0, null, incomingKg, incomingPriceKg)).toBe(0.1);
    expect(weightedCost(0, null, 0, null)).toBeNull();
    expect(kgFactor("t")).toBe(1000);
    expect(kgFactor("pz")).toBeNull();
  });
});

describe
  .skipIf(!RUN_DB)
  .sequential("F99 — 12 accettazioni reali / tenant temporanei", () => {
    beforeAll(async () => {
      if (!TEST_URL)
        throw new Error(
          "F99 opt-in richiede FEEDING_INTEGRATION_DATABASE_URL; nessun fallback operativo"
        );
      const testIdentity = connectionIdentity(TEST_URL);
      previousDatabaseUrl = process.env.DATABASE_URL;
      if (
        previousDatabaseUrl &&
        connectionIdentity(previousDatabaseUrl) === testIdentity &&
        process.env.ALLOW_FEEDING_SANDBOX_TENANTS99 !== "1"
      )
        throw new Error(
          "F99 vieta il database operativo: usa un database di test distinto e già migrato"
        );
      process.env.DATABASE_URL = TEST_URL;
      changedDatabaseUrl = true;
      const connection = await getDb();
      if (!connection)
        throw new Error("F99 DB di test non disponibile; test non simulati");
      db = connection;
      await db.insert(companies).values(
        COMPANY_IDS.map(id => ({
          id,
          name: `TEST F99 ${id}`,
          createdBy: USER_UUIDS[0],
          updatedBy: USER_UUIDS[0],
        }))
      );
      const roles = ["manager", "operator", "viewer", "manager"] as const;
      await db.insert(users).values(
        USER_UUIDS.map((uuid, i) => ({
          uuid,
          openId: `f99-${uuid}`,
          name: `TEST F99 ${roles[i]}`,
          platformRole: roles[i],
          role: "user" as const,
          activeCompanyId: i === 3 ? OTHER_COMPANY_ID : COMPANY_ID,
        }))
      );
      const temporaryUsers = await db
        .select()
        .from(users)
        .where(inArray(users.uuid, USER_UUIDS));
      const findUser = (uuid: string) => {
        const user = temporaryUsers.find(u => u.uuid === uuid);
        if (!user) throw new Error("F99 creazione utente fixture incompleta");
        return user;
      };
      [manager, operator, viewer, outsider] = USER_UUIDS.map(findUser);
      actor = {
        companyId: COMPANY_ID,
        userId: manager.id,
        userUuid: manager.uuid,
      };
      await db
        .insert(companyMemberships)
        .values(
          temporaryUsers.map(user =>
            withCreate(
              { ...actor, companyId: user.activeCompanyId! },
              { userId: user.id, roleCode: user.platformRole, attiva: true }
            )
          )
        );
      await db.insert(userModulePermissions).values(
        temporaryUsers.flatMap(user => {
          const userActor = { ...actor, companyId: user.activeCompanyId! };
          const records = [
            withCreate(userActor, {
              userId: user.id,
              moduleKey: "azienda.stalla.alimentazione",
              canView: true,
              canEdit: user.platformRole !== "viewer",
            }),
          ];
          if (user.platformRole === "manager")
            records.push(
              withCreate(userActor, {
                userId: user.id,
                moduleKey: "finanza.kpi",
                canView: true,
                canEdit: false,
              })
            );
          return records;
        })
      );
      caller = makeCaller(manager);
      operatorCaller = makeCaller(operator);
      viewerCaller = makeCaller(viewer);
      otherCaller = makeCaller(outsider);
    }, 60_000);

    beforeEach(async () => {
      groupId = randomUUID();
      otherGroupId = randomUUID();
      productId = randomUUID();
      secondProductId = randomUUID();
      animalIds = [randomUUID(), randomUUID()];
      at = Date.now();
      await database()
        .insert(gruppi)
        .values(
          [groupId, otherGroupId].map(id =>
            withCreate(actor, {
              id,
              nome: `TEST F99 gruppo ${id}`,
              tipologia: "lattazione" as const,
              tipoGestione: "manuale" as const,
              modalitaMembri: "esclusivo" as const,
            })
          )
        );
      await database()
        .insert(animali)
        .values(
          animalIds.map(id =>
            withCreate(actor, {
              id,
              matricola: `F99-${id}`,
              gruppoId: groupId,
              statoProduttivo: "in_lattazione" as const,
            })
          )
        );
      await database()
        .insert(prodotti)
        .values(
          [productId, secondProductId].map(id =>
            withCreate(actor, {
              id,
              nome: `TEST F99 alimento ${id}`,
              categoria: "Alimenti",
              unitaMisura: "kg",
              quantita: "1000.000",
              prezzoUnitario: null,
              costoMedioUnitario: "0.090000",
              costoFonte: "TEST costo residuo documentato",
            })
          )
        );
      await caller.configureFrequency({
        groupId,
        runsPerDay: 1,
        confirm: true,
      });
      await saveActiveRecipe([{ productId, kgPerHead: 50, order: 0 }]);
    }, 60_000);

    afterAll(async () => {
      const failures: unknown[] = [];
      try {
        if (db) {
          for (const table of cleanupTables) {
            try {
              await db
                .delete(table)
                .where(inArray(table.companyId, [...COMPANY_IDS]));
              const remaining = await db
                .select({ id: table.id })
                .from(table)
                .where(inArray(table.companyId, [...COMPANY_IDS]));
              expect(
                remaining,
                "Cleanup completo anche per record soft-deleted"
              ).toHaveLength(0);
            } catch (error) {
              failures.push(error);
            }
          }
          try {
            await db.delete(users).where(inArray(users.uuid, USER_UUIDS));
            expect(
              await db
                .select({ id: users.id })
                .from(users)
                .where(inArray(users.uuid, USER_UUIDS))
            ).toHaveLength(0);
          } catch (error) {
            failures.push(error);
          }
          try {
            await db
              .delete(companies)
              .where(inArray(companies.id, [...COMPANY_IDS]));
            expect(
              await db
                .select({ id: companies.id })
                .from(companies)
                .where(inArray(companies.id, [...COMPANY_IDS]))
            ).toHaveLength(0);
          } catch (error) {
            failures.push(error);
          }
        }
      } finally {
        // getDb espone un pool MySQL callback sotto $client. Nessun vi.mock/getDb fake.
        if (db) {
          try {
            const pool = (db as typeof db & { $client: Pool }).$client;
            await new Promise<void>((resolve, reject) =>
              pool.end(error => (error ? reject(error) : resolve()))
            );
          } catch (error) {
            failures.push(error);
          }
        }
        if (changedDatabaseUrl) {
          if (previousDatabaseUrl === undefined)
            delete process.env.DATABASE_URL;
          else process.env.DATABASE_URL = previousDatabaseUrl;
        }
      }
      if (failures.length)
        throw new AggregateError(
          failures,
          "F99 cleanup/chiusura connessione incompleti"
        );
    }, 60_000);

    it("1 — capi da Stalla: spostamento ricalcola il presente senza mutare il carro storico", async () => {
      const before = await readData();
      const group = before.groups.find(g => g.id === groupId)!;
      const recipe = before.recipes.find(r => r.id === recipeId)!;
      expect(group.nAnimali).toBe(2);
      expect(group.animalIds.sort()).toEqual([...animalIds].sort());
      expect(calculateRecipe(recipe, group, before.products).kgPerRun).toBe(
        100
      );
      const loaded = await caller.confirmLoad(loadInput());
      const snapshot = structuredClone((await run(loaded.id)).payload);
      await livestockService.spostaGruppo(actor, {
        animaleId: animalIds[0],
        nuovoGruppoId: otherGroupId,
        confermaFattori: false,
        motivo: "TEST F99 verifica fonte unica Stalla",
      });
      const after = await readData();
      const currentGroup = after.groups.find(g => g.id === groupId)!;
      const stalla = await livestockService.getGruppoDetail(
        COMPANY_ID,
        groupId
      );
      expect(currentGroup.nAnimali).toBe(stalla!.stats.totale);
      expect(currentGroup.nAnimali).toBe(1);
      expect(after.groups.find(g => g.id === otherGroupId)!.nAnimali).toBe(1);
      const calc = calculateRecipe(recipe, currentGroup, after.products);
      expect(calc.kgPerDay).toBe(50);
      expect(calc.kgPerRun).toBe(50);
      expect(after.products.find(p => p.id === productId)!.dailyUseKg).toBe(50);
      expect((await run(loaded.id)).payload).toEqual(snapshot);
      expect(snapshot.headCount).toBe(2);
      expect(snapshot.animalIds.sort()).toEqual([...animalIds].sort());
    }, 60_000);

    it("2 — bozza senza scarico, doppia conferma concorrente idempotente e payload diverso respinto", async () => {
      const draft = await operatorCaller.saveDraft({
        groupId,
        recipeId,
        draft: { actualKg: 90 },
        confirm: true,
      });
      expect(Number((await stock()).quantita)).toBe(1000);
      expect(await movements(productId)).toHaveLength(0);
      expect((await run(draft.id)).state).toBe("preparazione");
      const input = loadInput({
        draftId: draft.id,
        ingredients: [{ productId, actualKg: 90 }],
      });
      const [first, second] = await Promise.all([
        operatorCaller.confirmLoad(input),
        operatorCaller.confirmLoad(input),
      ]);
      expect(first.id).toBe(second.id);
      expect([first.idempotent, second.idempotent].sort()).toEqual([
        false,
        true,
      ]);
      expect(Number((await stock()).quantita)).toBe(910);
      const rows = await movements(productId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        tipo: "scarico",
        causale: "carico_carro",
        originModule: "feeding",
        originId: first.id,
        operatore: operator.uuid,
      });
      expect(Number(rows[0].quantita)).toBe(90);
      expect((await run(draft.id)).state).toBe("annullato");
      expect((await run(first.id)).payload.ingredients[0].actualKg).toBe(90);
      const retry = await operatorCaller.confirmLoad(input);
      expect(retry).toEqual({ id: first.id, idempotent: true });
      await expect(
        operatorCaller.confirmLoad({
          ...input,
          ingredients: [{ productId, actualKg: 91 }],
        })
      ).rejects.toThrow(/dati diversi/);
      expect(Number((await stock()).quantita)).toBe(910);
      expect(await movements(productId)).toHaveLength(1);
      expect(
        await database()
          .select()
          .from(feedingRuns)
          .where(
            and(
              eq(feedingRuns.companyId, COMPANY_ID),
              eq(feedingRuns.requestKey, input.key)
            )
          )
      ).toHaveLength(1);
    }, 60_000);

    it("3 — rollback multi-ingrediente dopo il primo scarico: nessuna giacenza/movimento/carico parziale", async () => {
      const [firstId, scarceId] = [productId, secondProductId].sort();
      await saveActiveRecipe([
        { productId: firstId, kgPerHead: 25, order: 0 },
        { productId: scarceId, kgPerHead: 25, order: 1 },
      ]);
      await database()
        .update(prodotti)
        .set({ quantita: "1.000" })
        .where(
          and(eq(prodotti.id, scarceId), eq(prodotti.companyId, COMPANY_ID))
        );
      const beforeFirst = await stock(firstId);
      const beforeScarce = await stock(scarceId);
      const input = loadInput({
        ingredients: [
          { productId: firstId, actualKg: 50 },
          { productId: scarceId, actualKg: 50 },
        ],
      });
      await expect(caller.confirmLoad(input)).rejects.toThrow(
        /Giacenza insufficiente/
      );
      expect(await stock(firstId)).toEqual(beforeFirst);
      expect(await stock(scarceId)).toEqual(beforeScarce);
      expect(await movements(firstId)).toHaveLength(0);
      expect(await movements(scarceId)).toHaveLength(0);
      expect(
        await database()
          .select()
          .from(feedingRuns)
          .where(
            and(
              eq(feedingRuns.companyId, COMPANY_ID),
              eq(feedingRuns.requestKey, input.key)
            )
          )
      ).toHaveLength(0);
    }, 60_000);

    it("4 — distribuzioni parziali e retry non scaricano nuovamente, saldo non superabile", async () => {
      const loaded = await caller.confirmLoad(loadInput());
      const originalStock = await stock();
      const originalMovements = await movements(productId);
      const input: DistributionInput = {
        key: randomUUID(),
        runId: loaded.id,
        groupId,
        at: at + 1000,
        kg: 40,
        confirm: true,
      };
      const first = await operatorCaller.distribute(input);
      expect(await operatorCaller.distribute(input)).toEqual({
        id: first.id,
        idempotent: true,
      });
      expect((await run(loaded.id)).payload).toMatchObject({
        state: "parziale",
        remainingKg: 60,
      });
      await expect(
        operatorCaller.distribute({ ...input, key: randomUUID(), kg: 61 })
      ).rejects.toThrow(/residuo/);
      await expect(
        operatorCaller.distribute({ ...input, kg: 41 })
      ).rejects.toThrow(/dati diversi/);
      await operatorCaller.distribute({
        ...input,
        key: randomUUID(),
        kg: 60,
        at: at + 2000,
      });
      expect((await run(loaded.id)).payload).toMatchObject({
        state: "distribuito",
        remainingKg: 0,
      });
      expect(await stock()).toEqual(originalStock);
      expect(await movements(productId)).toEqual(originalMovements);
      const data = await readData();
      const distributions = data.distributions.filter(
        d => d.runId === loaded.id
      );
      expect(distributions).toHaveLength(2);
      expect(distributions.reduce((s, d) => s + d.kg, 0)).toBe(100);
      expect(data.groups.find(g => g.id === groupId)!.lastDistributionAt).toBe(
        at + 2000
      );
    }, 60_000);

    it("5 — contenitore 1,5 × 45 = 67,5 kg ricalcolati server e calibrazione storica stabile", async () => {
      const { distribution } = await loadedAndDistributed();
      const container = await operatorCaller.saveContainer({
        nome: "TEST F99 carriola calibrata",
        kg: 45,
        groupId,
        recipeId,
        confirm: true,
      });
      const input: LeftoverInput = {
        key: randomUUID(),
        distributionId: distribution.id,
        at: at + 2000,
        method: "contenitore",
        containerId: container.id,
        containerCount: 1.5,
        kg: 999,
        destination: "rimosso",
        confirm: true,
      };
      const leftover = await operatorCaller.registerLeftover(input);
      const first = (await readData()).leftovers.find(
        l => l.id === leftover.id
      )!;
      expect(first).toMatchObject({
        kg: 67.5,
        containerCount: 1.5,
        containerWeightKg: 45,
        distributionId: distribution.id,
      });
      await operatorCaller.saveContainer({
        id: container.id,
        nome: "TEST F99 nuova calibrazione",
        kg: 50,
        groupId,
        recipeId,
        confirm: true,
      });
      const retry = await operatorCaller.registerLeftover(input);
      expect(retry.id).toBe(leftover.id);
      expect(
        (await readData()).leftovers.find(l => l.id === leftover.id)
      ).toEqual(first);
      await expect(
        operatorCaller.registerLeftover({ ...input, key: randomUUID() })
      ).rejects.toThrow(/già registrato/);
      const managed = await caller.saveContainer({
        nome: "TEST F99 calibrazione responsabile",
        kg: 350,
        groupId,
        confirm: true,
      });
      await expect(
        operatorCaller.saveContainer({
          id: managed.id,
          nome: "TEST F99 tentativo modifica altrui",
          kg: 300,
          groupId,
          confirm: true,
        })
      ).rejects.toThrow();
      expect(
        (await readData()).containers.find(c => c.id === managed.id)!.kg
      ).toBe(350);
      expect(await movements(productId)).toHaveLength(1);
    }, 60_000);

    it("6 — riuso compatibile riduce fresco e non produce un secondo scarico del residuo", async () => {
      const { loaded, distribution } = await loadedAndDistributed();
      const leftover = await operatorCaller.registerLeftover({
        key: randomUUID(),
        distributionId: distribution.id,
        at: at + 2000,
        method: "kg",
        kg: 20,
        destination: "riutilizzo",
        compositionKnown: true,
        compatibleReuse: true,
        confirm: true,
      });
      const input = loadInput({
        at: at + 3000,
        leftoverId: leftover.id,
        reusedKg: 20,
        compatibleReuse: true,
        ingredients: [{ productId, actualKg: 80 }],
      });
      await expect(
        operatorCaller.confirmLoad({
          ...input,
          key: randomUUID(),
          compatibleReuse: false,
        })
      ).rejects.toThrow(/compatibilità/);
      const next = await operatorCaller.confirmLoad(input);
      const payload = (await run(next.id)).payload;
      expect(payload).toMatchObject({
        expectedKg: 100,
        freshKg: 80,
        reusedKg: 20,
        totalKg: 100,
        remainingKg: 100,
        leftoverId: leftover.id,
      });
      expect(payload.ingredients[0].expectedKg).toBe(80);
      expect(payload.totalCostCents).toBe(
        (await run(loaded.id)).payload.totalCostCents
      );
      expect(Number((await stock()).quantita)).toBe(820);
      const rows = await movements(productId);
      expect(rows).toHaveLength(2);
      expect(rows.reduce((s, m) => s + Number(m.quantita), 0)).toBe(180);
      expect(
        (await readData()).leftovers.find(l => l.id === leftover.id)!.reusedKg
      ).toBe(20);
      await operatorCaller.confirmLoad(input);
      expect(Number((await stock()).quantita)).toBe(820);
      expect(await movements(productId)).toHaveLength(2);
      await expect(
        operatorCaller.confirmLoad({ ...input, key: randomUUID() })
      ).rejects.toThrow(/insufficiente|incompatibile/);
      expect(
        (await readData()).leftovers.find(l => l.id === leftover.id)!.reusedKg
      ).toBe(20);
      // Accettazione acquisto reale: 42.000 kg RESIDUI, non somma acquisti.
      // Il setup fisico è esclusivo della fixture; la valorizzazione passa da
      // invoiceService.confirm e dalla sua transazione produzione, mai da mock.
      const historicalFirst = structuredClone((await run(loaded.id)).payload);
      const historicalNext = structuredClone((await run(next.id)).payload);
      await database()
        .update(prodotti)
        .set({ quantita: "42000.000" })
        .where(
          and(eq(prodotti.id, productId), eq(prodotti.companyId, COMPANY_ID))
        );
      const purchase = await invoiceFixture();
      const result = await invoiceService.confirm(actor, purchase.confirmInput);
      expect(result.giaRegistrata).toBe(false);
      expect(result.movimentiMagazzino).toBe(1);
      const purchased = await stock();
      expect(Number(purchased.quantita)).toBe(62_000);
      expect(Number(purchased.costoMedioUnitario)).toBeCloseTo(
        weightedCost(42_000, 0.09, 20_000, 0.1)!,
        6
      );
      const purchaseRows = (await movements(productId)).filter(
        m => m.fatturaRigaId === purchase.lineId
      );
      expect(purchaseRows).toHaveLength(1);
      expect(Number(purchaseRows[0].quantita)).toBe(20_000);
      expect(Number(purchaseRows[0].costoUnitario)).toBe(0.1);
      expect(purchaseRows[0]).toMatchObject({
        tipo: "carico",
        originModule: "finance",
        originId: purchase.acquisition.id,
        causale: "acquisto_fattura",
      });
      const current = await readData();
      expect(
        current.products.find(p => p.id === productId)!.prezzoKg
      ).toBeCloseTo(Number(purchased.costoMedioUnitario), 12);
      expect(
        calculateRecipe(
          current.recipes.find(r => r.id === recipeId)!,
          current.groups.find(g => g.id === groupId)!,
          current.products
        ).costPerHead
      ).toBeCloseTo(50 * Number(purchased.costoMedioUnitario), 12);
      expect((await run(loaded.id)).payload).toEqual(historicalFirst);
      expect((await run(next.id)).payload).toEqual(historicalNext);
      await assertInvoiceRetry(purchase, result.documentoId);
    }, 60_000);

    it("7 — preferenze persistenti per operatore/gruppo/azienda senza avanzo automatico", async () => {
      const before = await readData();
      const value = {
        lastGroupId: groupId,
        recipeId,
        method: "contenitore",
        containerWeightKg: 45,
        lastCount: 1.5,
        ingredientOrder: [productId],
        destination: "rimosso",
      };
      const saved = await operatorCaller.savePreferences({
        scopeType: "operatore",
        value,
        confirm: true,
      });
      await operatorCaller.savePreferences({
        scopeType: "operatore",
        value: { lastCount: 2 },
        confirm: true,
      });
      await caller.savePreferences({
        scopeType: "gruppo",
        scopeId: groupId,
        value: { method: "kg" },
        confirm: true,
      });
      await caller.savePreferences({
        scopeType: "azienda",
        value: { requireReuseCheck: true },
        confirm: true,
      });
      const reopened = makeCaller(operator);
      const data = await readData(reopened);
      const personal = data.settings.filter(
        s => s.scopeType === "operatore" && s.scopeId === String(operator.id)
      );
      expect(personal).toHaveLength(1);
      expect(personal[0]).toMatchObject({
        id: saved.id,
        value: { ...value, lastCount: 2 },
      });
      expect(
        data.settings.some(
          s =>
            s.scopeType === "gruppo" &&
            s.scopeId === groupId &&
            s.value.method === "kg"
        )
      ).toBe(true);
      expect(
        data.settings.some(
          s =>
            s.scopeType === "azienda" &&
            s.scopeId === COMPANY_ID &&
            s.value.requireReuseCheck === true
        )
      ).toBe(true);
      expect(
        (await readData()).settings.some(
          s => s.scopeType === "operatore" && s.scopeId === String(operator.id)
        )
      ).toBe(false);
      expect(data.leftovers).toEqual(before.leftovers);
      expect(await movements(productId)).toHaveLength(0);
    }, 60_000);

    it("8 — un carro ogni 3 giorni: frequenza 1/3 persistita, peso carro e consumo giornaliero distinti", async () => {
      await database()
        .update(gruppi)
        .set({ tipologia: "manze" })
        .where(and(eq(gruppi.id, groupId), eq(gruppi.companyId, COMPANY_ID)));
      await database()
        .update(animali)
        .set({ statoProduttivo: "manza" })
        .where(
          and(eq(animali.gruppoId, groupId), eq(animali.companyId, COMPANY_ID))
        );
      await caller.configureFrequency({
        groupId,
        runsPerDay: 1 / 3,
        confirm: true,
      });
      const data = await readData(makeCaller(manager));
      const group = data.groups.find(g => g.id === groupId)!;
      expect(group.frequency).toBeCloseTo(1 / 3, 12);
      expect(group.frequencyReliability).toBe("configurata");
      const calc = calculateRecipe(
        data.recipes.find(r => r.id === recipeId)!,
        group,
        data.products
      );
      expect(calc.kgPerDay).toBe(100);
      expect(calc.kgPerRun).toBe(300);
      expect(data.products.find(p => p.id === productId)!.dailyUseKg).toBe(100);
      expect(data.products.find(p => p.id === productId)!.autonomyDays).toBe(
        10
      );
      const loaded = await caller.confirmLoad(
        loadInput({ ingredients: [{ productId, actualKg: 300 }] })
      );
      expect((await run(loaded.id)).payload.expectedKg).toBe(300);
      const stillNotFed = await readData();
      expect(
        stillNotFed.groups.find(g => g.id === groupId)!.lastDistributionAt
      ).toBeNull();
      expect(
        stillNotFed.groups.find(g => g.id === groupId)!.frequencyReliability
      ).toBe("configurata");
      const distribution = await caller.distribute({
        key: randomUUID(),
        runId: loaded.id,
        groupId,
        kg: 300,
        at: at + 1000,
        confirm: true,
      });
      await caller.registerLeftover({
        key: randomUUID(),
        distributionId: distribution.id,
        at: at + 2000,
        method: "nessuno",
        destination: "rimosso",
        confirm: true,
      });
      const fed = (await readData()).groups.find(g => g.id === groupId)!;
      expect(fed.nextDistributionAt).toBe(at + 1000 + 3 * DAY);
      const analysis = await caller.analytics({
        from: at - 1000,
        to: at + 3000,
        groupId,
      });
      expect(analysis.groups.find(g => g.groupId === groupId)).toMatchObject({
        lactating: false,
        milk: null,
        iofc: null,
      });
    }, 60_000);

    it("9 — nuova analisi NIR aggiorna corrente ma conserva analisi, quantità e snapshot carro precedenti", async () => {
      const firstNir = await activeNir(34);
      const before = await readData();
      const recipe = before.recipes.find(r => r.id === recipeId)!;
      const loaded = await caller.confirmLoad(loadInput());
      const historicalRun = structuredClone((await run(loaded.id)).payload);
      const secondNir = await activeNir(30);
      const after = await readData();
      const analyses = after.nirAnalyses.filter(n => n.productId === productId);
      expect(analyses).toHaveLength(2);
      expect(analyses.find(n => n.id === firstNir.id)).toMatchObject({
        active: false,
        params: params(34),
      });
      expect(analyses.find(n => n.id === secondNir.id)).toMatchObject({
        active: true,
        params: params(30),
      });
      const product = after.products.find(p => p.id === productId)!;
      expect(product.nirId).toBe(secondNir.id);
      expect(product.params.umidita.value).toBe(70);
      expect(dryMatter(product.params)).toBe(30);
      expect(
        calculateRecipe(
          recipe,
          after.groups.find(g => g.id === groupId)!,
          after.products
        ).ssKgPerHead
      ).toBe(15);
      expect(after.recipes.find(r => r.id === recipeId)!.ingredients).toEqual(
        recipe.ingredients
      );
      expect((await run(loaded.id)).payload).toEqual(historicalRun);
      expect(historicalRun.ingredients[0]).toMatchObject({
        nirId: firstNir.id,
        dryMatter: 34,
        params: params(34),
      });
      expect(await movements(productId)).toHaveLength(1);
    }, 60_000);

    it("10 — confronto persistito rilegge lato aziendale, crea versioni senza carico o nuovo prodotto", async () => {
      const nir = await activeNir(34);
      const before = await readData();
      const beforeStock = await stock();
      const beforeMovements = await movements(productId);
      const left: ComparisonSide = {
        productId,
        nome: "Nome client non autorevole",
        pricePerQuintal: 1,
        params: params(10),
        source: "client",
      };
      const right: ComparisonSide = {
        nome: "TEST F99 offerta NON acquistata",
        pricePerQuintal: 8.5,
        params: params(30),
        supplier: "TEST F99 nuovo fornitore",
        source: "Offerta inserita e verificata",
      };
      const saved = await caller.saveComparison({
        left,
        right,
        notes: "TEST F99 valutazione",
        confirm: true,
      });
      const historical = (await readData()).comparisons.find(
        c => c.id === saved.id
      )!;
      expect(historical.left).toMatchObject({
        productId,
        nome: beforeStock.nome,
        pricePerQuintal: 9,
        nirId: nir.id,
        params: params(34),
      });
      expect(historical.right).toEqual(right);
      expect(historical.results).toEqual(
        calculateComparison(historical.left, historical.right)
      );
      expect(
        calculateComparison(historical.left, historical.right).equivalentPrice
      ).toBeCloseTo((9 * 30) / 34, 12);
      // Il ricevimento fisico è già compreso nelle scorte. La fattura lo
      // valorizza senza aumentare nuovamente giacenza né aggiungere movimenti.
      const receiptId = randomUUID();
      await database()
        .update(prodotti)
        .set({ quantita: "62000.000" })
        .where(
          and(eq(prodotti.id, productId), eq(prodotti.companyId, COMPANY_ID))
        );
      await database()
        .insert(movimentiMagazzino)
        .values(
          withCreate(actor, {
            id: receiptId,
            prodottoId: productId,
            tipo: "carico" as const,
            quantita: "20000.000",
            data: new Date(at),
            dataOra: new Date(at),
            causale: "TEST ricevimento fisico",
            originModule: "inventory",
            operatore: actor.userUuid,
          })
        );
      const purchase = await invoiceFixture(receiptId, 20_000);
      const result = await invoiceService.confirm(actor, purchase.confirmInput);
      expect(result.giaRegistrata).toBe(false);
      expect(result.movimentiMagazzino).toBe(0);
      const valuedStock = await stock();
      expect(Number(valuedStock.quantita)).toBe(62_000);
      expect(Number(valuedStock.costoMedioUnitario)).toBeCloseTo(
        weightedCost(42_000, 0.09, 20_000, 0.1)!,
        6
      );
      const linked = (await movements(productId)).find(
        m => m.id === receiptId
      )!;
      expect(linked.fatturaRigaId).toBe(purchase.lineId);
      expect(Number(linked.quantita)).toBe(20_000);
      expect(Number(linked.costoUnitario)).toBe(0.1);
      expect(await movements(productId)).toHaveLength(
        beforeMovements.length + 1
      );
      await assertInvoiceRetry(purchase, result.documentoId);
      const afterInvoiceMoves = await movements(productId);
      const next = await caller.saveComparison({
        id: saved.id,
        left,
        right,
        notes: "TEST F99 nuova versione",
        confirm: true,
      });
      expect(next.id).not.toBe(saved.id);
      const reopened = await readData(makeCaller(manager));
      expect(reopened.comparisons.find(c => c.id === saved.id)).toEqual(
        historical
      );
      expect(reopened.comparisons.find(c => c.id === next.id)).toMatchObject({
        parentId: saved.id,
        left: { pricePerQuintal: Number(valuedStock.costoMedioUnitario) * 100 },
      });
      expect(reopened.products.map(p => p.id).sort()).toEqual(
        before.products.map(p => p.id).sort()
      );
      expect(reopened.runs).toEqual(before.runs);
      expect(Number((await stock()).quantita)).toBe(62_000);
      expect(await movements(productId)).toEqual(afterInvoiceMoves);
    }, 60_000);

    it("11 — isolamento cross-company, 403 ruoli/permessi e costi oscurati dal router", async () => {
      const foreign = await foreignFixture();
      const before = await readData();
      expect(before.groups.some(g => g.id === foreign.foreignGroup)).toBe(
        false
      );
      expect(before.products.some(p => p.id === foreign.foreignProduct)).toBe(
        false
      );
      expect(before.runs.some(r => r.id === foreign.foreignRun.id)).toBe(false);
      await expect(
        caller.saveRecipe({
          groupId,
          nome: "TEST F99 tentativo cross",
          ingredients: [
            { productId: foreign.foreignProduct, kgPerHead: 10, order: 0 },
          ],
          confirm: true,
        })
      ).rejects.toThrow(/Magazzino aziendale/);
      await expect(
        caller.activateRecipe({ id: foreign.foreignRecipe.id, confirm: true })
      ).rejects.toThrow(/non attivabile/);
      await expect(
        caller.distribute({
          key: randomUUID(),
          runId: foreign.foreignRun.id,
          groupId,
          kg: 1,
          at: at + 3000,
          confirm: true,
        })
      ).rejects.toThrow(/non distribuibile/);
      await expect(
        caller.registerLeftover({
          key: randomUUID(),
          distributionId: foreign.foreignDist.id,
          at: at + 3000,
          method: "nessuno",
          destination: "rimosso",
          confirm: true,
        })
      ).rejects.toThrow(/non disponibile/);
      await expect(
        caller.saveNir({
          productId: foreign.foreignProduct,
          at,
          params: params(40),
          confirm: true,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        caller.activateNir({ id: foreign.foreignNir.id, confirm: true })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        caller.saveComparison({
          left: {
            productId: foreign.foreignProduct,
            nome: "TEST cross",
            pricePerQuintal: null,
            params: {},
            source: "client",
          },
          right: {
            nome: "TEST offerta",
            pricePerQuintal: null,
            params: {},
            source: "test",
          },
          confirm: true,
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(caller.data({ scope: OTHER_COMPANY_ID })).rejects.toThrow(
        /Azienda cambiata/
      );
      await expect(viewerCaller.confirmLoad(loadInput())).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
      await expect(
        operatorCaller.configureFrequency({
          groupId,
          runsPerDay: 1,
          confirm: true,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        operatorCaller.saveNir({
          productId,
          at,
          params: params(34),
          confirm: true,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const loaded = await caller.confirmLoad(loadInput());
      await expect(
        operatorCaller.rectifyLoad({
          key: randomUUID(),
          runId: loaded.id,
          reason: "TEST operatore non autorizzato",
          confirm: true,
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        caller.confirmLoad({
          ...loadInput(),
          confirm: false,
        } as unknown as LoadInput)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      const visible = await readData(operatorCaller);
      expect(visible.permissions.canSeeCosts).toBe(false);
      expect(visible.products.find(p => p.id === productId)).toMatchObject({
        prezzoKg: null,
        lastPriceKg: null,
      });
      expect(visible.runs.find(r => r.id === loaded.id)).toMatchObject({
        totalCostCents: null,
        ingredients: [
          expect.objectContaining({
            unitCostCentsPerKg: null,
            costCents: null,
          }),
        ],
      });
      // Tentativo company spoof nel contesto: il resolver ricade nella membership
      // propria, mai nei dati dell'altra azienda (senza cambiare alcun utente DB).
      const spoofed = await readData(
        makeCaller({ ...manager, activeCompanyId: OTHER_COMPANY_ID })
      );
      expect(spoofed.permissions.companyId).toBe(COMPANY_ID);
      expect(spoofed.runs.some(r => r.id === foreign.foreignRun.id)).toBe(
        false
      );
      expect(
        Number((await stock(foreign.foreignProduct, OTHER_COMPANY_ID)).quantita)
      ).toBe(990);
    }, 60_000);

    it("12 — mancanti null, analytics filtrate e riapertura conserva registrazioni senza valori inventati", async () => {
      await database()
        .update(prodotti)
        .set({
          prezzoUnitario: null,
          costoMedioUnitario: null,
          costoFonte: null,
        })
        .where(
          and(eq(prodotti.id, productId), eq(prodotti.companyId, COMPANY_ID))
        );
      const before = await readData();
      const product = before.products.find(p => p.id === productId)!;
      expect(product).toMatchObject({
        prezzoKg: null,
        lastPriceKg: null,
        nirId: null,
        dryMatter: null,
        params: {},
      });
      const calc = calculateRecipe(
        before.recipes.find(r => r.id === recipeId)!,
        before.groups.find(g => g.id === groupId)!,
        before.products
      );
      expect(calc.costPerHead).toBeNull();
      expect(calc.costPerDay).toBeNull();
      expect(calc.ssKgPerHead).toBeNull();
      const { loaded, distribution } = await loadedAndDistributed();
      const leftover = await caller.registerLeftover({
        key: randomUUID(),
        distributionId: distribution.id,
        at: at + 2000,
        method: "nessuno",
        destination: "rimosso",
        confirm: true,
      });
      const milk = await caller.saveMilkRecord({
        groupId,
        at: at + 1500,
        milkKg: 60,
        fat: null,
        protein: null,
        pricePerKg: null,
        source: "TEST F99 rilevazione senza referto/prezzo",
        confirm: true,
      });
      const payload = (await run(loaded.id)).payload;
      expect(payload.totalCostCents).toBeNull();
      expect(payload.ingredients[0]).toMatchObject({
        unitCostCentsPerKg: null,
        costCents: null,
        nirId: null,
        params: {},
        dryMatter: null,
      });
      const rows = await movements(productId);
      expect(rows[0]).toMatchObject({
        costoUnitario: null,
        importoCosto: null,
      });
      const analysis = await caller.analytics({
        from: at - 1000,
        to: at + 3000,
        groupId,
      });
      expect(analysis.totals.distributedKg).toBe(100);
      expect(analysis.totals.ingestionKg).toBe(100);
      expect(analysis.totals.milk).toBe(60);
      for (const key of [
        "cost",
        "costUsed",
        "revenue",
        "iofc",
        "iofcActual",
        "ecm",
        "dm",
        "efficiency",
      ])
        expect(
          analysis.totals[key],
          `Indicatore ${key}: null non zero`
        ).toBeNull();
      const anotherGroup = await caller.analytics({
        from: at - 1000,
        to: at + 3000,
        groupId: otherGroupId,
      });
      expect(anotherGroup.totals.distributedKg).toBeNull();
      expect(anotherGroup.totals.milk).toBeNull();
      const anotherPeriod = await caller.analytics({
        from: at - 2 * DAY,
        to: at - DAY,
        groupId,
      });
      expect(anotherPeriod.daily).toHaveLength(0);
      expect(anotherPeriod.totals.milk).toBeNull();
      const persisted = await readData();
      const reopened = await readData(makeCaller(manager));
      expect(reopened.recipes).toEqual(persisted.recipes);
      expect(reopened.runs).toEqual(persisted.runs);
      expect(reopened.distributions).toEqual(persisted.distributions);
      expect(reopened.leftovers).toEqual(persisted.leftovers);
      expect(reopened.settings).toEqual(persisted.settings);
      expect(reopened.milkRecords.find(m => m.id === milk.id)).toMatchObject({
        pricePerKg: null,
        fat: null,
        protein: null,
      });
      expect(reopened.leftovers.find(l => l.id === leftover.id)).toMatchObject({
        kg: 0,
        method: "nessuno",
      });
      expect(await movements(productId)).toHaveLength(1);
    }, 60_000);
  });
