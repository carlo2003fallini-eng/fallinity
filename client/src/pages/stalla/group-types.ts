export type GroupMode = "manuale" | "automatico";
export type SourceKey = `group:${string}` | "ungrouped";
export type WizardStep = "origins" | "animals" | "review";

export type GroupSummary = {
  id: string;
  nome: string;
  codice?: string | null;
  tipologia: string;
  colore?: string | null;
  tipoGestione: GroupMode;
  modalitaMembri: "esclusivo" | "personalizzato";
  regolaAutomatica?: { tipo: "alta_produzione"; sogliaLitriGiorno: number } | { tipo: "post_parto"; giorniMassimi: number } | null;
  capacitaMax?: number | null;
  nAnimali: number;
  inLattazione: number;
  gravide: number;
  manze: number;
  produzioneMedia: number | null;
  hasAlert: boolean;
};

export type AnimalCandidate = {
  id: string;
  matricola: string;
  numeroAziendale?: string | null;
  nome?: string | null;
  gruppoId?: string | null;
  statoProduttivo?: string | null;
  statoRiproduttivo?: string | null;
  produzioneOggi?: string | number | null;
  healthScore?: number | null;
};

export type SourceBucket = {
  source: { key: SourceKey; gruppoId: string | null; nome: string; codice?: string | null; tipologia?: string | null; nDisponibili: number };
  animali: AnimalCandidate[];
};

export const WIZARD_STEPS: Array<{ id: WizardStep; label: string }> = [
  { id: "origins", label: "Origini" },
  { id: "animals", label: "Animali" },
  { id: "review", label: "Riepilogo" },
];

export function sourceKeyFromGroupId(gruppoId: string | null | undefined): SourceKey {
  return gruppoId ? `group:${gruppoId}` : "ungrouped";
}
