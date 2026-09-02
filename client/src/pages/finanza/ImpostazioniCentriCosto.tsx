import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getUserErrorMessage } from "@/lib/userError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Archive, CheckSquare2, Layers3, Loader2, Pencil, Plus, RotateCcw, Search, Target } from "lucide-react";
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
  const [showBulk, setShowBulk] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkCategoriaId, setBulkCategoriaId] = useState("");
  const [bulkSearch, setBulkSearch] = useState("");
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const [bulkInitial, setBulkInitial] = useState<string[]>([]);
  const utils = trpc.useUtils();

  const { data: categorie = [] } = trpc.finanza.categorieCentri.list.useQuery();
  const { data: centri = [] } = trpc.finanza.centriCosto.list.useQuery();
  const { data: sottocategorie = [] } = trpc.finanza.categorie.list.useQuery(undefined);

  const invalidate = async () => {
    await Promise.all([utils.finanza.categorieCentri.invalidate(), utils.finanza.centriCosto.invalidate(), utils.finanza.categorie.invalidate()]);
  };
  const categoriaCreate = trpc.finanza.categorieCentri.create.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Categoria del centro creata"); closeForm(); }, onError: (e) => toast.error(getUserErrorMessage(e)) });
  const categoriaUpdate = trpc.finanza.categorieCentri.update.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Categoria aggiornata"); closeForm(); }, onError: (e) => toast.error(getUserErrorMessage(e)) });
  const centroCreate = trpc.finanza.centriCosto.create.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Centro di costo creato"); closeForm(); }, onError: (e) => toast.error(getUserErrorMessage(e)) });
  const centroUpdate = trpc.finanza.centriCosto.update.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Centro aggiornato"); closeForm(); }, onError: (e) => toast.error(getUserErrorMessage(e)) });
  const bulkUpdate = trpc.finanza.categorieCentri.replaceSottocategorie.useMutation({
    onSuccess: async (result) => {
      await utils.finanza.invalidate();
      toast.success(`Relazioni aggiornate: ${result.totale} sottocategorie collegate`);
      setShowBulkConfirm(false);
      setShowBulk(false);
    },
    onError: (e) => toast.error(getUserErrorMessage(e)),
  });

  const categorieVisibili = useMemo(() => (categorie as any[]).filter((item) => item.attivo === !showArchived && item.nome.toLowerCase().includes(search.toLowerCase())), [categorie, search, showArchived]);
  const centriVisibili = useMemo(() => (centri as any[]).filter((item) => item.attivo === !showArchived && item.nome.toLowerCase().includes(search.toLowerCase())), [centri, search, showArchived]);
  const sottocategorieAttive = useMemo(() => (sottocategorie as any[]).filter((item) => item.attivo !== false), [sottocategorie]);
  const sottocategorieBulk = useMemo(() => sottocategorieAttive.filter((item) => item.nome.toLowerCase().includes(bulkSearch.toLowerCase()) || String(item.codice ?? "").toLowerCase().includes(bulkSearch.toLowerCase())), [sottocategorieAttive, bulkSearch]);
  const bulkAggiunte = useMemo(() => bulkSelected.filter((id) => !bulkInitial.includes(id)), [bulkSelected, bulkInitial]);
  const bulkRimosse = useMemo(() => bulkInitial.filter((id) => !bulkSelected.includes(id)), [bulkSelected, bulkInitial]);

  function resetForm(nextMode: FormMode, item?: EditableItem) {
    setMode(nextMode); setEditId(item?.id ?? null); setNome(item?.nome ?? ""); setCodice(item?.codice ?? "");
    setDescrizione(item?.descrizione ?? ""); setColore(item?.colore ?? "#60a5fa"); setCategoriaCentroId(item?.categoriaCentroId ?? ""); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }
  function selectBulkCategory(id: string) {
    const collegate = sottocategorieAttive.filter((item) => (item.categoriaCentroIds ?? []).includes(id)).map((item) => item.id);
    setBulkCategoriaId(id);
    setBulkSelected(collegate);
    setBulkInitial(collegate);
    setBulkSearch("");
  }
  function openBulk() {
    const primaCategoria = (categorie as any[]).find((item) => item.attivo !== false);
    if (!primaCategoria) return toast.error("Crea prima una categoria del centro");
    selectBulkCategory(primaCategoria.id);
    setShowBulk(true);
  }
  function toggleBulk(id: string, checked: boolean) {
    setBulkSelected((current) => checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id));
  }
  function selectAllVisible() {
    setBulkSelected((current) => Array.from(new Set([...current, ...sottocategorieBulk.map((item) => item.id)])));
  }
  function deselectAllVisible() {
    const visibili = new Set(sottocategorieBulk.map((item) => item.id));
    setBulkSelected((current) => current.filter((id) => !visibili.has(id)));
  }
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold">Categorie dei centri</h2><p className="text-xs text-muted-foreground">Determinano le sottocategorie disponibili</p></div>{!showArchived && <div className="grid grid-cols-2 gap-2 sm:flex"><Button size="sm" variant="outline" onClick={openBulk}><CheckSquare2 className="mr-1 size-4" />Relazioni</Button><Button size="sm" onClick={() => resetForm("categoria")}><Plus className="mr-1 size-4" />Categoria</Button></div>}</div>
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

      <Sheet open={showBulk} onOpenChange={(open) => { if (!bulkUpdate.isPending) setShowBulk(open); }}>
        <SheetContent side="bottom" className="flex max-h-[94vh] flex-col rounded-t-2xl p-0">
          <SheetHeader className="border-b border-border/30 px-4 pb-4 pt-5">
            <SheetTitle>Gestisci relazioni in blocco</SheetTitle>
            <p className="text-left text-xs text-muted-foreground">Scegli una categoria del centro e assegna tutte le sottocategorie compatibili in un’unica operazione.</p>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div>
              <Label>Categoria del centro</Label>
              <Select value={bulkCategoriaId} onValueChange={selectBulkCategory}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona categoria" /></SelectTrigger>
                <SelectContent>{(categorie as any[]).filter((item) => item.attivo !== false).map((item) => <SelectItem key={item.id} value={item.id}>{item.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{bulkSelected.length} selezionate</span><span className="text-xs text-muted-foreground">{sottocategorieAttive.length} disponibili</span></div>
              <div className="mt-2 flex gap-2 text-xs"><Badge className="bg-green-500/15 text-green-400">+{bulkAggiunte.length} aggiunte</Badge><Badge className="bg-red-500/15 text-red-400">−{bulkRimosse.length} rimosse</Badge></div>
            </div>

            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={bulkSearch} onChange={(e) => setBulkSearch(e.target.value)} placeholder="Cerca sottocategoria..." className="pl-9" /></div>
            <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Seleziona le sottocategorie da proporre</p><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={selectAllVisible}>Seleziona tutte</Button><Button size="sm" variant="ghost" onClick={deselectAllVisible}>Deseleziona</Button></div></div>

            <div className="space-y-2" role="group" aria-label="Sottocategorie disponibili">
              {sottocategorieBulk.map((item) => {
                const checked = bulkSelected.includes(item.id);
                return <label key={item.id} htmlFor={`bulk-${item.id}`} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${checked ? "border-primary/40 bg-primary/[0.08]" : "border-border/30 bg-white/[0.02]"}`}>
                  <Checkbox id={`bulk-${item.id}`} checked={checked} onCheckedChange={(value) => toggleBulk(item.id, value === true)} />
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.colore || "#4ade80" }} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.nome}</span><span className="text-[10px] uppercase text-muted-foreground">{item.tipo} · {item.codice}</span></span>
                </label>;
              })}
              {sottocategorieBulk.length === 0 && <Empty icon={Layers3} text="Nessuna sottocategoria trovata" />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-border/30 bg-background/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
            <Button variant="outline" onClick={() => setShowBulk(false)} disabled={bulkUpdate.isPending}>Annulla</Button>
            <Button onClick={() => setShowBulkConfirm(true)} disabled={bulkUpdate.isPending || (bulkAggiunte.length === 0 && bulkRimosse.length === 0)}>Rivedi modifiche</Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Conferma relazioni</AlertDialogTitle><AlertDialogDescription>Verranno collegate {bulkAggiunte.length} nuove sottocategorie e rimosse {bulkRimosse.length} relazioni dalla categoria selezionata. I movimenti storici non verranno modificati.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={bulkUpdate.isPending}>Indietro</AlertDialogCancel><AlertDialogAction disabled={bulkUpdate.isPending} onClick={(event) => { event.preventDefault(); bulkUpdate.mutate({ categoriaCentroId: bulkCategoriaId, sottocategoriaIds: bulkSelected }); }}>{bulkUpdate.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />Salvataggio…</> : "Conferma e applica"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Dot({ color }: { color?: string | null }) { return <div className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color || "#60a5fa"}20` }}><div className="size-3 rounded-full" style={{ backgroundColor: color || "#60a5fa" }} /></div>; }
function IconButton({ label, onClick, icon: Icon }: { label: string; onClick: () => void; icon: typeof Pencil }) { return <button type="button" aria-label={label} onClick={onClick} className="rounded-lg p-2 hover:bg-white/5"><Icon className="size-4 text-muted-foreground" /></button>; }
function Empty({ icon: Icon, text }: { icon: typeof Target; text: string }) { return <div className="rounded-xl border border-dashed border-border/40 py-8 text-center text-muted-foreground"><Icon className="mx-auto mb-2 size-8 opacity-40" /><p className="text-sm">{text}</p></div>; }
