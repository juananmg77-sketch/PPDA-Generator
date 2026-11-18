// Modelo y cálculos del Plan de Circularidad: ficha, indicadores por año, plan de acción con seguimiento trimestral (como el PPDA) y cumplimiento legal.
import { AREAS, INDICADORES, ORDEN_AREAS, REQUISITOS, camasElevablesExigidas, indicador } from './catalogo.ts';
import type { Area, CategoriaHotel, EstadoReq } from './catalogo.ts';

/** Persona del equipo responsable del plan (estructura organizativa). */
export interface Miembro { id: string; departamento: string; nombre: string; cargo: string; email: string; funcion: string }
export const FUNCION_RESPONSABLE = 'Responsable del plan';
export const FUNCIONES_PLAN = [FUNCION_RESPONSABLE, 'Dirección', 'Responsable línea Energía', 'Responsable línea Agua', 'Responsable línea Materiales y residuos', 'Responsable línea Alimentos', 'Responsable línea Gobernanza y sensibilización', 'Colaborador'];
export const miembroVacio = (): Miembro => ({ id: `m${Date.now()}${Math.floor(Math.random() * 1000)}`, departamento: '', nombre: '', cargo: '', email: '', funcion: 'Colaborador' });

export interface Ficha {
  establecimiento: string; empresa: string; direccion: string; actividad: string; apertura: string;
  habitaciones?: number; capacidad?: number; pernoctaciones?: number; superficie?: number;
  categoria: CategoriaHotel; categoriaTexto: string;
  /** Estructura organizativa: personas con su departamento, cargo y función en el plan. */
  equipo: Miembro[];
  /** Campos de texto de versiones anteriores; solo se leen para migrarlos a `equipo`. */
  responsablePlan?: string; estructura?: string;
  vigenciaDesde: number; vigenciaHasta: number; fechaPublicacion: string;
}
export interface Accion {
  id: string; codigo: string; descripcion: string; responsable: string;
  /** Año de finalización (se deriva de `fin`; se conserva por compatibilidad con planes anteriores). */
  plazo: string;
  /** Ficha de la acción (guía AETIB, tabla 2): indicadores relacionados, recursos, inversión y periodo. */
  indicadores?: string[]; recursos?: string; inversion?: string; inicio?: string; fin?: string;
}
const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');
/** Periodo previsto de una acción en texto («01/03/2024 – 31/12/2024»); si no hay fechas, el plazo antiguo. */
export function periodoAccion(a: Accion): string {
  if (a.inicio && a.fin) return `${fechaCorta(a.inicio)} – ${fechaCorta(a.fin)}`;
  if (a.fin) return `hasta el ${fechaCorta(a.fin)}`;
  if (a.inicio) return `desde el ${fechaCorta(a.inicio)}`;
  return a.plazo || '—';
}
export interface Objetivo {
  id: string; codigo: string; area: Area; descripcion: string; indicadorId: string; lineaBase: string; meta: string; plazo: string;
  responsable: string; recursos: string; inversion: string; acciones: Accion[];
  /** Valor numérico del indicador que se quiere alcanzar en el plazo (sirve para dibujar la línea de meta). */
  metaValor?: number;
}
export interface Trimestre { cumple: boolean; evidencia: string }
export interface SeguimientoAccion { t1: Trimestre; t2: Trimestre; t3: Trimestre; t4: Trimestre; notas: string }
export interface SeguimientoAnio { cerrado: boolean; acciones: Record<string, SeguimientoAccion> }
export interface EstadoRequisito { estado: EstadoReq; evidencia: string; nota: string }
/** Registro de versiones: elaboración, revisiones anuales, modificaciones y renovaciones del plan (exigido por la guía). */
export type TipoRegistro = 'elaboracion' | 'revision' | 'modificacion' | 'renovacion';
export const TIPOS_REGISTRO: Record<TipoRegistro, string> = { elaboracion: 'Elaboración', revision: 'Revisión anual', modificacion: 'Modificación', renovacion: 'Renovación' };
export interface Registro { id: string; fecha: string; tipo: TipoRegistro; version: string; descripcion: string; autor: string }
/** Cómo se pone el plan a disposición de quien debe poder consultarlo. */
export interface Disponibilidad { inspeccion: string; representantes: string; trabajadores: string }
/** Texto libre de la revisión anual de un año. */
export interface RevisionAnual { conclusiones: string; propuestas: string }

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
  historial?: Registro[];
  disponibilidad?: Disponibilidad;
  revisiones?: Record<number, RevisionAnual>;
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

/** Plan en blanco para un establecimiento nuevo (la ficha se completa con los datos que ya se conocen). */
export function planVacio(base: Partial<Ficha> & { establecimiento: string }, anio = new Date().getFullYear()): Plan {
  return {
    id: '', version: 1, cerrado: false,
    ficha: {
      empresa: '', direccion: '', actividad: '', apertura: '', categoria: '4', categoriaTexto: '4 estrellas', equipo: [],
      vigenciaDesde: anio, vigenciaHasta: anio + 4, fechaPublicacion: '', ...base,
    },
    datos: {}, letraCertificado: {}, accionesClientes: [], camasElevablesInstaladas: {}, objetivos: [], seguimiento: {}, requisitos: {},
  };
}

/** Responsable del plan según el equipo (o el texto antiguo si el plan es de una versión anterior). */
export function responsableDelPlan(f: Ficha): string {
  const m = f.equipo?.find((x) => x.funcion === FUNCION_RESPONSABLE && x.nombre.trim());
  return m ? [m.nombre, m.cargo].filter(Boolean).join(' · ') : (f.responsablePlan ?? '');
}

/** Convierte los planes guardados con la estructura en texto libre («Cargo: Nombre» por línea) al equipo estructurado. */
export function migrarPlan(p: Plan): Plan {
  p = migrarEquipo(p);
  // Acciones de versiones anteriores: indicador del objetivo como relacionado y fecha de fin a partir del plazo (año).
  return { ...p, objetivos: p.objetivos.map((o) => ({ ...o, acciones: o.acciones.map((a) => (a.indicadores !== undefined ? a : {
    ...a, indicadores: o.indicadorId ? [o.indicadorId] : [], recursos: a.recursos ?? '', inversion: a.inversion ?? '', inicio: a.inicio ?? '', fin: a.fin ?? (/^\d{4}$/.test(a.plazo) ? `${a.plazo}-12-31` : ''),
  })) })) };
}
function migrarEquipo(p: Plan): Plan {
  if (Array.isArray(p.ficha.equipo)) return p;
  const lineas = (p.ficha.estructura ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const equipo: Miembro[] = [];
  const resp = (p.ficha.responsablePlan ?? '').trim();
  if (resp) { const [cargo, ...n] = resp.split('·').map((x) => x.trim()); equipo.push({ ...miembroVacio(), cargo: n.length ? cargo : '', nombre: n.length ? n.join(' · ') : cargo, funcion: FUNCION_RESPONSABLE }); }
  lineas.forEach((l, i) => { const k = l.indexOf(':'); equipo.push({ ...miembroVacio(), id: `m-mig-${i}`, cargo: k > 0 ? l.slice(0, k).trim() : '', nombre: k > 0 ? l.slice(k + 1).trim() : l, funcion: 'Colaborador' }); });
  return { ...p, ficha: { ...p.ficha, equipo } };
}
