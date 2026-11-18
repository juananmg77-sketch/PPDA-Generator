// Informe del Plan de Circularidad (Ley 3/2022 y guía AETIB): de los datos del plan a un documento estructurado que se renderiza en HTML/PDF y Word con la misma maquinaria que Huella.
import type { Bloque, ModeloInforme, Seccion } from '../huella/informe.ts';
import { svgBarrasAgrupadas } from '../huella/graficos.ts';
import { AREAS, CATEGORIAS_HOTEL, INDICADORES, ORDEN_AREAS, tablaCamas } from './catalogo.ts';
import type { Plan } from './plan.ts';
import { TIPOS_REGISTRO } from './plan.ts';
import { TRIMESTRES, periodoAccion, camas, cumplimiento, evolucion, progresoAccion, progresoObjetivo, progresoPlan, valorIndicador, nombreArea, responsableDelPlan } from './plan.ts';

const num = (v: number, d = 2) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const fechaEs = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const dash = (x?: string | number | null) => (x === null || x === undefined || x === '' ? '—' : String(x));
const ESTADO_REQ = { cumple: 'Cumple', parcial: 'Parcial', no: 'No cumple', na: 'No aplica', pendiente: 'Pendiente de comprobar' } as const;

export interface OpcionesInformeCirc { anioEvaluacion: number; hoy: string; emitidoPor?: string }

export function construirInformeCirculardad(plan: Plan, o: OpcionesInformeCirc): ModeloInforme {
  const f = plan.ficha;
  const anios = Object.keys(plan.datos).map(Number).sort((a, b) => a - b).filter((a) => a <= o.anioEvaluacion);
  const ev = evolucion(plan, anios);
  const fmt = (v: number | undefined, d: number) => (v === undefined ? '—' : num(v, d));

  const s1: Seccion = { id: '1', titulo: 'Introducción', bloques: [
    { k: 'p', texto: 'El Plan de Circularidad recoge las prioridades y líneas de acción definidas por el establecimiento, integrando pautas de planificación, consumo y producción y el compromiso circular en su estrategia de negocio, sus procesos internos y la relación con sus grupos de interés. Se elabora en cumplimiento del capítulo II de la Ley 3/2022, de 15 de junio, de medidas urgentes para la sostenibilidad y la circularidad del turismo de les Illes Balears, siguiendo la guía de la Agència d’Estratègia Turística de les Illes Balears (AETIB).' },
    { k: 'p', texto: 'Consta de la evaluación circular, que mide mediante indicadores el progreso de la estrategia y se recalcula cada año, y de la planificación circular, que define objetivos y acciones y se renueva como máximo cada cinco años.' },
  ] };

  const s2: Seccion = { id: '2', titulo: 'Datos del establecimiento', bloques: [
    { k: 'h', texto: 'Compromiso con los requisitos legales' },
    { k: 'p', texto: 'La empresa suscribe todos los compromisos colectivos de reducción en la generación de residuos de la Ley 8/2019, de residuos y suelos contaminados, y en la reducción de emisiones de gases de efecto invernadero de la Ley 10/2019, de cambio climático y transición energética, así como toda la normativa que le afecte en materia de circularidad.' },
    { k: 'h', texto: 'Ficha del establecimiento' },
    { k: 'tabla', cab: ['Campo', 'Dato'], filas: [
      ['Nombre del establecimiento', f.establecimiento], ['Empresa a la que pertenece', f.empresa], ['Dirección', f.direccion], ['Categoría', CATEGORIAS_HOTEL[f.categoria] ?? f.categoriaTexto],
      ['Actividad y servicios', f.actividad], ['Periodo de apertura', f.apertura], ['Número de habitaciones', dash(f.habitaciones)], ['Capacidad (plazas)', dash(f.capacidad)],
      ['Pernoctaciones anuales (promedio)', f.pernoctaciones ? num(f.pernoctaciones, 0) : '—'], ['Área total (m²)', f.superficie ? num(f.superficie, 0) : '—'],
      ['Responsable del plan', responsableDelPlan(f) || '—'], ['Duración prevista del plan', `${f.vigenciaDesde}-${f.vigenciaHasta} (revisable anualmente)`], ['Fecha de publicación del informe', fechaEs(f.fechaPublicacion)],
    ] },
    { k: 'h', texto: 'Estructura organizativa y responsables de las líneas de acción' },
    ...((f.equipo ?? []).length
      ? [{ k: 'tabla' as const, cab: ['Departamento', 'Nombre', 'Cargo', 'Función en el plan', 'Contacto'], filas: f.equipo.map((m) => [m.departamento || '—', m.nombre || '—', m.cargo || '—', m.funcion, m.email || '—']) }]
      : [{ k: 'nota' as const, texto: 'Sin definir: añada el equipo responsable en la ficha del establecimiento.' }]),
    { k: 'h', texto: 'Disponibilidad del plan' },
    { k: 'tabla', cab: ['A disposición de', 'Cómo y dónde'], filas: [
      ['Inspección de la administración turística', plan.disponibilidad?.inspeccion || '—'],
      ['Representantes legales de las personas trabajadoras', plan.disponibilidad?.representantes || '—'],
      ['Personas trabajadoras (consulta)', plan.disponibilidad?.trabajadores || '—'],
    ] },
    { k: 'h', texto: 'Registro de modificaciones, revisiones y renovaciones' },
    ...((plan.historial ?? []).length
      ? [{ k: 'tabla' as const, cab: ['Fecha', 'Tipo', 'Versión', 'Descripción', 'Responsable'], filas: [...(plan.historial ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha)).map((r) => [fechaEs(r.fecha), TIPOS_REGISTRO[r.tipo], r.version || '—', r.descripcion, r.autor || '—']) }]
      : [{ k: 'nota' as const, texto: 'Aún no hay registros. Anote la elaboración del plan y cada revisión, modificación o renovación.' }]),
  ] };

  // ── 3 Evaluación circular
  const b3: Bloque[] = [
    { k: 'p', texto: `Evaluación circular de ${o.anioEvaluacion}${anios.length > 1 ? `, con la evolución desde ${anios[0]}` : ''}. Metodología: cálculo de los indicadores definidos en la guía AETIB para la Ley 3/2022; la huella de carbono se calcula conforme a la norma UNE-EN ISO 14064-1 y al Registro balear de la huella de carbono.` },
  ];
  for (const area of ORDEN_AREAS) {
    const filas = ev.filter((x) => x.area === area);
    b3.push({ k: 'h', texto: `Área prioritaria: ${AREAS[area].nombre}` });
    b3.push({ k: 'tabla', cab: ['Indicador', 'Unidad', ...anios.map(String)], filas: filas.map((x) => [x.nombre, x.unidad, ...anios.map((a) => fmt(x.valores[a], x.decimales))]), numericas: anios.map((_, i) => i + 2) });
    // Un gráfico de barras agrupadas por año con los indicadores en % (comparables entre sí)
    const porc = filas.filter((x) => x.unidad === '%' && anios.some((a) => x.valores[a] !== undefined));
    if (porc.length > 0 && anios.length > 0) {
      b3.push({ k: 'grafico', titulo: `${AREAS[area].nombre}: evolución de los indicadores (%)`, ...svgBarrasAgrupadas(porc.map((x) => x.nombre.length > 32 ? x.nombre.slice(0, 31) + '…' : x.nombre), anios.map((a) => ({ nombre: String(a), valores: porc.map((x) => x.valores[a] ?? 0) })), `${AREAS[area].nombre}: indicadores en %`, '%'), pie: 'Valores en %; cuanto más alto, mejor salvo indicación en contrario en la tabla.' });
    }
  }
  const e1 = ev.find((x) => x.id === 'E1')!;
  if (anios.some((a) => e1.valores[a] !== undefined)) {
    b3.push({ k: 'grafico', titulo: 'Huella de carbono por pernoctación (kg CO₂e)', ...svgBarrasAgrupadas(['kg CO₂e por pernoctación'], anios.filter((a) => e1.valores[a] !== undefined).map((a) => ({ nombre: String(a), valores: [e1.valores[a]!] })), 'Huella por pernoctación', 'kg CO₂e'), pie: 'Huella de carbono anual dividida entre las pernoctaciones (Registro balear, ISO 14064-1).' });
  }
  b3.push({ k: 'h', texto: 'Certificación energética y acciones con los clientes' });
  b3.push({ k: 'p', texto: `Certificado de eficiencia energética (RD 390/2021): letra ${dash(plan.letraCertificado[o.anioEvaluacion])}, ${fmt(valorIndicador(plan, 'E2', o.anioEvaluacion), 0)} kWh/m²·año.` });
  b3.push({ k: 'lista', items: plan.accionesClientes.length ? plan.accionesClientes : ['Sin acciones registradas.'] });
  const s3: Seccion = { id: '3', titulo: 'Evaluación circular', bloques: b3 };

  // ── 4 Planificación
  const b4: Bloque[] = [
    { k: 'p', texto: 'La planificación circular parte de un análisis interno (revisión de los indicadores, cadena de valor y grupos de interés, recursos disponibles), define objetivos medibles vinculados a los indicadores y los concreta en un plan de acción con responsables, recursos y plazos.' },
    { k: 'h', texto: 'Objetivos generales' },
    { k: 'tabla', cab: ['Cód.', 'Área prioritaria', 'Objetivo', 'Indicador', 'Meta', 'Plazo'], filas: plan.objetivos.map((x) => [x.codigo, nombreArea(x.area), x.descripcion, INDICADORES.find((i) => i.id === x.indicadorId)?.nombre ?? x.indicadorId, x.meta, x.plazo]) },
  ];
  for (const x of plan.objetivos) {
    b4.push({ k: 'h', texto: `Objetivo ${x.codigo} · ${x.descripcion}` });
    b4.push({ k: 'tabla', cab: ['Campo', 'Contenido'], filas: [
      ['Área prioritaria', nombreArea(x.area)], ['Línea base', x.lineaBase], ['Meta y plazo', `${x.meta} (${x.plazo})`], ['Responsable', x.responsable], ['Recursos necesarios', x.recursos], ['Inversión', x.inversion],
    ] });
    if (x.acciones.length) {
      const nomInd = (id: string) => INDICADORES.find((i) => i.id === id)?.nombre ?? id;
      b4.push({ k: 'tabla', cab: ['Cód.', 'Acción', 'Responsable', 'Periodo', 'Indicadores relacionados', 'Recursos', 'Inversión'], filas: x.acciones.map((a) => [a.codigo, a.descripcion, a.responsable || '—', periodoAccion(a), (a.indicadores ?? []).map(nomInd).join('; ') || '—', a.recursos || '—', a.inversion || '—']) });
    }
  }
  const s4: Seccion = { id: '4', titulo: 'Planificación circular', bloques: b4 };

  // ── 5 Seguimiento
  const sa = plan.seguimiento[o.anioEvaluacion];
  const marca = (cumple: boolean | undefined) => (cumple ? '●' : '○');
  const b5: Bloque[] = [
    { k: 'p', texto: `Seguimiento trimestral del plan de acción en ${o.anioEvaluacion}. Progreso global: ${num(progresoPlan(plan, o.anioEvaluacion) * 100, 0)} %. Leyenda: ● trimestre cumplido, ○ no cumplido o pendiente.` },
    { k: 'tabla', cab: ['Cód.', 'Objetivo / acción', 'Resp.', 'T1', 'T2', 'T3', 'T4', 'Avance'], filas: plan.objetivos.flatMap((x) => [
      [x.codigo, x.descripcion, x.responsable, '', '', '', '', `${num(progresoObjetivo(plan, x, o.anioEvaluacion) * 100, 0)} %`],
      ...x.acciones.map((a) => { const s = sa?.acciones[a.id]; return [a.codigo, a.descripcion, a.responsable, ...TRIMESTRES.map((t) => marca(s?.[t].cumple)), `${num(progresoAccion(s) * 100, 0)} %`]; }),
    ]), numericas: [7] },
  ];
  const s5: Seccion = { id: '5', titulo: 'Seguimiento del plan de acción', bloques: b5 };

  // ── 6 Cumplimiento
  const filasC = cumplimiento(plan, o.hoy);
  const cm = camas(plan, o.anioEvaluacion);
  const b6: Bloque[] = [
    { k: 'p', texto: `Situación frente a los requisitos obligatorios de la Ley 3/2022 y normativa asociada a ${fechaEs(o.hoy)}.` },
    { k: 'tabla', cab: ['Requisito', 'Norma', 'Exigible desde', 'Estado', 'Evidencia / nota'], filas: filasC.map((r) => [r.texto, r.norma, fechaEs(r.desde), ESTADO_REQ[r.estado], [r.evidencia, r.nota].filter(Boolean).join(' · ') || '—']) },
    { k: 'h', texto: 'Camas elevables' },
    { k: 'p', texto: `Categoría ${CATEGORIAS_HOTEL[f.categoria]}: en ${o.anioEvaluacion} se exige al menos el ${cm.exigido} % de camas elevables; instalado: ${cm.instalado === undefined ? 'sin dato' : `${cm.instalado} %`}${cm.cumple === null ? '' : cm.cumple ? ' (cumple)' : ' (por debajo de lo exigido)'}.` },
    { k: 'tabla', cab: ['Categoría', '2023', '2024', '2025', '2026', '2027', '2028'], filas: tablaCamas().map((t) => [t.nombre, ...t.porAnio.map((p) => (p === null ? '—' : `${p} %`))]), numericas: [1, 2, 3, 4, 5, 6], pie: 'Porcentaje mínimo de camas elevables por categoría. Pendiente de contraste final con el texto legal.' },
  ];
  const s6: Seccion = { id: '6', titulo: 'Cumplimiento de requisitos obligatorios', bloques: b6 };

  const s7: Seccion = { id: '7', titulo: 'Revisión y vigencia', bloques: [
    { k: 'p', texto: `El plan tiene una vigencia de ${f.vigenciaDesde} a ${f.vigenciaHasta} (máximo cinco años) y se revisa anualmente: cada año se recalculan los indicadores y se documenta el seguimiento. El documento está a disposición de la administración turística y de los representantes legales de las personas trabajadoras, y puede ser consultado por la plantilla.` },
  ] };

  return {
    meta: { titulo: 'Plan de circularidad', subtitulo: f.establecimiento, norma: 'Ley 3/2022, de 15 de junio, de medidas urgentes para la sostenibilidad y la circularidad del turismo de les Illes Balears', estado: plan.cerrado ? 'APROBADO' : 'BORRADOR', edicion: `Edición ${plan.version} · ${fechaEs(o.hoy)}`, fecha: o.hoy, organizacion: f.empresa, anio: o.anioEvaluacion, codigo: 'A-08-A' },
    secciones: [s1, s2, s3, s4, s5, s6, s7],
    pendientes: [
      ...(plan.objetivos.length === 0 ? ['No hay objetivos definidos en la planificación.'] : []),
      ...(plan.disponibilidad?.inspeccion && plan.disponibilidad?.representantes && plan.disponibilidad?.trabajadores ? [] : ['Indique cómo está el plan a disposición de la inspección, los representantes de los trabajadores y los trabajadores.']),
      ...INDICADORES.filter((i) => valorIndicador(plan, i.id, o.anioEvaluacion) === undefined).map((i) => `Falta el dato del indicador «${i.nombre}» en ${o.anioEvaluacion}.`),
    ],
  };
}
