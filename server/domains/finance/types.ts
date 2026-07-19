/**
 * FINANCE — Types & Enums condivisi
 */

export const TIPO_MOVIMENTO = ["entrata", "uscita"] as const;
export type TipoMovimento = (typeof TIPO_MOVIMENTO)[number];

export const TIPO_REGISTRAZIONE = ["pagato_subito", "documento", "ricorrente", "trasferimento", "investimento"] as const;
export type TipoRegistrazione = (typeof TIPO_REGISTRAZIONE)[number];

export const TIPO_DOCUMENTO = [
  "fattura_acquisto",
  "fattura_vendita",
  "ricevuta",
  "nota_credito_ricevuta",
  "nota_credito_emessa",
  "parcella",
  "contratto",
  "avviso_pagamento",
  "generico",
  "altro",
] as const;
export type TipoDocumento = (typeof TIPO_DOCUMENTO)[number];

export const STATO_DOCUMENTO = ["bozza", "registrato", "parzialmente_regolato", "pagato", "incassato", "scaduto", "annullato"] as const;
export type StatoDocumento = (typeof STATO_DOCUMENTO)[number];

export const STATO_SCADENZA = ["aperta", "parzialmente_pagata", "pagata", "incassata", "scaduta", "annullata"] as const;
export type StatoScadenza = (typeof STATO_SCADENZA)[number];

export const STATO_PAGAMENTO = ["confermato", "annullato", "rettificato"] as const;
export type StatoPagamento = (typeof STATO_PAGAMENTO)[number];

export const STATO_MOVIMENTO_CASSA = ["confermato", "annullato", "rettificato"] as const;
export type StatoMovimentoCassa = (typeof STATO_MOVIMENTO_CASSA)[number];

export const TIPO_CONTO = ["bancario", "cassa", "carta", "deposito", "altro"] as const;
export type TipoConto = (typeof TIPO_CONTO)[number];

export const TIPOLOGIA_SOGGETTO = ["cliente", "fornitore", "entrambi"] as const;
export type TipologiaSoggetto = (typeof TIPOLOGIA_SOGGETTO)[number];

export const TIPO_CATEGORIA = ["entrata", "uscita", "entrambi"] as const;
export type TipoCategoria = (typeof TIPO_CATEGORIA)[number];

export const METODO_IVA = ["totale_iva_inclusa", "imponibile_piu_iva", "importo_senza_iva", "iva_non_applicabile"] as const;
export type MetodoIva = (typeof METODO_IVA)[number];

export const FREQUENZA_RICORRENZA = ["mensile", "bimestrale", "trimestrale", "semestrale", "annuale"] as const;
export type FrequenzaRicorrenza = (typeof FREQUENZA_RICORRENZA)[number];

// Aliquote IVA comuni (in centesimi: 2200 = 22%)
export const ALIQUOTE_IVA = [0, 400, 500, 1000, 2200] as const;

// Mappa frequenza → mesi di offset
export const FREQUENZA_MESI: Record<FrequenzaRicorrenza, number> = {
  mensile: 1,
  bimestrale: 2,
  trimestrale: 3,
  semestrale: 6,
  annuale: 12,
};

/** Categorie iniziali uscite */
export const CATEGORIE_USCITE_DEFAULT = [
  { codice: "USC-01", nome: "Alimentazione animale", colore: "#f59e0b", icona: "wheat" },
  { codice: "USC-02", nome: "Farmaci e veterinario", colore: "#ef4444", icona: "pill" },
  { codice: "USC-03", nome: "Carburanti", colore: "#6366f1", icona: "fuel" },
  { codice: "USC-04", nome: "Manutenzione macchinari", colore: "#8b5cf6", icona: "wrench" },
  { codice: "USC-05", nome: "Ricambi", colore: "#a855f7", icona: "cog" },
  { codice: "USC-06", nome: "Energia", colore: "#eab308", icona: "zap" },
  { codice: "USC-07", nome: "Personale", colore: "#3b82f6", icona: "users" },
  { codice: "USC-08", nome: "Sementi", colore: "#22c55e", icona: "sprout" },
  { codice: "USC-09", nome: "Concimi", colore: "#84cc16", icona: "leaf" },
  { codice: "USC-10", nome: "Contoterzisti", colore: "#14b8a6", icona: "truck" },
  { codice: "USC-11", nome: "Assicurazioni", colore: "#06b6d4", icona: "shield" },
  { codice: "USC-12", nome: "Leasing e mutui", colore: "#0ea5e9", icona: "landmark" },
  { codice: "USC-13", nome: "Investimenti", colore: "#2563eb", icona: "trending-up" },
  { codice: "USC-14", nome: "Amministrazione", colore: "#64748b", icona: "file-text" },
  { codice: "USC-15", nome: "Altro", colore: "#94a3b8", icona: "more-horizontal" },
];

/** Categorie iniziali entrate */
export const CATEGORIE_ENTRATE_DEFAULT = [
  { codice: "ENT-01", nome: "Vendita latte", colore: "#4ade80", icona: "milk" },
  { codice: "ENT-02", nome: "Vendita animali", colore: "#34d399", icona: "cow" },
  { codice: "ENT-03", nome: "Vendita colture", colore: "#10b981", icona: "wheat" },
  { codice: "ENT-04", nome: "Lavorazioni conto terzi", colore: "#059669", icona: "tractor" },
  { codice: "ENT-05", nome: "Contributi", colore: "#0d9488", icona: "hand-coins" },
  { codice: "ENT-06", nome: "Rimborsi", colore: "#14b8a6", icona: "undo" },
  { codice: "ENT-07", nome: "Affitti", colore: "#06b6d4", icona: "home" },
  { codice: "ENT-08", nome: "Altri ricavi", colore: "#22d3ee", icona: "plus-circle" },
];

/** Centri di costo iniziali */
export const CENTRI_COSTO_DEFAULT = [
  { codice: "CDC-01", nome: "Stalla", colore: "#4ade80" },
  { codice: "CDC-02", nome: "Alimentazione", colore: "#f59e0b" },
  { codice: "CDC-03", nome: "Sanità animale", colore: "#ef4444" },
  { codice: "CDC-04", nome: "Produzione latte", colore: "#06b6d4" },
  { codice: "CDC-05", nome: "Campi", colore: "#84cc16" },
  { codice: "CDC-06", nome: "Officina", colore: "#8b5cf6" },
  { codice: "CDC-07", nome: "Macchinari", colore: "#6366f1" },
  { codice: "CDC-08", nome: "Magazzino", colore: "#f97316" },
  { codice: "CDC-09", nome: "Personale", colore: "#3b82f6" },
  { codice: "CDC-10", nome: "Energia", colore: "#eab308" },
  { codice: "CDC-11", nome: "Amministrazione", colore: "#64748b" },
  { codice: "CDC-12", nome: "Investimenti", colore: "#2563eb" },
  { codice: "CDC-13", nome: "Altro", colore: "#94a3b8" },
];

/** Metodi di pagamento iniziali */
export const METODI_PAGAMENTO_DEFAULT = [
  "Bonifico", "Carta", "Contanti", "Addebito diretto", "Assegno", "Compensazione", "Altro",
];
