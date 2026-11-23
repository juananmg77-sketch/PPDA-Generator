// Año base de una organización (ISO 14064-1:2018, 5.3 y 6.4): definición, resumen de un inventario, comparación base · anterior · actual
// y reglas de recálculo (cambio de límites, de metodología o de factor/PCA por encima de un umbral). Las reglas son configurables.
import type { ConjuntoFactores, ResultadoLinea, Totales } from './tipos.ts';
import { CATEGORIA_ISO_FUENTE } from './iso.ts';
import { fmtOpc } from './formato.ts';

/** Datos de un año (calculados de un inventario o introducidos a mano para un año base sin inventario en el sistema). */
export interface ResumenAnio {
  anio: number;
  /** Toneladas de CO₂e por categoría ISO (1 y 2 hoy; 3 a 6 si se cuantifican) y total. */
  porCategoria: Record<number, number>;
  total: number;
  /** Toneladas de CO₂e por fuente (nombre tal como figura en el inventario). */
  porFuente: Record<string, number>;
  /** Toneladas de CO₂e por tipo de fuente comparable entre años (instalaciones fijas, vehículos, fugitivas, electricidad). Si falta, se deduce del nombre de cada fuente. */
  porTipo?: Record<string, number>;
  estancias?: number | null;
  plantilla?: number | null;
  /** Id del conjunto de factores con que se calculó (p. ej. «calculadora-2024.1@2024»). */
  factoresId: string | null;
  /** Centros incluidos en los límites; si no se conocen, el cambio de límites no es evaluable. */
  centros?: string[] | null;
  /** Factor aplicado a cada fuente (kg CO₂e por unidad; PCA en refrigerantes; mix en electricidad): permite detectar cambios de factor. */
  factores?: Record<string, number> | null;
}

export interface AnioBaseDef {
  anio: number;
  /** Inventario del sistema del que salen los datos; si no hay, `manual` los contiene. */
  inventarioId?: string | null;
  manual?: ResumenAnio | null;
  /** De dónde proceden los datos del año base y su evidencia (obligatorios cuando se introducen a mano). */
  origen?: string | null;
  evidenciaUrl?: string | null;
  evidenciaNombre?: string | null;
  evidenciaPath?: string | null;
  /** Por qué se eligió ese año como base. */
  justificacion: string;
  definidoEn?: string | null;
}

export interface ConfigRecalculo {
  /** % de cambio del factor o PCA de una fuente a partir del cual se recalcula el año base. */
  umbralFactor: number;
  reglas: { limites: boolean; metodologia: boolean; factores: boolean };
}
export const CONFIG_RECALCULO_POR_DEFECTO: ConfigRecalculo = { umbralFactor: 5, reglas: { limites: true, metodologia: true, factores: true } };
export const configRecalculo = (c?: Partial<ConfigRecalculo> | null): ConfigRecalculo => ({ ...CONFIG_RECALCULO_POR_DEFECTO, ...(c ?? {}), reglas: { ...CONFIG_RECALCULO_POR_DEFECTO.reglas, ...(c?.reglas ?? {}) } });

/** Decisión documentada sobre el recálculo del año base en un inventario. */
export interface DecisionRecalculo {
  /** El responsable declara si ha cambiado la metodología de cálculo respecto al año base (no se puede deducir de los datos). */
  metodologiaCambiada: boolean | null;
  decision: 'recalcula' | 'no_recalcula' | null;
  motivo: string | null;
  fecha?: string | null;
  usuario?: string | null;
}

/** Validación de una definición de año base. Devuelve las incidencias (vacío = válida). */
export function validarAnioBase(d: AnioBaseDef): string[] {
  const out: string[] = [];
  if (!(d.anio >= 2007 && d.anio <= 2100)) out.push('Año base no válido.');
  if (!d.justificacion?.trim()) out.push('Falta la justificación de la elección del año base.');
  if (!d.inventarioId) {
    if (!d.manual) out.push('Falta vincular un inventario o introducir los datos del año base.');
    if (!d.origen?.trim()) out.push('Año base introducido a mano: falta indicar su origen.');
    if (!d.evidenciaUrl?.trim() && !d.evidenciaPath) out.push('Año base introducido a mano: falta la evidencia (enlace o documento).');
    if (d.manual && !(d.manual.total > 0)) out.push('Año base introducido a mano: falta el total de emisiones.');
  }
  return out;
}

const kg = (x: number) => x / 1000;

/** Tipos de fuente comparables entre años: los nombres de fuente cambian de un informe a otro, los tipos no. */
export const TIPOS_FUENTE = ['Combustibles en instalaciones fijas', 'Combustibles en vehículos', 'Emisiones fugitivas (refrigerantes)', 'Electricidad', 'Otras fuentes'] as const;
const TIPO_POR_CATEGORIA: Record<string, string> = { combustion_fija: TIPOS_FUENTE[0], combustion_movil: TIPOS_FUENTE[1], fugitiva: TIPOS_FUENTE[2], electricidad: TIPOS_FUENTE[3] };
/** Tipo de fuente a partir del nombre con que figura en un informe (año base introducido a mano o leído por IA). */
export function tipoDeFuente(nombre: string): string {
  const n = nombre.toLowerCase();
  if (/el[eé]ctric/.test(n)) return TIPOS_FUENTE[3];
  if (/fugitiv|refriger|\br-?\d|hfc|hfo|fluorad|f-?gas/.test(n)) return TIPOS_FUENTE[2];
  if (/veh[ií]culo|m[oó]vil|flota|gasolina|di[eé]sel|gas[oó]leo a\b|transporte|surtidor/.test(n)) return TIPOS_FUENTE[1];
  if (/instalaci|fij|caldera|estacionari|gas natural|butano|propano|gas[oó]leo|g\.?l\.?p|fuel|combustible/.test(n)) return TIPOS_FUENTE[0];
  return TIPOS_FUENTE[4];
}
/** Emisiones por tipo de fuente de un año: las calculadas por categoría si constan; si no, las deducidas del nombre de cada fuente. */
export function emisionesPorTipo(r: ResumenAnio): Record<string, number> {
  if (r.porTipo) return r.porTipo;
  const out: Record<string, number> = {};
  for (const [k, t] of Object.entries(r.porFuente)) { const tp = tipoDeFuente(k); out[tp] = (out[tp] ?? 0) + t; }
  return out;
}
/** Factor aplicado a una línea en kg CO₂e por unidad (el que se compara entre años). */
function factorDeLinea(r: ResultadoLinea, f: ConjuntoFactores): number | null {
  const l = r.linea;
  if (l.categoria === 'electricidad') return f.mixElectrico;
  if (l.categoria === 'fugitiva') return f.pcaRefrigerantes[l.fuente] ?? null;
  const fac = f.combustibles[l.fuente];
  return fac ? (fac.co2 ?? 0) + ((fac.ch4 ?? 0) * f.gwp.ch4 + (fac.n2o ?? 0) * f.gwp.n2o) / 1000 : null;
}

export function resumenDeInventario(o: { anio: number; resultados: ResultadoLinea[]; totales: Totales; factores: ConjuntoFactores; estancias?: number | null; plantilla?: number | null; centros?: string[] | null }): ResumenAnio {
  const porCategoria: Record<number, number> = {};
  const porFuente: Record<string, number> = {};
  const porTipo: Record<string, number> = {};
  const factores: Record<string, number> = {};
  for (const r of o.resultados) {
    const c = CATEGORIA_ISO_FUENTE[r.linea.categoria].n;
    porCategoria[c] = (porCategoria[c] ?? 0) + kg(r.kgCO2e);
    const k = r.linea.fuente || 'Electricidad';
    porFuente[k] = (porFuente[k] ?? 0) + kg(r.kgCO2e);
    const tp = TIPO_POR_CATEGORIA[r.linea.categoria] ?? TIPOS_FUENTE[4];
    porTipo[tp] = (porTipo[tp] ?? 0) + kg(r.kgCO2e);
    const fa = factorDeLinea(r, o.factores); if (fa != null) factores[k] = fa;
  }
  return { anio: o.anio, porCategoria, total: kg(o.totales.kgCO2eTotal), porFuente, porTipo, estancias: o.estancias ?? null, plantilla: o.plantilla ?? null, factoresId: o.factores.id, centros: o.centros ?? null, factores };
}

export const ratioEstancia = (r: ResumenAnio | null) => (r && r.estancias && r.estancias > 0 ? r.total / r.estancias : null);
export const ratioTrabajador = (r: ResumenAnio | null) => (r && r.plantilla && r.plantilla > 0 ? r.total / r.plantilla : null);

/** Variación porcentual de `v` respecto a `ref` (null si no hay referencia o es 0). */
export const variacion = (v: number | null | undefined, ref: number | null | undefined): number | null => (v == null || ref == null || !(ref > 0) ? null : ((v - ref) / ref) * 100);

export interface FilaComparacion { concepto: string; base: number | null; anterior: number | null; actual: number | null; vsBase: number | null; vsAnterior: number | null }
export interface Comparacion { categorias: FilaComparacion[]; fuentes: FilaComparacion[]; ratios: FilaComparacion[] }

/** Comparación automática base · anterior · actual por categoría, por fuente y de ratios. null en lo que un año no tiene. */
export function compararAnios(base: ResumenAnio | null, anterior: ResumenAnio | null, actual: ResumenAnio, nombresCategoria: Record<number, string> = {}): Comparacion {
  const fila = (concepto: string, b: number | null, a: number | null, c: number | null): FilaComparacion => ({ concepto, base: b, anterior: a, actual: c, vsBase: variacion(c, b), vsAnterior: variacion(c, a) });
  const cats = [...new Set([1, 2, ...[base, anterior, actual].flatMap((x) => (x ? Object.keys(x.porCategoria).map(Number) : []))])].sort();
  const categorias = [
    ...cats.map((n) => fila(nombresCategoria[n] ?? `Categoría ${n}`, base ? base.porCategoria[n] ?? 0 : null, anterior ? anterior.porCategoria[n] ?? 0 : null, actual.porCategoria[n] ?? 0)),
    fila('Total', base?.total ?? null, anterior?.total ?? null, actual.total),
  ];
  // Se compara por tipo de fuente (no por nombre): los nombres de un informe antiguo y de este inventario no coinciden
  const tb = base ? emisionesPorTipo(base) : null, ta = anterior ? emisionesPorTipo(anterior) : null, tc = emisionesPorTipo(actual);
  const fuentes = TIPOS_FUENTE.filter((k) => (tb?.[k] ?? 0) > 0 || (ta?.[k] ?? 0) > 0 || (tc[k] ?? 0) > 0)
    .map((k) => fila(k, tb ? tb[k] ?? 0 : null, ta ? ta[k] ?? 0 : null, tc[k] ?? 0));
  const ratios = [
    fila('t CO₂e por estancia', ratioEstancia(base), ratioEstancia(anterior), ratioEstancia(actual)),
    fila('t CO₂e por trabajador', ratioTrabajador(base), ratioTrabajador(anterior), ratioTrabajador(actual)),
  ].filter((r) => r.base != null || r.anterior != null || r.actual != null);
  return { categorias, fuentes, ratios };
}

export interface Disparador { regla: 'limites' | 'metodologia' | 'factores'; titulo: string; detalle: string[] }
export interface EvaluacionRecalculo {
  disparadores: Disparador[];
  /** Reglas activas que no se pueden evaluar con los datos disponibles (p. ej. año base manual sin lista de centros). */
  noEvaluables: string[];
  /** Hay que documentar la decisión sobre el recálculo (se dispara alguna regla). */
  exigeDecision: boolean;
  /** Incidencias: falta la decisión o su motivo. */
  incidencias: string[];
}

/** Aplica las reglas de recálculo del año base al inventario actual. */
export function evaluarRecalculo(base: ResumenAnio | null, actual: ResumenAnio, cfg: ConfigRecalculo, decision: DecisionRecalculo | null): EvaluacionRecalculo {
  const disparadores: Disparador[] = []; const noEvaluables: string[] = [];
  if (!base) return { disparadores, noEvaluables: ['No hay año base con datos: no se pueden evaluar las reglas de recálculo.'], exigeDecision: false, incidencias: [] };
  if (cfg.reglas.limites) {
    if (!base.centros || !actual.centros) noEvaluables.push('Cambio de límites: el año base no indica sus centros.');
    else {
      const altas = actual.centros.filter((c) => !base.centros!.includes(c)), bajas = base.centros.filter((c) => !actual.centros!.includes(c));
      if (altas.length || bajas.length) disparadores.push({ regla: 'limites', titulo: 'Cambio de límites (alta o baja de centros)', detalle: [...altas.map((c) => `Alta de «${c}»`), ...bajas.map((c) => `Baja de «${c}»`)] });
    }
  }
  if (cfg.reglas.metodologia) {
    if (decision?.metodologiaCambiada == null) noEvaluables.push('Cambio de metodología: falta declarar si ha cambiado respecto al año base.');
    else if (decision.metodologiaCambiada) disparadores.push({ regla: 'metodologia', titulo: 'Cambio de metodología', detalle: ['Declarado por el responsable del inventario'] });
  }
  if (cfg.reglas.factores) {
    if (!base.factores) noEvaluables.push('Cambio de factor o PCA: el año base no indica los factores aplicados.');
    else {
      const det: string[] = [];
      for (const [fuente, fa] of Object.entries(actual.factores ?? {})) {
        const fb = base.factores[fuente];
        const v = variacion(fa, fb);
        if (v != null && Math.abs(v) > cfg.umbralFactor) det.push(`${fuente}: ${fmtOpc(v, 'porcentaje', { signo: true })} % (de ${fmtOpc(fb, 'factor')} a ${fmtOpc(fa, 'factor')})`);
      }
      if (det.length) disparadores.push({ regla: 'factores', titulo: `Cambio de factor o PCA de una fuente superior al ${fmtOpc(cfg.umbralFactor, 'porcentaje')} %`, detalle: det });
    }
  }
  const exigeDecision = disparadores.length > 0;
  const incidencias: string[] = [];
  if (exigeDecision) {
    if (!decision?.decision) incidencias.push('Se cumple una regla de recálculo del año base: hay que documentar si se recalcula o no.');
    else if (!decision.motivo?.trim()) incidencias.push('Falta el motivo de la decisión sobre el recálculo del año base.');
  }
  return { disparadores, noEvaluables, exigeDecision, incidencias };
}

/** Texto del informe sobre el recálculo del año base, generado de las reglas y de la decisión documentada. */
export function textoRecalculo(ev: EvaluacionRecalculo, decision: DecisionRecalculo | null, cfg: ConfigRecalculo): string[] {
  const reglas = [cfg.reglas.limites && 'cambio de límites (alta o baja de centros)', cfg.reglas.metodologia && 'cambio de metodología', cfg.reglas.factores && `cambio de factor o PCA de una fuente superior al ${fmtOpc(cfg.umbralFactor, 'porcentaje')} %`].filter(Boolean) as string[];
  const out = [`Reglas de recálculo del año base: ${reglas.length ? reglas.join('; ') : 'ninguna activa'}.`];
  if (!ev.disparadores.length) out.push('No se cumple ninguna regla: no es necesario recalcular el año base.');
  else {
    for (const d of ev.disparadores) out.push(`Se cumple la regla «${d.titulo}»: ${d.detalle.join('; ')}.`);
    if (decision?.decision) out.push(`Decisión: ${decision.decision === 'recalcula' ? 'se recalcula el año base' : 'no se recalcula el año base'}. Motivo: ${decision.motivo?.trim() ?? '—'}${decision.fecha ? ` (${decision.fecha}${decision.usuario ? `, ${decision.usuario}` : ''})` : ''}.`);
    else out.push('Falta documentar la decisión sobre el recálculo del año base.');
  }
  if (ev.noEvaluables.length) out.push(`No evaluable con los datos disponibles: ${ev.noEvaluables.join(' ')}`);
  return out;
}
