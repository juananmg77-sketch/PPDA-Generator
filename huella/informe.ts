// Modelo del informe de inventario de GEI (ISO 14064-1 / Decreto 48/2021). Función pura: de los datos del inventario a un documento estructurado
// que se renderiza después a HTML/PDF, Word y al paquete del verificador. No contiene texto de la norma (licencia): solo la cita de sus apartados.
import type { ConjuntoFactores, ResultadoLinea, Totales } from './tipos.ts';
import { NOMBRES_MES, etiquetaFuente, svgAnillo, svgBarrasAgrupadas, svgBarrasApiladas, svgBarrasHorizontales } from './graficos.ts';
import { resolucionDeAnio, textoResolucion, validarResolucion } from './resolucion.ts';
import { APARTADOS_ISO, evaluarCorrespondencia } from './correspondenciaIso.ts';
import { conclusiones, fuentesPrincipales } from './resumenEjecutivo.ts';
import type { ConfigResumen } from './resumenEjecutivo.ts';
import { configPlantilla } from './configInforme.ts';
import type { ConfigPlantillaInforme } from './configInforme.ts';
import { ORIGENES_DATO, calcularIncertidumbre, configIncertidumbre } from './incertidumbre.ts';
import type { ConfigIncertidumbre } from './incertidumbre.ts';
import { textoResponsable, tituloCriterio, validarOrganizacion, CRITERIOS_CONSOLIDACION } from './organizacion.ts';
import { CATEGORIAS_ISO, CATEGORIA_ISO_FUENTE, UMBRALES_SIGNIFICANCIA, resultadosIso } from './iso.ts';
import { criteriosDe, declaracionConformidad, estadoEvaluacion, evaluarEvaluacion, evaluarExclusionesDirectas, resumenPorCategoria } from './significancia.ts';
import { compararAnios, configRecalculo, evaluarRecalculo, ratioEstancia, ratioTrabajador, textoRecalculo } from './anioBase.ts';
import type { AnioBaseDef, ConfigRecalculo, DecisionRecalculo, ResumenAnio } from './anioBase.ts';
import type { CriteriosSignificancia, DeclaracionConformidad, Evaluacion, SubcategoriaPlantilla, TextosDeclaracion } from './significancia.ts';
import { fmt, fmtOpc, comoSeMuestra } from './formato.ts';
import { NOTAS_FUENTES, marcaFinal } from './notasFuentes.ts';

export const VERSION_MOTOR = 'HS GREEN huella 1.0';

export type Bloque =
  | { k: 'p'; texto: string }
  | { k: 'h'; texto: string }
  | { k: 'lista'; items: string[] }
  | { k: 'nota'; texto: string }
  | { k: 'grafico'; titulo: string; svg: string; ancho: number; alto: number; pie?: string }
  | { k: 'tabla'; cab: string[]; filas: string[][]; numericas?: number[]; pie?: string; /** Notas al pie de las marcas (*, †) que aparecen en la tabla, con su texto del catálogo. */ notas?: string[] };
export interface Seccion { id: string; titulo: string; bloques: Bloque[] }
export interface ModeloInforme {
  /** Resumen ejecutivo de una página (cifras clave y tres conclusiones generadas por reglas). */
  resumen?: Seccion;
  meta: { /** Cláusula de la portada (si falta, la de por defecto). */ confidencialidad?: string; minFilasSinPartir?: number; titulo: string; subtitulo: string; norma: string; estado: string; edicion: string; fecha: string; organizacion: string; anio: number; codigo: string };
  secciones: Seccion[];
  /** Datos que faltan o conviene revisar antes de entregar el informe al verificador. */
  pendientes: string[];
}

/** Informe de inventario de GEI: además del modelo común, sus incidencias bloqueantes y la declaración de conformidad que se imprime. */
export interface ModeloInformeHuella extends ModeloInforme {
  /** Incidencias que impiden entregar el informe (p. ej. los totales no cuadran). */
  bloqueantes: string[];
  /** Declaración de conformidad que se imprime (caso a o b) y lo que falta para el caso a. */
  declaracion: DeclaracionConformidad;
}

export interface DatosInforme {
  /** `nombre` es el nombre comercial; la razón social (denominación legal) va aparte. */
  organizacion: { nombre: string; razonSocial?: string | null; cif?: string | null; direccion?: string | null; cnae?: string | null; iae?: string | null; criterio?: string | null; justificacionConsolidacion?: string | null; responsable?: { nombre?: string | null; cargo?: string | null; entidad?: string | null; email?: string | null } | null };
  centros: Array<{ nombre: string; direccion?: string | null; municipio?: string | null; isla?: string | null; enBaleares: boolean; unidades?: number | null; operativoDesde?: string | null; operativoHasta?: string | null; indice: number; /** Plantilla media del año (trabajadores). */ plantilla?: number }>;
  inventario: {
    anio: number; estado: string; anioBase?: number | null; cerradoEn?: string | null; conjuntoFijado: boolean;
    cierre?: { analisisVariacion?: string; reaperturas?: Array<{ fecha: string; usuario: string; motivo: string }> } | null;
    verificacion?: { entidad?: string; nivel?: string; fecha?: string; referencia?: string } | null;
  };
  factores: ConjuntoFactores;
  resultados: ResultadoLinea[];
  totales: Totales;
  actividad: Array<{ id?: string; documentoId?: string | null; centro: string; categoria: string; fuente: string; cantidad: number; unidad?: string | null; contador?: string | null; periodoDesde?: string | null; periodoHasta?: string | null; documento?: string | null; notas?: string | null; origenElectricidad?: string | null }>;
  anterior?: { anio: number; a1: number; a2: number; total: number } | null;
  exclusiones: Array<{ fuente: string; porcentaje: number | null; justificacion: string; /** Categoría ISO (1 a 6) a la que pertenece lo excluido. */ categoriaIso?: number | null; /** Hay una evidencia (documento o referencia) que respalda la exclusión. */ evidencia?: boolean }>;
  /** Evaluación de la significancia de las emisiones indirectas (apartado 5.2.3 de la norma); si falta, no se puede declarar la conformidad completa. */
  /** Año base de la organización, año anterior y año actual (resumen), reglas de recálculo y decisión documentada. */
  anioBase?: { def: AnioBaseDef | null; base: ResumenAnio | null; anterior: ResumenAnio | null; actual: ResumenAnio; config?: Partial<ConfigRecalculo> | null; decision: DecisionRecalculo | null };
  /** Textos y opciones de la plantilla del informe (confidencialidad, tablas que no se parten). */
  plantilla?: Partial<ConfigPlantillaInforme> | null;
  /** Reglas del resumen ejecutivo (umbrales de las conclusiones). */
  resumen?: Partial<ConfigResumen> | null;
  /** Catálogo de incertidumbres de la organización (si no, el de por defecto). */
  incertidumbre?: Partial<ConfigIncertidumbre> | null;
  significancia?: { plantilla: Array<Pick<SubcategoriaPlantilla, 'codigo' | 'nombre' | 'activa' | 'categoria'>>; evaluaciones: Evaluacion[]; criterios?: Partial<CriteriosSignificancia> | null; textos?: Partial<TextosDeclaracion> | null };
  noConformidades: Array<{ fecha: string; descripcion: string; medida?: string | null; responsable?: string | null; cerradaEn?: string | null }>;
  documentos: Array<{ id?: string; nombre: string; tipo: string; centro: string; periodoDesde?: string | null; periodoHasta?: string | null; estado: string }>;
  /** Emisiones mensuales por fuente (t CO₂e, 12 valores) para el gráfico de evolución; opcional. */
  mensualPorFuente?: Record<string, number[]>;
  emitidoPor: string;
  fecha: string; // AAAA-MM-DD
}

/** Toneladas (t CO₂e) a partir de kg, siempre con el formato de la capa única. */
const tn = (kg: number) => fmt(kg / 1000, 'tCO2e');
const pct = (v: number | null | undefined) => { const t = fmtOpc(v, 'porcentaje'); return t === null ? '—' : `${t} %`; };
const fechaEs = (iso?: string | null) => (iso ? new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—');
const variacionPct = (v: number, ref: number) => (ref > 0 ? ((v - ref) / ref) * 100 : null);
const dash = (x?: string | number | null) => (x === null || x === undefined || x === '' ? '—' : String(x));

const CATEGORIA: Record<string, string> = { combustion_fija: 'Combustión fija', combustion_movil: 'Combustión móvil', fugitiva: 'Emisiones fugitivas (refrigerantes)', electricidad: 'Electricidad adquirida' };
const ISO_CAT: Record<string, string> = { combustion_fija: 'Categoría 1', combustion_movil: 'Categoría 1', fugitiva: 'Categoría 1', electricidad: 'Categoría 2' };
const ORIGEN: Record<string, string> = { red: 'Red', autoconsumo: 'Autoconsumo', gdo_renovable_balear: 'GdO renovable de Baleares', gdo_otra: 'GdO renovable (otra)' };


/** Correspondencia entre el contenido obligatorio de la ISO 14064-1 (9.3.1) y los apartados de este informe. */
export const CORRESPONDENCIA_ISO: Array<[string, string, string]> = APARTADOS_ISO;

export function construirInforme(d: DatosInforme): ModeloInformeHuella {
  const pendientes: string[] = [];
  const { organizacion: o, inventario: inv, factores: f, totales: tot } = d;
  const anio = inv.anio;
  const ab = d.anioBase;
  // «Año anterior» para el gráfico y la tabla de totales: el dato aportado o el del resumen
  const ant = d.anterior ?? (ab?.anterior ? { anio: ab.anterior.anio, a1: (ab.anterior.porCategoria[1] ?? 0) * 1000, a2: (ab.anterior.porCategoria[2] ?? 0) * 1000, total: ab.anterior.total * 1000 } : null);
  const cfgRec = configRecalculo(ab?.config);
  const evRec = ab ? evaluarRecalculo(ab.base, ab.actual, cfgRec, ab.decision) : null;
  const cerrado = inv.estado === 'cerrado' || inv.estado === 'verificado';

  if (!o.direccion) pendientes.push('Falta la dirección de la organización.');
  // Datos obligatorios de la organización (razón social, CIF, CNAE, IAE, criterio de consolidación, responsable): sin ellos no hay versión final
  const incOrg = validarOrganizacion({ razonSocial: o.razonSocial, nombreComercial: o.nombre, cif: o.cif, cnae: o.cnae, iae: o.iae, criterioConsolidacion: o.criterio, justificacionConsolidacion: o.justificacionConsolidacion, responsableNombre: o.responsable?.nombre, responsableCargo: o.responsable?.cargo, responsableEntidad: o.responsable?.entidad, responsableEmail: o.responsable?.email });
  pendientes.push(...incOrg.map((x) => x.mensaje));
  if (!ab?.def && !inv.anioBase) pendientes.push('No se ha fijado el año base de la organización.');
  else if (ab && !ab.base) pendientes.push('El año base no tiene datos (inventario vinculado o introducidos a mano): no se puede comparar ni evaluar el recálculo.');
  if (evRec) pendientes.push(...evRec.incidencias);
  if (!cerrado) pendientes.push('El inventario no está cerrado: el informe es un borrador y sus cifras pueden cambiar.');
  if (!inv.conjuntoFijado) pendientes.push('Los factores de emisión no están fijados en el inventario.');
  const sinIndice = d.centros.filter((c) => !(c.indice > 0)).map((c) => c.nombre);
  const hayPlantilla = d.centros.some((c) => (c.plantilla ?? 0) > 0);
  if (sinIndice.length) pendientes.push(`Sin índice de actividad (estancias): ${sinIndice.join(', ')}.`);
  const resFactores = f.resolucion ?? resolucionDeAnio(anio);
  if (!resFactores) pendientes.push(`Cite la resolución oficial de factores de emisión de ${anio}: no está incorporada al catálogo.`);
  else pendientes.push(...validarResolucion(resFactores).map((x) => `Resolución de factores ${anio}: ${x.charAt(0).toLowerCase()}${x.slice(1)}`));
  if (d.actividad.some((a) => !a.documento)) pendientes.push(`${d.actividad.filter((a) => !a.documento).length} dato(s) de actividad sin factura asociada (el verificador pedirá su evidencia).`);
  if (!d.exclusiones.length) pendientes.push('No hay fuentes excluidas registradas: confirme que el inventario es completo para las categorías 1 y 2.');

  const centrosTabla = d.centros.map((c) => [c.nombre, dash(c.direccion), [c.municipio, c.enBaleares ? c.isla : 'Fuera de Baleares'].filter(Boolean).join(' · ') || '—', fmt(c.unidades, 'entero')]);

  // ── 1
  const s1: Seccion = { id: '1', titulo: 'Datos básicos y descripción de la organización', bloques: [
    { k: 'tabla', cab: ['Dato', 'Valor'], filas: [['Razón social', dash(o.razonSocial)], ['Nombre comercial', o.nombre], ['CIF', dash(o.cif)], ['Dirección', dash(o.direccion)], ['CNAE', dash(o.cnae)], ['IAE', dash(o.iae)]] },
    { k: 'p', texto: `La organización dispone de ${d.centros.length} centro${d.centros.length === 1 ? '' : 's'} de trabajo incluido${d.centros.length === 1 ? '' : 's'} en el inventario.` },
    { k: 'tabla', cab: ['Centro', 'Dirección', 'Municipio e isla', 'Unidades de alojamiento'], filas: centrosTabla, numericas: [3] },
  ] };

  // ── 2
  const s2: Seccion = { id: '2', titulo: 'Responsable, objetivo y usuarios del informe', bloques: [
    { k: 'p', texto: textoResponsable({ responsableNombre: o.responsable?.nombre, responsableCargo: o.responsable?.cargo, responsableEntidad: o.responsable?.entidad, responsableEmail: o.responsable?.email }) ? `Responsable de la elaboración del inventario: ${textoResponsable({ responsableNombre: o.responsable?.nombre, responsableCargo: o.responsable?.cargo, responsableEntidad: o.responsable?.entidad, responsableEmail: o.responsable?.email })}.` : 'Responsable de la elaboración del inventario: sin indicar.' },
    { k: 'p', texto: `Objetivo: cuantificar las emisiones de gases de efecto invernadero de las categorías 1 (emisiones directas) y 2 (energía importada) correspondientes al año ${anio}, para su inscripción en el Registro balear de huella de carbono (Decreto 48/2021) y como base del plan de reducción.` },
    { k: 'p', texto: 'Usuarios previstos: la propia organización, la Administración competente del Registro balear y la entidad verificadora. La difusión del informe es decisión de la organización. Frecuencia: anual.' },
  ] };

  // ── 3
  const reap = inv.cierre?.reaperturas ?? [];
  const s3: Seccion = { id: '3', titulo: 'Periodo e inventario', bloques: [
    { k: 'tabla', cab: ['Concepto', 'Valor'], filas: [['Periodo cubierto', `1 de enero a 31 de diciembre de ${anio}`], ['Año base', ab?.def ? `${ab.def.anio}${ab.base ? (ab.def.inventarioId ? ' (inventario del sistema)' : ' (datos introducidos manualmente)') : ' (sin datos)'}` : inv.anioBase ? `${inv.anioBase} (sin inventario ni datos vinculados)` : 'No fijado'], ['Estado del inventario', inv.estado], ['Fecha de cierre', fechaEs(inv.cerradoEn)]] },
    ...(ab?.def ? [{ k: 'p' as const, texto: `Elección del año base: ${ab.def.justificacion}${ab.def.inventarioId ? '' : ` Origen de los datos: ${ab.def.origen ?? '—'}${ab.def.evidenciaUrl || ab.def.evidenciaNombre ? `; evidencia: ${ab.def.evidenciaNombre ?? ab.def.evidenciaUrl}` : ''}.`}` }] : []),
    ab?.base
      ? { k: 'tabla' as const, cab: ['Inventario del año base', 'Valor'], filas: [
        [`Emisiones directas (categoría 1)`, `${fmt(ab.base.porCategoria[1] ?? 0, 'tCO2e')} t CO₂e`], [`Energía importada (categoría 2)`, `${fmt(ab.base.porCategoria[2] ?? 0, 'tCO2e')} t CO₂e`], ['Total', `${fmt(ab.base.total, 'tCO2e')} t CO₂e`],
        ...(ratioEstancia(ab.base) != null ? [['Ratio por estancia', `${fmt(ratioEstancia(ab.base), 'ratio')} t CO₂e por estancia`]] : []),
        ...(ratioTrabajador(ab.base) != null ? [['Ratio por trabajador', `${fmt(ratioTrabajador(ab.base), 'ratio')} t CO₂e por trabajador`]] : []),
        ['Conjunto de factores', ab.base.factoresId ?? '—'],
      ] }
      : { k: 'p' as const, texto: ab?.def ? `El año base (${ab.def.anio}) no tiene datos en el sistema: no existe inventario del año base con el que comparar.` : 'No existe inventario del año base: la organización no ha definido su año base, por lo que no se puede comparar con él ni aplicar las reglas de recálculo.' },
    ...(evRec ? textoRecalculo(evRec, ab!.decision, cfgRec).map((t) => ({ k: 'p' as const, texto: t })) : []),
    reap.length
      ? { k: 'tabla', cab: ['Fecha', 'Usuario', 'Causa de la reapertura'], filas: reap.map((r) => [fechaEs(r.fecha), r.usuario, r.motivo]) }
      : { k: 'p', texto: 'No se han producido reaperturas del inventario tras su cierre.' },
  ] };

  // ── 4
  const s4: Seccion = { id: '4', titulo: 'Límites de la organización', bloques: [
    { k: 'p', texto: tituloCriterio(o.criterio) ? `Criterio de consolidación: ${tituloCriterio(o.criterio)!.toLowerCase()}. ${CRITERIOS_CONSOLIDACION.find((x) => x.id === o.criterio)!.descripcion}${o.justificacionConsolidacion?.trim() ? ` Justificación: ${o.justificacionConsolidacion.trim()}` : ''}` : 'Criterio de consolidación: sin definir.' },
    { k: 'tabla', cab: hayPlantilla ? ['Centro incluido', 'Operativo desde', 'Operativo hasta', 'Estancias', 'Plantilla media'] : ['Centro incluido', 'Operativo desde', 'Operativo hasta', 'Estancias'], filas: d.centros.map((c) => [c.nombre, c.operativoDesde ? fechaEs(c.operativoDesde) : `1/1/${anio}`, c.operativoHasta ? fechaEs(c.operativoHasta) : `31/12/${anio}`, fmt(c.indice > 0 ? c.indice : null, 'entero'), ...(hayPlantilla ? [fmt((c.plantilla ?? 0) > 0 ? c.plantilla : null, 'plantilla')] : [])]), numericas: hayPlantilla ? [3, 4] : [3] },
  ] };

  // ── 5
  const criterios = criteriosDe(d.significancia?.criterios);
  const sig = d.significancia;
  const estadoSig = sig ? estadoEvaluacion(sig.plantilla, sig.evaluaciones, criterios) : null;
  const iso = resultadosIso(d.resultados, d.factores, d.exclusiones.map((x) => ({ fuente: x.fuente, porcentaje: x.porcentaje, justificacion: x.justificacion, categoriaIso: x.categoriaIso })), tot, sig ? resumenPorCategoria(sig.plantilla, sig.evaluaciones, criterios) : {});
  const dir = evaluarExclusionesDirectas(d.exclusiones.filter((x) => (x.categoriaIso ?? 1) === 1).map((x) => ({ fuente: x.fuente, porcentaje: x.porcentaje, evidencia: !!x.evidencia })), criterios);
  /** Une las categorías consecutivas no cuantificadas que comparten estado y justificación (así no se repite el mismo motivo en cada fila). */
  const nombreCorto = (n: number) => CATEGORIAS_ISO[n - 1].nombre.charAt(0).toLowerCase() + CATEGORIAS_ISO[n - 1].nombre.slice(1);
  const fusionar = <T extends { n: number; estado: string; justificacion: string | null }>(l: T[]) => {
    const grupos: Array<{ items: T[] }> = [];
    for (const c of l) { const g = grupos[grupos.length - 1]; const u = g?.items[g.items.length - 1]; if (g && u && c.estado !== 'Cuantificada' && u.estado === c.estado && u.justificacion === c.justificacion && c.n === u.n + 1) g.items.push(c); else grupos.push({ items: [c] }); }
    return grupos.map((g) => ({ ...g, etiqueta: g.items.length === 1 ? CATEGORIAS_ISO[g.items[0].n - 1].resumen : `Categorías ${g.items[0].n} a ${g.items[g.items.length - 1].n} (${g.items.map((x) => nombreCorto(x.n)).join('; ')})` }));
  };
  const subsConDatos = (n: number) => [...new Set(d.actividad.map((a) => CATEGORIA_ISO_FUENTE[a.categoria as keyof typeof CATEGORIA_ISO_FUENTE]).filter((c) => c && c.n === n).map((c) => c.sub.replace(/^\d\.\d\s+/, '')))].sort(); // sin códigos de subcategoría
  const s5: Seccion = { id: '5', titulo: 'Límites del informe', bloques: [
    { k: 'tabla', cab: ['Categoría (ISO 14064-1)', 'Estado', 'Fuentes o justificación'], filas: fusionar(iso.categorias).map((g) => [
      g.etiqueta, g.items[0].estado,
      g.items[0].estado === 'Cuantificada' ? (subsConDatos(g.items[0].n).join('; ') || '—') : g.items[0].justificacion ?? '—',
    ]) },
    { k: 'p', texto: `Criterio de significancia: se consideran insignificantes las fuentes que individualmente representan menos del ${fmtOpc(criterios.exclusionDirectaPorFuente, 'porcentaje')} % de las emisiones y, en conjunto, no más del ${fmtOpc(criterios.exclusionDirectaTotal, 'porcentaje')} %.` },
  ] };

  // ── 6
  const s6: Seccion = { id: '6', titulo: 'Exclusiones', bloques: d.exclusiones.length
    ? [{ k: 'tabla', cab: ['Fuente excluida', '% estimado', 'Justificación'], filas: d.exclusiones.map((x) => [x.fuente, pct(x.porcentaje), x.justificacion]), numericas: [1] },
       { k: 'p', texto: `Suma estimada de las exclusiones: ${pct(d.exclusiones.reduce((s, x) => s + (x.porcentaje ?? 0), 0))} de las emisiones.` }]
    : [{ k: 'p', texto: 'No se ha excluido ninguna fuente de las categorías 1 y 2 en este inventario.' }] };

  // ── 7
  const porFuente = new Map<string, { cant: number; n: number; unidad: string; centros: Set<string> }>();
  for (const a of d.actividad) {
    const k = a.fuente || 'Electricidad';
    const x = porFuente.get(k) ?? { cant: 0, n: 0, unidad: a.categoria === 'electricidad' ? 'kWh' : a.categoria === 'fugitiva' ? 'kg' : f.unidades[a.fuente] ?? a.unidad ?? '', centros: new Set<string>() };
    x.cant += a.cantidad; x.n += 1; x.centros.add(a.centro); porFuente.set(k, x);
  }
  const usados = [...porFuente.keys()].filter((k) => f.combustibles[k]);
  const gasesUsados = [...porFuente.keys()].filter((k) => f.pcaRefrigerantes[k] !== undefined);
  const biogenico = [...porFuente.keys()].some((k) => k.includes('**'));
  const s7: Seccion = { id: '7', titulo: 'Cuantificación', bloques: [
    { k: 'h', texto: '7.1 Metodología' },
    { k: 'lista', items: [
      'Combustión (fija y móvil): cantidad de combustible × factor de emisión de CO₂, CH₄ y N₂O; el CH₄ y el N₂O se convierten a CO₂e con los potenciales de calentamiento indicados.',
      'Emisiones fugitivas: kg de gas refrigerante recargado × potencial de calentamiento atmosférico del gas.',
      'Electricidad: kWh × factor del mix eléctrico balear del año (método de ubicación). Con garantía de origen renovable de Baleares o autoconsumo se informa además el método de mercado, por separado.',
      'Razón de la elección: es el enfoque de la calculadora oficial del Registro balear, basado en datos de factura con incertidumbre baja y trazabilidad documental.',
      'No se han producido cambios de enfoque de cuantificación respecto a inventarios anteriores.',
    ] },
    { k: 'h', texto: '7.2 Datos de actividad' },
    { k: 'tabla', cab: ['Fuente', 'Cantidad total', 'Unidad', 'Registros', 'Centros'], filas: [...porFuente.entries()].map(([k, x]) => [k, fmt(x.cant, 'actividad'), x.unidad, fmt(x.n, 'entero'), [...x.centros].join(', ')]), numericas: [1, 3] },
    { k: 'p', texto: `Cada dato procede de una factura revisada y confirmada por una persona; ${d.actividad.filter((a) => !a.documento).length} dato(s) se introdujeron manualmente con su origen anotado. El detalle está en el Anexo A.` },
    { k: 'h', texto: '7.3 Factores de emisión y potenciales de calentamiento' },
    { k: 'tabla', cab: ['Concepto', 'Valor'], filas: [
      ['Conjunto de factores', f.id], ['Procedencia', f.procedencia], ['Potencial de calentamiento CH₄', `${fmt(f.gwp.ch4, 'pca')} kg CO₂e/kg`], ['Potencial de calentamiento N₂O', `${fmt(f.gwp.n2o, 'pca')} kg CO₂e/kg`],
      ['Fuente de los potenciales', f.gwp.fuente], ['Mix eléctrico balear', `${fmt(f.mixElectrico, 'factor')} kg CO₂e/kWh`],
    ] },
    { k: 'p', texto: resFactores ? textoResolucion(resFactores) : `Resolución anual de factores de emisión correspondiente al año ${anio}: pendiente de citar.` },
    ...(f.notas.length ? [{ k: 'lista' as const, items: f.notas.map((n) => `Nota sobre los factores: ${n}`) }] : []),
    ...(usados.length ? [{ k: 'tabla' as const, cab: ['Fuente', 'Unidad', 'CO₂ (kg/ud)', 'CH₄ (g/ud)', 'N₂O (g/ud)'], filas: usados.map((k) => [k, dash(f.unidades[k]), fmt(f.combustibles[k].co2, 'factor'), fmt(f.combustibles[k].ch4, 'factor'), fmt(f.combustibles[k].n2o, 'factor')]), numericas: [2, 3, 4] }] : []),
    ...(gasesUsados.length ? [{ k: 'tabla' as const, cab: ['Gas refrigerante', 'PCA'], filas: gasesUsados.map((k) => [k, fmt(f.pcaRefrigerantes[k], 'pca')]), numericas: [1] }] : []),
    { k: 'h', texto: '7.4 CO₂ biogénico y absorciones' },
    { k: 'p', texto: biogenico ? 'El inventario incluye combustibles de origen biogénico (marcados con **). Su CO₂ biogénico no se suma a las emisiones totales; el CH₄ y el N₂O sí se contabilizan.' : 'No se han identificado emisiones de CO₂ de origen biogénico. No se cuantifican absorciones ni compensaciones en este inventario.' },
    { k: 'h', texto: '7.5 Herramienta de cálculo' },
    { k: 'p', texto: `Cálculo realizado con ${VERSION_MOTOR}, que reproduce las fórmulas de la calculadora oficial del Registro balear. Cada línea conserva el factor aplicado y la fórmula (Anexo C), de modo que el resultado es reproducible.` },
  ] };

  // ── 8 · Incertidumbre (ISO 14064-1, 8.3 y 9.3.1 p/q): método 1 del IPCC, combinando por fuente, categoría y total
  const cfgInc = configIncertidumbre(d.incertidumbre);
  const inc = calcularIncertidumbre(d.resultados, f, d.incertidumbre);
  pendientes.push(...inc.incidencias);
  const mpct = (v: number | null) => (v == null ? '—' : `±${fmt(v, 'porcentaje')} %`);
  const ajustadas = inc.lineas.filter((x) => x.ajustada);
  const s8: Seccion = { id: '8', titulo: 'Incertidumbre', bloques: [
    { k: 'p', texto: 'La incertidumbre se cuantifica con el método 1 del IPCC (Directrices 2006, vol. 1, cap. 3): cada línea combina la incertidumbre de su dato de actividad y la de su factor con la raíz de la suma de cuadrados, y las fuentes, las categorías y el total se obtienen con la raíz de la suma de cuadrados de las incertidumbres absolutas. Los valores son intervalos de confianza del 95 % y proceden del catálogo de incertidumbres por defecto (indicado al final), ajustable con justificación en cada línea.' },
    { k: 'tabla', cab: ['Categoría', 'Emisiones (t CO₂e)', 'Incertidumbre', 'Valoración', 'Principal fuente de incertidumbre'], filas: [
      ...inc.porCategoria.map((c) => [CATEGORIAS_ISO[c.n - 1].resumen, fmt(c.emision / 1000, 'tCO2e'), mpct(c.pct), c.valoracion ?? '—', c.principal ? `${c.principal.fuente} (${fmt(c.principal.peso, 'porcentaje')} % de la varianza)` : '—']),
      ['Total del inventario', fmt(inc.total.emision / 1000, 'tCO2e'), mpct(inc.total.pct), inc.total.valoracion ?? '—', inc.total.principal ? `${inc.total.principal.fuente} (${fmt(inc.total.principal.peso, 'porcentaje')} % de la varianza)` : '—'],
    ], numericas: [1, 2], pie: `Valoración cualitativa: Baja hasta ±${fmt(cfgInc.umbrales.baja, 'porcentaje')} %, Media hasta ±${fmt(cfgInc.umbrales.media, 'porcentaje')} %, Alta hasta ±${fmt(cfgInc.umbrales.alta, 'porcentaje')} %, Muy alta por encima.` },
    { k: 'p', texto: inc.total.pct != null ? `La incertidumbre combinada del inventario es de ${mpct(inc.total.pct)} (±${fmt(inc.total.absoluta / 1000, 'tCO2e')} t CO₂e sobre ${fmt(inc.total.emision / 1000, 'tCO2e')} t CO₂e), con un nivel de confianza del 95 %; su valoración cualitativa es ${String(inc.total.valoracion).toLowerCase()}.` : 'No se puede calcular la incertidumbre combinada: el inventario no tiene emisiones.' },
    { k: 'tabla', cab: ['Fuente', 'Emisiones (t CO₂e)', 'Incertidumbre', 'Valoración'], filas: inc.porFuente.map((x) => [x.nombre, fmt(x.emision / 1000, 'tCO2e'), mpct(x.pct), x.valoracion ?? '—']), numericas: [1, 2] },
    ...(ajustadas.length ? [{ k: 'tabla' as const, cab: ['Línea ajustada', 'Origen del dato', 'Dato', 'Factor', 'Justificación'], filas: ajustadas.map((x) => [x.fuente, ORIGENES_DATO[x.origen], mpct(x.datoPct), mpct(x.factorPct), x.justificacion ?? '—']), numericas: [2, 3], pie: 'Líneas cuya incertidumbre se ha ajustado respecto al catálogo.' }] : []),
    { k: 'tabla', cab: ['Catálogo de incertidumbres por defecto', 'Incertidumbre'], filas: [
      ...(Object.keys(cfgInc.dato) as Array<keyof typeof cfgInc.dato>).map((k) => [`Dato de actividad: ${ORIGENES_DATO[k].toLowerCase()}`, mpct(cfgInc.dato[k])]),
      ['Factor de CO₂ de combustibles', mpct(cfgInc.factor.co2Combustible)], ['Factor de CH₄', mpct(cfgInc.factor.ch4)], ['Factor de N₂O', mpct(cfgInc.factor.n2o)], ['Mix eléctrico', mpct(cfgInc.factor.mixElectrico)],
      ['PCA de gases puros', mpct(cfgInc.factor.pcaGasPuro)], ['PCA de mezclas', mpct(cfgInc.factor.pcaMezcla)],
    ], numericas: [1] },
  ] };

  // ── 9
  const lineasElec = d.resultados.filter((r) => r.electricidad);
  const ubic = lineasElec.reduce((s, r) => s + (r.electricidad?.kgCO2eUbicacion ?? 0), 0);
  const merc = lineasElec.reduce((s, r) => s + (r.electricidad?.kgCO2eMercado ?? 0), 0);
  const indiceTotal = d.centros.reduce((s, c) => s + (c.indice > 0 ? c.indice : 0), 0);
  const plantillaTotal = comoSeMuestra(d.centros.reduce((s, c) => s + ((c.plantilla ?? 0) > 0 ? comoSeMuestra(c.plantilla!, 'plantilla') : 0), 0), 'plantilla'); // el divisor de los ratios es el valor que se muestra
  const unCentro = d.centros.length === 1;
  // Gráficos de resultados (SVG)
  const fuenteT: Record<string, number> = {};
  for (const r of d.resultados) { const k = etiquetaFuente(r.linea.fuente); fuenteT[k] = (fuenteT[k] ?? 0) + r.kgCO2e / 1000; }
  const graficos: Bloque[] = [];
  const gAnillo = svgAnillo(Object.entries(fuenteT).map(([nombre, t]) => ({ nombre, t })), 'Reparto de las emisiones por fuente');
  graficos.push({ k: 'grafico', titulo: 'Reparto de las emisiones por fuente (t CO₂e)', ...gAnillo, pie: 'Cada fuente con su aportación al total de emisiones del año.' });
  const mens = d.mensualPorFuente ?? {};
  const seriesM = Object.entries(mens).map(([nombre, valores]) => ({ nombre, valores })).sort((a, b) => b.valores.reduce((x, y) => x + y, 0) - a.valores.reduce((x, y) => x + y, 0));
  if (seriesM.some((x) => x.valores.some((v) => v > 0))) {
    graficos.push({ k: 'grafico', titulo: `Evolución mensual de las emisiones ${anio} (t CO₂e)`, ...svgBarrasApiladas(NOMBRES_MES, seriesM, 'Evolución mensual de las emisiones'), pie: 'Cada consumo se reparte por meses en proporción a los días de su periodo de facturación.' });
  }
  const centrosT = Object.entries(tot.porCentro).map(([nombre, kg]) => ({ nombre, t: kg / 1000 }));
  if (ant) {
    graficos.push({ k: 'grafico', titulo: `Comparación con ${ant.anio} (t CO₂e)`, ...svgBarrasAgrupadas(['Alcance 1', 'Alcance 2', 'Total'], [
      { nombre: String(ant.anio), valores: [ant.a1 / 1000, ant.a2 / 1000, ant.total / 1000] },
      { nombre: String(anio), valores: [tot.kgCO2eAlcance1 / 1000, tot.kgCO2eAlcance2 / 1000, tot.kgCO2eTotal / 1000] },
    ], `Comparación con ${ant.anio}`) });
  }

  // Resumen ejecutivo: totales por categoría y ratios globales (con un único centro, los ratios del centro son los globales)
  const filasResumen: string[][] = [
    ['Emisiones directas (categoría 1)', `${fmt(iso.porCategoria[1], 'tCO2e')} t CO₂e`],
    ['Energía importada (categoría 2)', `${fmt(iso.porCategoria[2], 'tCO2e')} t CO₂e`],
    ...iso.indirectas.filter((c) => c.n >= 3 && c.estado === 'Cuantificada').map((c) => [`${CATEGORIAS_ISO[c.n - 1].resumen}`, `${fmt(c.toneladasCO2e, 'tCO2e')} t CO₂e`]),
    ['Total del inventario', `${fmt(iso.totalInventario, 'tCO2e')} t CO₂e`],
    ...(indiceTotal > 0 ? [['Ratio por estancia', `${fmt(iso.totalInventario / indiceTotal, 'ratio')} t CO₂e por estancia (${fmt(indiceTotal, 'entero')} estancias)`]] : []),
    ...(plantillaTotal > 0 ? [['Ratio por trabajador', `${fmt(iso.totalInventario / plantillaTotal, 'ratio')} t CO₂e por trabajador (plantilla media ${fmt(plantillaTotal, 'plantilla')})`]] : []),
  ];
  const grupoGraf = iso.gases.filter((x) => x.toneladasCO2e > 0).map((x) => ({ nombre: x.grupo, t: x.toneladasCO2e }));
  const catGraf = iso.categorias.filter((c) => c.estado === 'Cuantificada').map((c) => ({ nombre: CATEGORIAS_ISO[c.n - 1].resumen, t: iso.porCategoria[c.n] }));

  const bloques9: Bloque[] = [
    { k: 'h', texto: '9.0 Resumen ejecutivo' },
    { k: 'tabla', cab: ['Magnitud', 'Valor'], filas: filasResumen, pie: 'Las compensaciones no se restan del inventario (ISO 14064-1); se informarían aparte.' },
    ...graficos,
    { k: 'h', texto: '9.1 Emisiones directas por gas (categoría 1)' },
    { k: 'tabla', cab: ['Grupo de gas', 'Emisión (t del gas)', 'PCA', 'Emisiones (t CO₂e)', '% de la categoría 1'], filas: [
      ...iso.gases.map((x) => [x.grupo, fmt(x.toneladasGas, 'gasT'), fmt(x.pca, 'pca'), fmt(x.toneladasCO2e, 'tCO2e'), pct(x.porcentajeCat1)]),
      ['Total categoría 1', '', '', fmt(iso.totalCat1, 'tCO2e'), iso.totalCat1 > 0 ? pct(100) : '—'],
    ], numericas: [1, 2, 3, 4], pie: 'Solo fuentes de la categoría 1. Cada gas en toneladas del propio gas; las emisiones en CO₂e resultan de multiplicarlas por su potencial de calentamiento global (PCA; en los grupos con varios gases, el PCA medio ponderado). Las mezclas HFC/HFO cuentan como HFC.' },
    iso.refrigerantes.length
      ? { k: 'tabla', cab: ['Refrigerante', 'Grupo de gas', 'Emisión (t del gas)', 'PCA', 'Emisiones (t CO₂e)'], filas: iso.refrigerantes.map((x) => [x.gas, x.grupo, fmt(x.toneladasGas, 'gasT'), fmt(x.pca, 'pca'), fmt(x.toneladasCO2e, 'tCO2e')]), numericas: [2, 3, 4], pie: 'Desglose por refrigerante de las emisiones fugitivas (recargas), con el PCA del conjunto de factores utilizado.' }
      : { k: 'p', texto: 'No hay emisiones fugitivas de refrigerantes en este inventario.' },
    ...(grupoGraf.length ? [{ k: 'grafico' as const, titulo: 'Emisiones directas por grupo de gas (t CO₂e)', ...svgBarrasHorizontales(grupoGraf, 'Emisiones directas por grupo de gas'), pie: 'Solo categoría 1; se muestran los grupos con emisiones.' }] : []),
    { k: 'h', texto: '9.2 Emisiones indirectas por categoría (2 a 6)' },
    { k: 'tabla', cab: ['Categoría', 'Estado', 'Emisiones (t CO₂e)', 'Justificación'], filas: fusionar(iso.indirectas).map((g) => [g.etiqueta, g.items[0].estado, fmt(g.items[0].toneladasCO2e, 'tCO2e'), g.items[0].justificacion ?? '—']), numericas: [2], pie: 'Cuantificada: con datos de actividad. No significativa: excluida por estar por debajo del umbral de significancia. Excluida: no cuantificada, con su justificación.' },
    ...(catGraf.length ? [{ k: 'grafico' as const, titulo: 'Emisiones por categoría (t CO₂e)', ...svgBarrasHorizontales(catGraf, 'Emisiones por categoría'), pie: 'Categorías cuantificadas del inventario.' }] : []),
    { k: 'h', texto: '9.3 Electricidad: método de ubicación y método de mercado' },
    { k: 'tabla', cab: ['Método', 'Emisiones (t CO₂e)'], filas: [['Basado en la ubicación (mix de la red)', tn(ubic)], ['Basado en el mercado (garantías de origen / autoconsumo)', tn(merc)]], numericas: [1], pie: 'Se informan por separado conforme al Anexo E de la norma.' },
  ];
  if (!unCentro) {
    bloques9.push({ k: 'h', texto: '9.4 Resultados por centro' });
    bloques9.push({ k: 'tabla', cab: hayPlantilla ? ['Centro', 'Emisiones (t CO₂e)', 'Estancias', 't CO₂e por estancia', 'Plantilla media', 't CO₂e por trabajador'] : ['Centro', 'Emisiones (t CO₂e)', 'Estancias', 't CO₂e por estancia'], filas: d.centros.map((c) => { const kg = tot.porCentro[c.nombre] ?? 0; const pl = (c.plantilla ?? 0) > 0 ? comoSeMuestra(c.plantilla!, 'plantilla') : null; return [c.nombre, tn(kg), fmt(c.indice > 0 ? c.indice : null, 'entero'), fmt(c.indice > 0 ? kg / 1000 / c.indice : null, 'ratio'), ...(hayPlantilla ? [fmt(pl, 'plantilla'), fmt(pl ? kg / 1000 / pl : null, 'ratio')] : [])]; }), numericas: hayPlantilla ? [1, 2, 3, 4, 5] : [1, 2, 3] });
    bloques9.push({ k: 'grafico', titulo: 'Emisiones por centro (t CO₂e)', ...svgBarrasHorizontales(centrosT, 'Emisiones por centro'), pie: 'Emisiones totales de cada centro de trabajo incluido en el inventario.' });
    if (d.centros.filter((c) => c.indice > 0).length > 1) bloques9.push({ k: 'grafico', titulo: 'Intensidad por estancia (kg CO₂e por estancia)', ...svgBarrasHorizontales(d.centros.filter((c) => c.indice > 0).map((c) => ({ nombre: c.nombre, t: (tot.porCentro[c.nombre] ?? 0) / c.indice })), 'Intensidad por estancia', 2, 'kg'), pie: 'Emisiones del centro divididas entre sus estancias (índice de actividad).' });
  }
  if (ab) {
    const cmp = compararAnios(ab.base, ab.anterior, ab.actual, Object.fromEntries(CATEGORIAS_ISO.map((c) => [c.n, c.resumen])));
    const hayBase = !!ab.base, hayAnt = !!ab.anterior;
    const cols = (primera: string) => [primera, ...(hayBase ? [`Año base ${ab.base!.anio} (t CO₂e)`] : []), ...(hayAnt ? [`${ab.anterior!.anio} (t CO₂e)`] : []), `${anio} (t CO₂e)`, ...(hayBase ? ['Var. vs base'] : []), ...(hayAnt ? ['Var. vs anterior'] : [])];
    const fila = (x: { concepto: string; base: number | null; anterior: number | null; actual: number | null; vsBase: number | null; vsAnterior: number | null }, mag: 'tCO2e' | 'ratio') => [x.concepto, ...(hayBase ? [fmt(x.base, mag)] : []), ...(hayAnt ? [fmt(x.anterior, mag)] : []), fmt(x.actual, mag), ...(hayBase ? [x.vsBase == null ? '—' : `${fmt(x.vsBase, 'porcentaje', { signo: true })} %`] : []), ...(hayAnt ? [x.vsAnterior == null ? '—' : `${fmt(x.vsAnterior, 'porcentaje', { signo: true })} %`] : [])];
    const numericas = (n: number) => Array.from({ length: n - 1 }, (_, i) => i + 1);
    bloques9.push({ k: 'h', texto: `9.5 Comparación con ${[hayBase && `el año base (${ab.base!.anio})`, hayAnt && `el año anterior (${ab.anterior!.anio})`].filter(Boolean).join(' y ') || 'otros años'}` });
    if (!hayBase) bloques9.push({ k: 'p', texto: 'No existe inventario del año base: la comparación con el año base no se puede realizar.' });
    if (!hayAnt) bloques9.push({ k: 'p', texto: `No existe inventario del año anterior (${anio - 1}) en el sistema.` });
    bloques9.push({ k: 'tabla', cab: cols('Categoría'), filas: cmp.categorias.map((x) => fila(x, 'tCO2e')), numericas: numericas(cols('').length) });
    bloques9.push({ k: 'tabla', cab: cols('Fuente'), filas: cmp.fuentes.map((x) => fila(x, 'tCO2e')), numericas: numericas(cols('').length) });
    if (cmp.ratios.length) bloques9.push({ k: 'tabla', cab: cols('Ratio').map((c) => c.replace('(t CO₂e)', '')), filas: cmp.ratios.map((x) => fila(x, 'ratio')), numericas: numericas(cols('').length) });
    const grandes = [...cmp.categorias, ...cmp.fuentes].filter((x) => [x.vsBase, x.vsAnterior].some((v) => v != null && Math.abs(v) >= 20));
    const analisis = inv.cierre?.analisisVariacion?.trim();
    if (analisis) bloques9.push({ k: 'p', texto: `Análisis de variaciones: ${analisis}` });
    else if (grandes.length) { bloques9.push({ k: 'p', texto: 'Hay variaciones iguales o superiores al 20 % sin explicar.' }); pendientes.push(`Falta explicar las variaciones (${grandes.length} magnitud(es) varían un 20 % o más).`); }
    else bloques9.push({ k: 'p', texto: 'Ninguna magnitud varía un 20 % o más: no se requiere análisis específico.' });
  } else if (ant) {
    const v = (a: number, b: number) => (b > 0 ? `${fmt(((a - b) / b) * 100, 'porcentaje', { signo: true })} %` : '—');
    bloques9.push({ k: 'h', texto: `9.5 Comparación con ${ant.anio}` });
    bloques9.push({ k: 'tabla', cab: ['Magnitud', `${ant.anio} (t CO₂e)`, `${anio} (t CO₂e)`, 'Variación'], filas: [
      ['Alcance 1', tn(ant.a1), tn(tot.kgCO2eAlcance1), v(tot.kgCO2eAlcance1, ant.a1)],
      ['Alcance 2', tn(ant.a2), tn(tot.kgCO2eAlcance2), v(tot.kgCO2eAlcance2, ant.a2)],
      ['Total', tn(ant.total), tn(tot.kgCO2eTotal), v(tot.kgCO2eTotal, ant.total)],
    ], numericas: [1, 2, 3] });
    bloques9.push({ k: 'p', texto: inv.cierre?.analisisVariacion?.trim() ? `Análisis de variaciones: ${inv.cierre.analisisVariacion.trim()}` : 'Ninguna magnitud varía de forma que exija análisis específico (umbral del 20 %).' });
  }
  const s9: Seccion = { id: '9', titulo: 'Resultados', bloques: bloques9 };

  // ── 10
  const s10: Seccion = { id: '10', titulo: 'Iniciativas de reducción', bloques: [
    { k: 'p', texto: 'No se han registrado en este inventario iniciativas de reducción. El Registro balear exige un plan de reducción de emisiones desde 2025 (objetivos absolutos o relativos, año base, medidas, ahorro y reducción prevista), que se documentará por separado.' },
  ] };

  // ── 11
  const v = inv.verificacion;
  const declaracion = declaracionConformidad(estadoSig, anio, sig?.textos ?? {});
  const s11: Seccion = { id: '11', titulo: 'Declaración de conformidad y verificación', bloques: [
    { k: 'p', texto: declaracion.texto },
    { k: 'tabla', cab: ['Verificación', 'Dato'], filas: [
      ['Estado', inv.estado === 'verificado' ? 'Verificado' : 'Pendiente de verificación por una entidad acreditada (ISO 14064-3)'],
      ['Entidad verificadora', dash(v?.entidad)], ['Nivel de aseguramiento', dash(v?.nivel)], ['Fecha de la verificación', fechaEs(v?.fecha)], ['Referencia del informe de verificación', dash(v?.referencia)],
    ] },
  ] };

  // ── 12 Anexos
  // Códigos de evidencia (EV-001…): cada documento recibe el suyo y los anexos de actividad y trazabilidad enlazan con él
  const ORDEN_CAT = ['combustion_fija', 'combustion_movil', 'fugitiva', 'electricidad'];
  const docsOrdenados = [...d.documentos].sort((a, b) => a.centro.localeCompare(b.centro) || a.tipo.localeCompare(b.tipo) || (a.periodoDesde ?? '').localeCompare(b.periodoDesde ?? '') || a.nombre.localeCompare(b.nombre));
  const codigoDoc = new Map<string, string>(); const codigoNombre = new Map<string, string>();
  docsOrdenados.forEach((x, i) => { const c = `EV-${String(i + 1).padStart(3, '0')}`; if (x.id) codigoDoc.set(x.id, c); codigoNombre.set(x.nombre, c); });
  const evidenciaDe = (a: { documentoId?: string | null; documento?: string | null; notas?: string | null }) => (a.documentoId && codigoDoc.get(a.documentoId)) || (a.documento && codigoNombre.get(a.documento)) || (a.documento ? a.documento : `Manual: ${a.notas ?? ''}`);
  const porCatFuenteFecha = <T extends { categoria: string; fuente: string; periodoDesde?: string | null }>(l: T[]) => [...l].sort((a, b) => ORDEN_CAT.indexOf(a.categoria) - ORDEN_CAT.indexOf(b.categoria) || (a.fuente || 'Electricidad').localeCompare(b.fuente || 'Electricidad') || (a.periodoDesde ?? '').localeCompare(b.periodoDesde ?? ''));
  const periodoTxt = (desde?: string | null, hasta?: string | null) => (desde ? `${fechaEs(desde)} – ${fechaEs(hasta)}` : '—');
  const anexoA: Bloque = { k: 'tabla', cab: ['Centro', 'Categoría', 'Fuente', 'Contador', 'Periodo', 'Cantidad', 'Ud.', 'Evidencia'], filas: porCatFuenteFecha(d.actividad).map((a) => [
    a.centro, CATEGORIA[a.categoria] ?? a.categoria, a.fuente || (a.origenElectricidad ? `Electricidad · ${ORIGEN[a.origenElectricidad] ?? a.origenElectricidad}` : 'Electricidad'), dash(a.contador),
    periodoTxt(a.periodoDesde, a.periodoHasta), fmt(a.cantidad, 'actividad'), a.categoria === 'electricidad' ? 'kWh' : a.categoria === 'fugitiva' ? 'kg' : dash(f.unidades[a.fuente] ?? a.unidad), evidenciaDe(a),
  ]), numericas: [5] };
  const actPorId = new Map(d.actividad.filter((a) => a.id).map((a) => [a.id!, a]));
  const resOrdenados = [...d.resultados].sort((a, b) => ORDEN_CAT.indexOf(a.linea.categoria) - ORDEN_CAT.indexOf(b.linea.categoria) || (a.linea.fuente || 'Electricidad').localeCompare(b.linea.fuente || 'Electricidad') || (actPorId.get(a.linea.id)?.periodoDesde ?? '').localeCompare(actPorId.get(b.linea.id)?.periodoDesde ?? ''));
  const anexoC: Bloque = { k: 'tabla', cab: ['Centro', 'Fuente', 'Periodo', 'kg CO₂', 'g CH₄', 'g N₂O', 'kg CO₂e', 'Cálculo', 'Evidencia'], filas: resOrdenados.map((r) => { const a = actPorId.get(r.linea.id); return [
    r.linea.centro, r.linea.fuente || 'Electricidad', a ? periodoTxt(a.periodoDesde, a.periodoHasta) : '—', fmt(r.kgCO2, 'kgCO2e'), fmt(r.gCH4, 'gramos'), fmt(r.gN2O, 'gramos'), fmt(r.kgCO2e, 'kgCO2e'), r.trazabilidad.factorUsado, a ? evidenciaDe(a) : '—',
  ]; }), numericas: [3, 4, 5, 6] };
  // Correspondencia con el 9.3.1: cada apartado se marca según los datos
  const verif = inv.verificacion;
  const corr = evaluarCorrespondencia({
    organizacionCompleta: !incOrg.some((x) => x.obligatorio && ['razonSocial', 'cif', 'cnae', 'iae'].includes(x.campo)) && !!o.direccion,
    responsableCompleto: !incOrg.some((x) => x.obligatorio && x.campo.startsWith('responsable')), criterioConsolidacion: !incOrg.some((x) => x.obligatorio && x.campo.includes('onsolidacion')), centros: d.centros.length,
    evaluacionCompleta: estadoSig ? estadoSig.completa : null, categoriasSinEvaluar: iso.indirectas.filter((c) => c.estado === 'Sin evaluar').length,
    exclusiones: { total: d.exclusiones.length, sinJustificar: d.exclusiones.filter((x) => !x.justificacion.trim()).length, directasIncompletas: dir.incidencias.filter((x) => /falta/.test(x)).length },
    baseDefinida: !!ab?.def, baseConDatos: !!ab?.base, recalculoSinDecision: !!evRec && evRec.incidencias.length > 0, metodologiaDeclarada: ab?.decision?.metodologiaCambiada != null,
    hayBiogenico: d.actividad.some((a) => a.fuente.includes('**')), resolucionCompleta: !!resFactores && validarResolucion(resFactores).length === 0, conjuntoFijado: inv.conjuntoFijado, gwpConFuente: !!f.gwp.fuente,
    incertidumbreCalculada: inc.total.pct != null, incidenciasIncertidumbre: inc.incidencias.length, cuadreOk: iso.cuadre.ok,
    declaracionCaso: declaracion.caso, verificado: inv.estado === 'verificado', verificacionCompleta: !!(verif?.entidad && verif?.nivel && verif?.fecha && verif?.referencia),
  });
  const s12: Seccion = { id: '12', titulo: 'Anexos', bloques: [
    { k: 'h', texto: 'Anexo A · Datos de actividad' }, anexoA,
    { k: 'h', texto: 'Anexo B · Factores aplicados' }, { k: 'p', texto: 'Los factores y potenciales utilizados figuran en el apartado 7.3 y se conservan íntegros en el inventario (conjunto ' + f.id + ').' },
    { k: 'h', texto: 'Anexo C · Trazabilidad del cálculo por línea' }, anexoC,
    { k: 'h', texto: 'Anexo D · Correspondencia con el contenido del apartado 9.3.1 de la ISO 14064-1' },
    { k: 'tabla', cab: ['Apartado', 'Contenido', 'Se recoge en', 'Estado', 'Motivo'], filas: corr.map((x) => [x.apartado, x.contenido, x.seccion, x.estado, x.motivo]), pie: 'Estado calculado a partir de los datos del inventario: Cumple, No cumple o No aplica.' },
    { k: 'h', texto: 'Anexo E · Índice de evidencias' },
    { k: 'tabla', cab: ['Código', 'Documento', 'Tipo', 'Centro', 'Periodo', 'Estado'], filas: docsOrdenados.map((x) => [codigoNombre.get(x.nombre)!, x.nombre, x.tipo, x.centro, periodoTxt(x.periodoDesde, x.periodoHasta), x.estado]) },
    { k: 'h', texto: 'Anexo F · Registro de no conformidades' },
    d.noConformidades.length
      ? { k: 'tabla', cab: ['Fecha', 'Descripción', 'Medida', 'Responsable', 'Cerrada'], filas: d.noConformidades.map((n) => [fechaEs(n.fecha), n.descripcion, dash(n.medida), dash(n.responsable), fechaEs(n.cerradaEn)]) }
      : { k: 'p', texto: 'No se han registrado no conformidades.' },
    { k: 'h', texto: 'Anexo G · Control del documento' },
    { k: 'tabla', cab: ['Elaborado por', 'Revisado por', 'Aprobado por'], filas: [[`${d.emitidoPor}\nFecha: ${fechaEs(d.fecha)}`, 'Nombre y fecha:', 'Nombre y fecha:']] },
  ] };

  const meta = {
    titulo: 'Informe de inventario de gases de efecto invernadero',
    subtitulo: `${o.nombre} · Año ${anio}`,
    norma: 'ISO 14064-1:2018 · Decreto 48/2021 (Registro balear de huella de carbono)',
    estado: inv.estado === 'verificado' ? 'VERIFICADO' : cerrado ? 'CERRADO · PENDIENTE DE VERIFICACIÓN' : 'BORRADOR',
    edicion: `Edición 1 · ${fechaEs(d.fecha)}`,
    fecha: d.fecha,
    organizacion: o.nombre,
    anio,
    codigo: `HC-${anio}-${o.nombre.normalize('NFD').replace(/[^\w]+/g, '').slice(0, 12).toUpperCase()}`,
    confidencialidad: configPlantilla(d.plantilla).confidencialidad,
    minFilasSinPartir: configPlantilla(d.plantilla).minFilasSinPartir,
  };
  const secciones = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12];
  // Notas al pie: cada marca (*, †) al final del nombre de una fuente o factor genera su nota bajo la tabla donde aparece; sin texto en el catálogo es una incidencia
  const sinNota = new Set<string>();
  for (const sec of secciones) for (const b of sec.bloques) if (b.k === 'tabla') {
    const marcas = [...new Set(b.filas.flatMap((fila) => fila.map(marcaFinal)).filter((m): m is string => !!m))].sort();
    if (!marcas.length) continue;
    b.notas = marcas.filter((m) => NOTAS_FUENTES[m]).map((m) => `${m} ${NOTAS_FUENTES[m]}`);
    for (const m of marcas) if (!NOTAS_FUENTES[m]) sinNota.add(m);
  }
  for (const m of sinNota) pendientes.push(`La marca «${m}» aparece en nombres de fuentes pero no tiene nota en el catálogo de fuentes.`);
  pendientes.push(...dir.incidencias);
  if (estadoSig) {
    // Un solo pendiente por tipo de falta (no uno por subcategoría)
    if (estadoSig.sinValorar.length) pendientes.push(`Significancia: faltan por valorar ${estadoSig.sinValorar.length} subcategoría(s) de las emisiones indirectas.`);
    if (estadoSig.excluidasSinJustificar.length) pendientes.push(`Significancia: ${estadoSig.excluidasSinJustificar.length} subcategoría(s) se excluyen sin justificación.`);
    if (estadoSig.significativasSinCuantificar.length) pendientes.push(`Significancia: ${estadoSig.significativasSinCuantificar.length} subcategoría(s) significativa(s) sin cuantificar.`);
  } else pendientes.push('No se ha realizado la evaluación de la significancia de las emisiones indirectas (5.2.3).');
  const sinEvaluar = iso.indirectas.filter((c) => c.estado === 'Sin evaluar');
  if (sinEvaluar.length) pendientes.push(`Categoría(s) ${sinEvaluar.map((c) => c.n).join(', ')} sin evaluar: indique si es no significativa o está excluida, con su justificación.`);
  const bloqueantes = [...iso.cuadre.incidencias, ...(cerrado ? incOrg.filter((x) => x.obligatorio).map((x) => x.mensaje) : [])];
  // Resumen ejecutivo: cifras clave y conclusiones por reglas (una página)
  const t1 = iso.porCategoria[1] ?? 0, t2 = iso.porCategoria[2] ?? 0, totalT = iso.totalInventario;
  const ref = ab?.base ? { pct: variacionPct(totalT, ab.base.total), anioRef: ab.base.anio, tipo: 'base' as const } : ab?.anterior ? { pct: variacionPct(totalT, ab.anterior.total), anioRef: ab.anterior.anio, tipo: 'anterior' as const } : null;
  const principales = fuentesPrincipales(Object.fromEntries(inc.porFuente.map((x) => [x.nombre, x.emision / 1000])), totalT, 5);
  const concl = conclusiones({ anio, total: totalT, cat1: t1, cat2: t2, porFuente: Object.fromEntries(inc.porFuente.map((x) => [x.nombre, x.emision / 1000])), ratioEstancia: indiceTotal > 0 ? totalT / indiceTotal : null, ratioTrabajador: plantillaTotal > 0 ? totalT / plantillaTotal : null, variacion: ref, incertidumbre: { pct: inc.total.pct, valoracion: inc.total.valoracion, principal: inc.total.principal?.fuente ?? null }, pendientes: pendientes.length + bloqueantes.length }, d.resumen);
  const resumen: Seccion = { id: 'R', titulo: 'Resumen ejecutivo', bloques: [
    { k: 'tabla', cab: ['Indicador', 'Valor'], filas: [
      ['Emisiones totales', `${fmt(totalT, 'tCO2e')} t CO₂e`], ['Emisiones directas (categoría 1)', `${fmt(t1, 'tCO2e')} t CO₂e`], ['Energía importada (categoría 2)', `${fmt(t2, 'tCO2e')} t CO₂e`],
      ...(indiceTotal > 0 ? [['Ratio por estancia', `${fmt(totalT / indiceTotal, 'ratio')} t CO₂e`]] : []), ...(plantillaTotal > 0 ? [['Ratio por trabajador', `${fmt(totalT / plantillaTotal, 'ratio')} t CO₂e`]] : []),
      [ab?.base ? `Variación frente al año base (${ab.base.anio})` : 'Variación frente al año base', ab?.base && ref?.tipo === 'base' && ref.pct != null ? `${fmt(ref.pct, 'porcentaje', { signo: true })} %` : 'No existe inventario del año base'],
      ['Incertidumbre combinada', inc.total.pct != null ? `±${fmt(inc.total.pct, 'porcentaje')} % (${String(inc.total.valoracion).toLowerCase()})` : '—'],
      ['Estado de verificación', inv.estado === 'verificado' ? `Verificado${verif?.entidad ? ` por ${verif.entidad}` : ''}${verif?.nivel ? ` (aseguramiento ${verif.nivel.toLowerCase()})` : ''}` : 'Pendiente de verificación'],
    ] },
    { k: 'tabla', cab: ['Principales fuentes', 't CO₂e', '% del total'], filas: principales.map((x) => [x.fuente, fmt(x.t, 'tCO2e'), `${fmt(x.pct, 'porcentaje')} %`]), numericas: [1, 2] },
    { k: 'h', texto: 'Conclusiones' },
    { k: 'lista', items: concl },
  ] };
  return { meta, resumen, secciones, pendientes, bloqueantes, declaracion };
}
