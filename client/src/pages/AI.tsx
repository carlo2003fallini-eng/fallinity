import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Streamdown } from "streamdown";
import { Send, Plus, Trash2, Bot, User, Zap, Brain, Eye, Shield, Lightbulb, MessageSquare, TrendingUp, Sprout, Tractor, Activity } from "lucide-react";
import { toast } from "sonner";

const GREEN = "oklch(0.65 0.18 142)";
const GOLD = "oklch(0.72 0.15 75)";

const SUGGESTED_QUESTIONS = [
  "Analizza la situazione finanziaria del mese corrente",
  "Quali campi necessitano attenzione urgente?",
  "Suggerisci come ottimizzare le spese di officina",
  "Come migliorare il ROI aziendale?",
  "Quali manutenzioni sono in scadenza?",
  "Analizza i prodotti sotto scorta in magazzino",
];

const XAI_PRINCIPLES = [
  { icon: Brain, label: "Ragionamento Trasparente", desc: "Ogni risposta include il ragionamento dietro il suggerimento" },
  { icon: Eye, label: "Dati Contestuali", desc: "L'AI accede ai dati reali della tua azienda per risposte precise" },
  { icon: Shield, label: "Decisioni Motivate", desc: "Nessun suggerimento senza spiegazione — sempre verificabile" },
  { icon: Lightbulb, label: "Enterprise Memory™", desc: "L'AI ricorda il contesto delle conversazioni precedenti" },
];

export default function AI() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: kpi } = trpc.dashboard.kpi.useQuery();
  const { data: sessions = [], refetch: refetchSessions } = trpc.ai.sessions.useQuery();
  const { data: messages = [], refetch: refetchMessages } = trpc.ai.messages.useQuery(
    { sessionId: selectedSession! },
    { enabled: !!selectedSession }
  );

  const newSession = trpc.ai.newSession.useMutation({
    onSuccess: (data) => {
      refetchSessions();
      setSelectedSession(data.sessionId);
    },
    onError: () => toast.error("Errore nella creazione della sessione"),
  });

  const chat = trpc.ai.chat.useMutation({
    onSuccess: () => {
      refetchMessages();
      setIsTyping(false);
    },
    onError: () => {
      setIsTyping(false);
      toast.error("Errore nella risposta AI");
    },
  });

  const deleteSession = trpc.ai.deleteSession.useMutation({
    onSuccess: () => {
      refetchSessions();
      setSelectedSession(null);
      toast.success("Conversazione eliminata");
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (msg?: string) => {
    const text = (msg ?? input).trim();
    if (!text) return;

    let sessionId = selectedSession;
    if (!sessionId) {
      const result = await newSession.mutateAsync({ titolo: text.slice(0, 50) });
      sessionId = result.sessionId;
    }

    setInput("");
    setIsTyping(true);
    chat.mutate({ sessionId: sessionId!, message: text });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const msgList = messages as any[];
  const sessionList = sessions as any[];

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 animate-fade-in-up">
      {/* Sidebar sessioni */}
      <div className="w-64 shrink-0 flex flex-col gap-2">
        <Button
          onClick={() => { setSelectedSession(null); newSession.mutate({ titolo: "Nuova conversazione" }); }}
          disabled={newSession.isPending}
          className="w-full gap-2 justify-start"
          style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}
        >
          <Plus size={15} /> Nuova chat
        </Button>

        <div className="flex-1 overflow-y-auto space-y-1">
          {sessionList.length === 0 ? (
            <div className="text-center py-6">
              <MessageSquare size={24} className="mx-auto mb-2 opacity-20" style={{ color: GREEN }} />
              <p className="text-xs" style={{ color: "oklch(0.4 0.01 145)" }}>Nessuna conversazione</p>
            </div>
          ) : (
            sessionList.map((s: any) => (
              <div
                key={s.id}
                onClick={() => setSelectedSession(s.id)}
                className="group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all"
                style={{
                  background: selectedSession === s.id ? `${GREEN}15` : "transparent",
                  border: `1px solid ${selectedSession === s.id ? GREEN + "40" : "transparent"}`,
                }}
              >
                <MessageSquare size={13} style={{ color: selectedSession === s.id ? GREEN : "oklch(0.45 0.01 145)" }} className="shrink-0" />
                <span className="flex-1 text-xs truncate" style={{ color: selectedSession === s.id ? "oklch(0.85 0.01 145)" : "oklch(0.6 0.01 145)" }}>
                  {s.titolo}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession.mutate({ id: s.id }); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={11} style={{ color: "oklch(0.5 0.15 25)" }} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* XAI Principles */}
        <div className="rounded-xl p-3 space-y-2" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
          <p className="text-xs font-semibold" style={{ color: GOLD }}>Explainable AI™</p>
          {XAI_PRINCIPLES.map(p => (
            <div key={p.label} className="flex items-start gap-2">
              <p.icon size={11} className="mt-0.5 shrink-0" style={{ color: GREEN }} />
              <div>
                <p className="text-xs font-medium" style={{ color: "oklch(0.7 0.01 145)" }}>{p.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Area chat principale */}
      <div className="flex-1 flex flex-col rounded-xl overflow-hidden" style={{ background: "oklch(0.11 0.006 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${GREEN}20` }}>
            <Bot size={16} style={{ color: GREEN }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold" style={{ color: "oklch(0.9 0.01 145)" }}>Fallinity Copilot</h2>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: `${GOLD}20`, color: GOLD }}>Explainable AI™</span>
            </div>
            <p className="text-xs" style={{ color: "oklch(0.45 0.01 145)" }}>Suggerimenti motivati sui dati reali della tua azienda</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} />
            <span className="text-xs" style={{ color: GREEN }}>Online</span>
          </div>
        </div>

        {/* Banner contesto live */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-b overflow-x-auto" style={{ borderColor: "oklch(0.16 0.007 145)", background: "oklch(0.09 0.005 145)" }}>
          <span className="text-[10px] font-semibold uppercase tracking-wider shrink-0" style={{ color: "oklch(0.4 0.01 145)" }}>Contesto live</span>
          {[
            { icon: TrendingUp, label: "Utile", value: `€${Number(kpi?.utile ?? 0).toLocaleString("it-IT")}`, color: (kpi?.utile ?? 0) >= 0 ? GREEN : "oklch(0.6 0.2 25)" },
            { icon: Sprout, label: "Campi", value: String(kpi?.campi ?? 0), color: GREEN },
            { icon: Tractor, label: "Mezzi", value: String(kpi?.macchine ?? 0), color: GOLD },
            { icon: Activity, label: "Sotto scorta", value: String(kpi?.prodottiSottoScorta ?? 0), color: (kpi?.prodottiSottoScorta ?? 0) > 0 ? GOLD : GREEN },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-1.5 shrink-0">
              <c.icon size={12} style={{ color: c.color }} />
              <span className="text-[11px]" style={{ color: "oklch(0.5 0.01 145)" }}>{c.label}:</span>
              <span className="text-[11px] font-semibold" style={{ color: "oklch(0.85 0.01 145)" }}>{c.value}</span>
            </div>
          ))}
        </div>

        {/* Messaggi */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!selectedSession || msgList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `${GREEN}15`, border: `1px solid ${GREEN}30` }}>
                  <Zap size={28} style={{ color: GREEN }} />
                </div>
                <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: "var(--font-display)", color: "oklch(0.85 0.01 145)" }}>
                  Ciao! Sono l'AI di Fallinity
                </h3>
                <p className="text-sm max-w-sm text-center" style={{ color: "oklch(0.5 0.01 145)" }}>
                  Posso analizzare i dati della tua azienda e fornirti suggerimenti motivati con approccio <strong style={{ color: GOLD }}>Explainable AI™</strong>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-left px-3 py-2.5 rounded-lg text-xs transition-all hover:scale-[1.02]"
                    style={{
                      background: "oklch(0.09 0.005 145)",
                      border: "1px solid oklch(0.2 0.008 145)",
                      color: "oklch(0.65 0.01 145)",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {msgList.map((msg: any) => (
                <div key={msg.id} className={`flex gap-3 ${msg.ruolo === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: msg.ruolo === "user" ? `${GOLD}20` : `${GREEN}20`,
                    }}
                  >
                    {msg.ruolo === "user"
                      ? <User size={13} style={{ color: GOLD }} />
                      : <Bot size={13} style={{ color: GREEN }} />
                    }
                  </div>
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${msg.ruolo === "user" ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                    style={{
                      background: msg.ruolo === "user"
                        ? `${GOLD}15`
                        : "oklch(0.09 0.005 145)",
                      border: `1px solid ${msg.ruolo === "user" ? GOLD + "30" : "oklch(0.18 0.008 145)"}`,
                      color: "oklch(0.85 0.01 145)",
                    }}
                  >
                    {msg.ruolo === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none [&>*]:text-[oklch(0.82_0.01_145)] [&_strong]:text-[oklch(0.9_0.01_145)] [&_code]:bg-[oklch(0.15_0.006_145)] [&_code]:px-1 [&_code]:rounded [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_ul]:list-disc [&_ol]:list-decimal">
                        <Streamdown>{msg.contenuto}</Streamdown>
                      </div>
                    ) : (
                      <p>{msg.contenuto}</p>
                    )}
                    <p className="text-xs mt-1.5 opacity-40">
                      {new Date(msg.createdAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${GREEN}20` }}>
                    <Bot size={13} style={{ color: GREEN }} />
                  </div>
                  <div className="px-4 py-3 rounded-xl rounded-tl-sm" style={{ background: "oklch(0.09 0.005 145)", border: "1px solid oklch(0.18 0.008 145)" }}>
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full animate-bounce"
                          style={{ background: GREEN, animationDelay: `${i * 150}ms` }}
                        />
                      ))}
                      <span className="text-xs ml-2" style={{ color: "oklch(0.45 0.01 145)" }}>Analisi in corso...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="px-4 py-3 border-t" style={{ borderColor: "oklch(0.18 0.008 145)" }}>
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Chiedi all'AI Fallinity... (Invio per inviare)"
                className="pr-4 py-3 text-sm bg-input border-border"
                disabled={chat.isPending || isTyping}
              />
            </div>
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || chat.isPending || isTyping}
              className="h-10 w-10 p-0 shrink-0"
              style={{ background: GREEN, color: "oklch(0.08 0.005 145)" }}
            >
              <Send size={15} />
            </Button>
          </div>
          <p className="text-xs mt-1.5" style={{ color: "oklch(0.35 0.01 145)" }}>
            Explainable AI™ — ogni suggerimento include il ragionamento basato sui dati reali della tua azienda.
          </p>
        </div>
      </div>
    </div>
  );
}
