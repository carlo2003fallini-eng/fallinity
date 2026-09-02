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
import { ArrowLeft, Archive, Check, Pencil, Plus, RotateCcw, Search, Tags } from "lucide-react";
import { toast } from "sonner";

type Tipo = "entrata" | "uscita" | "entrambi";
const COLORI = ["#4ade80", "#60a5fa", "#f59e0b", "#f87171", "#a78bfa", "#ec4899", "#14b8a6", "#8b5cf6"];

export default function ImpostazioniCategorie() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"tutti" | Tipo>("tutti");
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState(""); const [tipo, setTipo] = useState<Tipo>("uscita"); const [codice, setCodice] = useState(""); const [colore, setColore] = useState("#4ade80");
  const [categoriaCentroIds, setCategoriaCentroIds] = useState<string[]>([]);
  const utils = trpc.useUtils();
  const { data: sottocategorie = [] } = trpc.finanza.categorie.list.useQuery(undefined);
  const { data: categorieCentri = [] } = trpc.finanza.categorieCentri.list.useQuery();
  const invalidate = async () => { await Promise.all([utils.finanza.categorie.invalidate(), utils.finanza.categorieCentri.invalidate()]); };
  const createMut = trpc.finanza.categorie.create.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Sottocategoria creata"); close(); }, onError: (e) => toast.error(getUserErrorMessage(e)) });
  const updateMut = trpc.finanza.categorie.update.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Sottocategoria aggiornata"); close(); }, onError: (e) => toast.error(getUserErrorMessage(e)) });

  const filtered = useMemo(() => (sottocategorie as any[]).filter((item) => item.attivo === !showArchived && (filtroTipo === "tutti" || item.tipo === filtroTipo || item.tipo === "entrambi") && item.nome.toLowerCase().includes(search.toLowerCase())), [sottocategorie, showArchived, filtroTipo, search]);
  const categoryName = (id: string) => (categorieCentri as any[]).find((item) => item.id === id)?.nome || "Categoria non disponibile";
  function open(item?: any) { setEditId(item?.id ?? null); setNome(item?.nome ?? ""); setTipo(item?.tipo ?? "uscita"); setCodice(item?.codice ?? ""); setColore(item?.colore ?? "#4ade80"); setCategoriaCentroIds(item?.categoriaCentroIds ?? []); setShowForm(true); }
  function close() { setShowForm(false); setEditId(null); }
  function toggleCategory(id: string) { setCategoriaCentroIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }
  function save() {
    if (!nome.trim()) return toast.error("Nome obbligatorio");
    if (categoriaCentroIds.length === 0) return toast.error("Collega almeno una categoria del centro");
    if (editId) updateMut.mutate({ id: editId, nome: nome.trim(), tipo, colore, categoriaCentroIds });
    else createMut.mutate({ nome: nome.trim(), tipo, codice: codice || undefined, colore, categoriaCentroIds });
  }

  return <div className="min-h-screen bg-background pb-24">
    <header className="sticky top-0 z-30 border-b border-border/30 bg-background/85 px-4 py-3 backdrop-blur-xl"><div className="flex items-center gap-3"><button onClick={() => setLocation("/finanza/impostazioni")} className="-ml-2 rounded-xl p-2 hover:bg-white/5"><ArrowLeft className="size-5" /></button><div className="min-w-0 flex-1"><h1 className="text-lg font-bold">Sottocategorie</h1><p className="text-xs text-muted-foreground">Voci proposte in base al centro di costo</p></div><Button size="sm" onClick={() => open()}><Plus className="mr-1 size-4" />Nuova</Button></div></header>
    <div className="space-y-3 p-4">
      <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca sottocategoria..." className="pl-9" /></div>
      <div className="flex gap-2 overflow-x-auto pb-1">{(["tutti", "entrata", "uscita", "entrambi"] as const).map((value) => <button key={value} onClick={() => setFiltroTipo(value)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${filtroTipo === value ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground"}`}>{value === "tutti" ? "Tutte" : value}</button>)}<button onClick={() => setShowArchived(!showArchived)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${showArchived ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-muted-foreground"}`}>Archiviate</button></div>
      {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground"><Tags className="mx-auto mb-3 size-10 opacity-30" /><p className="text-sm">Nessuna sottocategoria trovata</p></div>}
      {filtered.map((item: any) => <Card key={item.id} className="border-border/30 p-3"><div className="flex items-start gap-3"><div className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: item.colore || "#4ade80" }} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-medium">{item.nome}</p><Badge variant="outline" className="text-[10px]">{item.tipo}</Badge></div><p className="mt-1 text-[10px] text-muted-foreground">{item.codice}</p><div className="mt-2 flex flex-wrap gap-1">{(item.categoriaCentroIds ?? []).map((id: string) => <Badge key={id} variant="secondary" className="text-[10px]">{categoryName(id)}</Badge>)}</div></div>{showArchived ? <button aria-label="Riattiva" onClick={() => updateMut.mutate({ id: item.id, attivo: true })} className="p-2"><RotateCcw className="size-4 text-green-400" /></button> : <><button aria-label="Modifica" onClick={() => open(item)} className="p-2"><Pencil className="size-4 text-muted-foreground" /></button><button aria-label="Archivia" onClick={() => updateMut.mutate({ id: item.id, attivo: false })} className="p-2"><Archive className="size-4 text-muted-foreground" /></button></>}</div></Card>)}
    </div>
    <Sheet open={showForm} onOpenChange={setShowForm}><SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl"><SheetHeader><SheetTitle>{editId ? "Modifica sottocategoria" : "Nuova sottocategoria"}</SheetTitle></SheetHeader><div className="mt-4 space-y-4 pb-6">
      <div><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Carburanti" className="mt-1" /></div>
      <div><Label>Tipo *</Label><Select value={tipo} onValueChange={(value) => setTipo(value as Tipo)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="entrata">Entrata</SelectItem><SelectItem value="uscita">Uscita</SelectItem><SelectItem value="entrambi">Entrambi</SelectItem></SelectContent></Select></div>
      {!editId && <div><Label>Codice <span className="text-muted-foreground">(auto se vuoto)</span></Label><Input value={codice} onChange={(e) => setCodice(e.target.value)} className="mt-1" /></div>}
      <div><Label>Categorie dei centri collegate *</Label><p className="mb-2 text-xs text-muted-foreground">La sottocategoria verrà proposta soltanto per i centri appartenenti alle categorie selezionate.</p><div className="space-y-2">{(categorieCentri as any[]).filter((c) => c.attivo !== false).map((categoria) => { const selected = categoriaCentroIds.includes(categoria.id); return <button key={categoria.id} type="button" onClick={() => toggleCategory(categoria.id)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left ${selected ? "border-primary/50 bg-primary/10" : "border-border/40 bg-white/[0.02]"}`}><span className="flex size-5 items-center justify-center rounded border" style={{ borderColor: selected ? categoria.colore : undefined, backgroundColor: selected ? `${categoria.colore}25` : undefined }}>{selected && <Check className="size-3" />}</span><span className="text-sm">{categoria.nome}</span></button>; })}</div></div>
      <div><Label>Colore</Label><div className="mt-2 flex flex-wrap gap-2">{COLORI.map((value) => <button key={value} type="button" aria-label={`Colore ${value}`} onClick={() => setColore(value)} className={`size-8 rounded-full border-2 ${colore === value ? "scale-110 border-white" : "border-transparent"}`} style={{ backgroundColor: value }} />)}</div></div>
      <Button className="w-full" onClick={save} disabled={createMut.isPending || updateMut.isPending}>Salva sottocategoria</Button>
    </div></SheetContent></Sheet>
  </div>;
}
