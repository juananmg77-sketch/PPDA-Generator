// Comprobaciones previas al cierre de un inventario. Los errores impiden cerrar; los avisos se muestran y quedan a criterio del consultor.
import { variacionAnual } from './extraccion.ts';
import { agruparPorTipoYContador, mesesTocados, NOMBRES_MES } from './mensual.ts';

export type Nivel = 'error' | 'aviso' | 'info' | 'ok';
export interface ItemCierre { nivel: Nivel; codigo: string; mensaje: string }

export interface DocCierre { estado: 'subido' | 'leido' | 'revisado' | 'rechazado'; tipo: string; contador?: string | null; periodoDesde?: string | null; periodoHasta?: string | null }
export interface MagnitudCierre { nombre: string; actual: number; anterior: number }

export interface EntradaCierre {
  anio: number;
  docs: DocCierre[];
  actividadConfirmada: number;
  actividadManual: number;
  fallosCalculo: number;
  centrosSinIndice: string[];
  factoresId: string;
  factoresFijados: boolean;
  /** Totales del año y del anterior (si hay inventario previo) para el análisis de variaciones. */
  variaciones?: MagnitudCierre[];
  analisisVariacion?: string;
  exclusiones: Array<{ fuente: string; porcentaje: number | null; justificacion: string }>;
  ncAbiertas: number;
  umbralVariacion?: number;
  exclusionPorFuente?: number; // % por fuente (3 por defecto)
  exclusionTotal?: number; // % total (5 por defecto)
}

/** Huecos de meses (entre el primer y el último mes cubierto) en cada serie de facturas de electricidad o gas. */
export function huecosMensuales(docs: DocCierre[], anio: number): Array<{ tipo: string; contador: string; faltan: string[] }> {
  const validas = docs.filter((d) => d.estado === 'revisado' && (d.tipo === 'electricidad' || d.tipo === 'gas_natural'));
  return agruparPorTipoYContador(validas, (d) => d.tipo, (d) => d.contador)
    .map((g) => {
      const cubiertos = new Set(g.items.flatMap((d) => mesesTocados(d.periodoDesde, d.periodoHasta, anio)));
      if (cubiertos.size === 0) return { tipo: g.tipo, contador: g.contador, faltan: [] as string[] };
      const min = Math.min(...cubiertos), max = Math.max(...cubiertos);
      const faltan: string[] = [];
      for (let m = min; m <= max; m++) if (!cubiertos.has(m)) faltan.push(NOMBRES_MES[m]);
      return { tipo: g.tipo, contador: g.contador, faltan };
    })
    .filter((x) => x.faltan.length > 0);
}

/** Evalúa el criterio de insignificancia sobre porcentajes estimados de fuentes excluidas. */
export function evaluarExclusionesEstimadas(ex: Array<{ porcentaje: number | null }>, porFuente = 3, total = 5): { cumple: boolean; suma: number; sinPorcentaje: number } {
  const sinPorcentaje = ex.filter((x) => x.porcentaje == null).length;
  const suma = ex.reduce((s, x) => s + (x.porcentaje ?? 0), 0);
  const cumple = sinPorcentaje === 0 && ex.every((x) => (x.porcentaje ?? 0) < porFuente) && suma <= total;
  return { cumple, suma, sinPorcentaje };
}

export function evaluarCierre(e: EntradaCierre): { items: ItemCierre[]; puedeCerrar: boolean } {
  const items: ItemCierre[] = [];
  const add = (nivel: Nivel, codigo: string, mensaje: string) => items.push({ nivel, codigo, mensaje });

  const pendientes = e.docs.filter((d) => d.estado === 'subido' || d.estado === 'leido').length;
  if (pendientes > 0) add('error', 'facturas_pendientes', `${pendientes} factura(s) sin revisar: confírmelas o recházelas antes de cerrar.`);
  else add('ok', 'facturas_pendientes', 'No hay facturas pendientes de revisar.');

  if (e.actividadConfirmada === 0) add('error', 'sin_actividad', 'No hay ningún dato de actividad confirmado.');
  else add('ok', 'actividad', `${e.actividadConfirmada} dato(s) de actividad confirmados.`);

  if (e.fallosCalculo > 0) add('error', 'fallos_calculo', `${e.fallosCalculo} dato(s) no se pueden calcular (falta el factor): corríjalos o elimínelos.`);
  if (e.actividadManual > 0) add('info', 'datos_manuales', `${e.actividadManual} dato(s) introducidos a mano sin factura: el verificador pedirá su evidencia.`);

  if (e.centrosSinIndice.length > 0) add('aviso', 'indice_actividad', `Sin índice de actividad (estancias) en: ${e.centrosSinIndice.join(', ')}. Los ratios no se calcularán para ellos (válido si el centro estuvo cerrado).`);

  for (const h of huecosMensuales(e.docs, e.anio)) add('aviso', 'hueco_meses', `${h.tipo === 'electricidad' ? 'Electricidad' : 'Gas natural'}${h.contador !== 'sin contador' ? ` (${h.contador})` : ''}: faltan facturas de ${h.faltan.join(', ')}.`);

  // Variaciones frente al año anterior
  const umbral = e.umbralVariacion ?? 0.2;
  if (!e.variaciones) add('info', 'sin_anterior', 'No hay cálculo del año anterior con el que comparar.');
  else {
    const grandes = e.variaciones.map((m) => ({ ...m, ...variacionAnual(m.actual, m.anterior, umbral) })).filter((m) => m.analizar);
    if (grandes.length === 0) add('ok', 'variacion', 'Ninguna magnitud varía más del 20 % respecto al año anterior.');
    else if ((e.analisisVariacion ?? '').trim().length < 15) add('error', 'variacion', `Variación superior al ${Math.round(umbral * 100)} % en ${grandes.map((m) => `${m.nombre} (${Math.round((m.variacion ?? 0) * 100)} %)`).join(', ')}: explique la causa en el análisis de variaciones.`);
    else add('ok', 'variacion', 'Variaciones grandes analizadas y justificadas.');
  }

  if (e.exclusiones.length > 0) {
    const r = evaluarExclusionesEstimadas(e.exclusiones, e.exclusionPorFuente ?? 3, e.exclusionTotal ?? 5);
    if (e.exclusiones.some((x) => !x.justificacion.trim())) add('error', 'exclusion_sin_justificar', 'Hay exclusiones sin justificación.');
    if (!r.cumple) add('aviso', 'exclusion_criterio', r.sinPorcentaje > 0 ? 'Hay exclusiones sin porcentaje estimado.' : `Las exclusiones no cumplen el criterio de insignificancia (cada fuente < ${e.exclusionPorFuente ?? 3} % y total ≤ ${e.exclusionTotal ?? 5} %; suma ${r.suma} %). Cuantifíquelas o justifíquelo ante el verificador.`);
  }
  if (e.ncAbiertas > 0) add('aviso', 'nc_abiertas', `${e.ncAbiertas} no conformidad(es) abierta(s).`);

  add(e.factoresFijados ? 'ok' : 'info', 'factores', e.factoresFijados ? `Factores fijados: ${e.factoresId}.` : `Al cerrar se fijarán los factores ${e.factoresId} (no podrán cambiarse sin reabrir).`);

  return { items, puedeCerrar: !items.some((i) => i.nivel === 'error') };
}
