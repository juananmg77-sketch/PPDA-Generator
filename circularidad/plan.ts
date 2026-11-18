// Modelo y cálculos del Plan de Circularidad: ficha, indicadores por año, plan de acción con seguimiento trimestral (como el PPDA) y cumplimiento legal.
import { AREAS, INDICADORES, ORDEN_AREAS, REQUISITOS, camasElevablesExigidas, indicador } from './catalogo.ts';
import type { Area, CategoriaHotel, EstadoReq } from './catalogo.ts';

export interface Ficha {
  establecimiento: string; empresa: string; direccion: string; actividad: string; apertura: string;
  habitaciones?: number; capacidad?: number; pernoctaciones?: number; superficie?: number;
  categoria: CategoriaHotel; categoriaTexto: string; responsablePlan: string; estructura: string;
  vigenciaDesde: number; vigenciaHasta: number; fechaPublicacion: string;
}
export interface Accion { id: string; codigo: string; descripcion: string; responsable: string; plazo: string }
export interface Objetivo {
  id: string; codigo: string; area: Area; descripcion: string; indicadorId: string; lineaBase: string; meta: string; plazo: string;
  responsable: string; recursos: string; inversion: string; acciones: Accion[];
}
export interface Trimestre { cumple: boolean; evidencia: string }
export interface SeguimientoAccion { t1: Trimestre; t2: Trimestre; t3: Trimestre; t4: Trimestre; notas: string }
export interface SeguimientoAnio { cerrado: boolean; acciones: Record<string, SeguimientoAccion> }
export interface EstadoRequisito { estado: EstadoReq; evidencia: string; nota: string }
export interface Plan {
  id: string; version: number; ficha: Ficha;
  /** Datos de entrada de los indicadores: año → campo → valor. */
  datos: Record<number, Record<string, number | undefined>>;
  /** Letra de la certificación energética por año (dato cualitativo). */
  letraCertificado: Record<number, string>;
  accionesClientes: string[];
  camasElevablesInstaladas: Record<number, number | undefined>;
  objetivos: Objetivo[];
  seguimiento: Record<number, SeguimientoAnio>;
  requisitos: Record<string, EstadoRequisito>;
  cerrado: boolean;
}

export const TRIMESTRES = ['t1', 't2', 't3', 't4'] as const;
export const vacioTrim = (): Trimestre => ({ cumple: false, evidencia: '' });
export const vacioSeg = (): SeguimientoAccion => ({ t1: vacioTrim(), t2: vacioTrim(), t3: vacioTrim(), t4: vacioTrim(), notas: '' });

/** Valor de un indicador en un año, o undefined si faltan datos. */
export function valorIndicador(plan: Plan, id: string, anio: number): number | undefined {
  return indicador(id).calcular(plan.datos[anio] ?? {}, { pernoctaciones: plan.ficha.pernoctaciones });
}

export interface FilaEvolucion { id: string; nombre: string; unidad: string; decimales: number; area: Area; valores: Record<number, number | undefined>; tendencia: 'mejora' | 'empeora' | 'igual' | 'sin-datos' }
export function evolucion(plan: Plan, anios: number[]): FilaEvolucion[] {
  return INDICADORES.map((ind) => {
    const valores: Record<number, number | undefined> = {};
    for (const a of anios) valores[a] = valorIndicador(plan, ind.id, a);
    const con = anios.filter((a) => valores[a] !== undefined);
    let tendencia: FilaEvolucion['tendencia'] = 'sin-datos';
    if (con.length >= 2) {
      const d = valores[con[con.length - 1]]! - valores[con[con.length - 2]]!;
      tendencia = Math.abs(d) < 1e-9 ? 'igual' : (d > 0) === ind.masEsMejor ? 'mejora' : 'empeora';
    }
    return { id: ind.id, nombre: ind.nombre, unidad: ind.unidad, decimales: ind.decimales, area: ind.area, valores, tendencia };
  });
}

/** Indicadores con valor calculado en un año, por área. */
export function completitud(plan: Plan, anio: number): Record<Area, { con: number; total: number }> {
  const r = {} as Record<Area, { con: number; total: number }>;
  for (const a of ORDEN_AREAS) r[a] = { con: 0, total: 0 };
  for (const ind of INDICADORES) { r[ind.area].total++; if (valorIndicador(plan, ind.id, anio) !== undefined) r[ind.area].con++; }
  // G4 (acciones al cliente) es cualitativo
  r.gobernanza.total++; if (plan.accionesClientes.length > 0) r.gobernanza.con++;
  return r;
}

/** Progreso de una acción en un año: trimestres cumplidos de 4 (0-1). */
export function progresoAccion(seg: SeguimientoAccion | undefined): number {
  if (!seg) return 0;
  return TRIMESTRES.filter((t) => seg[t].cumple).length / 4;
}
export function progresoObjetivo(plan: Plan, o: Objetivo, anio: number): number {
  if (o.acciones.length === 0) return 0;
  const s = plan.seguimiento[anio]?.acciones ?? {};
  return o.acciones.reduce((x, a) => x + progresoAccion(s[a.id]), 0) / o.acciones.length;
}
export function progresoPlan(plan: Plan, anio: number): number {
  if (plan.objetivos.length === 0) return 0;
  return plan.objetivos.reduce((x, o) => x + progresoObjetivo(plan, o, anio), 0) / plan.objetivos.length;
}
export function progresoPorArea(plan: Plan, anio: number): Record<Area, number | null> {
  const r = {} as Record<Area, number | null>;
  for (const a of ORDEN_AREAS) {
    const os = plan.objetivos.filter((o) => o.area === a);
    r[a] = os.length ? os.reduce((x, o) => x + progresoObjetivo(plan, o, anio), 0) / os.length : null;
  }
  return r;
}

export interface FilaCumplimiento { id: string; area: string; texto: string; norma: string; desde: string; exigible: boolean; estado: EstadoReq; evidencia: string; nota: string; alerta: boolean }
/** Estado de los requisitos obligatorios a una fecha: «alerta» si ya son exigibles y no constan como cumplidos. */
export function cumplimiento(plan: Plan, hoy: string): FilaCumplimiento[] {
  return REQUISITOS.map((r) => {
    const e = plan.requisitos[r.id] ?? { estado: 'pendiente' as EstadoReq, evidencia: '', nota: '' };
    const exigible = r.desde <= hoy;
    return { id: r.id, area: r.area, texto: r.texto, norma: r.norma, desde: r.desde, exigible, ...e, alerta: exigible && (e.estado === 'no' || e.estado === 'pendiente' || e.estado === 'parcial') };
  });
}
export function camas(plan: Plan, anio: number) {
  const exigido = camasElevablesExigidas(plan.ficha.categoria, anio);
  const instalado = plan.camasElevablesInstaladas[anio];
  return { exigido, instalado, cumple: instalado === undefined ? null : instalado >= exigido };
}

export function resumenCumplimiento(filas: FilaCumplimiento[]) {
  const exigibles = filas.filter((f) => f.exigible && f.estado !== 'na');
  return { exigibles: exigibles.length, cumplen: exigibles.filter((f) => f.estado === 'cumple').length, alertas: filas.filter((f) => f.alerta).length, proximos: filas.filter((f) => !f.exigible).length };
}

export const nombreArea = (a: Area | 'general') => (a === 'general' ? 'General' : AREAS[a].nombre);
