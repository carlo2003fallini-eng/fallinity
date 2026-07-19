import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownRight, ArrowUpRight, Search, Calendar, Receipt,
  Clock, CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";

const GREEN = "oklch(0.65 0.18 142)";
const RED = "oklch(0.55 0.22 25)";

const fmtCents = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short" }); }
  catch { return d; }
};

const statoIcon: Record<string, React.ReactNode> = {
  registrato: <Clock className="w-3.5 h-3.5 text-blue-500" />,
  pagato: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  incassato: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  annullato: <XCircle className="w-3.5 h-3.5 text-muted-foreground" />,
  scaduto: <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />,
  parzialmente_regolato: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  bozza: <Receipt className="w-3.5 h-3.5 text-muted-foreground" />,
};

const statoLabel: Record<string, string> = {
  registrato: "Da regolare",
  pagato: "Pagato",
  incassato: "Incassato",
  annullato: "Annullato",
  scaduto: "Scaduto",
  parzialmente_regolato: "Parziale",
  bozza: "Bozza",
};

type TabFilter = "tutti" | "entrate" | "uscite" | "da_regolare";

export default function ListaMovimenti() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<TabFilter>("tutti");
  const [search, setSearch] = useState("");

  const tipoFilter = tab === "entrate" ? "entrata" : tab === "uscite" ? "uscita" : undefined;
  const { data: movimenti = [], isLoading } = trpc.finanza.movimenti.list.useQuery({
    tipo: tipoFilter,
    stato: tab === "da_regolare" ? "registrato" : undefined,
    search: search || undefined,
  });

  // Raggruppamento per mese
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const m of movimenti as any[]) {
      const date = new Date(m.dataDocumento);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
      if (!groups[key]) groups[key] = [];
      groups[key].push({ ...m, monthLabel: label });
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [movimenti]);

  // Totali per tab
  const totali = useMemo(() => {
    let entrate = 0, uscite = 0;
    for (const m of movimenti as any[]) {
      if (m.tipo === "entrata") entrate += m.totale;
      else uscite += m.totale;
    }
    return { entrate, uscite, saldo: entrate - uscite };
  }, [movimenti]);

  return (
    <div className="space-y-4">
      {/* Riepilogo rapido */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-emerald-500/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Entrate</p>
          <p className="text-sm font-bold text-emerald-600">{fmtCents(totali.entrate)}</p>
        </div>
        <div className="rounded-xl bg-red-500/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Uscite</p>
          <p className="text-sm font-bold text-red-600">{fmtCents(totali.uscite)}</p>
        </div>
        <div className="rounded-xl bg-primary/10 p-3 text-center">
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`text-sm font-bold ${totali.saldo >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {fmtCents(totali.saldo)}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="tutti">Tutti</TabsTrigger>
          <TabsTrigger value="entrate">Entrate</TabsTrigger>
          <TabsTrigger value="uscite">Uscite</TabsTrigger>
          <TabsTrigger value="da_regolare">Scadenze</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Ricerca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per descrizione, soggetto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nessun movimento</p>
          <p className="text-sm mt-1">Premi + per registrare il primo</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(([key, items]) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase">
                  {items[0].monthLabel}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((m: any) => (
                  <button
                    key={m.id}
                    onClick={() => setLocation(`/finanza/movimento/${m.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      m.tipo === "entrata" ? "bg-emerald-500/10" : "bg-red-500/10"
                    }`}>
                      {m.tipo === "entrata"
                        ? <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                        : <ArrowUpRight className="w-4 h-4 text-red-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {m.descrizione || m.tipoDocumento || (m.tipo === "entrata" ? "Entrata" : "Uscita")}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {statoIcon[m.stato]}
                        <span className="text-xs text-muted-foreground">{statoLabel[m.stato] || m.stato}</span>
                        <span className="text-xs text-muted-foreground">• {fmtDate(m.dataDocumento)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold" style={{ color: m.tipo === "entrata" ? GREEN : RED }}>
                        {m.tipo === "entrata" ? "+" : "-"}{fmtCents(m.totale)}
                      </p>
                      {m.categoriaNome && (
                        <Badge variant="outline" className="text-[10px] mt-0.5">{m.categoriaNome}</Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
