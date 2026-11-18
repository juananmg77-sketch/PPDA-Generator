import { test } from 'node:test';
import assert from 'node:assert/strict';
import { camasElevablesExigidas } from '../catalogo.ts';
import { planDemo } from '../demo.ts';
import { camas, completitud, cumplimiento, evolucion, progresoAccion, progresoObjetivo, progresoPlan, resumenCumplimiento, valorIndicador, migrarPlan, responsableDelPlan } from '../plan.ts';
import { construirInformeCirculardad } from '../informe.ts';
import { informeAHtml } from '../../huella/informeHtml.ts';

test('los indicadores se calculan con las fórmulas de la guía', () => {
  const p = planDemo();
  assert.equal(Math.round(valorIndicador(p, 'E1', 2022)! * 100) / 100, 18.71); // 1.150.000 kg / 61.460 pernoctaciones
  assert.equal(Math.round(valorIndicador(p, 'AL1', 2022)! * 10) / 10, 8.5); // km 0 sobre gasto en alimentos y bebidas
  assert.equal(Math.round(valorIndicador(p, 'G2', 2024)! * 10) / 10, 74.7);
  assert.equal(valorIndicador(p, 'A1', 2022), 0);
  assert.equal(valorIndicador(p, 'E3', 2030), undefined); // sin datos
});

test('un denominador cero o ausente no produce un valor', () => {
  const p = planDemo(); p.datos[2025] = { ren_kwh: 10, cons_kwh: 0 };
  assert.equal(valorIndicador(p, 'E3', 2025), undefined);
  p.ficha.pernoctaciones = undefined; p.datos[2025].huella_kg = 100;
  assert.equal(valorIndicador(p, 'E1', 2025), undefined);
});

test('la evolución distingue mejora y empeora según el sentido de cada indicador', () => {
  const ev = evolucion(planDemo(), [2022, 2023, 2024]);
  const t = (id: string) => ev.find((x) => x.id === id)!.tendencia;
  assert.equal(t('E1'), 'mejora'); // baja la huella
  assert.equal(t('AL1'), 'mejora'); // sube el km 0
  assert.equal(t('A2'), 'mejora'); // baja el consumo de agua
});

test('camas elevables: porcentaje exigido por categoría y año', () => {
  assert.equal(camasElevablesExigidas('4', 2023), 20);
  assert.equal(camasElevablesExigidas('4', 2028), 100);
  assert.equal(camasElevablesExigidas('5', 2030), 100);
  assert.equal(camasElevablesExigidas('1-3', 2023), 0);
  assert.equal(camasElevablesExigidas('1-3', 2025), 30);
  const c = camas(planDemo(), 2024); assert.equal(c.exigido, 30); assert.equal(c.cumple, true);
});

test('el progreso del plan sigue los trimestres cumplidos como en el seguimiento del PPDA', () => {
  const p = planDemo();
  assert.equal(progresoAccion(p.seguimiento[2024].acciones.a1), 1);
  assert.equal(progresoAccion(p.seguimiento[2024].acciones.a3), 0);
  assert.equal(progresoAccion(undefined), 0);
  const o1 = p.objetivos[0];
  assert.equal(progresoObjetivo(p, o1, 2024), (1 + 0.75 + 0 + 1) / 4);
  assert.ok(progresoPlan(p, 2024) > 0.5 && progresoPlan(p, 2024) < 1);
});

test('el cumplimiento marca como alerta lo exigible que no se cumple y no lo futuro', () => {
  const p = planDemo();
  const hoy = cumplimiento(p, '2026-11-18');
  assert.ok(hoy.find((f) => f.id === 'q5')!.alerta); // gasoil exigible desde mayo de 2026 y no cumple
  assert.ok(hoy.find((f) => f.id === 'q4')!.alerta); // parcial
  const antes = cumplimiento(p, '2026-01-01');
  assert.equal(antes.find((f) => f.id === 'q5')!.exigible, false);
  assert.equal(antes.find((f) => f.id === 'q5')!.alerta, false);
  const r = resumenCumplimiento(hoy); assert.equal(r.alertas, 2); assert.equal(r.proximos, 0);
});

test('la completitud cuenta los indicadores con dato por área', () => {
  const c = completitud(planDemo(), 2024);
  assert.equal(c.energia.con, 5); assert.equal(c.energia.total, 5); assert.equal(c.gobernanza.con, c.gobernanza.total);
});

test('el informe del plan tiene las secciones de la guía, gráficos y se vuelca a HTML', () => {
  const m = construirInformeCirculardad(planDemo(), { anioEvaluacion: 2024, hoy: '2026-11-18' });
  assert.deepEqual(m.secciones.map((s) => s.titulo), ['Introducción', 'Datos del establecimiento', 'Evaluación circular', 'Planificación circular', 'Seguimiento del plan de acción', 'Cumplimiento de requisitos obligatorios', 'Revisión y vigencia']);
  assert.ok(m.secciones[2].bloques.filter((b) => b.k === 'grafico').length >= 4);
  assert.equal(m.pendientes.length, 0);
  const html = informeAHtml(m);
  assert.match(html, /Hotel Mediterráneo Playa/); assert.match(html, /<svg/); assert.match(html, /Ley 3\/2022/);
});

test('el equipo es estructurado y los planes con texto libre se migran', () => {
  const d = planDemo();
  assert.equal(responsableDelPlan(d.ficha), 'Nombre Apellidos · Responsable de Calidad');
  const html = informeAHtml(construirInformeCirculardad(d, { anioEvaluacion: 2024, hoy: '2026-11-18' }));
  assert.match(html, /Función en el plan/); assert.match(html, /Responsable línea Energía/);
  const viejo = { ...d, ficha: { ...d.ficha, equipo: undefined, responsablePlan: 'Responsable de Calidad · Ana Pérez', estructura: 'Director: Luis Gómez\nChef: Marta Ruiz' } } as unknown as typeof d;
  const m = migrarPlan(viejo);
  assert.equal(m.ficha.equipo.length, 3);
  assert.equal(responsableDelPlan(m.ficha), 'Ana Pérez · Responsable de Calidad');
  assert.deepEqual(m.ficha.equipo[1], { ...m.ficha.equipo[1], cargo: 'Director', nombre: 'Luis Gómez' });
});
