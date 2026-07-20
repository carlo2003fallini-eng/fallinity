import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Clock, AlertTriangle, Link2, XCircle } from "lucide-react";

const fmtCents = (cents: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);

type ModuleName = "fleet" | "inventory" | "livestock" | "crop" | "machinery";

interface Props {
  originModule: ModuleName;
  originEntityId: string;
  compact?: boolean;
}

const statoConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  da_esaminare: { icon: <Clock className="w-3 h-3" />, color: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "Da esaminare" },
  convertita: { icon: <CheckCircle2 className="w-3 h-3" />, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "Convertita" },
  collegata: { icon: <Link2 className="w-3 h-3" />, color: "bg-blue-500/10 text-blue-600 border-blue-500/20", label: "Collegata" },
  ignorata: { icon: <XCircle className="w-3 h-3" />, color: "bg-muted text-muted-foreground border-border", label: "Ignorata" },
  errore: { icon: <AlertTriangle className="w-3 h-3" />, color: "bg-red-500/10 text-red-600 border-red-500/20", label: "Errore" },
};

/**
 * Badge che mostra lo stato finanziario di un'entità (intervento, animale, ecc.)
 * Collegamento bidirezionale: dal record operativo → stato finanziario.
 */
export default function FinancialStatusBadge({ originModule, originEntityId, compact }: Props) {
  const { data, isLoading } = trpc.finanza.proposte.originStatus.useQuery(
    { originModule, originEntityId },
    { staleTime: 30_000 },
  );

  if (isLoading || !data?.hasProposals) return null;

  const proposals = data.proposals;
  if (proposals.length === 0) return null;

  // Mostra lo stato più rilevante
  const primary = proposals[0];
  const config = statoConfig[primary.stato] || statoConfig.da_esaminare;
  const totalAmount = proposals.reduce((sum: number, p: any) => sum + p.importo, 0);

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 ${config.color}`}>
            {config.icon}
            <span>{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{proposals.length} proposta/e — {fmtCents(totalAmount)}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 ${config.color}`}>
        {config.icon}
        <span>{config.label}</span>
      </Badge>
      <span className="text-[10px] text-muted-foreground">{fmtCents(totalAmount)}</span>
    </div>
  );
}
