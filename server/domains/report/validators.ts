/**
 * REPORT (Enterprise Metrics) — Validators
 *
 * Tutte le procedure di questo dominio (summary, finanza, operativo) sono query
 * di sola lettura che operano sul contesto azienda corrente e NON accettano input.
 * Questo file esiste per coerenza architetturale (ogni dominio ha i 4 layer:
 * router / service / repository / validators). Quando verranno introdotti filtri
 * (es. intervallo date, dominio specifico), i relativi schemi Zod andranno qui.
 */

export {};
