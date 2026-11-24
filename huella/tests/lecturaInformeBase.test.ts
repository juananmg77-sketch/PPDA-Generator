import test from 'node:test';
import assert from 'node:assert/strict';
import { limpiarLecturaBase, resumenDeLectura } from '../lecturaInformeBase.ts';
import type { LecturaInformeBase } from '../lecturaInformeBase.ts';

const base: LecturaInformeBase = { anio: 2023, organizacion: 'Hotel X', unidad: 't', categoria1: 120.5, categoria2: 413.4, total: 533.9, estancias: 40000, plantilla: 63.4, factores: 'Calculadora del Govern 2023.2', centros: ['Hotel X'], porFuente: [{ fuente: 'Electricidad', emisiones: 413.4 }, { fuente: 'Gas natural', emisiones: 120.5 }], verificador: 'SGS', referenciaVerificacion: 'NT-02', paginaTotal: 9, observaciones: null };

test('lectura del informe del año base: se convierte a un resumen en toneladas', () => {
  const { resumen, avisos } = resumenDeLectura(limpiarLecturaBase(base));
  assert.deepEqual(avisos, []);
  assert.equal(resumen!.anio, 2023); assert.equal(resumen!.total, 533.9); assert.equal(resumen!.porCategoria[1], 120.5);
  assert.equal(resumen!.porFuente.Electricidad, 413.4); assert.equal(resumen!.factoresId, 'Calculadora del Govern 2023.2'); assert.deepEqual(resumen!.centros, ['Hotel X']);
});
test('unidad en kg: se pasa a toneladas; sin total se suma y se avisa; si no cuadra se avisa', () => {
  const kg = resumenDeLectura({ ...base, unidad: 'kg', categoria1: 120500, categoria2: 413400, total: 533900, porFuente: [{ fuente: 'Gas', emisiones: 100000 }] }).resumen!;
  assert.equal(kg.total, 533.9); assert.equal(kg.porFuente.Gas, 100);
  const sinTotal = resumenDeLectura({ ...base, total: null });
  assert.ok(Math.abs(sinTotal.resumen!.total - 533.9) < 1e-9); assert.ok(sinTotal.avisos.some((a) => /sumado/.test(a)));
  assert.ok(resumenDeLectura({ ...base, total: 700 }).avisos.some((a) => /no suman el total/.test(a)));
  assert.ok(resumenDeLectura({ ...base, porFuente: [{ fuente: 'Electricidad', emisiones: 413.4 }, { fuente: 'Gas natural', emisiones: 100 }] }).avisos.some((a) => /fuentes del informe suman/.test(a))); // fuentes que no suman el total
});
test('datos que faltan: no se inventan (resumen null o avisos), y se limpian valores absurdos', () => {
  const r = resumenDeLectura(limpiarLecturaBase({ ...base, total: null, categoria1: null, categoria2: null }));
  assert.equal(r.resumen, null); assert.ok(r.avisos.some((a) => /total/.test(a)));
  const l = limpiarLecturaBase({ ...base, anio: 1850, total: -5, estancias: NaN as never, centros: ['  ', 'A'] });
  assert.equal(l.anio, null); assert.equal(l.total, null); assert.equal(l.estancias, null); assert.deepEqual(l.centros, ['A']);
  assert.ok(resumenDeLectura(limpiarLecturaBase({ ...base, anio: null })).avisos.some((a) => /año/.test(a)));
});

import { ESQUEMA_INFORME_BASE } from '../lecturaInformeBase.ts';
test('el esquema de salida usa tipos simples (sin uniones con null) y la lectura tolera los datos que faltan', () => {
  const props = ESQUEMA_INFORME_BASE.properties as Record<string, { type: unknown }>;
  for (const [k, v] of Object.entries(props)) assert.ok(typeof v.type === 'string', `${k}: type debe ser una cadena`);
  assert.deepEqual(ESQUEMA_INFORME_BASE.required, ['centros', 'porFuente']);
  const sinNada = limpiarLecturaBase({ centros: [], porFuente: [] } as never);
  assert.equal(sinNada.anio, null); assert.equal(sinNada.total, null); assert.equal(sinNada.organizacion, null);
  assert.equal(resumenDeLectura(sinNada).resumen, null);
});
