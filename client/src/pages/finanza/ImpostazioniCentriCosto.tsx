import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getUserErrorMessage } from "@/lib/userError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Archive, Layers3, Pencil, Plus, RotateCcw, Search, Target } from "lucide-react";
import { toast } from "sonner";

type FormMode = "categoria" | "centro";
type EditableItem = { id: string; nome: string; codice?: string | null; descrizione?: string | null; colore?: string | null; categoriaCentroId?: string | null };

const COLORI = ["#60a5fa", "#4ade80", "#f59e0b", "#f87171", "#a78bfa", "#ec4899", "#14b8a6", "#8b5cf6"];

export default function ImpostazioniCentriCosto() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<FormMode>("centro");
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [codice, setCodice] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [colore, setColore] = useState("#60a5fa");
  const [categoriaCentroId, setCategoriaCentroId] = useState("");
  const utils = trpc.useUtils();

  const { data: categorie = [] } = trpc.finanza.categorieCentri.list.useQuery();
  const { data: centri = [] } = trpc.finanza.centriCosto.list.useQuery();

  const invalidate = async () => {
    await Promise.all([utils.finanza.categorieCentri.invalidate(), utils.finanza.centriCosto.invalidate(), utils.finanza.categorie.invalidate()]);
  };
  const categoriaCreate = trpc.finanza.categorieCentri.create.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Categoria del centro creata"); closeForm(); }, onError: (e) => toast.error(getUserErrorMessage(e)) });
  const categoriaUpdate = trpc.finanza.categorieCentri.update.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Categoria aggiornata"); closeForm(); }, onError: (e) => toast.error(getUserErrorMessage(e)) });
  const centroCreate = trpc.finanza.centriCosto.create.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Centro di costo creato"); closeForm(); }, onError: (e) => toast.error(getUserErrorMessage(e)) });
  const centroUpdate = trpc.finanza.centriCosto.update.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Centro aggiornato"); closeForm(); }, onError: (e) => toast.error(getUserErrorMessage(e)) });

  const categorieVisibili = useMemo(() => (categorie as any[]).filter((item) => item.attivo === !showArchived && item.nome.toLowerCase().includes(search.toLowerCase())), [categorie, search, showArchived]);
  const centriVisibili = useMemo(() => (centri as any[]).filter((item) => item.attivo === !showArchived && item.nome.toLowerCase().includes(search.toLowerCase())), [centri, search, showArchived]);

  function resetForm(nextMode: FormMode, item?: EditableItem) {
    setMode(nextMode); setEditId(item?.id ?? null); setNome(item?.nome ?? ""); setCodice(item?.codice ?? "");
    setDescrizione(item?.descrizione ?? ""); setColore(item?.colore ?? "#60a5fa"); setCategoriaCentroId(item?.categoriaCentroId ?? ""); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }
  function save() {
    if (!nome.trim()) return toast.error("Nome obbligatorio");
    if (mode === "centro" && !categoriaCentroId) return toast.error("Seleziona la categoria del centro");
    if (mode === "categoria") {
      if (editId) categoriaUpdate.mutate({ id: editId, nome: nome.trim(), descrizione: descrizione || null, colore });
      else categoriaCreate.mutate({ nome: nome.trim(), codice: codice || undefined, descrizione: descrizione || undefined, colore });
      return;
    }
    if (editId) centroUpdate.mutate({ id: editId, nome: nome.trim(), descrizione: descrizione || undefined, colore, categoriaCentroId });
    else centroCreate.mutate({ nome: nome.trim(), codice: codice || undefined, descrizione: descrizione || undefined, colore, categoriaCentroId });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-30 border-b border-border/30 bg-background/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/finanza/impostazioni")} className="-ml-2 rounded-xl p-2 hover:bg-white/5"><ArrowLeft className="size-5" /></button>
          <div className="min-w-0 flex-1"><h1 className="text-lg font-bold">Centri e categorie</h1><p className="text-xs text-muted-foreground">Organizza dove vengono attribuiti costi e ricavi</p></div>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca categoria o centro..." className="pl-9" /></div>
        <div className="flex gap-2"><Button size="sm" variant={!showArchived ? "default" : "outline"} onClick={() => setShowArchived(false)}>Attivi</Button><Button size="sm" variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived(true)}>Archiviati</Button></div>

        <section className="space-y-2">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold">Categorie dei centri</h2><p className="text-xs text-muted-foreground">Determinano le sottocategorie disponibili</p></div>{!showArchived && <Button size="sm" onClick={() => resetForm("categoria")}><Plus className="mr-1 size-4" />Categoria</Button>}</div>
          {categorieVisibili.length === 0 && <Empty icon={Layers3} text="Nessuna categoria del centro" />}
          {categorieVisibili.map((categoria: any) => {
            const collegati = (centri as any[]).filter((centro) => centro.categoriaCentroId === categoria.id && centro.attivo !== false).length;
            return <Card key={categoria.id} className="flex flex-row items-center gap-3 border-border/30 p-3">
              <Dot color={categoria.colore} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{categoria.nome}</p><p className="text-[11px] text-muted-foreground">{categoria.codice} · {collegati} centri collegati</p></div>
              {showArchived ? <IconButton label="Riattiva categoria" onClick={() => categoriaUpdate.mutate({ id: categoria.id, attivo: true })} icon={RotateCcw} /> : <><IconButton label="Modifica categoria" onClick={() => resetForm("categoria", categoria)} icon={Pencil} /><IconButton label="Archivia categoria" onClick={() => categoriaUpdate.mutate({ id: categoria.id, attivo: false })} icon={Archive} /></>}
            </Card>;
          })}
        </section>

        <section className="space-y-2 pt-2">
          <div className="flex items-center justify-between"><div><h2 className="font-semibold">Centri di costo</h2><p className="text-xs text-muted-foreground">Ogni centro appartiene a una categoria</p></div>{!showArchived && <Button size="sm" onClick={() => resetForm("centro")}><Plus className="mr-1 size-4" />Centro</Button>}</div>
          {centriVisibili.length === 0 && <Empty icon={Target} text="Nessun centro di costo" />}
          {centriVisibili.map((centro: any) => <Card key={centro.id} className="flex flex-row items-center gap-3 border-border/30 p-3">
            <Dot color={centro.colore} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{centro.nome}</p><div className="mt-1 flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{centro.categoriaCentroNome || "Senza categoria"}</Badge><span className="text-[10px] text-muted-foreground">{centro.codice}</span></div></div>
            {showArchived ? <IconButton label="Riattiva centro" onClick={() => centroUpdate.mutate({ id: centro.id, attivo: true })} icon={RotateCcw} /> : <><IconButton label="Modifica centro" onClick={() => resetForm("centro", centro)} icon={Pencil} /><IconButton label="Archivia centro" onClick={() => centroUpdate.mutate({ id: centro.id, attivo: false })} icon={Archive} /></>}
          </Card>)}
        </section>
      </div>

      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>{editId ? "Modifica" : "Nuova"} {mode === "categoria" ? "categoria del centro" : "centro di costo"}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={mode === "categoria" ? "es. Produzione animale" : "es. Stalla"} className="mt-1" /></div>
            {!editId && <div><Label>Codice <span className="text-muted-foreground">(auto se vuoto)</span></Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} className="mt-1" /></div>}
            {mode === "centro" && <div><Label>Categoria del centro *</Label><Select value={categoriaCentroId} onValueChange={setCategoriaCentroId}><SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona categoria" /></SelectTrigger><SelectContent>{(categorie as any[]).filter((c) => c.attivo !== false).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent></Select></div>}
            <div><Label>Descrizione</Label><Input value={descrizione} onChange={(e) => setDescrizione(e.target.value)} className="mt-1" /></div>
            <div><Label>Colore</Label><div className="mt-2 flex flex-wrap gap-2">{COLORI.map((value) => <button key={value} type="button" aria-label={`Colore ${value}`} onClick={() => setColore(value)} className={`size-8 rounded-full border-2 ${colore === value ? "scale-110 border-white" : "border-transparent"}`} style={{ backgroundColor: value }} />)}</div></div>
            <Button className="w-full" onClick={save} disabled={categoriaCreate.isPending || categoriaUpdate.isPending || centroCreate.isPending || centroUpdate.isPending}>Salva</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Dot({ color }: { color?: string | null }) { return <div className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color || "#60a5fa"}20` }}><div className="size-3 rounded-full" style={{ backgroundColor: color || "#60a5fa" }} /></div>; }
function IconButton({ label, onClick, icon: Icon }: { label: string; onClick: () => void; icon: typeof Pencil }) { return <button type="button" aria-label={label} onClick={onClick} className="rounded-lg p-2 hover:bg-white/5"><Icon className="size-4 text-muted-foreground" /></button>; }
function Empty({ icon: Icon, text }: { icon: typeof Target; text: string }) { return <div className="rounded-xl border border-dashed border-border/40 py-8 text-center text-muted-foreground"><Icon className="mx-auto mb-2 size-8 opacity-40" /><p className="text-sm">{text}</p></div>; }
