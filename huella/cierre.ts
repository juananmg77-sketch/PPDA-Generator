// Comprobaciones previas al cierre de un inventario. Los errores impiden cerrar; los avisos se muestran y quedan a criterio del consultor.
import { variacionAnual } from './extraccion.ts';
import { agruparPorTipoYContador, mesesTocados, NOMBRES_MES } from './mensual.ts';

export type Nivel = 'error' | 'aviso' | 'info' | 'ok';
/** Dónde se resuelve cada comprobación: pestañas de la aplicación o tarjetas de la propia pantalla de cierre. */
export type DestinoCierre = 'facturas' | 'consumos' | 'centros' | 'organizacion' | 'anio_base' | 'recalculo' | 'significancia' | 'exclusiones';
/** Elemento concreto al que se refiere una comprobación (p. ej. una factura), para poder localizarlo. */
export interface DetalleCierre { texto: string; nota?: string; /** Factura concreta a la que se refiere, para abrirla y decidir sobre ella. */ docId?: string }
export interface ItemCierre { nivel: Nivel; codigo: string; mensaje: string; /** Qué elementos concretos afecta. */ detalle?: DetalleCierre[]; /** Pantalla donde se resuelve. */ ir?: DestinoCierre; irEtiqueta?: string }

export interface DocCierre {
  verificado?: boolean; id?: string; nombre?: string; centro?: string; estado: 'subido' | 'leido' | 'revisado' | 'rechazado'; tipo: string; contador?: string | null; periodoDesde?: string | null; periodoHasta?: string | null; /** Garantía de origen de la electricidad indicada en la factura (si consta). */ origenElectricidad?: string | null; /** Cantidad leída de la factura (en su unidad). */ cantidad?: number | null }
export interface MagnitudCierre { nombre: string; actual: number; anterior: number }

export interface EntradaCierre {
  anio: number;
  docs: DocCierre[];
  actividadConfirmada: number;
  actividadManual: number;
  fallosCalculo: number;
  /** Descripción de cada dato que no se puede calcular (opcional). */
  fallosDetalle?: string[];
  centrosSinIndice: string[];
  /** Centros sin plantilla media cuando otros sí la tienen (el ratio por trabajador quedaría incompleto). */
  centrosSinPlantilla?: string[];
  factoresId: string;
  factoresFijados: boolean;
  /** Totales del año y del anterior (si hay inventario previo) para el análisis de variaciones. */
  variaciones?: MagnitudCierre[];
  analisisVariacion?: string;
  exclusiones: Array<{ fuente: string; porcentaje: number | null; justificacion: string }>;
  /** Resultado de la comprobación de cuadre de la estructura ISO (por gas, por categoría y total). Si no se cuadra, bloquea el cierre. */
  cuadreIso?: { ok: boolean; incidencias: string[] };
  /** Categorías ISO 3 a 6 (o 2) sin cuantificar, sin exclusión registrada y sin justificación. */
  categoriasSinEvaluar?: Array<{ n: number; nombre: string }>;
  /** Evaluación de la significancia de las emisiones indirectas; null/undefined = no realizada. */
  significancia?: { completa: boolean; significativasCuantificadas: boolean; sinValorar: string[]; excluidasSinJustificar: string[]; significativasSinCuantificar: string[]; faltas: string[] } | null;
  /** Incidencias de las exclusiones de la categoría 1 (falta de % o de evidencia, umbral superado). */
  exclusionesDirectas?: string[];
  /** Año base: sin definir / sin datos, y evaluación de las reglas de recálculo con la decisión documentada. */
  anioBase?: { definido: boolean; conDatos: boolean; recalculo: { disparadores: Array<{ titulo: string; detalle: string[] }>; noEvaluables: string[]; incidencias: string[] } | null };
  /** Datos de la organización: obligatorios que faltan (bloquean el cierre) y avisos (razón social, forma jurídica). */
  organizacion?: { faltan: string[]; avisos: string[] };
  ncAbiertas: number;
  umbralVariacion?: number;
  exclusionPorFuente?: number; // % por fuente (3 por defecto)
  exclusionTotal?: number; // % total (5 por defecto)
}

const DIA = 86400000;
const aFecha = (iso?: string | null) => { const t = iso ? Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) : NaN; return Number.isNaN(t) ? null : t; };
/** Días en que dos periodos facturados coinciden (0 si solo se tocan en un extremo). */
const diasSolape = (a: DocCierre, b: DocCierre) => {
  const a1 = aFecha(a.periodoDesde), a2 = aFecha(a.periodoHasta), b1 = aFecha(b.periodoDesde), b2 = aFecha(b.periodoHasta);
  if (a1 === null || a2 === null || b1 === null || b2 === null) return 0;
  return Math.max(0, (Math.min(a2, b2) - Math.max(a1, b1)) / DIA);
};

/**
 * Series de facturas de un mismo suministro. Se agrupa por centro, tipo y contador, y luego se FUSIONAN las series de un mismo centro y tipo
 * que nunca facturan a la vez (solape de más de 3 días): son el mismo suministro con el identificador escrito de otra forma
 * (nº de contador, CUPS, CUPS mal leído o sin contador). Dos contadores reales facturan a la vez y no se fusionan.
 */
export function seriesDeSuministro(docs: DocCierre[]): Array<{ tipo: string; contador: string; items: DocCierre[] }> {
  const base = agruparPorTipoYContador(docs, (d) => `${d.centro ?? ''}\u0000${d.tipo}`, (d) => d.contador);
  const padre = base.map((_, i) => i);
  const raiz = (i: number): number => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
  for (let i = 0; i < base.length; i++) for (let j = i + 1; j < base.length; j++) {
    if (base[i].tipo !== base[j].tipo) continue;
    const concurrentes = base[i].items.some((a) => base[j].items.some((b) => diasSolape(a, b) > 3));
    if (!concurrentes) padre[raiz(j)] = raiz(i);
  }
  const m = new Map<number, { tipo: string; contadores: string[]; items: DocCierre[] }>();
  base.forEach((g, i) => {
    const r = raiz(i); const e = m.get(r) ?? { tipo: g.tipo.split('\u0000')[1], contadores: [], items: [] };
    if (g.contador !== 'sin contador') e.contadores.push(g.contador);
    e.items.push(...g.items); m.set(r, e);
  });
  return [...m.values()].map((e) => ({ tipo: e.tipo, contador: e.contadores.length ? e.contadores.join(' + ') : 'sin contador', items: e.items }));
}

/** Huecos de meses (entre el primer y el último mes cubierto) en cada serie de facturas de electricidad o gas. */
export function huecosMensuales(docs: DocCierre[], anio: number): Array<{ tipo: string; contador: string; faltan: string[] }> {
  const validas = docs.filter((d) => d.estado === 'revisado' && (d.tipo === 'electricidad' || d.tipo === 'gas_natural'));
  return seriesDeSuministro(validas)
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

/** Facturas confirmadas que repiten periodo y cantidad de otra del mismo centro y tipo (aunque el contador esté escrito distinto): se contarían dos veces. */
export function facturasDuplicadas(docs: DocCierre[]): DocCierre[][] {
  const m = new Map<string, DocCierre[]>();
  for (const d of docs) {
    if (d.estado !== 'revisado' || !d.periodoDesde || !d.periodoHasta || !(Number(d.cantidad) > 0)) continue;
    const k = `${d.centro ?? ''}|${d.tipo}|${d.periodoDesde}|${d.periodoHasta}|${d.cantidad}`;
    m.set(k, [...(m.get(k) ?? []), d]);
  }
  return [...m.values()].filter((g) => g.length > 1);
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
  const add = (nivel: Nivel, codigo: string, mensaje: string, extra: Partial<Pick<ItemCierre, 'detalle' | 'ir' | 'irEtiqueta'>> = {}) => items.push({ nivel, codigo, mensaje, ...extra });
  const nom = (d: DocCierre) => d.nombre ?? 'Factura sin nombre';

  const pend = e.docs.filter((d) => d.estado === 'subido' || d.estado === 'leido');
  const pendientes = pend.length;
  if (pendientes > 0) add('error', 'facturas_pendientes', `${pendientes} factura(s) sin revisar: confírmelas, recházelas o elimínelas antes de cerrar.`, {
    detalle: pend.map((d) => ({ docId: d.id, texto: nom(d), nota: d.estado === 'subido' ? 'subida pero sin leer (elimínela y vuelva a subirla)' : 'leída, pendiente de confirmar' })), ir: 'facturas', irEtiqueta: 'Ir a las facturas pendientes' });
  else add('ok', 'facturas_pendientes', 'No hay facturas pendientes de revisar.');

  if (e.actividadConfirmada === 0) add('error', 'sin_actividad', 'No hay ningún dato de actividad confirmado.', { ir: 'facturas', irEtiqueta: 'Ir a las facturas' });
  else add('ok', 'actividad', `${e.actividadConfirmada} dato(s) de actividad confirmados.`);

  if (e.fallosCalculo > 0) add('error', 'fallos_calculo', `${e.fallosCalculo} dato(s) no se pueden calcular (falta el factor): corríjalos o elimínelos.`, { detalle: (e.fallosDetalle ?? []).map((texto) => ({ texto })), ir: 'consumos', irEtiqueta: 'Ir a Consumos' });
  if (e.actividadManual > 0) add('info', 'datos_manuales', `${e.actividadManual} dato(s) introducidos a mano sin factura: el verificador pedirá su evidencia.`);

  if (e.centrosSinIndice.length > 0) add('aviso', 'indice_actividad', `Sin índice de actividad (estancias) en: ${e.centrosSinIndice.join(', ')}. Los ratios no se calcularán para ellos (válido si el centro estuvo cerrado).`, { ir: 'centros', irEtiqueta: 'Indicar las estancias' });

  if ((e.centrosSinPlantilla ?? []).length > 0) add('info', 'plantilla_media', `Sin plantilla media en: ${e.centrosSinPlantilla!.join(', ')}. El ratio por trabajador solo contará los centros que la tienen.`, { ir: 'centros', irEtiqueta: 'Indicar la plantilla' });

  // Origen de la electricidad: se pregunta aquí, una sola vez, y no en cada factura
  const sinOrigenDocs = e.docs.filter((d) => d.estado === 'revisado' && d.tipo === 'electricidad' && (!d.origenElectricidad || d.origenElectricidad === 'desconocida'));
  const sinOrigen = sinOrigenDocs.length;
  if (sinOrigen > 0) add('info', 'origen_electricidad', `${sinOrigen} factura(s) de electricidad sin garantía de origen acreditada: se tratan como energía de red (mix balear). Si alguna tiene garantía de origen renovable o autoconsumo, aplíquelo abajo a todas o corríjalo en esa factura antes de cerrar.`, { detalle: sinOrigenDocs.map((d) => ({ docId: d.id, texto: nom(d) })) });

  for (const h of huecosMensuales(e.docs, e.anio)) add('aviso', 'hueco_meses', `${h.tipo === 'electricidad' ? 'Electricidad' : 'Gas natural'}${h.contador !== 'sin contador' ? ` (${h.contador})` : ''}: faltan facturas de ${h.faltan.join(', ')}.`, { ir: 'facturas', irEtiqueta: 'Subir facturas' });

  const dups = facturasDuplicadas(e.docs);
  if (dups.length > 0) add('error', 'facturas_duplicadas', `${dups.length} factura(s) repetida(s) (mismo centro, periodo y cantidad): se contarían dos veces. Elimine o rechace la repetida.`, { detalle: dups.flatMap((g) => g.map((d, i) => ({ docId: d.id, texto: nom(d), nota: i === 0 ? 'misma factura que las siguientes' : 'repetida' }))) });
  const ceros = e.docs.filter((d) => d.estado === 'revisado' && d.cantidad === 0 && !d.verificado && d.tipo !== 'otro');
  if (ceros.length > 0) add('aviso', 'consumo_cero', `${ceros.length} factura(s) confirmadas con consumo 0: compruebe que no falta una página o una lectura (el consumo quedaría subestimado).`, { detalle: ceros.map((d) => ({ docId: d.id, texto: nom(d) })) });

  // Variaciones frente al año anterior
  const umbral = e.umbralVariacion ?? 0.2;
  if (!e.variaciones) add('info', 'sin_anterior', 'No hay cálculo del año anterior con el que comparar.');
  else {
    const grandes = e.variaciones.map((m) => ({ ...m, ...variacionAnual(m.actual, m.anterior, umbral) })).filter((m) => m.analizar);
    if (grandes.length === 0) add('ok', 'variacion', 'Ninguna magnitud varía más del 20 % respecto al año anterior.');
    else if ((e.analisisVariacion ?? '').trim().length < 15) add('error', 'variacion', `Variación superior al ${Math.round(umbral * 100)} % en ${grandes.map((m) => `${m.nombre} (${Math.round((m.variacion ?? 0) * 100)} %)`).join(', ')}: explique la causa en el cuadro «Análisis de variaciones», más abajo en esta pantalla.`);
    else add('ok', 'variacion', 'Variaciones grandes analizadas y justificadas.');
  }

  if (e.organizacion) {
    if (e.organizacion.faltan.length) add('error', 'organizacion_datos', 'Faltan datos obligatorios de la organización para la versión final (razón social, CIF, CNAE, IAE, criterio de consolidación, responsable del informe).', { detalle: e.organizacion.faltan.map((texto) => ({ texto })) , ir: 'organizacion', irEtiqueta: 'Completar los datos de la organización' });
    if (e.organizacion.avisos.length) add('aviso', 'organizacion_avisos', 'Revise la razón social de la organización.', { detalle: e.organizacion.avisos.map((texto) => ({ texto })) , ir: 'organizacion', irEtiqueta: 'Revisar la razón social' });
  }
  if (e.exclusionesDirectas && e.exclusionesDirectas.length) add('error', 'exclusiones_directas', 'Las exclusiones de la categoría 1 no cumplen la regla (porcentaje estimado, evidencia y umbral).', { detalle: e.exclusionesDirectas.map((texto) => ({ texto })) , ir: 'exclusiones', irEtiqueta: 'Completar las exclusiones' });
  if (e.significancia === null) add('aviso', 'significancia_no_realizada', 'No se ha evaluado la significancia de las emisiones indirectas (ISO 14064-1, 5.2.3): la declaración de conformidad será solo con el programa aplicable.', { ir: 'significancia', irEtiqueta: 'Ir a la significancia' });
  else if (e.significancia) {
    const s = e.significancia;
    if (s.sinValorar.length || s.excluidasSinJustificar.length) add('aviso', 'significancia_incompleta', 'La evaluación de la significancia de las emisiones indirectas está incompleta.', { detalle: [...s.sinValorar.map((texto) => ({ texto, nota: 'sin valorar' })), ...s.excluidasSinJustificar.map((texto) => ({ texto, nota: 'excluida sin justificación' }))] , ir: 'significancia', irEtiqueta: 'Completar la significancia' });
    if (s.significativasSinCuantificar.length) add('aviso', 'significativas_sin_cuantificar', `${s.significativasSinCuantificar.length} fuente(s) indirecta(s) significativa(s) sin cuantificar.`, { detalle: s.significativasSinCuantificar.map((texto) => ({ texto })) , ir: 'significancia', irEtiqueta: 'Ir a la significancia' });
    if (!s.completa || !s.significativasCuantificadas) add('aviso', 'declaracion_parcial', 'La declaración de conformidad del informe será solo con el programa aplicable («siguiendo la metodología de la ISO 14064-1:2018»), no con la norma.', { ir: 'significancia', irEtiqueta: 'Completar la significancia' });
  }
  if (e.anioBase) {
    const a = e.anioBase;
    if (!a.definido) add('aviso', 'anio_base_sin_definir', 'La organización no ha definido su año base (Ajustes): el informe lo dirá y no se podrá comparar ni evaluar el recálculo.', { ir: 'anio_base', irEtiqueta: 'Definir el año base' });
    else if (!a.conDatos) add('aviso', 'anio_base_sin_datos', 'El año base no tiene datos (inventario vinculado o introducidos a mano).', { ir: 'anio_base', irEtiqueta: 'Completar el año base' });
    if (a.recalculo) {
      if (a.recalculo.incidencias.length) add('error', 'recalculo_sin_decision', 'Se cumple una regla de recálculo del año base y falta documentar la decisión.', { detalle: [...a.recalculo.disparadores.flatMap((d) => d.detalle.map((t) => ({ texto: d.titulo, nota: t }))), ...a.recalculo.incidencias.map((texto) => ({ texto }))] , ir: 'recalculo', irEtiqueta: 'Documentar la decisión' });
      else if (a.recalculo.disparadores.length) add('info', 'recalculo_documentado', 'Se cumple una regla de recálculo del año base y la decisión está documentada.');
      if (a.recalculo.noEvaluables.length) add('info', 'recalculo_no_evaluable', 'Reglas de recálculo no evaluables con los datos disponibles.', { detalle: a.recalculo.noEvaluables.map((texto) => ({ texto })) });
    }
  }
  if (e.cuadreIso && !e.cuadreIso.ok) add('error', 'cuadre_iso', 'Los resultados por gas o por categoría no cuadran con el total del inventario: no se puede cerrar ni entregar el informe.', { detalle: e.cuadreIso.incidencias.map((texto) => ({ texto })) });
  if ((e.categoriasSinEvaluar ?? []).length > 0) add('aviso', 'categorias_sin_evaluar', `${e.categoriasSinEvaluar!.length} categoría(s) ISO sin evaluar: indique para cada una si es no significativa o está excluida, con su justificación (Fuentes excluidas).`, { detalle: e.categoriasSinEvaluar!.map((c) => ({ texto: `${c.n} · ${c.nombre}` })) , ir: 'significancia', irEtiqueta: 'Evaluar las categorías' });
  if (e.exclusiones.length > 0) {
    const r = evaluarExclusionesEstimadas(e.exclusiones, e.exclusionPorFuente ?? 3, e.exclusionTotal ?? 5);
    if (e.exclusiones.some((x) => !x.justificacion.trim())) add('error', 'exclusion_sin_justificar', 'Hay exclusiones sin justificación.');
    if (!r.cumple) add('aviso', 'exclusion_criterio', r.sinPorcentaje > 0 ? 'Hay exclusiones sin porcentaje estimado.' : `Las exclusiones no cumplen el criterio de insignificancia (cada fuente < ${e.exclusionPorFuente ?? 3} % y total ≤ ${e.exclusionTotal ?? 5} %; suma ${r.suma} %). Cuantifíquelas o justifíquelo ante el verificador.`);
  }
  if (e.ncAbiertas > 0) add('aviso', 'nc_abiertas', `${e.ncAbiertas} no conformidad(es) abierta(s).`);

  add(e.factoresFijados ? 'ok' : 'info', 'factores', e.factoresFijados ? `Factores fijados: ${e.factoresId}.` : `Al cerrar se fijarán los factores ${e.factoresId} (no podrán cambiarse sin reabrir).`);

  return { items, puedeCerrar: !items.some((i) => i.nivel === 'error') };
}
