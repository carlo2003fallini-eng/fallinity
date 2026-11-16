import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft, ArrowRight, Check, ChevronRight, CircleDot, Cpu, Droplets,
  Gauge, Minus, Package, Plus, RotateCcw, ShoppingCart, Tractor, Trash2,
  Wrench, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { C, eur } from "./shared";

type Step = "categoria" | "mezzo" | "reparto" | "famiglia" | "sottocategoria" | "articoli";
type Cart = Record<string, number>;

const REPARTO_ICONS: Record<string, any> = {
  "Elettronica ed elettrico": Zap,
  Idraulica: Droplets,
  Meccanica: Wrench,
  Motore: Gauge,
  "Trasmissione e cambio": Cpu,
};

function labelCategoria(value: string) {
  const lower = value.toLowerCase();
  if (lower.includes("tratt")) return "Trattori";
  if (lower.includes("attrezz")) return "Attrezzi";
  if (lower.includes("rimorch")) return "Rimorchi";
  if (lower.includes("semov")) return "Macchine semoventi";
  return value;
}

export default function OperatoreTab() {
  const [step, setStep] = useState<Step>("categoria");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [mezzoId, setMezzoId] = useState<string | null>(null);
  const [reparto, setReparto] = useState<string | null>(null);
  const [famiglia, setFamiglia] = useState<string | null>(null);
  const [sottocategoria, setSottocategoria] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [attemptKey, setAttemptKey] = useState(() => `operator-${crypto.randomUUID()}`);
  const [interventoId, setInterventoId] = useState("");
  const [nuovaDescrizione, setNuovaDescrizione] = useState("");
  const [success, setSuccess] = useState<{ id: string; costo: number } | null>(null);
  const utils = trpc.useUtils();
  const { data, isLoading, isError } = trpc.officina.operatore.catalogo.useQuery();
  const conferma = trpc.officina.operatore.confermaPrelievo.useMutation({
    onSuccess: async (result) => {
      setCart({});
      setAttemptKey(`operator-${crypto.randomUUID()}`);
      setCartOpen(false);
      setSuccess({ id: result.prelievoId, costo: result.costoTotale });
      await utils.officina.operatore.catalogo.invalidate();
      await utils.officina.ricambi.list.invalidate();
      await utils.officina.dashboard.invalidate();
      toast.success(result.duplicate ? "Prelievo già registrato: nessun doppio scarico" : "Prelievo confermato e giacenze aggiornate");
    },
    onError: (error) => toast.error(error.message || "Impossibile confermare il prelievo"),
  });

  const mezzo = useMemo(() => (data?.categorie ?? []).flatMap((group) => group.mezzi).find((item) => item.id === mezzoId), [data, mezzoId]);
  const gruppoCategoria = data?.categorie.find((group) => group.nome === categoria);
  const repartoData = data?.reparti.find((item) => item.nome === reparto);
  const famigliaData = repartoData?.famiglie.find((item) => item.nome === famiglia);
  const selectedArticles = useMemo(() => (data?.articoli ?? []).filter((part) => {
    if (part.reparto !== reparto) return false;
    if (part.famiglia !== famiglia) return false;
    if (sottocategoria && part.sottocategoria !== sottocategoria) return false;
    return true;
  }), [data, reparto, famiglia, sottocategoria]);
  const cartRows = useMemo(() => (data?.articoli ?? []).filter((part) => cart[part.id] > 0).map((part) => ({ part, quantita: cart[part.id] })), [data, cart]);
  const cartCount = cartRows.reduce((sum, row) => sum + row.quantita, 0);
  const cartTotal = cartRows.reduce((sum, row) => sum + row.quantita * (row.part.costoUnitario ?? 0), 0);
  const openInterventi = (data?.interventiAperti ?? []).filter((item) => item.macchinaId === mezzoId);

  function chooseMezzo(id: string) {
    setMezzoId(id);
    setInterventoId("");
    setSuccess(null);
    setStep("reparto");
  }
  function add(partId: string) {
    const part = data?.articoli.find((item) => item.id === partId);
    if (!part) return;
    setCart((current) => {
      const next = (current[partId] ?? 0) + 1;
      if (next > part.quantitaDisponibile) {
        toast.error(`Disponibilità massima: ${part.quantitaDisponibile}`);
        return current;
      }
      return { ...current, [partId]: next };
    });
  }
  function change(partId: string, delta: number) {
    const part = data?.articoli.find((item) => item.id === partId);
    if (!part) return;
    setCart((current) => {
      const next = Math.max(0, (current[partId] ?? 0) + delta);
      if (next > part.quantitaDisponibile) return current;
      const result = { ...current };
      if (next === 0) delete result[partId];
      else result[partId] = next;
      return result;
    });
  }
  function clearCart() {
    setCart({});
    setAttemptKey(`operator-${crypto.randomUUID()}`);
  }
  function back() {
    if (step === "articoli") setStep(sottocategoria ? "sottocategoria" : "famiglia");
    else if (step === "sottocategoria") setStep("famiglia");
    else if (step === "famiglia") setStep("reparto");
    else if (step === "reparto") setStep("mezzo");
    else if (step === "mezzo") setStep("categoria");
  }
  function homeMenu() {
    setStep("categoria");
    setCategoria(null); setMezzoId(null); setReparto(null); setFamiglia(null); setSottocategoria(null); setSuccess(null);
  }
  function goToArticles() {
    const hasSub = (famigliaData?.sottocategorie ?? []).length > 0;
    setStep(hasSub ? "sottocategoria" : "articoli");
  }
  function confirm() {
    if (!mezzoId || !cartRows.length) return;
    if (cartRows.some((row) => row.quantita > row.part.quantitaDisponibile)) {
      toast.error("Una giacenza è cambiata: riduci la quantità e riprova"); return;
    }
    if (!interventoId && nuovaDescrizione.trim().length < 3) {
      toast.error("Seleziona un intervento o descrivine uno nuovo"); return;
    }
    if (!window.confirm(`Confermare il prelievo di ${cartCount} pezzi per ${mezzo?.nome}? Le giacenze verranno scaricate ora.`)) return;
    conferma.mutate({
      idempotencyKey: attemptKey,
      macchinaId: mezzoId,
      interventoId: interventoId || undefined,
      nuovoIntervento: interventoId ? undefined : { descrizione: nuovaDescrizione.trim(), tipo: "manutenzione" },
      righe: cartRows.map((row) => ({ ricambioId: row.part.id, quantita: row.quantita })),
    });
  }

  if (isLoading) return <div className="py-20 text-center text-sm" style={{ color: C.textFaint }}>Caricamento catalogo operativo…</div>;
  if (isError || !data) return <div className="rounded-xl p-5 text-sm" style={{ background: `${C.red}12`, border: `1px solid ${C.red}35`, color: C.text }}>Catalogo non disponibile. Verifica i permessi dell’azienda attiva.</div>;

  return (
    <div className="space-y-4 pb-24">
      <div className="rounded-2xl p-4 sm:p-5" style={{ background: `linear-gradient(125deg, ${C.panel}, ${C.panelDark})`, border: `1px solid ${C.blue}35` }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: C.blue }}>F-006 · Operatività touch</p>
            <h2 className="mt-1 text-xl font-bold" style={{ color: C.text, fontFamily: "var(--font-display)" }}>Menù operatore</h2>
            <p className="mt-1 text-xs" style={{ color: C.textDim }}>Prelievo ricambi direttamente dalle giacenze reali.</p>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: `${C.blue}18`, color: C.blue }}><ShoppingCart size={21} /></div>
        </div>
        {mezzo && <div className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: C.inner }}><Tractor size={16} style={{ color: C.green }} /><span className="text-sm font-semibold truncate" style={{ color: C.text }}>{mezzo.nome}</span><span className="text-xs" style={{ color: C.textFaint }}>{mezzo.codice}</span></div>}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto text-[11px]" aria-label="Percorso operatore">
        <button onClick={homeMenu} className="whitespace-nowrap" style={{ color: step === "categoria" ? C.green : C.textFaint }}>Categorie</button>
        {mezzo && <><ChevronRight size={13} style={{ color: C.textFaint }} /><button onClick={() => setStep("mezzo")} className="whitespace-nowrap" style={{ color: step === "mezzo" ? C.green : C.textDim }}>Mezzo</button></>}
        {reparto && <><ChevronRight size={13} style={{ color: C.textFaint }} /><button onClick={() => setStep("reparto")} className="whitespace-nowrap" style={{ color: ["reparto", "famiglia", "sottocategoria", "articoli"].includes(step) ? C.green : C.textDim }}>{reparto}</button></>}
        {famiglia && <><ChevronRight size={13} style={{ color: C.textFaint }} /><span className="whitespace-nowrap" style={{ color: C.textDim }}>{famiglia}</span></>}
      </div>

      {success && (
        <div className="rounded-2xl p-5" style={{ background: `${C.green}12`, border: `1px solid ${C.green}45` }}>
          <div className="flex items-start gap-3"><div className="rounded-full p-2" style={{ background: `${C.green}20`, color: C.green }}><Check size={20} /></div><div><p className="font-semibold" style={{ color: C.text }}>Prelievo registrato</p><p className="mt-1 text-xs" style={{ color: C.textDim }}>Giacenze, storico intervento e costo attribuito aggiornati. Nessuna nuova spesa Finanza è stata generata.</p><p className="mt-2 text-xs" style={{ color: C.green }}>Costo materiali: {eur(success.costo)}</p></div></div>
          <Button onClick={() => setSuccess(null)} className="mt-4 w-full" style={{ background: C.green, color: C.bgDeep }}><RotateCcw size={15} /> Nuovo prelievo</Button>
        </div>
      )}

      {!success && step === "categoria" && <PanelTitle title="1 · Categoria mezzo" hint="Scegli il tipo di mezzo su cui stai lavorando" />}
      {!success && step === "categoria" && <div className="grid grid-cols-2 gap-3">{data.categorie.map((group) => <Tile key={group.nome} icon={Tractor} title={labelCategoria(group.nome)} detail={`${group.mezzi.length} ${group.mezzi.length === 1 ? "mezzo" : "mezzi"}`} color={C.green} onClick={() => { setCategoria(group.nome); setStep("mezzo"); }} />)}</div>}

      {!success && step === "mezzo" && <><PanelTitle title="2 · Mezzo aziendale" hint="Il nome è quello registrato nell’anagrafica mezzi" onBack={back} /> <div className="grid grid-cols-2 gap-3">{gruppoCategoria?.mezzi.map((item) => <Tile key={item.id} icon={Tractor} title={item.nome} detail={[item.marca, item.modello].filter(Boolean).join(" · ") || item.stato} color={C.green} onClick={() => chooseMezzo(item.id)} />)}</div></>}

      {!success && step === "reparto" && <><PanelTitle title="3 · Reparto" hint="Sono visibili solo i reparti con ricambi disponibili" onBack={back} /> <div className="grid grid-cols-2 gap-3">{data.reparti.map((item) => { const Icon = REPARTO_ICONS[item.nome] ?? Package; return <Tile key={item.nome} icon={Icon} title={item.nome} detail={`${item.famiglie.length} famiglie`} color={C.blue} onClick={() => { setReparto(item.nome); setFamiglia(null); setSottocategoria(null); setStep("famiglia"); }} />; })}</div></>}

      {!success && step === "famiglia" && <><PanelTitle title="4 · Famiglia ricambi" hint="Scegli la famiglia da prelevare" onBack={back} /> <div className="grid grid-cols-2 gap-3">{repartoData?.famiglie.map((item) => <Tile key={item.nome} icon={Package} title={item.nome} detail={item.sottocategorie.length ? `${item.sottocategorie.length} sottocategorie` : "Articoli disponibili"} color={C.orange} onClick={() => { setFamiglia(item.nome); setSottocategoria(null); goToArticles(); }} />)}</div></>}

      {!success && step === "sottocategoria" && <><PanelTitle title="5 · Sottocategoria" hint="Le sottocategorie sono mostrate solo quando configurate" onBack={back} /> <div className="grid grid-cols-2 gap-3">{(famigliaData?.sottocategorie ?? []).map((item) => <Tile key={item} icon={CircleDot} title={item} detail="Articoli disponibili" color={C.orange} onClick={() => { setSottocategoria(item); setStep("articoli"); }} />)}</div></>}

      {!success && step === "articoli" && <><PanelTitle title="6 · Articoli disponibili" hint="Tocca una scheda per aggiungere un pezzo al carrello" onBack={back} /> <div className="grid grid-cols-2 gap-3">{selectedArticles.map((part) => <button key={part.id} onClick={() => add(part.id)} className="min-h-[126px] rounded-xl p-3 text-left transition-transform active:scale-[0.98]" style={{ background: C.panel, border: `1px solid ${cart[part.id] ? C.green : C.border}` }}><div className="flex items-start justify-between gap-2"><div className="rounded-lg p-2" style={{ background: `${C.orange}18`, color: C.orange }}><Package size={17} /></div>{cart[part.id] ? <Badge style={{ background: `${C.green}20`, color: C.green }}>×{cart[part.id]}</Badge> : <Plus size={16} style={{ color: C.green }} />}</div><p className="mt-3 text-sm font-semibold leading-tight" style={{ color: C.text }}>{part.nome}</p><p className="mt-1 text-[11px]" style={{ color: C.textFaint }}>{part.codice} · disp. {part.quantitaDisponibile}</p></button>)}</div>{selectedArticles.length === 0 && <div className="py-12 text-center text-sm" style={{ color: C.textFaint }}>Nessun articolo disponibile in questa selezione.</div>}</>}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}><SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto" style={{ background: C.bgDeep, borderColor: C.border }}><SheetHeader><SheetTitle style={{ color: C.text }}>Carrello prelievo · {mezzo?.nome ?? "Nessun mezzo"}</SheetTitle></SheetHeader><div className="mt-4 space-y-4">{cartRows.length === 0 ? <p className="py-8 text-center text-sm" style={{ color: C.textFaint }}>Il carrello è vuoto.</p> : <>{cartRows.map(({ part, quantita }) => <div key={part.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: C.panel, border: `1px solid ${C.border}` }}><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate" style={{ color: C.text }}>{part.nome}</p><p className="text-xs" style={{ color: C.textFaint }}>{eur(part.costoUnitario ?? 0)} · disponibilità {part.quantitaDisponibile}</p></div><div className="flex items-center gap-2"><button onClick={() => change(part.id, -1)} className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: C.inner, color: C.text }} aria-label={`Riduci ${part.nome}`}><Minus size={15} /></button><span className="w-6 text-center text-sm font-semibold" style={{ color: C.text }}>{quantita}</span><button onClick={() => change(part.id, 1)} className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${C.green}20`, color: C.green }} aria-label={`Aumenta ${part.nome}`}><Plus size={15} /></button></div></div>)}<div className="flex items-center justify-between border-t pt-3" style={{ borderColor: C.border }}><span className="text-sm" style={{ color: C.textDim }}>Totale materiali</span><strong style={{ color: C.gold }}>{eur(cartTotal)}</strong></div><div className="space-y-3"><label className="text-xs font-medium" style={{ color: C.textDim }}>Intervento associato</label>{openInterventi.length > 0 && <select value={interventoId} onChange={(event) => setInterventoId(event.target.value)} className="h-11 w-full rounded-xl px-3 text-sm" style={{ background: C.inner, color: C.text, border: `1px solid ${C.border}` }}><option value="">Crea nuovo intervento</option>{openInterventi.map((item) => <option key={item.id} value={item.id}>{item.codice} · {item.descrizione}</option>)}</select>}{!interventoId && <Input value={nuovaDescrizione} onChange={(event) => setNuovaDescrizione(event.target.value)} placeholder="Descrizione nuovo intervento" className="bg-input border-border" />}</div><Button onClick={confirm} disabled={!cartRows.length || conferma.isPending} className="h-12 w-full gap-2" style={{ background: C.green, color: C.bgDeep }}>{conferma.isPending ? "Conferma in corso…" : <><Check size={17} /> Conferma e scarica</>}</Button><button onClick={() => setCart({})} className="flex w-full items-center justify-center gap-2 py-2 text-xs" style={{ color: C.red }}><Trash2 size={14} /> Svuota carrello</button></>}</div></SheetContent></Sheet>

      {cartCount > 0 && !success && <div className="fixed bottom-[4.7rem] left-1/2 z-30 w-[min(720px,calc(100%-2rem))] -translate-x-1/2"><button onClick={() => setCartOpen(true)} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 shadow-2xl" style={{ background: C.blue, color: C.bgDeep }}><ShoppingCart size={20} /><span className="flex-1 text-left text-sm font-bold">{cartCount} {cartCount === 1 ? "pezzo" : "pezzi"} nel carrello</span><span className="text-sm font-bold">{eur(cartTotal)}</span><ArrowRight size={17} /></button></div>}
    </div>
  );
}

function PanelTitle({ title, hint, onBack }: { title: string; hint: string; onBack?: () => void }) {
  return <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><h3 className="text-base font-semibold" style={{ color: C.text }}>{title}</h3><p className="mt-1 text-xs" style={{ color: C.textDim }}>{hint}</p></div>{onBack && <button onClick={onBack} className="flex h-10 items-center gap-1 rounded-lg px-3 text-xs" style={{ background: C.inner, color: C.textDim }}><ArrowLeft size={14} /> Indietro</button>}</div>;
}

function Tile({ icon: Icon, title, detail, color, onClick }: { icon: any; title: string; detail: string; color: string; onClick: () => void }) {
  return <button onClick={onClick} className="flex min-h-[94px] items-center gap-3 rounded-xl p-3 text-left transition-transform active:scale-[0.98]" style={{ background: C.panel, border: `1px solid ${C.border}` }}><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}18`, color }}><Icon size={21} /></div><span className="min-w-0 flex-1"><span className="block text-sm font-semibold leading-tight" style={{ color: C.text }}>{title}</span><span className="mt-1 block text-[11px]" style={{ color: C.textFaint }}>{detail}</span></span><ArrowRight size={15} style={{ color: C.textFaint }} /></button>;
}
