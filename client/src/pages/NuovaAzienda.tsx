import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight, Check, Building2, Scale, Award, Receipt, Wallet, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

// ──────────────────────────────────────────────────────────────────────────────
// WIZARD CREAZIONE AZIENDA — 6 Step
// ──────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Dati base", icon: Building2 },
  { id: 2, label: "Forma giuridica", icon: Scale },
  { id: 3, label: "Qualifiche", icon: Award },
  { id: 4, label: "Regime IVA", icon: Receipt },
  { id: 5, label: "Posizione IVA", icon: Wallet },
  { id: 6, label: "Riepilogo", icon: ClipboardCheck },
];

const FORME_GIURIDICHE = [
  { value: "ditta_individuale", label: "Ditta individuale" },
  { value: "societa_semplice", label: "Società semplice (S.s.)" },
  { value: "snc", label: "Società in nome collettivo (S.n.c.)" },
  { value: "sas", label: "Società in accomandita semplice (S.a.s.)" },
  { value: "srl", label: "Società a responsabilità limitata (S.r.l.)" },
  { value: "srls", label: "S.r.l. semplificata" },
  { value: "spa", label: "Società per azioni (S.p.A.)" },
  { value: "sapa", label: "Società in accomandita per azioni (S.a.p.a.)" },
  { value: "cooperativa", label: "Società cooperativa" },
  { value: "cooperativa_agricola", label: "Cooperativa agricola" },
  { value: "consorzio", label: "Consorzio" },
  { value: "consorzio_agrario", label: "Consorzio agrario" },
  { value: "ente_pubblico", label: "Ente pubblico" },
  { value: "fondazione", label: "Fondazione" },
  { value: "associazione", label: "Associazione" },
  { value: "altro", label: "Altro (specificare)" },
];

const QUALIFICHE = [
  { value: "nessuna", label: "Nessuna qualifica agricola" },
  { value: "IAP", label: "Imprenditore Agricolo Professionale (IAP)" },
  { value: "CD", label: "Coltivatore Diretto (CD)" },
  { value: "entrambe", label: "IAP + CD" },
  { value: "altra", label: "Altra qualifica" },
];

const REGIMI_IVA = [
  { value: "speciale_agricolo", label: "Regime speciale agricolo (Art. 34)" },
  { value: "ordinario", label: "Regime IVA ordinario" },
  { value: "forfettario", label: "Regime forfettario" },
  { value: "esonero", label: "Esonero (volume affari < 7.000€)" },
  { value: "misto", label: "Regime misto (speciale + ordinario)" },
  { value: "altro", label: "Altro regime" },
];

const PERIODICITA = [
  { value: "mensile", label: "Mensile" },
  { value: "trimestrale", label: "Trimestrale" },
  { value: "annuale", label: "Annuale" },
];

export default function NuovaAzienda() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);

  // Step 1 — Dati base
  const [nome, setNome] = useState("");
  const [piva, setPiva] = useState("");
  const [cf, setCf] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [settore, setSettore] = useState("agricoltura");
  const [ettari, setEttari] = useState("");

  // Step 2 — Forma giuridica
  const [formaGiuridica, setFormaGiuridica] = useState("");
  const [isAgricola, setIsAgricola] = useState(true);
  const [specifyOther, setSpecifyOther] = useState("");

  // Step 3 — Qualifiche
  const [qualifica, setQualifica] = useState("nessuna");
  const [soggettoNome, setSoggettoNome] = useState("");
  const [soggettoRuolo, setSoggettoRuolo] = useState("titolare");
  const [qualificaAutorita, setQualificaAutorita] = useState("");

  // Step 4 — Regime IVA
  const [regimeIva, setRegimeIva] = useState("");
  const [periodicita, setPeriodicita] = useState("trimestrale");
  const [decorrenza, setDecorrenza] = useState(new Date().toISOString().slice(0, 10));

  // Step 5 — Posizione IVA iniziale
  const [posizioneIva, setPosizioneIva] = useState<"credito" | "debito" | "zero" | "da_definire">("zero");
  const [importoIva, setImportoIva] = useState("");
  const [dataRiferimento, setDataRiferimento] = useState(new Date().toISOString().slice(0, 10));

  const createMutation = trpc.fiscal.createCompanyWizard.useMutation({
    onSuccess: () => {
      toast.success("Azienda creata con successo!");
      navigate("/");
    },
    onError: (err) => {
      toast.error(err.message || "Errore nella creazione");
    },
  });

  const handleSubmit = () => {
    createMutation.mutate({
      // Dati base
      name: nome,
      partitaIva: piva || undefined,
      codiceFiscale: cf || undefined,
      indirizzo: indirizzo || undefined,
      settore,
      ettari: ettari ? parseFloat(ettari) : undefined,
      // Forma giuridica
      legalForm: formaGiuridica as any,
      isAgriculturalCompany: isAgricola,
      specifyOther: formaGiuridica === "altro" ? specifyOther : undefined,
      // Qualifiche
      qualifications: qualifica !== "nessuna" ? [{
        qualificationType: qualifica as any,
        subjectRole: soggettoRuolo,
        subjectName: soggettoNome || undefined,
        authority: qualificaAutorita || undefined,
        validFrom: decorrenza,
      }] : [],
      // Regime IVA
      vatRegime: regimeIva as any,
      settlementFrequency: periodicita as any,
      vatEffectiveFrom: decorrenza,
      // Posizione iniziale
      vatPositionType: posizioneIva as any,
      vatAmount: posizioneIva === "zero" ? 0 : parseFloat(importoIva) || 0,
      vatReferenceDate: dataRiferimento,
    });
  };

  const canProceed = () => {
    switch (step) {
      case 1: return nome.trim().length > 0;
      case 2: return formaGiuridica.length > 0;
      case 3: return true; // qualifica è opzionale
      case 4: return regimeIva.length > 0;
      case 5: return true; // posizione è opzionale
      case 6: return true;
      default: return false;
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => step > 1 ? setStep(step - 1) : navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Nuova Azienda</h1>
          <p className="text-xs text-muted-foreground">Step {step} di 6 — {STEPS[step - 1].label}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1 mb-6">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s.id <= step ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="space-y-4">
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5 text-primary" />
                Dati base dell'azienda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome azienda *</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Azienda Agricola Rossi" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Partita IVA</Label>
                  <Input value={piva} onChange={(e) => setPiva(e.target.value)} placeholder="01234567890" />
                </div>
                <div>
                  <Label>Codice Fiscale</Label>
                  <Input value={cf} onChange={(e) => setCf(e.target.value)} placeholder="RSSMRA80A01H501Z" />
                </div>
              </div>
              <div>
                <Label>Indirizzo</Label>
                <Input value={indirizzo} onChange={(e) => setIndirizzo(e.target.value)} placeholder="Via Roma 1, 00100 Roma" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Settore</Label>
                  <Select value={settore} onValueChange={setSettore}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agricoltura">Agricoltura</SelectItem>
                      <SelectItem value="zootecnia">Zootecnia</SelectItem>
                      <SelectItem value="misto">Misto</SelectItem>
                      <SelectItem value="agriturismo">Agriturismo</SelectItem>
                      <SelectItem value="altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ettari (SAU)</Label>
                  <Input type="number" value={ettari} onChange={(e) => setEttari(e.target.value)} placeholder="0" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Scale className="h-5 w-5 text-primary" />
                Forma giuridica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Forma giuridica *</Label>
                <Select value={formaGiuridica} onValueChange={setFormaGiuridica}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {FORME_GIURIDICHE.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formaGiuridica === "altro" && (
                <div>
                  <Label>Specificare</Label>
                  <Input value={specifyOther} onChange={(e) => setSpecifyOther(e.target.value)} placeholder="Descrivi la forma giuridica" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isAgricola"
                  checked={isAgricola}
                  onChange={(e) => setIsAgricola(e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="isAgricola" className="cursor-pointer">Impresa agricola</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                La forma giuridica è indipendente dalla qualifica agricola (IAP/CD). 
                Qualsiasi forma giuridica può essere un'impresa agricola.
              </p>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-5 w-5 text-primary" />
                Qualifiche agricole
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Qualifica</Label>
                <Select value={qualifica} onValueChange={setQualifica}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUALIFICHE.map((q) => (
                      <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {qualifica !== "nessuna" && (
                <>
                  <div>
                    <Label>Soggetto qualificato</Label>
                    <Input value={soggettoNome} onChange={(e) => setSoggettoNome(e.target.value)} placeholder="Nome e cognome" />
                  </div>
                  <div>
                    <Label>Ruolo</Label>
                    <Select value={soggettoRuolo} onValueChange={setSoggettoRuolo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="titolare">Titolare</SelectItem>
                        <SelectItem value="socio">Socio</SelectItem>
                        <SelectItem value="amministratore">Amministratore</SelectItem>
                        <SelectItem value="familiare">Familiare coadiuvante</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Ente certificatore</Label>
                    <Input value={qualificaAutorita} onChange={(e) => setQualificaAutorita(e.target.value)} placeholder="Es. Regione Lombardia" />
                  </div>
                </>
              )}
              <p className="text-xs text-muted-foreground">
                La qualifica IAP/CD è personale e si applica al soggetto, non all'azienda. 
                Puoi aggiungerne altre in seguito dalle impostazioni.
              </p>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-5 w-5 text-primary" />
                Regime IVA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Regime IVA *</Label>
                <Select value={regimeIva} onValueChange={setRegimeIva}>
                  <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                  <SelectContent>
                    {REGIMI_IVA.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Periodicità liquidazione</Label>
                <Select value={periodicita} onValueChange={setPeriodicita}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIODICITA.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data decorrenza</Label>
                <Input type="date" value={decorrenza} onChange={(e) => setDecorrenza(e.target.value)} />
              </div>
              {regimeIva === "speciale_agricolo" && (
                <div className="p-3 bg-blue-500/10 rounded-lg text-xs text-blue-400">
                  <strong>Regime speciale agricolo (Art. 34):</strong> l'IVA sulle vendite non viene versata 
                  ma trattenuta come compensazione forfettaria. L'IVA sugli acquisti è un costo.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-5 w-5 text-primary" />
                Posizione IVA iniziale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Posizione attuale</Label>
                <Select value={posizioneIva} onValueChange={(v) => setPosizioneIva(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credito">Credito IVA (lo Stato ti deve)</SelectItem>
                    <SelectItem value="debito">Debito IVA (devi allo Stato)</SelectItem>
                    <SelectItem value="zero">Zero (nessun saldo)</SelectItem>
                    <SelectItem value="da_definire">Da definire in seguito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(posizioneIva === "credito" || posizioneIva === "debito") && (
                <div>
                  <Label>Importo (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={importoIva}
                    onChange={(e) => setImportoIva(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              )}
              {posizioneIva !== "da_definire" && (
                <div>
                  <Label>Data riferimento</Label>
                  <Input type="date" value={dataRiferimento} onChange={(e) => setDataRiferimento(e.target.value)} />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Il saldo IVA iniziale non viene registrato come entrata o uscita. 
                Rappresenta la posizione di partenza verso l'Erario.
              </p>
            </CardContent>
          </Card>
        )}

        {step === 6 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                Riepilogo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{nome}</span>
                </div>
                {piva && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">P.IVA</span>
                    <span className="font-medium">{piva}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Forma giuridica</span>
                  <span className="font-medium">{FORME_GIURIDICHE.find(f => f.value === formaGiuridica)?.label || formaGiuridica}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Qualifica</span>
                  <span className="font-medium">{QUALIFICHE.find(q => q.value === qualifica)?.label || "Nessuna"}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Regime IVA</span>
                  <span className="font-medium">{REGIMI_IVA.find(r => r.value === regimeIva)?.label || regimeIva}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Periodicità</span>
                  <span className="font-medium">{PERIODICITA.find(p => p.value === periodicita)?.label || periodicita}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Posizione IVA</span>
                  <span className="font-medium">
                    {posizioneIva === "credito" && `Credito €${importoIva || "0"}`}
                    {posizioneIva === "debito" && `Debito €${importoIva || "0"}`}
                    {posizioneIva === "zero" && "Zero"}
                    {posizioneIva === "da_definire" && "Da definire"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Indietro
            </Button>
          )}
          {step < 6 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="flex-1">
              Avanti
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={createMutation.isPending} className="flex-1">
              {createMutation.isPending ? "Creazione..." : "Crea Azienda"}
              <Check className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
