import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Search, Truck, Package, Tractor, Wheat, Wrench,
  ArrowDownRight, ArrowUpRight, Clock, CheckCircle2,
  XCircle, AlertTriangle, Link2, RotateCcw, Eye,
} from "lucide-react";
import ProposalConvertSheet from "./ProposalConvertSheet";

const fmtCents = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
const fmtDate = (d: string | Date) => {
  try { return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return String(d); }
};

const moduleIcons: Record<string, React.ReactNode> = {
  fleet: <Truck className="w-4 h-4" />,
  inventory: <Package className="w-4 h-4" />,
  livestock: <Tractor className="w-4 h-4" />,
  crop: <Wheat className="w-4 h-4" />,
  machinery: <Wrench className="w-4 h-4" />,
};
const moduleLabels: Record<string, string> = {
  fleet: "Officina",
  inventory: "Magazzino",
  livestock: "Stalla",
  crop: "Campi",
  machinery: "Macchinari",
};
const statoColors: Record<string, string> = {
  da_esaminare: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  convertita: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  collegata: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  ignorata: "bg-muted text-muted-foreground border-border",
  errore: "bg-red-500/10 text-red-600 border-red-500/20",
};
const statoLabels: Record<string, string> = {
  da_esaminare: "Da esaminare",
  convertita: "Convertita",
  collegata: "Collegata",
  ignorata: "Ignorata",
  errore: "Errore",
};
const statoIcons: Record<string, React.ReactNode> = {
  da_esaminare: <Clock className="w-3.5 h-3.5" />,
  convertita: <CheckCircle2 className="w-3.5 h-3.5" />,
  collegata: <Link2 className="w-3.5 h-3.5" />,
  ignorata: <XCircle className="w-3.5 h-3.5" />,
  errore: <AlertTriangle className="w-3.5 h-3.5" />,
};

type TabFilter = "da_esaminare" | "convertita" | "collegata" | "ignorata" | "errore" | "tutte";

export default function Proposte() {
  const [tab, setTab] = useState<TabFilter>("da_esaminare");
  const [search, setSearch] = useState("");
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: counts = [] } = trpc.finanza.proposte.counts.useQuery();
  const { data: proposte = [], isLoading, refetch } = trpc.finanza.proposte.list.useQuery({
    stato: tab !== "tutte" ? tab : undefined,
    search: search || undefined,
    limit: 50,
    offset: 0,
  });

  const retryMutation = trpc.finanza.proposte.retry.useMutation({
    onSuccess: () => refetch(),
  });

  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of counts as any[]) {
      map[c.stato] = Number(c.count);
    }
    return map;
  }, [counts]);

  const handleAction = (proposal: any) => {
    setSelectedProposal(proposal);
    setSheetOpen(true);
  };

  return (
    <div className="flex flex-col gap-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Proposte finanziarie</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Movimenti generati automaticamente dai moduli operativi
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabFilter)}>
        <TabsList className="w-full overflow-x-auto flex-nowrap">
          <TabsTrigger value="da_esaminare" className="gap-1.5 text-xs">
            <Clock className="w-3.5 h-3.5" />
            Da esaminare
            {countMap.da_esaminare ? (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {countMap.da_esaminare}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="convertita" className="gap-1.5 text-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Convertite
          </TabsTrigger>
          <TabsTrigger value="collegata" className="gap-1.5 text-xs">
            <Link2 className="w-3.5 h-3.5" />
            Collegate
          </TabsTrigger>
          <TabsTrigger value="ignorata" className="gap-1.5 text-xs">
            <XCircle className="w-3.5 h-3.5" />
            Ignorate
          </TabsTrigger>
          <TabsTrigger value="errore" className="gap-1.5 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            Errori
            {countMap.errore ? (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                {countMap.errore}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per descrizione, modulo, riferimento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : proposte.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Nessuna proposta {tab !== "tutte" ? `con stato "${statoLabels[tab]}"` : ""}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(proposte as any[]).map((p) => (
            <Card
              key={p.id}
              className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent/50 transition-colors active:scale-[0.99]"
              onClick={() => handleAction(p)}
            >
              {/* Icona modulo */}
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {moduleIcons[p.originModule] || <Eye className="w-4 h-4" />}
              </div>

              {/* Contenuto */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{p.descrizione}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {moduleLabels[p.originModule] || p.originModule}
                  </span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(p.dataOrigine)}</span>
                  {p.originReference && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">{p.originReference}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Importo + stato */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`text-sm font-semibold tabular-nums ${p.tipo === "entrata" ? "text-emerald-600" : "text-red-500"}`}>
                  {p.tipo === "entrata" ? "+" : "-"}{fmtCents(Number(p.importo))}
                </span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statoColors[p.stato] || ""}`}>
                  {statoIcons[p.stato]}
                  <span className="ml-1">{statoLabels[p.stato] || p.stato}</span>
                </Badge>
              </div>

              {/* Azione rapida per errori */}
              {p.stato === "errore" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    retryMutation.mutate({ proposalId: p.id });
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Bottom Sheet conversione */}
      <ProposalConvertSheet
        proposal={selectedProposal}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSuccess={() => {
          setSheetOpen(false);
          refetch();
        }}
      />
    </div>
  );
}
