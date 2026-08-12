import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import {
  ArrowLeft, ChevronRight, Tag, Users, Target, Wallet, CreditCard,
  Settings2, Zap, SlidersHorizontal,
} from "lucide-react";

interface SettingCard {
  icon: React.ElementType;
  title: string;
  description: string;
  path: string;
  color: string;
  count?: number;
  alert?: string;
}

export default function ImpostazioniFinanza() {
  const [, setLocation] = useLocation();

  // Fetch counts
  const { data: categorie = [] } = trpc.finanza.categorie.list.useQuery({});
  const { data: soggettiList = [] } = trpc.finanza.soggetti.list.useQuery({});
  const { data: centriCosto = [] } = trpc.finanza.centriCosto.list.useQuery();
  const { data: conti = [] } = trpc.finanza.conti.list.useQuery();
  const { data: metodi = [] } = trpc.finanza.metodi.list.useQuery();

  const cards: SettingCard[] = [
    {
      icon: Tag,
      title: "Categorie e sottocategorie",
      description: "Organizza entrate e uscite per tipologia",
      path: "/finanza/impostazioni/categorie",
      color: "oklch(0.65 0.18 142)",
      count: categorie.length,
    },
    {
      icon: Users,
      title: "Soggetti",
      description: "Clienti, fornitori e la rubrica economica",
      path: "/finanza/impostazioni/soggetti",
      color: "oklch(0.6 0.15 220)",
      count: soggettiList.length,
    },
    {
      icon: Target,
      title: "Centri di costo",
      description: "Ripartisci le spese per area aziendale",
      path: "/finanza/impostazioni/centri-costo",
      color: "oklch(0.72 0.15 75)",
      count: centriCosto.length,
    },
    {
      icon: Wallet,
      title: "Conti finanziari",
      description: "Banca, cassa, carte e depositi",
      path: "/finanza/impostazioni/conti",
      color: "oklch(0.6 0.18 160)",
      count: conti.length,
    },
    {
      icon: CreditCard,
      title: "Metodi di pagamento",
      description: "Bonifico, carta, contanti e altri",
      path: "/finanza/impostazioni/metodi-pagamento",
      color: "oklch(0.65 0.15 280)",
      count: metodi.length,
    },
    {
      icon: Settings2,
      title: "Configurazione fiscale e IVA",
      description: "Forma giuridica, regime IVA, qualifiche",
      path: "/azienda/fiscale",
      color: "oklch(0.55 0.22 25)",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/finanza")} className="p-2 -ml-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Impostazioni Finanza</h1>
            <p className="text-xs text-muted-foreground">Gestisci anagrafiche e configurazioni</p>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="p-4 space-y-3">
        {cards.map((card) => (
          <Card
            key={card.path}
            className="p-4 cursor-pointer hover:bg-white/[0.03] active:scale-[0.98] transition-all duration-200 border-border/30"
            onClick={() => setLocation(card.path)}
          >
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `color-mix(in oklch, ${card.color} 15%, transparent)` }}
              >
                <card.icon className="w-6 h-6" style={{ color: card.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{card.title}</h3>
                  {card.count !== undefined && (
                    <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                      {card.count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{card.description}</p>
                {card.alert && (
                  <p className="text-xs text-amber-400 mt-1">{card.alert}</p>
                )}
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
