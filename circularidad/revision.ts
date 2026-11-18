// Informe de revisión anual del Plan de Circularidad: lo evaluado en el año y los cambios respecto al anterior (Ley 3/2022 y guía AETIB).
import type { ModeloInforme, Seccion, Bloque } from '../huella/informe.ts';
import { AREAS, INDICADORES, ORDEN_AREAS } from './catalogo.ts';
import type { Plan } from './plan.ts';
import { TIPOS_REGISTRO, TRIMESTRES, cumplimiento, evolucion, nombreArea, periodoAccion, progresoAccion, progresoObjetivo, progresoPlan, resumenCumplimiento, responsableDelPlan } from './plan.ts';
import type { OpcionesInformeCirc } from './informe.ts';

const num = (v: number, d = 2) => v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const fechaEs = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const fmt = (v: number | undefined, d: number) => (v === undefined ? '—' : num(v, d));
const TEND = { mejora: 'Mejora', empeora: 'Empeora', igual: 'Sin cambios', 'sin-datos': 'Sin datos' } as const;

export function construirInformeRevision(plan: Plan, o: OpcionesInformeCirc): ModeloInforme {
  const f = plan.ficha; const anio = o.anioEvaluacion; const ant = anio - 1;
  const aniosConDatos = Object.keys(plan.datos).map(Number).sort((a, b) => a - b);
  const hayAnterior = aniosConDatos.includes(ant);
  const ev = evolucion(plan, hayAnterior ? [ant, anio] : [anio]);
  const rev = plan.revisiones?.[anio];
  const segCerrado = !!plan.seguimiento[anio]?.cerrado;

  const s1: Seccion = { id: '1', titulo: 'Objeto de la revisión', bloques: [
    { k: 'p', texto: `Este documento recoge la revisión anual del Plan de Circularidad de ${f.establecimiento} correspondiente a ${anio}. La Ley 3/2022 exige recalcular cada año los indicadores de la evaluación circular y mantener la trazabilidad de su evolución; el plan de acción se mantiene durante su vigencia (${f.vigenciaDesde}-${f.vigenciaHasta}) y se renueva como máximo cada cinco años.` },
    { k: 'tabla', cab: ['Campo', 'Dato'], filas: [
      ['Establecimiento', f.establecimiento], ['Empresa', f.empresa || '—'], ['Año revisado', String(anio)], ['Vigencia del plan', `${f.vigenciaDesde}-${f.vigenciaHasta}`],
      ['Responsable del plan', responsableDelPlan(f) || '—'], ['Fecha de la revisión', fechaEs(o.hoy)], ['Versión del plan', String(plan.version)],
    ] },
  ] };

  const b2: Bloque[] = [];
  const conDato = ev.filter((x) => x.valores[anio] !== undefined);
  const cuenta = (t: string) => ev.filter((x) => x.tendencia === t).length;
  b2.push({ k: 'p', texto: hayAnterior
    ? `Se han recalculado los indicadores de ${anio} y se comparan con ${ant}. De ${INDICADORES.length} indicadores, ${conDato.length} tienen dato en ${anio}: ${cuenta('mejora')} mejoran, ${cuenta('empeora')} empeoran y ${cuenta('igual')} no cambian respecto a ${ant}.`
    : `Se han recalculado los indicadores de ${anio}. No hay datos de ${ant} con los que compararlos; ${anio} sirve como punto de partida.` });
  for (const a of ORDEN_AREAS) {
    const filas = ev.filter((x) => x.area === a);
    b2.push({ k: 'h', texto: `Área prioritaria: ${AREAS[a].nombre}` });
    b2.push(hayAnterior
      ? { k: 'tabla', cab: ['Indicador', 'Unidad', String(ant), String(anio), 'Variación', 'Valoración'], numericas: [2, 3, 4], filas: filas.map((x) => {
          const v0 = x.valores[ant], v1 = x.valores[anio];
          return [x.nombre, x.unidad, fmt(v0, x.decimales), fmt(v1, x.decimales), v0 !== undefined && v1 !== undefined && v0 !== 0 ? `${(v1 - v0) / Math.abs(v0) > 0 ? '+' : ''}${num(((v1 - v0) / Math.abs(v0)) * 100, 1)} %` : '—', TEND[x.tendencia]];
        }) }
      : { k: 'tabla', cab: ['Indicador', 'Unidad', String(anio)], numericas: [2], filas: filas.map((x) => [x.nombre, x.unidad, fmt(x.valores[anio], x.decimales)]) });
  }
  const s2: Seccion = { id: '2', titulo: `Evaluación circular de ${anio}${hayAnterior ? ` frente a ${ant}` : ''}`, bloques: b2 };

  const b3: Bloque[] = [
    { k: 'p', texto: `Avance global del plan de acción en ${anio}: ${num(progresoPlan(plan, anio) * 100, 0)} %. El seguimiento de ${anio} ${segCerrado ? 'está cerrado' : 'todavía no está cerrado'}.` },
  ];
  if (plan.objetivos.length) {
    b3.push({ k: 'tabla', cab: ['Cód.', 'Área', 'Objetivo', 'Acciones', 'Avance'], numericas: [3, 4], filas: plan.objetivos.map((x) => {
      const s = plan.seguimiento[anio]?.acciones ?? {};
      const hechas = x.acciones.filter((a) => progresoAccion(s[a.id]) === 1).length;
      return [x.codigo, nombreArea(x.area), x.descripcion, `${hechas}/${x.acciones.length}`, `${num(progresoObjetivo(plan, x, anio) * 100, 0)} %`];
    }) });
    const pend = plan.objetivos.flatMap((x) => x.acciones.filter((a) => progresoAccion(plan.seguimiento[anio]?.acciones[a.id]) < 1).map((a) => [a.codigo, a.descripcion, a.responsable || '—', periodoAccion(a), `${TRIMESTRES.filter((t) => plan.seguimiento[anio]?.acciones[a.id]?.[t].cumple).length}/4`]));
    if (pend.length) { b3.push({ k: 'h', texto: 'Acciones sin completar en el año' }); b3.push({ k: 'tabla', cab: ['Cód.', 'Acción', 'Responsable', 'Periodo', 'Trimestres'], filas: pend }); }
  } else b3.push({ k: 'nota', texto: 'No hay objetivos definidos en el plan de acción.' });
  const s3: Seccion = { id: '3', titulo: 'Seguimiento del plan de acción', bloques: b3 };

  const filasC = cumplimiento(plan, `${anio}-12-31`); const rc = resumenCumplimiento(filasC);
  const alertas = filasC.filter((x) => x.alerta);
  const s4: Seccion = { id: '4', titulo: 'Cumplimiento legal', bloques: [
    { k: 'p', texto: `A 31 de diciembre de ${anio}, de ${rc.exigibles} requisitos exigibles constan como cumplidos ${rc.cumplen}${alertas.length ? ` y ${alertas.length} requieren atención` : ''}.` },
    ...(alertas.length ? [{ k: 'lista' as const, items: alertas.map((x) => `${x.texto} (${x.norma})`) }] : []),
  ] };

  const delAnio = (plan.historial ?? []).filter((r) => r.fecha.startsWith(String(anio)));
  const accionesFin = plan.objetivos.flatMap((x) => x.acciones.filter((a) => (a.fin ?? '').startsWith(String(anio))).map((a) => `${a.codigo} · ${a.descripcion} (fin ${fechaEs(a.fin!)})`));
  const objVence = plan.objetivos.filter((x) => x.plazo === String(anio)).map((x) => `${x.codigo} · ${x.descripcion}`);
  const s5: Seccion = { id: '5', titulo: `Cambios respecto a ${ant}`, bloques: [
    { k: 'h', texto: 'Modificaciones registradas en el año' },
    ...(delAnio.length ? [{ k: 'tabla' as const, cab: ['Fecha', 'Tipo', 'Versión', 'Descripción'], filas: delAnio.map((r) => [fechaEs(r.fecha), TIPOS_REGISTRO[r.tipo], r.version || '—', r.descripcion]) }] : [{ k: 'nota' as const, texto: `No constan modificaciones registradas en ${anio}.` }]),
    { k: 'h', texto: 'Acciones que finalizan en el año' },
    accionesFinBloque(accionesFin),
    { k: 'h', texto: 'Objetivos cuyo plazo vence en el año' },
    accionesFinBloque(objVence),
  ] };

  const s6: Seccion = { id: '6', titulo: 'Conclusiones y propuestas de mejora', bloques: [
    { k: 'h', texto: 'Conclusiones de la revisión' }, { k: 'p', texto: rev?.conclusiones?.trim() || 'Pendiente de redactar.' },
    { k: 'h', texto: 'Propuestas de mejora para el próximo año' }, { k: 'p', texto: rev?.propuestas?.trim() || 'Pendiente de redactar.' },
  ] };

  return {
    meta: { titulo: 'Informe de revisión anual del plan de circularidad', subtitulo: f.establecimiento, norma: 'Ley 3/2022, de 15 de junio, de medidas urgentes para la sostenibilidad y la circularidad del turismo de les Illes Balears', estado: segCerrado ? 'REVISADO' : 'BORRADOR', edicion: `Revisión ${anio} · ${fechaEs(o.hoy)}`, fecha: o.hoy, organizacion: f.empresa, anio, codigo: 'A-08-A' },
    secciones: [s1, s2, s3, s4, s5, s6],
    pendientes: [
      ...(hayAnterior ? [] : [`No hay datos de ${ant}: no se puede comparar con el año anterior.`]),
      ...(segCerrado ? [] : [`El seguimiento de ${anio} no está cerrado.`]),
      ...(rev?.conclusiones?.trim() ? [] : ['Faltan las conclusiones de la revisión.']),
      ...(rev?.propuestas?.trim() ? [] : ['Faltan las propuestas de mejora.']),
    ],
  };
}
function accionesFinBloque(items: string[]): Bloque { return items.length ? { k: 'lista', items } : { k: 'nota', texto: 'Ninguno.' }; }
