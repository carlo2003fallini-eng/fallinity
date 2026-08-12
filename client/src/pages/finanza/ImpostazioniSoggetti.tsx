import { useState, useMemo } from "react";
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
  ArrowLeft, Plus, Search, Users, Archive, RotateCcw, Pencil, Phone, Mail, Building2,
} from "lucide-react";
import { toast } from "sonner";

type Tab = "tutti" | "cliente" | "fornitore" | "entrambi" | "archiviati";
type Tipologia = "cliente" | "fornitore" | "entrambi";

export default function ImpostazioniSoggetti() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>("tutti");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Form state
  const [ragioneSociale, setRagioneSociale] = useState("");
  const [nomeBreve, setNomeBreve] = useState("");
  const [tipologia, setTipologia] = useState<Tipologia>("fornitore");
  const [partitaIva, setPartitaIva] = useState("");
  const [codiceFiscale, setCodiceFiscale] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [iban, setIban] = useState("");
  const [note, setNote] = useState("");

  const utils = trpc.useUtils();
  const { data: soggettiAll = [] } = trpc.finanza.soggetti.list.useQuery({});

  const createMut = trpc.finanza.soggetti.create.useMutation({
    onSuccess: () => { utils.finanza.soggetti.invalidate(); toast.success("Soggetto creato"); closeForm(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.finanza.soggetti.update.useMutation({
    onSuccess: () => { utils.finanza.soggetti.invalidate(); toast.success("Soggetto aggiornato"); closeForm(); },
    onError: (e) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    let list = soggettiAll as any[];
    if (tab === "archiviati") {
      list = list.filter((s: any) => s.attivo === false);
    } else {
      list = list.filter((s: any) => s.attivo !== false);
      if (tab !== "tutti") list = list.filter((s: any) => s.tipologia === tab || s.tipologia === "entrambi");
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((item: any) =>
        item.ragioneSociale?.toLowerCase().includes(s) ||
        item.nomeBreve?.toLowerCase().includes(s) ||
        item.partitaIva?.toLowerCase().includes(s) ||
        item.codiceFiscale?.toLowerCase().includes(s) ||
        item.email?.toLowerCase().includes(s) ||
        item.telefono?.includes(s)
      );
    }
    return list;
  }, [soggettiAll, tab, search]);

  function openCreate() {
    setEditId(null);
    setRagioneSociale(""); setNomeBreve(""); setTipologia("fornitore");
    setPartitaIva(""); setCodiceFiscale(""); setEmail(""); setTelefono("");
    setIndirizzo(""); setIban(""); setNote("");
    setShowForm(true);
  }
  function openEdit(s: any) {
    setEditId(s.id);
    setRagioneSociale(s.ragioneSociale || ""); setNomeBreve(s.nomeBreve || ""); setTipologia(s.tipologia);
    setPartitaIva(s.partitaIva || ""); setCodiceFiscale(s.codiceFiscale || "");
    setEmail(s.email || ""); setTelefono(s.telefono || "");
    setIndirizzo(s.indirizzo || ""); setIban(s.iban || ""); setNote(s.note || "");
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }

  function handleSave() {
    if (!ragioneSociale.trim()) { toast.error("Ragione sociale obbligatoria"); return; }
    const data = { ragioneSociale, nomeBreve: nomeBreve || undefined, tipologia, partitaIva: partitaIva || undefined, codiceFiscale: codiceFiscale || undefined, email: email || undefined, telefono: telefono || undefined, indirizzo: indirizzo || undefined, iban: iban || undefined, note: note || undefined };
    if (editId) {
      updateMut.mutate({ id: editId, ...data });
    } else {
      createMut.mutate(data);
    }
  }
  function handleArchive(id: string) { updateMut.mutate({ id, attivo: false }); }
  function handleReactivate(id: string) { updateMut.mutate({ id, attivo: true }); }

  const TABS: { key: Tab; label: string }[] = [
    { key: "tutti", label: "Tutti" },
    { key: "cliente", label: "Clienti" },
    { key: "fornitore", label: "Fornitori" },
    { key: "entrambi", label: "Cli+For" },
    { key: "archiviati", label: "Archiviati" },
  ];

  // Detail view
  const detailSoggetto = detailId ? (soggettiAll as any[]).find((s: any) => s.id === detailId) : null;

  if (detailSoggetto) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setDetailId(null)} className="p-2 -ml-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold">{detailSoggetto.ragioneSociale}</h1>
              <p className="text-xs text-muted-foreground capitalize">{detailSoggetto.tipologia}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setDetailId(null); openEdit(detailSoggetto); }}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* Header card */}
          <Card className="p-4 border-border/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-bold">{detailSoggetto.ragioneSociale}</h2>
                <Badge variant="outline" className="capitalize">{detailSoggetto.tipologia}</Badge>
              </div>
            </div>
            {detailSoggetto.partitaIva && <p className="text-xs text-muted-foreground">P.IVA: {detailSoggetto.partitaIva}</p>}
            {detailSoggetto.codiceFiscale && <p className="text-xs text-muted-foreground">CF: {detailSoggetto.codiceFiscale}</p>}
          </Card>
          {/* Contatti */}
          <Card className="p-4 border-border/30">
            <h3 className="font-semibold text-sm mb-3">Contatti</h3>
            <div className="space-y-2">
              {detailSoggetto.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" />{detailSoggetto.email}</div>}
              {detailSoggetto.telefono && <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" />{detailSoggetto.telefono}</div>}
              {detailSoggetto.indirizzo && <p className="text-sm text-muted-foreground">{detailSoggetto.indirizzo}</p>}
              {detailSoggetto.iban && <p className="text-xs text-muted-foreground">IBAN: {detailSoggetto.iban}</p>}
            </div>
          </Card>
          {/* Azioni */}
          <Card className="p-4 border-border/30">
            <h3 className="font-semibold text-sm mb-3">Azioni</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => { setDetailId(null); openEdit(detailSoggetto); }}>Modifica</Button>
              <Button variant="outline" size="sm" onClick={() => { handleArchive(detailSoggetto.id); setDetailId(null); }}>Archivia</Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/finanza/nuovo")}>Nuova entrata</Button>
              <Button variant="outline" size="sm" onClick={() => setLocation("/finanza/nuovo")}>Nuova uscita</Button>
            </div>
          </Card>
          {detailSoggetto.note && (
            <Card className="p-4 border-border/30">
              <h3 className="font-semibold text-sm mb-2">Note</h3>
              <p className="text-sm text-muted-foreground">{detailSoggetto.note}</p>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/finanza/impostazioni")} className="p-2 -ml-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Soggetti</h1>
            <p className="text-xs text-muted-foreground">{filtered.length} risultati</p>
          </div>
          <Button size="sm" onClick={openCreate} className="gap-1">
            <Plus className="w-4 h-4" /> Nuovo
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3">
        <div className="flex gap-1 overflow-x-auto pb-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                tab === t.key ? "bg-primary text-primary-foreground" : "bg-white/5 text-muted-foreground hover:bg-white/10"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cerca per nome, P.IVA, email..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-2">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun soggetto trovato</p>
          </div>
        )}
        {filtered.map((s: any) => (
          <Card
            key={s.id}
            className="p-3 cursor-pointer hover:bg-white/[0.03] active:scale-[0.98] transition-all border-border/30"
            onClick={() => setDetailId(s.id)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary">{s.ragioneSociale?.charAt(0)?.toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{s.ragioneSociale}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">{s.tipologia}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {s.partitaIva && <span className="text-[10px] text-muted-foreground">P.IVA {s.partitaIva}</span>}
                  {s.telefono && <span className="text-[10px] text-muted-foreground">{s.telefono}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {tab === "archiviati" ? (
                  <button onClick={(e) => { e.stopPropagation(); handleReactivate(s.id); }} className="p-2 rounded-lg hover:bg-white/5">
                    <RotateCcw className="w-4 h-4 text-green-400" />
                  </button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="p-2 rounded-lg hover:bg-white/5">
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Form Sheet */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{editId ? "Modifica soggetto" : "Nuovo soggetto"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4 pb-6">
            <div>
              <Label>Ragione sociale *</Label>
              <Input value={ragioneSociale} onChange={(e) => setRagioneSociale(e.target.value)} placeholder="es. Agriforniture Rossi S.r.l." className="mt-1" />
            </div>
            <div>
              <Label>Nome breve</Label>
              <Input value={nomeBreve} onChange={(e) => setNomeBreve(e.target.value)} placeholder="es. Rossi" className="mt-1" />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={tipologia} onValueChange={(v) => setTipologia(v as Tipologia)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="fornitore">Fornitore</SelectItem>
                  <SelectItem value="entrambi">Cliente e fornitore</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Partita IVA</Label>
                <Input value={partitaIva} onChange={(e) => setPartitaIva(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Codice Fiscale</Label>
                <Input value={codiceFiscale} onChange={(e) => setCodiceFiscale(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1" />
              </div>
              <div>
                <Label>Telefono</Label>
                <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Indirizzo</Label>
              <Input value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} placeholder="Via, CAP, Città, Prov." className="mt-1" />
            </div>
            <div>
              <Label>IBAN</Label>
              <Input value={iban} onChange={(e) => setIban(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Note</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" rows={2} />
            </div>
            <Button onClick={handleSave} className="w-full" disabled={createMut.isPending || updateMut.isPending}>
              {editId ? "Salva modifiche" : "Crea soggetto"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
