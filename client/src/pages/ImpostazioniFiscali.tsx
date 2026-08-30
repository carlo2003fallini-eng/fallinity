import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Scale, Award, Receipt, Plus, History, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { getUserErrorMessage } from "@/lib/userError";

// ──────────────────────────────────────────────────────────────────────────────
// IMPOSTAZIONI FISCALI — Forma Giuridica, Qualifiche, Regime IVA
// ──────────────────────────────────────────────────────────────────────────────

const FORME_GIURIDICHE: Record<string, string> = {
  ditta_individuale: "Ditta individuale",
  societa_semplice: "Società semplice (S.s.)",
  snc: "S.n.c.",
  sas: "S.a.s.",
  srl: "S.r.l.",
  srls: "S.r.l. semplificata",
  spa: "S.p.A.",
  sapa: "S.a.p.a.",
  cooperativa: "Cooperativa",
  cooperativa_agricola: "Cooperativa agricola",
  consorzio: "Consorzio",
  consorzio_agrario: "Consorzio agrario",
  ente_pubblico: "Ente pubblico",
  fondazione: "Fondazione",
  associazione: "Associazione",
  societa_semplice_agricola: "S.s. agricola",
  srl_agricola: "S.r.l. agricola",
  impresa_familiare: "Impresa familiare",
  altro: "Altro",
};

const QUALIFICHE_LABELS: Record<string, string> = {
  IAP: "Imprenditore Agricolo Professionale",
  CD: "Coltivatore Diretto",
  nessuna: "Nessuna",
  altra: "Altra qualifica",
  coltivatore_part_time: "Coltivatore part-time",
};

const REGIMI_LABELS: Record<string, string> = {
  speciale_agricolo: "Regime speciale agricolo (Art. 34)",
  ordinario: "Regime IVA ordinario",
  forfettario: "Regime forfettario",
  esonero: "Esonero",
  misto: "Regime misto",
  altro: "Altro regime",
};

export default function ImpostazioniFiscali() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("giuridica");
  const [showNewQualifica, setShowNewQualifica] = useState(false);
  const [showCambioRegime, setShowCambioRegime] = useState(false);

  const { data: summary } = trpc.fiscal.summary.useQuery();
  const { data: qualifications } = trpc.fiscal.qualifications.useQuery();
  const { data: legalProfiles } = trpc.fiscal.legalProfiles.useQuery();
  const { data: taxProfiles } = trpc.fiscal.taxProfiles.useQuery();

  const createQualification = trpc.fiscal.createQualification.useMutation({
    onSuccess: () => { toast.success("Qualifica aggiunta"); setShowNewQualifica(false); },
    onError: (e) => toast.error(getUserErrorMessage(e)),
  });
  const createTaxProfile = trpc.fiscal.createTaxProfile.useMutation({
    onSuccess: () => { toast.success("Regime IVA aggiornato"); setShowCambioRegime(false); },
    onError: (e) => toast.error(getUserErrorMessage(e)),
  });

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/azienda")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Impostazioni Fiscali</h1>
          <p className="text-xs text-muted-foreground">Forma giuridica, qualifiche e regime IVA</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-3 mb-4">
          <TabsTrigger value="giuridica">Giuridica</TabsTrigger>
          <TabsTrigger value="qualifiche">Qualifiche</TabsTrigger>
          <TabsTrigger value="regime">Regime IVA</TabsTrigger>
        </TabsList>

        {/* Tab Forma Giuridica */}
        <TabsContent value="giuridica" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                Forma giuridica attuale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Forma</span>
                <span className="font-medium">
                  {FORME_GIURIDICHE[summary?.legalProfile?.legalForm || ""] || summary?.legalProfile?.legalForm || "Non configurata"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Impresa agricola</span>
                <span className="font-medium">
                  {summary?.legalProfile?.isAgriculturalCompany ? "Sì" : "No"}
                </span>
              </div>

            </CardContent>
          </Card>

          {/* Storico */}
          {legalProfiles && legalProfiles.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Storico modifiche
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {legalProfiles.map((lp: any) => (
                  <div key={lp.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                    <span>{FORME_GIURIDICHE[lp.legalForm] || lp.legalForm}</span>
                    <span className="text-muted-foreground">
                      {lp.effectiveFrom ? String(lp.effectiveFrom).slice(0, 10) : ""}
                      {lp.effectiveTo ? ` → ${String(lp.effectiveTo).slice(0, 10)}` : " (attuale)"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Qualifiche */}
        <TabsContent value="qualifiche" className="space-y-3">
          <Button size="sm" onClick={() => setShowNewQualifica(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Aggiungi qualifica
          </Button>

          {(!qualifications || qualifications.length === 0) ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                Nessuna qualifica agricola registrata
              </CardContent>
            </Card>
          ) : (
            qualifications.map((q: any) => (
              <Card key={q.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {q.active ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{QUALIFICHE_LABELS[q.qualificationType] || q.qualificationType}</p>
                        <p className="text-xs text-muted-foreground">
                          {q.subjectName || q.subjectRole || "Titolare"}
                          {q.authority ? ` · ${q.authority}` : ""}
                        </p>
                      </div>
                    </div>
                    <Badge variant={q.active ? "default" : "secondary"}>
                      {q.active ? "Attiva" : "Scaduta"}
                    </Badge>
                  </div>
                  <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                    <span>Dal: {q.validFrom ? String(q.validFrom).slice(0, 10) : "N/D"}</span>
                    {q.validTo && <span>Al: {String(q.validTo).slice(0, 10)}</span>}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Tab Regime IVA */}
        <TabsContent value="regime" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Regime attuale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Regime</span>
                <span className="font-medium">
                  {REGIMI_LABELS[summary?.taxProfile?.vatRegime || ""] || summary?.taxProfile?.vatRegime || "Non configurato"}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border">
                <span className="text-muted-foreground">Periodicità</span>
                <span className="font-medium">{summary?.taxProfile?.settlementFrequency || "N/D"}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-muted-foreground">Decorrenza</span>
                <span className="font-medium">
                  {summary?.taxProfile?.effectiveFrom ? String(summary.taxProfile.effectiveFrom).slice(0, 10) : "N/D"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Button variant="outline" onClick={() => setShowCambioRegime(true)} className="w-full">
            Cambia regime IVA
          </Button>

          {/* Storico regimi */}
          {taxProfiles && taxProfiles.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Storico regimi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {taxProfiles.map((tp: any) => (
                  <div key={tp.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                    <span>{REGIMI_LABELS[tp.vatRegime] || tp.vatRegime}</span>
                    <span className="text-muted-foreground">
                      {tp.effectiveFrom ? String(tp.effectiveFrom).slice(0, 10) : ""}
                      {tp.effectiveTo ? ` → ${String(tp.effectiveTo).slice(0, 10)}` : " (attuale)"}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Sheet — Nuova Qualifica */}
      <NewQualificaSheet open={showNewQualifica} onClose={() => setShowNewQualifica(false)} onSubmit={createQualification} />

      {/* Sheet — Cambio Regime */}
      <CambioRegimeSheet open={showCambioRegime} onClose={() => setShowCambioRegime(false)} onSubmit={createTaxProfile} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sheet: Nuova Qualifica
// ──────────────────────────────────────────────────────────────────────────────

function NewQualificaSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: any }) {
  const [tipo, setTipo] = useState("IAP");
  const [nome, setNome] = useState("");
  const [ruolo, setRuolo] = useState("titolare");
  const [autorita, setAutorita] = useState("");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));

  const handleSubmit = () => {
    onSubmit.mutate({
      qualificationType: tipo as any,
      subjectName: nome || undefined,
      subjectRole: ruolo,
      authority: autorita || undefined,
      validFrom,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nuova qualifica agricola</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div>
            <Label>Tipo qualifica</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="IAP">IAP — Imprenditore Agricolo Professionale</SelectItem>
                <SelectItem value="CD">CD — Coltivatore Diretto</SelectItem>
                <SelectItem value="coltivatore_part_time">Coltivatore part-time</SelectItem>
                <SelectItem value="altra">Altra qualifica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Soggetto qualificato</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome e cognome" />
          </div>
          <div>
            <Label>Ruolo</Label>
            <Select value={ruolo} onValueChange={setRuolo}>
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
            <Input value={autorita} onChange={(e) => setAutorita(e.target.value)} placeholder="Es. Regione Lombardia" />
          </div>
          <div>
            <Label>Data decorrenza</Label>
            <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={onSubmit.isPending} className="w-full">
            {onSubmit.isPending ? "Salvataggio..." : "Aggiungi qualifica"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sheet: Cambio Regime IVA
// ──────────────────────────────────────────────────────────────────────────────

function CambioRegimeSheet({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: any }) {
  const [regime, setRegime] = useState("ordinario");
  const [periodicita, setPeriodicita] = useState("trimestrale");
  const [decorrenza, setDecorrenza] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    onSubmit.mutate({
      vatRegime: regime as any,
      settlementFrequency: periodicita as any,
      effectiveFrom: decorrenza,
      notes: notes || undefined,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Cambio regime IVA</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="p-3 bg-yellow-500/10 rounded-lg text-xs text-yellow-400">
            <strong>Attenzione:</strong> il cambio regime chiuderà automaticamente il regime precedente 
            alla data di decorrenza del nuovo. Lo storico viene conservato.
          </div>
          <div>
            <Label>Nuovo regime</Label>
            <Select value={regime} onValueChange={setRegime}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="speciale_agricolo">Regime speciale agricolo (Art. 34)</SelectItem>
                <SelectItem value="ordinario">Regime IVA ordinario</SelectItem>
                <SelectItem value="forfettario">Regime forfettario</SelectItem>
                <SelectItem value="esonero">Esonero</SelectItem>
                <SelectItem value="misto">Regime misto</SelectItem>
                <SelectItem value="altro">Altro regime</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Periodicità liquidazione</Label>
            <Select value={periodicita} onValueChange={setPeriodicita}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mensile">Mensile</SelectItem>
                <SelectItem value="trimestrale">Trimestrale</SelectItem>
                <SelectItem value="annuale">Annuale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data decorrenza</Label>
            <Input type="date" value={decorrenza} onChange={(e) => setDecorrenza(e.target.value)} />
          </div>
          <div>
            <Label>Note</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opzionale" />
          </div>
          <Button onClick={handleSubmit} disabled={onSubmit.isPending} className="w-full">
            {onSubmit.isPending ? "Aggiornamento..." : "Conferma cambio regime"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
