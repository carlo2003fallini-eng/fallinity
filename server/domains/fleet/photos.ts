import { randomUUID } from "node:crypto";
import { z } from "zod";
import sharp from "sharp";
import { storagePut } from "../../storage";
import { fleetRepository } from "./repository";
import type { ActorContext } from "../_core";

export const MAX_FOTO_BYTES = 5 * 1024 * 1024;
export const uploadMacchinaFotoInput = z.object({
  macchinaId: z.string().min(1).optional(),
  nomeFile: z.string().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  contenutoBase64: z.string().min(1).max(Math.ceil(MAX_FOTO_BYTES / 3) * 4),
  size: z.number().int().min(1).max(MAX_FOTO_BYTES),
});
export const salvaMacchinaFotoInput = z.object({ id: z.string().min(1), foto: z.string().max(2048) });

/** Mantiene le foto legacy; impedisce associazioni a file privati di altre aziende. */
export function validateFotoReference(companyId: string, foto: string) {
  const value = foto.trim();
  if (!value) return "";
  if (value.length > 2048) throw new Error("Riferimento foto troppo lungo");
  if (value.startsWith("/manus-storage/")) {
    if (value.includes("..") || value.includes("%") || value.includes("\\") || value.includes("?") || value.includes("#")) throw new Error("Riferimento foto non valido");
    if (value.startsWith("/manus-storage/companies/")) {
      const prefix = `/manus-storage/companies/${companyId}/fleet/photos/`;
      if (!value.startsWith(prefix) || !/^[a-zA-Z0-9_-]+\.jpg$/.test(value.slice(prefix.length))) throw new Error("La foto non appartiene all’azienda attiva");
    }
    return value;
  }
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") {
      // Non permettere di aggirare il controllo aziendale con un URL assoluto.
      if (url.pathname.startsWith("/manus-storage/companies/")) return validateFotoReference(companyId, url.pathname);
      return value;
    }
  } catch { /* Messaggio uniforme, senza dettagli tecnici. */ }
  throw new Error("Usa una fotografia caricata o un indirizzo HTTP/HTTPS valido");
}

/** Decodifica reale, niente SVG/HTML, dimensioni limitate e metadati GPS/EXIF rimossi. */
export async function normalizzaFotoMezzo(raw: z.input<typeof uploadMacchinaFotoInput>) {
  const input = uploadMacchinaFotoInput.parse(raw);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.contenutoBase64)) throw new Error("Il file caricato è incompleto o danneggiato");
  const buffer = Buffer.from(input.contenutoBase64, "base64");
  if (buffer.length !== input.size || buffer.toString("base64") !== input.contenutoBase64) throw new Error("Il file caricato è incompleto o danneggiato");
  try {
    const image = sharp(buffer, { limitInputPixels: 40_000_000, failOn: "error" });
    const metadata = await image.metadata();
    const expected = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" }[input.contentType];
    if (metadata.format !== expected || (metadata.pages ?? 1) > 1) throw new Error("Formato foto non valido");
    const output = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    return { buffer: output, contentType: "image/jpeg" as const };
  } catch {
    throw new Error("Fotografia non leggibile: usa un file JPG, PNG o WebP valido");
  }
}

export const fleetPhotosService = {
  async carica(actor: ActorContext, raw: z.input<typeof uploadMacchinaFotoInput>) {
    const input = uploadMacchinaFotoInput.parse(raw);
    if (input.macchinaId && !await fleetRepository.getMacchina(actor.companyId, input.macchinaId)) throw new Error("Mezzo non trovato nell’azienda attiva");
    const image = await normalizzaFotoMezzo(input);
    const stored = await storagePut(`companies/${actor.companyId}/fleet/photos/${randomUUID()}.jpg`, image.buffer, image.contentType);
    return { foto: stored.url };
  },
  async salva(actor: ActorContext, input: z.infer<typeof salvaMacchinaFotoInput>) {
    if (!await fleetRepository.getMacchina(actor.companyId, input.id)) throw new Error("Mezzo non trovato nell’azienda attiva");
    const foto = validateFotoReference(actor.companyId, input.foto);
    await fleetRepository.updateMacchina(actor, input.id, { foto: foto || null });
    return { success: true, foto: foto || null };
  },
};
