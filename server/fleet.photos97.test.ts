import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { ActorContext } from "./domains/_core";

const mocks = vi.hoisted(() => ({
  storagePut: vi.fn(),
  getMacchina: vi.fn(),
  updateMacchina: vi.fn(),
}));

vi.mock("./storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("./domains/fleet/repository", () => ({
  fleetRepository: {
    getMacchina: mocks.getMacchina,
    updateMacchina: mocks.updateMacchina,
  },
}));

import {
  MAX_FOTO_BYTES,
  fleetPhotosService,
  normalizzaFotoMezzo,
  salvaMacchinaFotoInput,
  uploadMacchinaFotoInput,
  validateFotoReference,
} from "./domains/fleet/photos";

type UploadInput = Parameters<typeof normalizzaFotoMezzo>[0];
const COMPANY = "company-f97";
const OTHER_COMPANY = "company-f97-other";
const MACHINE = "mezzo-f97";
const actor: ActorContext = { companyId: COMPANY, userId: 97, userUuid: "operatore-f97" };
const storedFoto = `/manus-storage/companies/${COMPANY}/fleet/photos/existing.jpg`;
const originalMacchina = {
  id: MACHINE,
  companyId: COMPANY,
  nome: "Trattore F97",
  foto: storedFoto,
  marca: "Marca invariata",
  modello: "Modello invariato",
  targa: "AA123BB",
  telaio: "telaio-f97",
  anno: 2020,
  stato: "manutenzione",
  oreTotali: "2400",
  oreMotore: "1800",
  chilometri: "12345",
  healthScore: 74,
  ultimoTagliando: new Date("2026-02-10T10:00:00Z"),
  prossimaManutenzione: new Date("2027-02-10T10:00:00Z"),
  note: "Note da conservare",
};
let macchina: Omit<typeof originalMacchina, "foto"> & { foto: string | null } = { ...originalMacchina };
let jpeg: Buffer;
let png: Buffer;
let webp: Buffer;
let wideJpeg: Buffer;
let tallPng: Buffer;
let privateJpeg: Buffer;

function upload(buffer: Buffer, contentType: UploadInput["contentType"] = "image/jpeg"): UploadInput {
  return {
    nomeFile: contentType === "image/png" ? "galleria.png" : contentType === "image/webp" ? "galleria.webp" : "camera.jpg",
    contentType,
    contenutoBase64: buffer.toString("base64"),
    size: buffer.length,
  };
}

beforeAll(async () => {
  const image = (width: number, height: number, channels: 3 | 4 = 3) => sharp({
    create: { width, height, channels, background: { r: 34, g: 130, b: 70, alpha: 0.5 } },
  });
  [jpeg, png, webp, wideJpeg, tallPng, privateJpeg] = await Promise.all([
    image(120, 80).jpeg().toBuffer(),
    image(120, 80, 4).png().toBuffer(),
    image(120, 80).webp().toBuffer(),
    image(2400, 1200).jpeg().toBuffer(),
    image(1200, 2400, 4).png().toBuffer(),
    image(120, 80).jpeg().withMetadata({
      orientation: 6,
      exif: {
        IFD0: { Make: "F97_PRIVATE_CAMERA", Model: "Telefono privato", Artist: "F97_PRIVATE_OWNER" },
        IFD3: { GPSLatitudeRef: "N", GPSLatitude: "45/1 0/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "9/1 0/1 0/1" },
      },
    }).toBuffer(),
  ]);
});

beforeEach(() => {
  vi.resetAllMocks();
  macchina = { ...originalMacchina };
  // Il repository reale filtra company + id: non simuliamo record estranei come autorizzati.
  mocks.getMacchina.mockImplementation(async (companyId: string, id: string) =>
    companyId === macchina.companyId && id === macchina.id ? { ...macchina } : null,
  );
  mocks.updateMacchina.mockImplementation(async (_actor: ActorContext, _id: string, data: Partial<typeof macchina>) => {
    macchina = { ...macchina, ...data };
    return { success: true };
  });
  mocks.storagePut.mockImplementation(async (key: string) => ({ key, url: `/manus-storage/${key}` }));
});

describe("F97 — contratto upload foto mezzi", () => {
  it.each(["image/jpeg", "image/png", "image/webp"] as const)("accetta %s con macchinaId opzionale", (contentType) => {
    const input = upload(jpeg, contentType);
    expect(uploadMacchinaFotoInput.parse(input)).toEqual(input);
    expect(uploadMacchinaFotoInput.parse({ ...input, macchinaId: MACHINE })).toEqual({ ...input, macchinaId: MACHINE });
  });

  it.each(["image/gif", "image/svg+xml", "image/heic", "application/pdf", "text/plain", "image/jpg", ""])(
    "rifiuta contentType non ammesso: %s", (contentType) => {
      expect(uploadMacchinaFotoInput.safeParse({ ...upload(jpeg), contentType }).success).toBe(false);
    },
  );

  it.each(["nomeFile", "contentType", "contenutoBase64", "size"] as const)("richiede %s", (field) => {
    const input: Record<string, unknown> = { ...upload(jpeg) };
    delete input[field];
    expect(uploadMacchinaFotoInput.safeParse(input).success).toBe(false);
  });

  it.each([0, -1, 1.5, NaN, Infinity])("rifiuta size invalida %s", (size) => {
    expect(uploadMacchinaFotoInput.safeParse({ ...upload(jpeg), size }).success).toBe(false);
  });

  it("limita la dimensione dichiarata a 5 MiB e quella del base64 al limite corrispondente", () => {
    expect(MAX_FOTO_BYTES).toBe(5 * 1024 * 1024);
    expect(uploadMacchinaFotoInput.safeParse({ ...upload(jpeg), size: MAX_FOTO_BYTES }).success).toBe(true);
    expect(uploadMacchinaFotoInput.safeParse({ ...upload(jpeg), size: MAX_FOTO_BYTES + 1 }).success).toBe(false);
    expect(uploadMacchinaFotoInput.safeParse({ ...upload(jpeg),
      contenutoBase64: "A".repeat(Math.ceil(MAX_FOTO_BYTES / 3) * 4 + 1),
    }).success).toBe(false);
  });

  it("richiede nome non vuoto entro 255 caratteri e macchinaId non vuoto se fornito", () => {
    expect(uploadMacchinaFotoInput.safeParse({ ...upload(jpeg), nomeFile: "" }).success).toBe(false);
    expect(uploadMacchinaFotoInput.safeParse({ ...upload(jpeg), nomeFile: "x".repeat(256) }).success).toBe(false);
    expect(uploadMacchinaFotoInput.safeParse({ ...upload(jpeg), macchinaId: "" }).success).toBe(false);
  });

  it("il contratto conferma richiede id e consente foto vuota ma non riferimenti oltre 2048 caratteri", () => {
    expect(salvaMacchinaFotoInput.parse({ id: MACHINE, foto: "" })).toEqual({ id: MACHINE, foto: "" });
    expect(salvaMacchinaFotoInput.safeParse({ id: "", foto: storedFoto }).success).toBe(false);
    expect(salvaMacchinaFotoInput.safeParse({ id: MACHINE }).success).toBe(false);
    expect(salvaMacchinaFotoInput.safeParse({ id: MACHINE, foto: "x".repeat(2049) }).success).toBe(false);
  });
});

describe("F97 — riferimenti foto compatibili e isolati per azienda", () => {
  it.each([
    "",
    "https://images.example.test/mezzo-esistente.jpg",
    "http://images.example.test/mezzo-esistente.png",
    "/manus-storage/legacy/mezzo-esistente.jpg",
    storedFoto,
  ])("accetta rimozione o riferimento valido: %s", (foto) => {
    expect(() => validateFotoReference(COMPANY, foto)).not.toThrow();
  });

  it.each([
    "data:image/jpeg;base64,/9j/",
    "data:image/svg+xml,<svg/>",
    "javascript:alert(1)",
    "file:///tmp/foto.jpg",
    `/manus-storage/companies/${OTHER_COMPANY}/fleet/photos/private.jpg`,
    `https://storage.example.test/manus-storage/companies/${OTHER_COMPANY}/fleet/photos/private.jpg`,
    `/manus-storage/companies/${COMPANY}-suffix/fleet/photos/private.jpg`,
    `/manus-storage/companies/${COMPANY}/documents/private.jpg`,
    `/manus-storage/companies/${COMPANY}/fleet/photos/../private.jpg`,
    `/manus-storage/companies/${COMPANY}/fleet/photos/%2e%2e/private.jpg`,
    `${storedFoto}?companyId=${OTHER_COMPANY}`,
    `${storedFoto}#fragment`,
    `/manus-storage/companies/${COMPANY}/fleet/photos/private.svg`,
  ])("rifiuta riferimento pericoloso o di altra azienda: %s", (foto) => {
    expect(() => validateFotoReference(COMPANY, foto)).toThrow();
  });

  it("normalizza spazi e URL assoluti dello storage aziendale senza consentire cambi tenant", () => {
    expect(validateFotoReference(COMPANY, `  ${storedFoto}  `)).toBe(storedFoto);
    expect(validateFotoReference(COMPANY, "   ")).toBe("");
    expect(validateFotoReference(COMPANY, `https://app.example.test${storedFoto}`)).toBe(storedFoto);
  });
});

describe("F97 — decodifica reale e normalizzazione prima dello storage", () => {
  it.each(["jpeg", "png", "webp"] as const)("converte %s reale in JPEG decodificabile", async (format) => {
    const buffer = format === "png" ? png : format === "webp" ? webp : jpeg;
    const contentType = `image/${format}` as UploadInput["contentType"];
    const result = await normalizzaFotoMezzo(upload(buffer, contentType));
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.contentType).toBe("image/jpeg");
    expect(await sharp(result.buffer).metadata()).toMatchObject({ format: "jpeg", width: 120, height: 80 });
    await expect(sharp(result.buffer).raw().toBuffer()).resolves.toBeInstanceOf(Buffer);
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it.each(["orizzontale", "verticale"])("ridimensiona foto %s entro 1600 preservando proporzioni", async (direction) => {
    const result = await normalizzaFotoMezzo(direction === "orizzontale" ? upload(wideJpeg) : upload(tallPng, "image/png"));
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBeLessThanOrEqual(1600);
    expect(metadata.height).toBeLessThanOrEqual(1600);
    expect(metadata).toMatchObject(direction === "orizzontale" ? { width: 1600, height: 800 } : { width: 800, height: 1600 });
  });

  it("non ingrandisce artificialmente una foto piccola", async () => {
    const result = await normalizzaFotoMezzo(upload(jpeg));
    expect(await sharp(result.buffer).metadata()).toMatchObject({ width: 120, height: 80 });
  });

  it("applica orientamento camera e rimuove EXIF/GPS, proprietario e metadata prima di persistere", async () => {
    const source = await sharp(privateJpeg).metadata();
    expect(source.orientation).toBe(6);
    expect(source.exif).toBeInstanceOf(Buffer);
    expect(source.icc).toBeInstanceOf(Buffer);
    expect(source.exif!.toString()).toContain("F97_PRIVATE_CAMERA");
    expect(source.exif!.toString()).toContain("F97_PRIVATE_OWNER");
    const result = await normalizzaFotoMezzo(upload(privateJpeg));
    const metadata = await sharp(result.buffer).metadata();
    expect(metadata).toMatchObject({ format: "jpeg", width: 80, height: 120 });
    for (const key of ["exif", "icc", "iptc", "xmp", "orientation"] as const) expect(metadata[key]).toBeUndefined();
    expect(result.buffer.toString()).not.toContain("F97_PRIVATE_CAMERA");
    expect(result.buffer.toString()).not.toContain("F97_PRIVATE_OWNER");
  });

  it.each([-1, 1])("rifiuta dimensione dichiarata diversa dai byte effettivi: delta %s", async (delta) => {
    await expect(normalizzaFotoMezzo({ ...upload(jpeg), size: jpeg.length + delta })).rejects.toThrow();
  });

  it.each(["!!!!", "not-base64%%%", "", "data:image/jpeg;base64,/9j/"])("rifiuta base64 invalido: %s", async (contenutoBase64) => {
    await expect(normalizzaFotoMezzo({ ...upload(jpeg), contenutoBase64 })).rejects.toThrow();
  });

  it("non accetta caratteri illegali aggiunti a un’immagine base64 altrimenti valida", async () => {
    await expect(normalizzaFotoMezzo({ ...upload(jpeg), contenutoBase64: `${jpeg.toString("base64")}!` })).rejects.toThrow();
  });

  it.each([
    ["testo dichiarato JPEG", Buffer.from("questa non è una fotografia")],
    ["SVG dichiarato JPEG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')],
    ["PDF dichiarato JPEG", Buffer.from("%PDF-1.4\ncontenuto non fotografico")],
    ["header JPEG contraffatto", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 1, 2, 3])],
    ["header PNG contraffatto", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  ])("rifiuta %s anche con MIME ed estensione consentiti", async (_name, buffer) => {
    await expect(normalizzaFotoMezzo(upload(buffer as Buffer))).rejects.toThrow();
  });

  it("rifiuta JPEG troncato anche se il contenuto inizia con la firma corretta", async () => {
    await expect(normalizzaFotoMezzo(upload(jpeg.subarray(0, 64)))).rejects.toThrow();
  });

  it.each([
    ["PNG dichiarato JPEG", "png", "image/jpeg"],
    ["JPEG dichiarato PNG", "jpeg", "image/png"],
    ["WebP dichiarato JPEG", "webp", "image/jpeg"],
  ] as const)("rifiuta MIME contraffatto: %s", async (_label, format, contentType) => {
    const buffer = format === "png" ? png : format === "webp" ? webp : jpeg;
    await expect(normalizzaFotoMezzo(upload(buffer, contentType))).rejects.toThrow();
  });

  it("rifiuta un GIF reale etichettato JPEG invece di convertirlo implicitamente", async () => {
    const gif = await sharp(jpeg).gif().toBuffer();
    expect((await sharp(gif).metadata()).format).toBe("gif");
    await expect(normalizzaFotoMezzo(upload(gif))).rejects.toThrow();
  });
});

describe("F97 — upload aziendale senza salvataggio implicito della foto", () => {
  it("carica il buffer JPEG normalizzato in companies/{company}/fleet/photos/{uuid}.jpg, senza usare il nome originale", async () => {
    const input = { ...upload(privateJpeg), macchinaId: MACHINE, nomeFile: "../../camera-con-dati-privati.jpg" };
    const result = await fleetPhotosService.carica(actor, input);
    expect(mocks.getMacchina).toHaveBeenCalledWith(COMPANY, MACHINE);
    expect(mocks.storagePut).toHaveBeenCalledTimes(1);
    const [key, buffer, contentType] = mocks.storagePut.mock.calls[0];
    expect(key).toMatch(/^companies\/company-f97\/fleet\/photos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i);
    expect(key).not.toContain("camera-con-dati-privati");
    expect(contentType).toBe("image/jpeg");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    const metadata = await sharp(buffer).metadata();
    expect(metadata).toMatchObject({ format: "jpeg", width: 80, height: 120 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
    expect(result).toEqual({ foto: `/manus-storage/${key}` });
    expect(mocks.getMacchina.mock.invocationCallOrder[0]).toBeLessThan(mocks.storagePut.mock.invocationCallOrder[0]);
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it("consente upload per un nuovo mezzo senza macchinaId e senza scrittura repository", async () => {
    const result = await fleetPhotosService.carica(actor, upload(png, "image/png"));
    expect(result.foto).toMatch(/^\/manus-storage\/companies\/company-f97\/fleet\/photos\/.+\.jpg$/);
    expect(mocks.getMacchina).not.toHaveBeenCalled();
    expect(mocks.storagePut).toHaveBeenCalledTimes(1);
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it("genera chiavi distinte per due foto dello stesso mezzo", async () => {
    await fleetPhotosService.carica(actor, { ...upload(jpeg), macchinaId: MACHINE });
    await fleetPhotosService.carica(actor, { ...upload(jpeg), macchinaId: MACHINE });
    expect(mocks.storagePut.mock.calls[0][0]).not.toBe(mocks.storagePut.mock.calls[1][0]);
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
  });

  it.each(["mezzo-altra-azienda", "mezzo-inesistente"])("non carica né modifica foto per %s", async (macchinaId) => {
    await expect(fleetPhotosService.carica(actor, { ...upload(jpeg), macchinaId })).rejects.toThrow();
    expect(mocks.getMacchina).toHaveBeenCalledWith(COMPANY, macchinaId);
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it("un attore di un’altra azienda non può caricare una foto sul mezzo esistente", async () => {
    await expect(fleetPhotosService.carica({ ...actor, companyId: OTHER_COMPANY }, { ...upload(jpeg), macchinaId: MACHINE })).rejects.toThrow();
    expect(mocks.getMacchina).toHaveBeenCalledWith(OTHER_COMPANY, MACHINE);
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it("un payload contraffatto fallisce prima di storagePut e conserva la foto", async () => {
    await expect(fleetPhotosService.carica(actor, { ...upload(Buffer.from("contenuto contraffatto")), macchinaId: MACHINE })).rejects.toThrow();
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it("dimensione errata non avvia upload e non modifica la foto", async () => {
    await expect(fleetPhotosService.carica(actor, { ...upload(jpeg), macchinaId: MACHINE, size: jpeg.length + 1 })).rejects.toThrow();
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it("MIME contraffatto non avvia upload e non modifica foto o altri dati", async () => {
    await expect(fleetPhotosService.carica(actor, { ...upload(png), macchinaId: MACHINE })).rejects.toThrow();
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it("upload oltre il limite fallisce prima dello storage e conserva la foto", async () => {
    await expect(fleetPhotosService.carica(actor, { ...upload(jpeg), macchinaId: MACHINE, size: MAX_FOTO_BYTES + 1 })).rejects.toThrow();
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it("failure storage propagata senza sostituire né rimuovere la foto precedente", async () => {
    mocks.storagePut.mockRejectedValueOnce(new Error("Storage non disponibile F97"));
    await expect(fleetPhotosService.carica(actor, { ...upload(jpeg), macchinaId: MACHINE })).rejects.toThrow();
    expect(mocks.storagePut).toHaveBeenCalledTimes(1);
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });
});

describe("F97 — conferma esplicita e rimozione della sola foto", () => {
  it("soltanto salva dopo carica conferma la nuova foto e conserva tutti i dati del mezzo", async () => {
    const { foto } = await fleetPhotosService.carica(actor, { ...upload(png, "image/png"), macchinaId: MACHINE });
    expect(macchina).toEqual(originalMacchina);
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    await fleetPhotosService.salva(actor, { id: MACHINE, foto });
    expect(mocks.updateMacchina).toHaveBeenCalledTimes(1);
    expect(mocks.updateMacchina).toHaveBeenCalledWith(actor, MACHINE, { foto });
    expect(macchina).toEqual({ ...originalMacchina, foto });
  });

  it.each(["https://images.example.test/esistente.jpg", "/manus-storage/legacy/esistente.jpg", storedFoto])(
    "salva una foto esistente compatibile senza nuovo upload: %s", async (foto) => {
      await fleetPhotosService.salva(actor, { id: MACHINE, foto });
      expect(mocks.getMacchina).toHaveBeenCalledWith(COMPANY, MACHINE);
      expect(mocks.updateMacchina).toHaveBeenCalledWith(actor, MACHINE, { foto });
      expect(mocks.storagePut).not.toHaveBeenCalled();
      expect(macchina).toEqual({ ...originalMacchina, foto });
    },
  );

  it("rimuove la foto con stringa vuota senza modificare dati, stato, ore o manutenzioni", async () => {
    const result = await fleetPhotosService.salva(actor, { id: MACHINE, foto: "" });
    expect(mocks.getMacchina).toHaveBeenCalledWith(COMPANY, MACHINE);
    expect(mocks.updateMacchina).toHaveBeenCalledTimes(1);
    const patch = mocks.updateMacchina.mock.calls[0][2];
    expect(patch).toEqual({ foto: null });
    expect(result).toEqual({ success: true, foto: null });
    expect(macchina).toEqual({ ...originalMacchina, foto: null });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("salva ignora campi estranei alla foto e non riscrive il mezzo con dati del client", async () => {
    const input = { id: MACHINE, foto: storedFoto, nome: "Non sovrascrivere", stato: "fermo", oreTotali: 0, companyId: OTHER_COMPANY };
    await fleetPhotosService.salva(actor, input);
    expect(mocks.updateMacchina).toHaveBeenCalledWith(actor, MACHINE, { foto: storedFoto });
    expect(macchina).toEqual(originalMacchina);
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it.each([
    "data:image/jpeg;base64,/9j/",
    "javascript:alert(1)",
    `/manus-storage/companies/${OTHER_COMPANY}/fleet/photos/private.jpg`,
    `https://app.example.test/manus-storage/companies/${OTHER_COMPANY}/fleet/photos/private.jpg`,
  ])("conferma invalida non modifica la foto né altri dati: %s", async (foto) => {
    await expect(fleetPhotosService.salva(actor, { id: MACHINE, foto })).rejects.toThrow();
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it.each(["", storedFoto])("non rimuove o salva foto di un mezzo fuori tenant: %s", async (foto) => {
    await expect(fleetPhotosService.salva({ ...actor, companyId: OTHER_COMPANY }, { id: MACHINE, foto })).rejects.toThrow();
    expect(mocks.getMacchina).toHaveBeenCalledWith(OTHER_COMPANY, MACHINE);
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it("non salva foto su un mezzo inesistente", async () => {
    await expect(fleetPhotosService.salva(actor, { id: "mezzo-inesistente", foto: storedFoto })).rejects.toThrow();
    expect(mocks.getMacchina).toHaveBeenCalledWith(COMPANY, "mezzo-inesistente");
    expect(mocks.updateMacchina).not.toHaveBeenCalled();
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });

  it("failure repository propagata senza fallback che azzeri la foto o altri dati", async () => {
    mocks.updateMacchina.mockRejectedValueOnce(new Error("Aggiornamento non disponibile F97"));
    await expect(fleetPhotosService.salva(actor, { id: MACHINE, foto: "https://images.example.test/nuova.jpg" })).rejects.toThrow();
    expect(mocks.updateMacchina).toHaveBeenCalledTimes(1);
    expect(mocks.updateMacchina).toHaveBeenCalledWith(actor, MACHINE, { foto: "https://images.example.test/nuova.jpg" });
    expect(mocks.storagePut).not.toHaveBeenCalled();
    expect(macchina).toEqual(originalMacchina);
  });
});
