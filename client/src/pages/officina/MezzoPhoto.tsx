import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { C } from "./shared";
import { prepareMezzoPhoto, type PreparedMezzoPhoto } from "./photoUpload";

export function MezzoPhotoPicker({ foto, draft, onDraft, onClear, onBusy, disabled = false, showCurrentPreview = true }: {
  foto: string; draft: PreparedMezzoPhoto | null; onDraft: (value: PreparedMezzoPhoto | null) => void;
  onClear: () => void; onBusy: (busy: boolean) => void; disabled?: boolean; showCurrentPreview?: boolean;
}) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { generation.current++; }, []);
  async function select(file?: File) {
    if (!file || disabled || busy) return;
    const attempt = ++generation.current;
    setBusy(true); onBusy(true); setError("");
    try {
      const prepared = await prepareMezzoPhoto(file);
      if (generation.current === attempt) onDraft(prepared);
    } catch (e) {
      if (generation.current === attempt) setError(e instanceof Error ? e.message : "Impossibile leggere la foto.");
    } finally {
      if (generation.current === attempt) { setBusy(false); onBusy(false); }
    }
  }
  const preview = draft?.preview || (showCurrentPreview ? foto : "");
  return <div className="space-y-3">
    <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Scegli foto dalla galleria" className="hidden" onChange={(e) => { select(e.target.files?.[0]); e.target.value = ""; }} />
    <input ref={camera} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Scatta una foto del mezzo" className="hidden" onChange={(e) => { select(e.target.files?.[0]); e.target.value = ""; }} />
    {preview && <div className="overflow-hidden rounded-xl border" style={{ borderColor: C.border, background: C.bgDeep }}><img src={preview} alt="Anteprima foto del mezzo" className="h-40 w-full object-contain" /><p className="px-3 py-2 text-xs" style={{ color: draft ? C.gold : C.textDim }}>{draft ? "Anteprima locale · foto non ancora salvata" : "Foto attuale"}</p></div>}
    <div className="grid grid-cols-2 gap-2"><Button type="button" variant="outline" className="min-h-11 gap-2 px-2 text-xs" disabled={disabled || busy} onClick={() => gallery.current?.click()}><ImagePlus size={17} /> Carica foto</Button><Button type="button" variant="outline" className="min-h-11 gap-2 px-2 text-xs" disabled={disabled || busy} onClick={() => camera.current?.click()}><Camera size={17} /> Scatta foto</Button></div>
    {busy && <p role="status" className="flex items-center gap-2 text-xs" style={{ color: C.green }}><Loader2 size={14} className="animate-spin" /> Preparazione foto…</p>}
    {error && <p role="alert" className="text-xs" style={{ color: C.red }}>{error}</p>}
    <p className="text-[11px] leading-relaxed" style={{ color: C.textDim }}>JPG, PNG o WebP fino a 20 MB. La foto viene ottimizzata e salvata solo dopo la conferma.</p>
    {showCurrentPreview && (foto || draft) && <button type="button" className="min-h-11 text-xs" style={{ color: C.red }} disabled={disabled || busy} onClick={onClear}>Rimuovi dal modulo</button>}
  </div>;
}

export function MezzoPhotoViewer({ foto, nome, open, onOpenChange }: { foto: string; nome: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => { if (open) setZoom(1); }, [open, foto]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="w-[calc(100vw-2rem)] max-w-4xl p-4" style={{ background: C.panelDark, borderColor: C.border }}><DialogHeader><DialogTitle className="pr-8 text-left" style={{ color: C.text }}>Foto · {nome}</DialogTitle></DialogHeader><div className="max-h-[65dvh] overflow-auto rounded-xl" style={{ background: C.bgDeep }}><img src={foto} alt={`Foto del mezzo ${nome} ingrandita`} className="block max-w-none" style={{ width: `${zoom * 100}%`, minHeight: 120, objectFit: "contain" }} /></div><div className="flex flex-wrap justify-center gap-2"><Button variant="outline" className="min-h-11" aria-label="Riduci foto" disabled={zoom <= 1} onClick={() => setZoom(Math.max(1, zoom - 0.5))}><Minus size={18} /></Button><Button variant="outline" className="min-h-11 gap-2" onClick={() => setZoom(1)}><RotateCcw size={16} /> Ripristina</Button><Button variant="outline" className="min-h-11" aria-label="Ingrandisci foto" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + 0.5))}><Plus size={18} /></Button></div></DialogContent></Dialog>;
}

export function MezzoPhotoImage({ foto, nome, fallback, onOpen }: { foto?: string | null; nome: string; fallback: string; onOpen?: () => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [foto]);
  const real = !!foto && !failed;
  const image = <><img src={real ? foto! : fallback} alt={real ? `Foto del mezzo ${nome}` : "Immagine illustrativa di un mezzo agricolo"} className="h-full w-full object-contain" onError={() => { if (real) setFailed(true); }} /><span className="absolute bottom-2 left-2 rounded-lg bg-black/80 px-2 py-1 text-[10px] text-white">{real ? "Foto del mezzo" : failed ? "Foto non disponibile" : "Illustrativa"}</span>{real && onOpen && <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/80 px-2 py-1 text-xs text-white"><Maximize2 size={14} /> Ingrandisci</span>}</>;
  return onOpen ? <button type="button" disabled={!real} aria-label={real ? `Apri foto di ${nome}` : `Immagine illustrativa di ${nome}`} onClick={onOpen} className="relative block h-full w-full overflow-hidden" style={{ background: C.bgDeep }}>{image}</button> : <div className="relative h-full w-full overflow-hidden" style={{ background: C.bgDeep }}>{image}</div>;
}

export function MezzoPhotoManager({ id, foto, onSaved }: { id: string; foto: string; onSaved: () => void }) {
  const [draft, setDraft] = useState<PreparedMezzoPhoto | null>(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const uploaded = useRef<string | null>(null);
  const upload = trpc.officina.macchine.caricaFoto.useMutation();
  const save = trpc.officina.macchine.salvaFoto.useMutation();
  function choose(value: PreparedMezzoPhoto | null) { setDraft(value); uploaded.current = null; }
  async function confirm(remove = false) {
    if (inFlight.current || processing || (!remove && !draft)) return;
    if (remove && !window.confirm("Rimuovere la foto di questo mezzo? Gli altri dati resteranno invariati.")) return;
    inFlight.current = true; setSaving(true);
    try {
      let path = "";
      if (!remove && draft) {
        if (!uploaded.current) {
          const { preview, ...payload } = draft;
          uploaded.current = (await upload.mutateAsync({ macchinaId: id, ...payload })).foto;
        }
        path = uploaded.current!;
      }
      await save.mutateAsync({ id, foto: path });
      choose(null); onSaved(); toast.success(remove ? "Foto rimossa" : "Foto del mezzo salvata", { position: "top-center" });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Impossibile salvare la foto. Riprova.", { position: "top-center" }); }
    finally { inFlight.current = false; setSaving(false); }
  }
  return <section className="space-y-3 rounded-xl border p-3" style={{ borderColor: C.border, background: C.inner }} aria-label="Gestione foto mezzo"><h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.green }}>Foto del mezzo</h3><MezzoPhotoPicker foto={foto} draft={draft} onDraft={choose} onClear={() => choose(null)} onBusy={setProcessing} disabled={saving} showCurrentPreview={false} />{draft && <div className="grid grid-cols-2 gap-2"><Button className="min-h-11 gap-2 text-xs" style={{ background: C.green, color: C.bgDeep }} disabled={saving || processing} onClick={() => confirm()}>{saving ? <><Loader2 size={15} className="animate-spin" /> Salvataggio…</> : "Salva foto"}</Button><Button variant="outline" className="min-h-11 text-xs" disabled={saving} onClick={() => choose(null)}>Annulla</Button></div>}{!draft && foto && <button type="button" className="min-h-11 text-xs" style={{ color: C.red }} disabled={saving || processing} onClick={() => confirm(true)}>{saving ? "Rimozione…" : "Rimuovi foto"}</button>}</section>;
}
