import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Plus, Search, Tag, Archive, RotateCcw, Pencil, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

type Tipo = "entrata" | "uscita" | "entrambi";

export default function ImpostazioniCategorie() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"tutti" | Tipo>("tutti");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  // Form state
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Tipo>("uscita");
  const [codice, setCodice] = useState("");
  const [colore, setColore] = useState("#4ade80");
  const [icona, setIcona] = useState("");
  const [parentId, setParentId] = useState<string>("");

  const utils = trpc.useUtils();
  const { data: categorie = [] } = trpc.finanza.categorie.list.useQuery({});

  // ── Seed automatico se nessuna categoria presente ──
  const seedMut = trpc.finanza.seed.useMutation({
    onSuccess: (data) => {
      if (data?.seeded) utils.finanza.categorie.invalidate();
    },
  });
  useEffect(() => {
    if ((categorie as any[]).length === 0 && !seedMut.isPending && !seedMut.isSuccess) {
      seedMut.mutate({});
    }
  }, [categorie]);

  const createMut = trpc.finanza.categorie.create.useMutation({
    onSuccess: () => { utils.finanza.categorie.invalidate(); toast.success("Categoria creata"); closeForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.finanza.categorie.update.useMutation({
    onSuccess: () => { utils.finanza.categorie.invalidate(); toast.success("Categoria aggiornata"); closeForm(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = categorie as any[];
    if (!showArchived) list = list.filter((c: any) => c.attivo !== false);
    else list = list.filter((c: any) => c.attivo === false);
    if (filtroTipo !== "tutti") list = list.filter((c: any) => c.tipo === filtroTipo || c.tipo === "entrambi");
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c: any) => c.nome.toLowerCase().includes(s) || c.codice?.toLowerCase().includes(s));
    }
    return list;
  }, [categorie, filtroTipo, search, showArchived]);

  const parentCategories = useMemo(() => (categorie as any[]).filter((c: any) => !c.parentId && c.attivo !== false), [categorie]);
  const getSubcategories = (parentId: string) => (categorie as any[]).filter((c: any) => c.parentId === parentId);

  function openCreate(parent?: string) {
    setEditId(null);
    setNome(""); setTipo("uscita"); setCodice(""); setColore("#4ade80"); setIcona(""); setParentId(parent || "");
    setShowForm(true);
  }
  function openEdit(cat: any) {
    setEditId(cat.id);
    setNome(cat.nome); setTipo(cat.tipo); setCodice(cat.codice || ""); setColore(cat.colore || "#4ade80"); setIcona(cat.icona || ""); setParentId(cat.parentId || "");
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }

  function handleSave() {
    if (!nome.trim()) { toast.error("Nome obbligatorio"); return; }
    if (editId) {
      updateMut.mutate({ id: editId, nome, colore, icona: icona || undefined, ordine: undefined, attivo: undefined });
    } else {
      createMut.mutate({ nome, tipo, codice: codice || undefined, colore, icona: icona || undefined, parentId: parentId || undefined });
    }
  }

  function handleArchive(id: string) {
    updateMut.mutate({ id, attivo: false });
  }
  function handleReactivate(id: string) {
    updateMut.mutate({ id, attivo: true });
  }

  const COLORI = ["#4ade80", "#60a5fa", "#f59e0b", "#f87171", "#a78bfa", "#ec4899", "#14b8a6", "#8b5cf6"];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/finanza/impostazioni")} className="p-2 -ml-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Categorie</h1>
            <p className="text-xs text-muted-foreground">{filtered.length} {showArchived ? "archiviate" : "attive"}</p>
          </div>
          <Button size="sm" onClick={() => openCreate()} className="gap-1">
            <Plus className="w-4 h-4" /> Nuova
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pt-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca categoria..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["tutti", "entrata", "uscita", "entrambi"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filtroTipo === t ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:bg-white/10"
              }`}
            >
              {t === "tutti" ? "Tutte" : t === "entrata" ? "Entrata" : t === "uscita" ? "Uscita" : "Entrambi"}
            </button>
          ))}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              showArchived ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <Archive className="w-3 h-3 inline mr-1" />Archiviate
          </button>
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Tag className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{showArchived ? "Nessuna categoria archiviata" : "Nessuna categoria trovata"}</p>
          </div>
        )}
        {filtered.filter((c: any) => !c.parentId).map((cat: any) => {
          const subs = getSubcategories(cat.id);
          return (
            <Card key={cat.id} className="border-border/30 overflow-hidden">
              <div className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.colore || "#4ade80"}20` }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.colore || "#4ade80" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{cat.nome}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">{cat.tipo}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{cat.codice}</span>
                    {subs.length > 0 && <span className="text-[10px] text-muted-foreground">{subs.length} sottocategorie</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {showArchived ? (
                    <button onClick={() => handleReactivate(cat.id)} className="p-2 rounded-lg hover:bg-white/5">
                      <RotateCcw className="w-4 h-4 text-green-400" />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => openEdit(cat)} className="p-2 rounded-lg hover:bg-white/5">
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleArchive(cat.id)} className="p-2 rounded-lg hover:bg-white/5">
                        <Archive className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Subcategories */}
              {subs.length > 0 && !showArchived && (
                <div className="border-t border-border/20 bg-white/[0.02] px-3 py-2 space-y-1">
                  {subs.map((sub: any) => (
                    <div key={sub.id} className="flex items-center gap-2 py-1 pl-4">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.colore || cat.colore || "#4ade80" }} />
                      <span className="text-xs flex-1">{sub.nome}</span>
                      <button onClick={() => openEdit(sub)} className="p-1 rounded hover:bg-white/5">
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => openCreate(cat.id)} className="flex items-center gap-1 text-xs text-primary pl-4 py-1 hover:underline">
                    <Plus className="w-3 h-3" /> Aggiungi sottocategoria
                  </button>
                </div>
              )}
              {subs.length === 0 && !showArchived && (
                <div className="border-t border-border/20 bg-white/[0.02] px-3 py-2">
                  <button onClick={() => openCreate(cat.id)} className="flex items-center gap-1 text-xs text-primary pl-4 py-1 hover:underline">
                    <Plus className="w-3 h-3" /> Aggiungi sottocategoria
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Form Sheet */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{editId ? "Modifica categoria" : parentId ? "Nuova sottocategoria" : "Nuova categoria"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4 pb-6">
            <div>
              <Label>Nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Carburanti" className="mt-1" />
            </div>
            {!editId && !parentId && (
              <div>
                <Label>Tipo *</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrata">Entrata</SelectItem>
                    <SelectItem value="uscita">Uscita</SelectItem>
                    <SelectItem value="entrambi">Entrambi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {!editId && (
              <div>
                <Label>Codice <span className="text-muted-foreground">(auto se vuoto)</span></Label>
                <Input value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="CAT-XXX" className="mt-1" />
              </div>
            )}
            <div>
              <Label>Colore</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {COLORI.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColore(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${colore === c ? "border-white scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Icona <span className="text-muted-foreground">(opzionale)</span></Label>
              <Input value={icona} onChange={(e) => setIcona(e.target.value)} placeholder="es. fuel, wrench, leaf" className="mt-1" />
            </div>
            {!editId && parentId && (
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Sottocategoria di: <span className="text-foreground font-medium">{parentCategories.find((c: any) => c.id === parentId)?.nome}</span></p>
              </div>
            )}
            <Button onClick={handleSave} className="w-full" disabled={createMut.isPending || updateMut.isPending}>
              {editId ? "Salva modifiche" : "Crea categoria"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
