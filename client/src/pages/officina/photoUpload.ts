export type PreparedMezzoPhoto = { nomeFile: string; contentType: "image/jpeg"; contenutoBase64: string; size: number; preview: string };
const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
export async function prepareMezzoPhoto(file: File): Promise<PreparedMezzoPhoto> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Scegli una foto JPG, PNG o WebP. Per HEIC, esportala prima come JPG.");
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("La foto supera 20 MB. Scegli una versione più leggera.");
  if (!file.size) throw new Error("La foto selezionata è vuota.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Fotografia non leggibile. Seleziona un’altra immagine."));
      image.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Impossibile preparare la foto su questo dispositivo.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Impossibile ottimizzare la fotografia.")), "image/jpeg", 0.84));
    const preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Impossibile leggere la fotografia."));
      reader.readAsDataURL(blob);
    });
    return { nomeFile: file.name.slice(0, 255), contentType: "image/jpeg", contenutoBase64: preview.split(",")[1], size: blob.size, preview };
  } finally { URL.revokeObjectURL(url); }
}
