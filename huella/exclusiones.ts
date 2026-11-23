// Fuentes que se pueden excluir del inventario y cálculo de las emisiones de los extintores de CO2 (criterio de insignificancia, ISO 14064-1).

export const FUENTE_EXTINTORES = 'Extintores de CO₂ (recargas)';
export const FUENTES_EXCLUIBLES = [
  FUENTE_EXTINTORES,
  'Refrigerante de equipos domésticos y pequeños (neveras, vitrinas)',
  'Grupo electrógeno de emergencia',
  'Otra fuente (indicar)',
] as const;
export const FUENTE_OTRA = 'Otra fuente (indicar)';

/** Una fila del certificado de mantenimiento: extintores de CO2 recargados de un mismo tamaño. */
export interface LineaExtintor { cantidad: number; kgPorExtintor: number }
export interface CalculoExtintores {
  tipo: 'extintores';
  lineas: LineaExtintor[];
  totalExtintores: number;
  kgCO2: number;
  tCO2e: number;
  /** Total del inventario (sin la exclusión) con el que se calculó el porcentaje, en t CO2e. */
  totalInventarioT: number;
  porcentaje: number;
  certificadoPath?: string;
  certificadoNombre?: string;
}

/** Porcentaje que supone lo excluido sobre el total que tendría el inventario si se incluyera. */
export function porcentajeExcluido(tExcluidas: number, totalInventarioT: number): number {
  const total = totalInventarioT + tExcluidas;
  return total > 0 ? (tExcluidas / total) * 100 : 0;
}

/** Cada recarga repone el CO2 liberado desde la última (se asume emitido a la atmósfera). PCA del CO2 = 1. */
export function calcularExtintores(lineas: LineaExtintor[], totalInventarioT: number): Omit<CalculoExtintores, 'certificadoPath' | 'certificadoNombre'> {
  const utiles = lineas.filter((l) => l.cantidad > 0 && l.kgPorExtintor > 0);
  const totalExtintores = utiles.reduce((s, l) => s + l.cantidad, 0);
  const kgCO2 = utiles.reduce((s, l) => s + l.cantidad * l.kgPorExtintor, 0);
  const tCO2e = kgCO2 / 1000;
  return { tipo: 'extintores', lineas: utiles, totalExtintores, kgCO2, tCO2e, totalInventarioT, porcentaje: porcentajeExcluido(tCO2e, totalInventarioT) };
}

const n = (x: number, d = 2) => x.toLocaleString('es-ES', { maximumFractionDigits: d });

/** Texto de justificación para el informe. */
export function justificacionExtintores(c: CalculoExtintores): string {
  const filas = c.lineas.map((l) => `${n(l.cantidad, 0)} de ${n(l.kgPorExtintor)} kg`).join(', ');
  return `Emisión estimada con el certificado anual de mantenimiento${c.certificadoNombre ? ` («${c.certificadoNombre}»)` : ''}: ${n(c.totalExtintores, 0)} extintor(es) de CO₂ recargado(s) (${filas}), es decir ${n(c.kgCO2)} kg de CO₂ = ${n(c.tCO2e, 3)} t CO₂e (PCA 1). Supone el ${n(c.porcentaje, 3)} % del total del inventario (${n(c.totalInventarioT, 2)} t CO₂e sin la exclusión), por debajo del umbral de insignificancia.`;
}
