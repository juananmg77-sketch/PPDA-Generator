// Modelo del informe de inventario de GEI (ISO 14064-1 / Decreto 48/2021). Función pura: de los datos del inventario a un documento estructurado
// que se renderiza después a HTML/PDF, Word y al paquete del verificador. No contiene texto de la norma (licencia): solo la cita de sus apartados.
import type { ConjuntoFactores, ResultadoLinea, Totales } from './tipos.ts';
import { NOMBRES_MES, etiquetaFuente, svgAnillo, svgBarrasAgrupadas, svgBarrasApiladas, svgBarrasHorizontales } from './graficos.ts';
import { desgloseGases } from './gases.ts';
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
  meta: { titulo: string; subtitulo: string; norma: string; estado: string; edicion: string; fecha: string; organizacion: string; anio: number; codigo: string };
  secciones: Seccion[];
  /** Datos que faltan o conviene revisar antes de entregar el informe al verificador. */
  pendientes: string[];
}

export interface DatosInforme {
  organizacion: { nombre: string; cif?: string | null; direccion?: string | null; cnae?: string | null; iae?: string | null; criterio: 'control' | 'participacion'; consultorEmail?: string | null };
  centros: Array<{ nombre: string; direccion?: string | null; municipio?: string | null; isla?: string | null; enBaleares: boolean; unidades?: number | null; operativoDesde?: string | null; operativoHasta?: string | null; indice: number; /** Plantilla media del año (trabajadores). */ plantilla?: number }>;
  inventario: {
    anio: number; estado: string; anioBase?: number | null; cerradoEn?: string | null; conjuntoFijado: boolean;
    cierre?: { analisisVariacion?: string; reaperturas?: Array<{ fecha: string; usuario: string; motivo: string }> } | null;
    verificacion?: { entidad?: string; nivel?: string; fecha?: string; referencia?: string } | null;
  };
  factores: ConjuntoFactores;
  resultados: ResultadoLinea[];
  totales: Totales;
  actividad: Array<{ centro: string; categoria: string; fuente: string; cantidad: number; unidad?: string | null; contador?: string | null; periodoDesde?: string | null; periodoHasta?: string | null; documento?: string | null; notas?: string | null; origenElectricidad?: string | null }>;
  anterior?: { anio: number; a1: number; a2: number; total: number } | null;
  exclusiones: Array<{ fuente: string; porcentaje: number | null; justificacion: string }>;
  noConformidades: Array<{ fecha: string; descripcion: string; medida?: string | null; responsable?: string | null; cerradaEn?: string | null }>;
  documentos: Array<{ nombre: string; tipo: string; centro: string; periodoDesde?: string | null; periodoHasta?: string | null; estado: string }>;
  /** Emisiones mensuales por fuente (t CO₂e, 12 valores) para el gráfico de evolución; opcional. */
  mensualPorFuente?: Record<string, number[]>;
  emitidoPor: string;
  fecha: string; // AAAA-MM-DD
}

/** Toneladas (t CO₂e) a partir de kg, siempre con el formato de la capa única. */
const tn = (kg: number) => fmt(kg / 1000, 'tCO2e');
const pct = (v: number | null | undefined) => { const t = fmtOpc(v, 'porcentaje'); return t === null ? '—' : `${t} %`; };
const fechaEs = (iso?: string | null) => (iso ? new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—');
const dash = (x?: string | number | null) => (x === null || x === undefined || x === '' ? '—' : String(x));

const CATEGORIA: Record<string, string> = { combustion_fija: 'Combustión fija', combustion_movil: 'Combustión móvil', fugitiva: 'Emisiones fugitivas (refrigerantes)', electricidad: 'Electricidad adquirida' };
const ISO_CAT: Record<string, string> = { combustion_fija: 'Categoría 1', combustion_movil: 'Categoría 1', fugitiva: 'Categoría 1', electricidad: 'Categoría 2' };
const ORIGEN: Record<string, string> = { red: 'Red', autoconsumo: 'Autoconsumo', gdo_renovable_balear: 'GdO renovable de Baleares', gdo_otra: 'GdO renovable (otra)' };

const RESOLUCIONES: Record<number, string> = {
  2023: 'Resolución del consejero de Empresa, Empleo y Energía por la que se aprueban los factores de emisión de las Illes Balears durante el año 2023 (BOIB n.º 35, de 20 de marzo de 2025), que remite al archivo «Factores de emisión 2007-2023, versión 4» (16/05/2024) del MITECO.',
  2024: 'Resolución del conseller de Empresa, Autónomos y Energía, a propuesta del director general de Economía Circular, Transición Energética y Cambio Climático, por la que se aprueban los factores de emisión para cuantificar las emisiones de gases de efecto invernadero de las Illes Balears durante el año 2024 (BOIB n.º 35, de 19 de marzo de 2026), que remite al archivo «Factores de emisión 2007-2024, versión 5» (6/05/2025) del MITECO.',
};

/** Correspondencia entre el contenido obligatorio de la ISO 14064-1 (9.3.1) y los apartados de este informe. */
export const CORRESPONDENCIA_ISO: Array<[string, string, string]> = [
  ['a', 'Descripción de la organización que informa', '1'],
  ['b', 'Persona responsable del informe', '2'],
  ['c', 'Periodo cubierto', '3'],
  ['d', 'Límites de la organización', '4'],
  ['e', 'Límites del informe y criterio de significancia', '5'],
  ['f', 'Emisiones directas por gas, en t CO₂e', '9'],
  ['g', 'Tratamiento del CO₂ de origen biogénico', '7.4'],
  ['h', 'Absorciones de GEI, si se cuantifican', '7.4'],
  ['i', 'Fuentes o sumideros excluidos y su razón', '6'],
  ['j', 'Emisiones indirectas por categoría, en t CO₂e', '9'],
  ['k', 'Año base', '3'],
  ['l', 'Cambios y recálculos del año base', '3'],
  ['m', 'Enfoques de cuantificación y sus razones', '7.1'],
  ['n', 'Cambios de enfoque de cuantificación', '7.1'],
  ['o', 'Factores de emisión utilizados', '7.3 y Anexo B'],
  ['p', 'Efecto de las incertidumbres por categoría', '8'],
  ['q', 'Evaluación de la incertidumbre', '8'],
  ['r', 'Declaración de conformidad con la norma', '11'],
  ['s', 'Estado de verificación, tipo y nivel de aseguramiento', '11'],
  ['t', 'Potenciales de calentamiento y su fuente', '7.3'],
];

export function construirInforme(d: DatosInforme): ModeloInforme {
  const pendientes: string[] = [];
  const { organizacion: o, inventario: inv, factores: f, totales: tot } = d;
  const anio = inv.anio;
  const cerrado = inv.estado === 'cerrado' || inv.estado === 'verificado';

  if (!o.cif) pendientes.push('Falta el CIF de la organización.');
  if (!o.direccion) pendientes.push('Falta la dirección de la organización.');
  if (!o.cnae) pendientes.push('Falta el CNAE de la organización.');
  if (!o.iae) pendientes.push('Falta el IAE de la organización.');
  if (!inv.anioBase) pendientes.push('No se ha fijado el año base del inventario.');
  if (!cerrado) pendientes.push('El inventario no está cerrado: el informe es un borrador y sus cifras pueden cambiar.');
  if (!inv.conjuntoFijado) pendientes.push('Los factores de emisión no están fijados en el inventario.');
  const sinIndice = d.centros.filter((c) => !(c.indice > 0)).map((c) => c.nombre);
  const hayPlantilla = d.centros.some((c) => (c.plantilla ?? 0) > 0);
  if (sinIndice.length) pendientes.push(`Sin índice de actividad (estancias): ${sinIndice.join(', ')}.`);
  if (!RESOLUCIONES[anio]) pendientes.push(`Cite la resolución oficial de factores de emisión de ${anio}: no está incorporada al catálogo.`);
  if (d.actividad.some((a) => !a.documento)) pendientes.push(`${d.actividad.filter((a) => !a.documento).length} dato(s) de actividad sin factura asociada (el verificador pedirá su evidencia).`);
  if (!d.exclusiones.length) pendientes.push('No hay fuentes excluidas registradas: confirme que el inventario es completo para las categorías 1 y 2.');
  if (o.consultorEmail == null) pendientes.push('No consta el consultor responsable del inventario.');

  const centrosTabla = d.centros.map((c) => [c.nombre, dash(c.direccion), [c.municipio, c.enBaleares ? c.isla : 'Fuera de Baleares'].filter(Boolean).join(' · ') || '—', fmt(c.unidades, 'entero')]);

  // ── 1
  const s1: Seccion = { id: '1', titulo: 'Datos básicos y descripción de la organización', bloques: [
    { k: 'tabla', cab: ['Dato', 'Valor'], filas: [['Razón social', o.nombre], ['CIF', dash(o.cif)], ['Dirección', dash(o.direccion)], ['CNAE', dash(o.cnae)], ['IAE', dash(o.iae)]] },
    { k: 'p', texto: `La organización dispone de ${d.centros.length} centro${d.centros.length === 1 ? '' : 's'} de trabajo incluido${d.centros.length === 1 ? '' : 's'} en el inventario.` },
    { k: 'tabla', cab: ['Centro', 'Dirección', 'Municipio e isla', 'Unidades de alojamiento'], filas: centrosTabla, numericas: [3] },
  ] };

  // ── 2
  const s2: Seccion = { id: '2', titulo: 'Responsable, objetivo y usuarios del informe', bloques: [
    { k: 'p', texto: `Responsable de la elaboración del inventario: HS Consulting Group${o.consultorEmail ? ` (consultor responsable: ${o.consultorEmail})` : ''}.` },
    { k: 'p', texto: `Objetivo: cuantificar las emisiones de gases de efecto invernadero de las categorías 1 (emisiones directas) y 2 (energía importada) correspondientes al año ${anio}, para su inscripción en el Registro balear de huella de carbono (Decreto 48/2021) y como base del plan de reducción.` },
    { k: 'p', texto: 'Usuarios previstos: la propia organización, la Administración competente del Registro balear y la entidad verificadora. La difusión del informe es decisión de la organización. Frecuencia: anual.' },
  ] };

  // ── 3
  const reap = inv.cierre?.reaperturas ?? [];
  const s3: Seccion = { id: '3', titulo: 'Periodo e inventario', bloques: [
    { k: 'tabla', cab: ['Concepto', 'Valor'], filas: [['Periodo cubierto', `1 de enero a 31 de diciembre de ${anio}`], ['Año base', inv.anioBase ? String(inv.anioBase) : 'No fijado'], ['Estado del inventario', inv.estado], ['Fecha de cierre', fechaEs(inv.cerradoEn)]] },
    { k: 'p', texto: 'Recálculo del año base: se efectuará cuando cambien los límites, la metodología o los factores de forma que alteren significativamente la comparabilidad, según el apartado 6.4 de la norma, dejando constancia de la causa.' },
    reap.length
      ? { k: 'tabla', cab: ['Fecha', 'Usuario', 'Causa de la reapertura'], filas: reap.map((r) => [fechaEs(r.fecha), r.usuario, r.motivo]) }
      : { k: 'p', texto: 'No se han producido reaperturas del inventario tras su cierre.' },
  ] };

  // ── 4
  const s4: Seccion = { id: '4', titulo: 'Límites de la organización', bloques: [
    { k: 'p', texto: `Criterio de consolidación: ${o.criterio === 'control' ? 'control (operativo o financiero)' : 'participación en el capital'}.` },
    { k: 'tabla', cab: hayPlantilla ? ['Centro incluido', 'Operativo desde', 'Operativo hasta', 'Estancias', 'Plantilla media'] : ['Centro incluido', 'Operativo desde', 'Operativo hasta', 'Estancias'], filas: d.centros.map((c) => [c.nombre, c.operativoDesde ? fechaEs(c.operativoDesde) : `1/1/${anio}`, c.operativoHasta ? fechaEs(c.operativoHasta) : `31/12/${anio}`, fmt(c.indice > 0 ? c.indice : null, 'entero'), ...(hayPlantilla ? [fmt((c.plantilla ?? 0) > 0 ? c.plantilla : null, 'plantilla')] : [])]), numericas: hayPlantilla ? [3, 4] : [3] },
  ] };

  // ── 5
  const catsConDatos = [...new Set(d.actividad.map((a) => CATEGORIA[a.categoria] ?? a.categoria))];
  const s5: Seccion = { id: '5', titulo: 'Límites del informe', bloques: [
    { k: 'tabla', cab: ['Categoría (ISO 14064-1)', 'Incluida', 'Fuentes'], filas: [
      ['1 · Emisiones directas', 'Sí', 'Combustión fija y móvil, emisiones fugitivas de refrigerantes'],
      ['2 · Energía importada', 'Sí', 'Electricidad adquirida (método de ubicación y de mercado, informados por separado)'],
      ['3 · Transporte', 'No', 'Opcional en el Registro balear; no cuantificada'],
      ['4 · Productos usados por la organización', 'No', 'Opcional; no cuantificada'],
      ['5 · Uso de productos de la organización', 'No', 'Opcional; no cuantificada'],
      ['6 · Otras fuentes', 'No', 'Opcional; no cuantificada'],
    ] },
    { k: 'p', texto: `Fuentes con datos en este inventario: ${catsConDatos.length ? catsConDatos.join(', ') : 'ninguna'}.` },
    { k: 'p', texto: 'Criterio de significancia: se consideran insignificantes las fuentes que individualmente representan menos del 3 % de las emisiones y, en conjunto, no más del 5 %.' },
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
    { k: 'p', texto: RESOLUCIONES[anio] ?? `Resolución anual de factores de emisión correspondiente al año ${anio}: pendiente de citar.` },
    ...(f.notas.length ? [{ k: 'lista' as const, items: f.notas.map((n) => `Nota sobre los factores: ${n}`) }] : []),
    ...(usados.length ? [{ k: 'tabla' as const, cab: ['Fuente', 'Unidad', 'CO₂ (kg/ud)', 'CH₄ (g/ud)', 'N₂O (g/ud)'], filas: usados.map((k) => [k, dash(f.unidades[k]), fmt(f.combustibles[k].co2, 'factor'), fmt(f.combustibles[k].ch4, 'factor'), fmt(f.combustibles[k].n2o, 'factor')]), numericas: [2, 3, 4] }] : []),
    ...(gasesUsados.length ? [{ k: 'tabla' as const, cab: ['Gas refrigerante', 'PCA'], filas: gasesUsados.map((k) => [k, fmt(f.pcaRefrigerantes[k], 'pca')]), numericas: [1] }] : []),
    { k: 'h', texto: '7.4 CO₂ biogénico y absorciones' },
    { k: 'p', texto: biogenico ? 'El inventario incluye combustibles de origen biogénico (marcados con **). Su CO₂ biogénico no se suma a las emisiones totales; el CH₄ y el N₂O sí se contabilizan.' : 'No se han identificado emisiones de CO₂ de origen biogénico. No se cuantifican absorciones ni compensaciones en este inventario.' },
    { k: 'h', texto: '7.5 Herramienta de cálculo' },
    { k: 'p', texto: `Cálculo realizado con ${VERSION_MOTOR}, que reproduce las fórmulas de la calculadora oficial del Registro balear. Cada línea conserva el factor aplicado y la fórmula (Anexo C), de modo que el resultado es reproducible.` },
  ] };

  // ── 8
  const s8: Seccion = { id: '8', titulo: 'Incertidumbre', bloques: [
    { k: 'p', texto: 'Se realiza una evaluación cualitativa de la incertidumbre, proporcionada al alcance del inventario.' },
    { k: 'tabla', cab: ['Elemento', 'Incertidumbre', 'Comentario'], filas: [
      ['Datos de actividad de facturas (electricidad, gas, combustibles)', 'Muy baja', 'Proceden de mediciones facturadas; cada dato se contrasta con la factura.'],
      ['Datos introducidos manualmente', 'Media', 'Dependen de la lectura o el registro interno de la organización.'],
      ['Factores de emisión de CO₂', 'Baja', 'Factores oficiales del Registro balear / MITECO.'],
      ['Factores de CH₄ y N₂O', 'Media', 'Mayor variabilidad en los factores por defecto.'],
      ['Recarga de refrigerantes', 'Baja a media', 'Depende del registro de mantenimiento de los equipos.'],
    ] },
  ] };

  // ── 9
  const lineasElec = d.resultados.filter((r) => r.electricidad);
  const ubic = lineasElec.reduce((s, r) => s + (r.electricidad?.kgCO2eUbicacion ?? 0), 0);
  const merc = lineasElec.reduce((s, r) => s + (r.electricidad?.kgCO2eMercado ?? 0), 0);
  const indiceTotal = d.centros.reduce((s, c) => s + (c.indice > 0 ? c.indice : 0), 0);
  const plantillaTotal = comoSeMuestra(d.centros.reduce((s, c) => s + ((c.plantilla ?? 0) > 0 ? comoSeMuestra(c.plantilla!, 'plantilla') : 0), 0), 'plantilla'); // el divisor de los ratios es el valor que se muestra
  const gases = desgloseGases(d.resultados, d.factores);
  const totalGases = gases.reduce((t, x) => t + x.toneladasCO2e, 0);
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
  if (d.anterior) {
    graficos.push({ k: 'grafico', titulo: `Comparación con ${d.anterior.anio} (t CO₂e)`, ...svgBarrasAgrupadas(['Alcance 1', 'Alcance 2', 'Total'], [
      { nombre: String(d.anterior.anio), valores: [d.anterior.a1 / 1000, d.anterior.a2 / 1000, d.anterior.total / 1000] },
      { nombre: String(anio), valores: [tot.kgCO2eAlcance1 / 1000, tot.kgCO2eAlcance2 / 1000, tot.kgCO2eTotal / 1000] },
    ], `Comparación con ${d.anterior.anio}`) });
  }

  const bloques9: Bloque[] = [
    { k: 'h', texto: '9.0 Resumen gráfico' },
    ...graficos,
    { k: 'h', texto: '9.1 Resultados por categoría' },
    { k: 'tabla', cab: ['Categoría', 'Emisiones (t CO₂e)'], filas: [['1 · Emisiones directas (Alcance 1)', tn(tot.kgCO2eAlcance1)], ['2 · Energía importada (Alcance 2, criterio del registro)', tn(tot.kgCO2eAlcance2)], ['Total', tn(tot.kgCO2eTotal)]], numericas: [1], pie: 'Las compensaciones no se restan del inventario (ISO 14064-1); se informarían aparte.' },
    { k: 'grafico', titulo: 'Emisiones por categoría (t CO₂e)', ...svgBarrasHorizontales([{ nombre: '1 · Emisiones directas', t: tot.kgCO2eAlcance1 / 1000 }, { nombre: '2 · Energía importada', t: tot.kgCO2eAlcance2 / 1000 }], 'Emisiones por categoría'), pie: 'Alcance 1 (combustibles, refrigerantes) y Alcance 2 (electricidad) del inventario.' },
    { k: 'h', texto: '9.2 Resultados por tipo de gas' },
    { k: 'tabla', cab: ['Gas', 'Familia', 'Emisión (t del gas)', 'PCA', 'Emisiones (t CO₂e)', '% del total'], filas: [
      ...gases.map((x) => [x.gas, x.familia, fmt(x.toneladasGas, 'gasT'), fmt(x.pca, 'pca'), tn(x.toneladasCO2e * 1000), totalGases > 0 ? pct((x.toneladasCO2e / totalGases) * 100) : '—']),
      ['Total', '', '', '', tn(totalGases * 1000), totalGases > 0 ? pct(100) : '—'],
    ], numericas: [2, 3, 4, 5], pie: 'Cada gas en toneladas del propio gas; las emisiones de CO₂e resultan de multiplicarlas por su potencial de calentamiento global (PCA). Los gases fluorados de las recargas se expresan en CO₂e igual que el CH₄ y el N₂O, con el PCA de cada gas del conjunto de factores utilizado.' },
    { k: 'grafico', titulo: 'Emisiones por gas (t CO₂e)', ...svgBarrasHorizontales(gases.filter((x) => x.toneladasCO2e > 0 || !x.fluorado).map((x) => ({ nombre: x.fluorado ? `${x.gas} (${x.familia})` : x.gas, t: x.toneladasCO2e })), 'Emisiones por gas'), pie: 'Expresadas en t CO₂e con los potenciales de calentamiento del conjunto de factores utilizado.' },
    { k: 'h', texto: '9.3 Electricidad: método de ubicación y método de mercado' },
    { k: 'tabla', cab: ['Método', 'Emisiones (t CO₂e)'], filas: [['Basado en la ubicación (mix de la red)', tn(ubic)], ['Basado en el mercado (garantías de origen / autoconsumo)', tn(merc)]], numericas: [1], pie: 'Se informan por separado conforme al Anexo E de la norma.' },
    { k: 'h', texto: '9.4 Resultados por centro' },
    { k: 'tabla', cab: hayPlantilla ? ['Centro', 'Emisiones (t CO₂e)', 'Estancias', 't CO₂e por estancia', 'Plantilla media', 't CO₂e por trabajador'] : ['Centro', 'Emisiones (t CO₂e)', 'Estancias', 't CO₂e por estancia'], filas: d.centros.map((c) => { const kg = tot.porCentro[c.nombre] ?? 0; const pl = (c.plantilla ?? 0) > 0 ? comoSeMuestra(c.plantilla!, 'plantilla') : null; return [c.nombre, tn(kg), fmt(c.indice > 0 ? c.indice : null, 'entero'), fmt(c.indice > 0 ? kg / 1000 / c.indice : null, 'ratio'), ...(hayPlantilla ? [fmt(pl, 'plantilla'), fmt(pl ? kg / 1000 / pl : null, 'ratio')] : [])]; }), numericas: hayPlantilla ? [1, 2, 3, 4, 5] : [1, 2, 3] },
    { k: 'grafico', titulo: 'Emisiones por centro (t CO₂e)', ...svgBarrasHorizontales(centrosT, 'Emisiones por centro'), pie: 'Emisiones totales de cada centro de trabajo incluido en el inventario.' },
    ...(d.centros.filter((c) => c.indice > 0).length > 1 ? [{ k: 'grafico' as const, titulo: 'Intensidad por estancia (kg CO₂e por estancia)', ...svgBarrasHorizontales(d.centros.filter((c) => c.indice > 0).map((c) => ({ nombre: c.nombre, t: (tot.porCentro[c.nombre] ?? 0) / c.indice })), 'Intensidad por estancia', 2, 'kg'), pie: 'Emisiones del centro divididas entre sus estancias (índice de actividad).' }] : []),
    ...(hayPlantilla && plantillaTotal > 0 ? [{ k: 'p' as const, texto: `Ratio global por trabajador: ${fmt(tot.kgCO2eTotal / 1000 / plantillaTotal, 'ratio')} t CO₂e por trabajador (plantilla media ${fmt(plantillaTotal, 'plantilla')}).` }] : hayPlantilla ? [{ k: 'p' as const, texto: 'No se calcula el ratio por trabajador.' }] : []),
    { k: 'p', texto: indiceTotal > 0 ? `Ratio global: ${fmt(tot.kgCO2eTotal / 1000 / indiceTotal, 'ratio')} t CO₂e por estancia (${fmt(indiceTotal, 'entero')} estancias).` : 'No se calcula el ratio global: no hay índice de actividad.' },
  ];
  if (d.anterior) {
    const v = (a: number, b: number) => (b > 0 ? `${fmt(((a - b) / b) * 100, 'porcentaje', { signo: true })} %` : '—');
    bloques9.push({ k: 'h', texto: `9.5 Comparación con ${d.anterior.anio}` });
    bloques9.push({ k: 'tabla', cab: ['Magnitud', `${d.anterior.anio} (t CO₂e)`, `${anio} (t CO₂e)`, 'Variación'], filas: [
      ['Alcance 1', tn(d.anterior.a1), tn(tot.kgCO2eAlcance1), v(tot.kgCO2eAlcance1, d.anterior.a1)],
      ['Alcance 2', tn(d.anterior.a2), tn(tot.kgCO2eAlcance2), v(tot.kgCO2eAlcance2, d.anterior.a2)],
      ['Total', tn(d.anterior.total), tn(tot.kgCO2eTotal), v(tot.kgCO2eTotal, d.anterior.total)],
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
  const s11: Seccion = { id: '11', titulo: 'Declaración de conformidad y verificación', bloques: [
    { k: 'p', texto: `La organización declara que este inventario de GEI del año ${anio} se ha elaborado conforme a la norma ISO 14064-1:2018 y a los requisitos del Decreto 48/2021 del Registro balear de huella de carbono, en lo que respecta a las categorías 1 y 2.` },
    { k: 'tabla', cab: ['Verificación', 'Dato'], filas: [
      ['Estado', inv.estado === 'verificado' ? 'Verificado' : 'Pendiente de verificación por una entidad acreditada (ISO 14064-3)'],
      ['Entidad verificadora', dash(v?.entidad)], ['Nivel de aseguramiento', dash(v?.nivel)], ['Fecha de la verificación', fechaEs(v?.fecha)], ['Referencia del informe de verificación', dash(v?.referencia)],
    ] },
  ] };

  // ── 12 Anexos
  const anexoA: Bloque = { k: 'tabla', cab: ['Centro', 'Categoría', 'Fuente', 'Contador', 'Periodo', 'Cantidad', 'Ud.', 'Evidencia'], filas: d.actividad.map((a) => [
    a.centro, CATEGORIA[a.categoria] ?? a.categoria, a.fuente || (a.origenElectricidad ? `Electricidad · ${ORIGEN[a.origenElectricidad] ?? a.origenElectricidad}` : 'Electricidad'), dash(a.contador),
    a.periodoDesde ? `${fechaEs(a.periodoDesde)} – ${fechaEs(a.periodoHasta)}` : '—', fmt(a.cantidad, 'actividad'), a.categoria === 'electricidad' ? 'kWh' : a.categoria === 'fugitiva' ? 'kg' : dash(f.unidades[a.fuente] ?? a.unidad), a.documento ?? `Manual: ${a.notas ?? ''}`,
  ]), numericas: [5] };
  const anexoC: Bloque = { k: 'tabla', cab: ['Centro', 'Fuente', 'kg CO₂', 'g CH₄', 'g N₂O', 'kg CO₂e', 'Cálculo'], filas: d.resultados.map((r) => [
    r.linea.centro, r.linea.fuente || 'Electricidad', fmt(r.kgCO2, 'kgCO2e'), fmt(r.gCH4, 'gramos'), fmt(r.gN2O, 'gramos'), fmt(r.kgCO2e, 'kgCO2e'), r.trazabilidad.factorUsado,
  ]), numericas: [2, 3, 4, 5] };
  const s12: Seccion = { id: '12', titulo: 'Anexos', bloques: [
    { k: 'h', texto: 'Anexo A · Datos de actividad' }, anexoA,
    { k: 'h', texto: 'Anexo B · Factores aplicados' }, { k: 'p', texto: 'Los factores y potenciales utilizados figuran en el apartado 7.3 y se conservan íntegros en el inventario (conjunto ' + f.id + ').' },
    { k: 'h', texto: 'Anexo C · Trazabilidad del cálculo por línea' }, anexoC,
    { k: 'h', texto: 'Anexo D · Correspondencia con el contenido del apartado 9.3.1 de la ISO 14064-1' },
    { k: 'tabla', cab: ['Apartado', 'Contenido', 'Se recoge en'], filas: CORRESPONDENCIA_ISO.map(([a, b, c]) => [a, b, c]) },
    { k: 'h', texto: 'Anexo E · Índice de evidencias' },
    { k: 'tabla', cab: ['Documento', 'Tipo', 'Centro', 'Periodo', 'Estado'], filas: d.documentos.map((x) => [x.nombre, x.tipo, x.centro, x.periodoDesde ? `${fechaEs(x.periodoDesde)} – ${fechaEs(x.periodoHasta)}` : '—', x.estado]) },
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
  return { meta, secciones, pendientes };
}
