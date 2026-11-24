import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_RECALCULO_POR_DEFECTO, compararAnios, tipoDeFuente, configRecalculo, evaluarRecalculo, ratioEstancia, textoRecalculo, validarAnioBase, variacion } from '../anioBase.ts';
import type { AnioBaseDef, ResumenAnio } from '../anioBase.ts';

const r = (anio: number, o: Partial<ResumenAnio> = {}): ResumenAnio => ({ anio, porCategoria: { 1: 40, 2: 60 }, total: 100, porFuente: { Electricidad: 60, 'Gas natural (kWhPCS)*': 40 }, estancias: 10000, plantilla: 50, factoresId: 'calculadora-2023.2@2023', centros: ['Hotel A'], factores: { Electricidad: 0.374, 'Gas natural (kWhPCS)*': 0.182 }, ...o });
const c = CONFIG_RECALCULO_POR_DEFECTO;

test('año base: vinculado a un inventario o manual con origen, evidencia y justificación', () => {
  const ok: AnioBaseDef = { anio: 2023, inventarioId: 'i0', justificacion: 'Primer año con datos completos.' };
  assert.deepEqual(validarAnioBase(ok), []);
  assert.ok(validarAnioBase({ ...ok, justificacion: ' ' }).some((x) => /justificación/.test(x)));
  const manual: AnioBaseDef = { anio: 2019, manual: r(2019), justificacion: 'Año previo a la pandemia.' };
  const inc = validarAnioBase(manual).join('|');
  assert.match(inc, /origen/); assert.match(inc, /evidencia/);
  assert.deepEqual(validarAnioBase({ ...manual, origen: 'Informe verificado 2019', evidenciaUrl: 'https://x/y.pdf' }), []);
  assert.ok(validarAnioBase({ anio: 2019, justificacion: 'x' }).some((x) => /vincular/.test(x)));
});
test('comparación base · anterior · actual por categoría, fuente y ratios, en t y en %', () => {
  const cmp = compararAnios(r(2019, { total: 80, porCategoria: { 1: 30, 2: 50 }, porFuente: { Electricidad: 50, 'Gas natural (kWhPCS)*': 30 } }), r(2023), r(2024, { total: 90, porCategoria: { 1: 35, 2: 55 }, porFuente: { Electricidad: 55, 'Gas natural (kWhPCS)*': 35 }, estancias: 9000 }), { 1: '1 · Directas', 2: '2 · Energía' });
  const tot = cmp.categorias.find((x) => x.concepto === 'Total')!;
  assert.equal(tot.base, 80); assert.equal(tot.anterior, 100); assert.equal(tot.actual, 90);
  assert.equal(tot.vsBase, 12.5); assert.equal(tot.vsAnterior, -10);
  assert.equal(cmp.categorias[0].concepto, '1 · Directas');
  assert.equal(cmp.fuentes.length, 2);
  assert.equal(cmp.ratios[0].actual, 0.01); assert.ok(Math.abs(cmp.ratios[0].vsAnterior! - 0) < 1e-9);
  // sin año anterior: sus columnas son null
  const sin = compararAnios(r(2019), null, r(2024));
  assert.equal(sin.categorias[0].anterior, null); assert.equal(sin.categorias[0].vsAnterior, null);
  assert.equal(variacion(5, 0), null); assert.equal(ratioEstancia(r(2024, { estancias: null })), null);
});
test('recálculo: cambio de límites por alta o baja de centros', () => {
  const ev = evaluarRecalculo(r(2019), r(2024, { centros: ['Hotel A', 'Hotel B'] }), c, { metodologiaCambiada: false, decision: null, motivo: null });
  assert.equal(ev.disparadores[0].regla, 'limites'); assert.match(ev.disparadores[0].detalle[0], /Alta de «Hotel B»/);
  assert.equal(ev.exigeDecision, true); assert.equal(ev.incidencias.length, 1);
  const baja = evaluarRecalculo(r(2019, { centros: ['Hotel A', 'Hotel C'] }), r(2024), c, { metodologiaCambiada: false, decision: null, motivo: null });
  assert.match(baja.disparadores[0].detalle[0], /Baja de «Hotel C»/);
});
test('recálculo: cambio de factor o PCA por encima del umbral configurable (5 % por defecto)', () => {
  const act = r(2024, { factores: { Electricidad: 0.348, 'Gas natural (kWhPCS)*': 0.185 } });
  const ev = evaluarRecalculo(r(2023), act, c, { metodologiaCambiada: false, decision: null, motivo: null });
  const d = ev.disparadores.find((x) => x.regla === 'factores')!;
  assert.equal(d.detalle.length, 1); assert.match(d.detalle[0], /Electricidad: -7,0 %/); // gas: +1,6 %, no llega
  assert.equal(evaluarRecalculo(r(2023), act, configRecalculo({ umbralFactor: 10 }), { metodologiaCambiada: false, decision: null, motivo: null }).disparadores.length, 0);
  assert.equal(evaluarRecalculo(r(2023), act, configRecalculo({ reglas: { factores: false } as never }), { metodologiaCambiada: false, decision: null, motivo: null }).disparadores.length, 0);
});
test('recálculo: metodología declarada y reglas no evaluables con un año base manual sin detalle', () => {
  assert.ok(evaluarRecalculo(r(2023), r(2024), c, null).noEvaluables.some((x) => /metodología/.test(x)));
  const m = evaluarRecalculo(r(2023), r(2024), c, { metodologiaCambiada: true, decision: null, motivo: null });
  assert.equal(m.disparadores[0].regla, 'metodologia');
  const manual = evaluarRecalculo(r(2019, { centros: null, factores: null }), r(2024), c, { metodologiaCambiada: false, decision: null, motivo: null });
  assert.equal(manual.noEvaluables.length, 2); assert.equal(manual.exigeDecision, false);
  assert.equal(evaluarRecalculo(null, r(2024), c, null).disparadores.length, 0);
});
test('la decisión documentada (y su motivo) aparece en el texto; sin ella es incidencia', () => {
  const act = r(2024, { centros: ['Hotel A', 'Hotel B'] });
  const sin = evaluarRecalculo(r(2019), act, c, { metodologiaCambiada: false, decision: null, motivo: null });
  assert.match(textoRecalculo(sin, null, c).join(' '), /Falta documentar la decisión/);
  const dec = { metodologiaCambiada: false, decision: 'recalcula' as const, motivo: 'Se incorpora el Hotel B a los límites.', fecha: '2025-03-05', usuario: 'Consultor' };
  const con = evaluarRecalculo(r(2019), act, c, dec);
  assert.deepEqual(con.incidencias, []);
  const t = textoRecalculo(con, dec, c).join(' ');
  assert.match(t, /se recalcula el año base/); assert.match(t, /Se incorpora el Hotel B/); assert.match(t, /Alta de «Hotel B»/);
  assert.equal(evaluarRecalculo(r(2019), act, c, { ...dec, motivo: ' ' }).incidencias.length, 1);
  assert.match(textoRecalculo(evaluarRecalculo(r(2023), r(2024), c, { metodologiaCambiada: false, decision: null, motivo: null }), null, c).join(' '), /no es necesario recalcular/);
});
test('la comparación por fuente agrupa por tipo: nombres distintos entre años son comparables', () => {
  const base = r(2023, { total: 533.94, porCategoria: { 1: 245, 2: 288.94 }, porFuente: { 'Combustible instalaciones fijas': 119.1, 'Combustible vehículos': 6.03, 'Consumo eléctrico': 288.94, 'Emisiones fugitivas': 119.87 } });
  const act = r(2024, { total: 435, porCategoria: { 1: 165, 2: 270.45 }, porFuente: { Electricidad: 270.45, 'Gas butano (kg)': 0.49, 'Gas natural (kWhPCS)*': 31.18, 'Gas propano (kg)': 2.09, 'R-448A': 131.2 }, porTipo: { 'Combustibles en instalaciones fijas': 33.76, 'Emisiones fugitivas (refrigerantes)': 131.2, Electricidad: 270.45 } });
  const f = compararAnios(base, null, act).fuentes;
  assert.deepEqual(f.map((x) => x.concepto), ['Combustibles en instalaciones fijas', 'Combustibles en vehículos', 'Emisiones fugitivas (refrigerantes)', 'Electricidad']);
  const fij = f[0]; assert.equal(fij.base, 119.1); assert.equal(fij.actual, 33.76);
  assert.equal(f[3].base, 288.94); assert.equal(f[3].actual, 270.45);
  assert.equal(tipoDeFuente('R-448A'), 'Emisiones fugitivas (refrigerantes)'); assert.equal(tipoDeFuente('Gasolina (l)'), 'Combustibles en vehículos');
});
test('solo se comparan fuentes comparables: un tipo ausente en un año no da -100 % y se avisa', () => {
  const base = r(2023, { porFuente: { 'Combustible vehículos': 6, 'Consumo eléctrico': 289 } });
  const act = r(2024, { porFuente: { Electricidad: 270, 'Gas natural': 30 } });
  const c = compararAnios(base, null, act);
  const veh = c.fuentes.find((x) => x.concepto === 'Combustibles en vehículos')!;
  assert.equal(veh.vsBase, null);
  assert.equal(c.fuentes.find((x) => x.concepto === 'Combustibles en instalaciones fijas')!.vsBase, null);
  assert.ok(c.fuentes.find((x) => x.concepto === 'Electricidad')!.vsBase != null);
  assert.deepEqual(c.noComparables.sort(), ['Combustibles en instalaciones fijas', 'Combustibles en vehículos']);
});

test('cambio de límites: un centro con otras mayúsculas, acentos o espacios sigue siendo el mismo', () => {
  const base = r(2023, { centros: ['ASTORIA PLAYA', 'Hotel  Mar-Azul'] }), act = r(2024, { centros: ['Astoria Playa', 'Hotel Mar Azul'] });
  assert.deepEqual(evaluarRecalculo(base, act, CONFIG_RECALCULO_POR_DEFECTO, null).disparadores.filter((d) => d.regla === 'limites'), []);
  const nuevo = evaluarRecalculo(base, r(2024, { centros: ['Astoria Playa', 'Hotel Nuevo'] }), CONFIG_RECALCULO_POR_DEFECTO, null).disparadores.find((d) => d.regla === 'limites');
  assert.ok(nuevo && /Hotel Nuevo/.test(nuevo.detalle.join(' ')) && /Hotel\s+Mar-Azul/.test(nuevo.detalle.join(' ')));
});
