import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirConjunto } from '../factores.ts';
import { calcularCombustion, calcularElectricidad, calcularFugitiva, calcularInventario, FactorNoEncontrado, ratio } from '../motor.ts';
import type { DatosCalculadora, LineaActividad } from '../tipos.ts';

const cargar = (v: string): DatosCalculadora =>
  JSON.parse(readFileSync(new URL(`../datos/factores-calculadora-${v}.json`, import.meta.url), 'utf-8'));

const calc2024 = cargar('2024.1');
const f2024 = construirConjunto(calc2024, { anioInventario: 2024 });
const base = { id: 't', centro: 'Hotel de prueba' } as const;

test('combustión: gas natural 2024 = kWh × 0,182 kg CO2/kWh (PCS), con CH4 y N2O en CO2e', () => {
  const l: LineaActividad = { ...base, categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 1000 };
  const r = calcularCombustion(l, f2024);
  assert.equal(r.kgCO2, 182);
  assert.equal(r.gCH4, 16);
  assert.equal(r.gN2O, 0);
  // CO2e = 182 + 0,016 kg × 27,9
  assert.ok(Math.abs(r.kgCO2e - (182 + 0.016 * 27.9)) < 1e-9);
  assert.equal(r.alcance, 1);
  assert.match(r.trazabilidad.conjunto, /calculadora-2024.1@2024/);
});

test('combustión: gasóleo C y biomasa (CO2 biogénico = 0, pero con CH4 y N2O)', () => {
  const gasoleo = calcularCombustion({ ...base, categoria: 'combustion_fija', fuente: 'Gasóleo C (l)', cantidad: 100 }, f2024);
  assert.ok(Math.abs(gasoleo.kgCO2 - 288.1) < 1e-9);
  const pellets = calcularCombustion({ ...base, categoria: 'combustion_fija', fuente: 'Biomasa pellets (kg)**', cantidad: 100 }, f2024);
  assert.equal(pellets.kgCO2, 0);
  assert.ok(pellets.gCH4 > 0 && pellets.kgCO2e > 0);
});

test('fugitivas: kg recargados × PCA', () => {
  const r = calcularFugitiva({ ...base, categoria: 'fugitiva', fuente: 'R-410A', cantidad: 2 }, f2024);
  assert.equal(r.kgCO2e, 2 * 2256);
});

test('electricidad: red = mix; autoconsumo y GdO renovable balear = 0; el método de ubicación se informa siempre', () => {
  const red = calcularElectricidad({ ...base, categoria: 'electricidad', fuente: '', cantidad: 1000, origenElectricidad: 'red' }, f2024);
  assert.ok(Math.abs(red.kgCO2e - 348) < 1e-9); // mix balear 2024 = 0,348
  const gdo = calcularElectricidad({ ...base, categoria: 'electricidad', fuente: '', cantidad: 1000, origenElectricidad: 'gdo_renovable_balear' }, f2024);
  assert.equal(gdo.kgCO2e, 0);
  assert.ok(Math.abs(gdo.electricidad!.kgCO2eUbicacion - 348) < 1e-9);
  assert.equal(gdo.electricidad!.kgCO2eMercado, 0);
  // Una garantía de origen que no es de Baleares reduce el método de mercado, pero no el valor del registro balear.
  const otra = calcularElectricidad({ ...base, categoria: 'electricidad', fuente: '', cantidad: 1000, origenElectricidad: 'gdo_otra' }, f2024);
  assert.ok(Math.abs(otra.kgCO2e - 348) < 1e-9);
  assert.equal(otra.electricidad!.kgCO2eMercado, 0);
});

test('un factor que falta lanza un error: nunca se asume cero', () => {
  assert.throws(() => calcularCombustion({ ...base, categoria: 'combustion_fija', fuente: 'Combustible inventado (l)', cantidad: 1 }, f2024), FactorNoEncontrado);
  assert.throws(() => calcularFugitiva({ ...base, categoria: 'fugitiva', fuente: 'R-999', cantidad: 1 }, f2024), FactorNoEncontrado);
});

test('los cambios manuales sobre factores oficiales exigen justificación', () => {
  assert.throws(() => construirConjunto(calc2024, { anioInventario: 2024, gwp: { ch4: 28, n2o: 265, fuente: 'x' } }), /justificación/);
  const ok = construirConjunto(calc2024, { anioInventario: 2024, gwp: { ch4: 28, n2o: 265, fuente: 'x' }, notas: ['prueba'] });
  assert.match(ok.id, /\+ajustes$/);
});

test('un año sin mix eléctrico en la versión exige indicarlo con su resolución', () => {
  assert.throws(() => construirConjunto(cargar('2023.2'), { anioInventario: 2024 }), /mix eléctrico/);
});

test('el repartidor (p. ej. 85/15) se aplica y queda en la línea', () => {
  const l: LineaActividad = { ...base, categoria: 'combustion_movil', fuente: 'E5 (l)|Furgonetas y furgones (N1)', cantidad: 100, reparto: { proporcion: 0.85, justificacion: 'uso interno' } };
  const r = calcularCombustion(l, f2024);
  assert.ok(Math.abs(r.kgCO2 - 85 * 2.235) < 1e-9);
});

test('totales por alcance, categoría y gas; y ratio por índice de actividad', () => {
  const lineas: LineaActividad[] = [
    { ...base, id: '1', categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 1000 },
    { ...base, id: '2', categoria: 'fugitiva', fuente: 'R-410A', cantidad: 1 },
    { ...base, id: '3', categoria: 'electricidad', fuente: '', cantidad: 1000, origenElectricidad: 'red' },
  ];
  const { totales } = calcularInventario(lineas, f2024);
  assert.ok(Math.abs(totales.kgCO2eTotal - (totales.kgCO2eAlcance1 + totales.kgCO2eAlcance2)) < 1e-9);
  assert.equal(totales.kgCO2PorGas.fluorados_co2e, 2256);
  assert.ok(Math.abs(ratio(totales.kgCO2eTotal, 100) - totales.kgCO2eTotal / 100) < 1e-12);
  assert.throws(() => ratio(10, 0));
});

import { conPcaManual } from '../factores.ts';
import { conMezclas } from '../mezclas.ts';
test('PCA manual de un gas fuera de la calculadora: queda en el conjunto, con su justificación en las notas', () => {
  const f = conMezclas(construirConjunto(JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2023.2.json', import.meta.url), 'utf-8')), { anioInventario: 2023 }));
  assert.ok(Math.abs(f.pcaRefrigerantes['R-448A'] - 1494.36) < 0.01); // propuesta por composición
  const g = conPcaManual(f, 'R-448A', 1387, 'Valor del documento MITECO de factores v17 (abril 2021), como en el inventario 2023 verificado.');
  assert.equal(g.pcaRefrigerantes['R-448A'], 1387); assert.match(g.id, /\+ajustes$/);
  assert.equal(g.notas.filter((n) => /R-448A/.test(n)).length, 1); assert.match(g.notas.find((n) => /R-448A/.test(n))!, /PCA manual de R-448A: 1\.387/);
  assert.equal(f.pcaRefrigerantes['R-448A'] > 1400, true); // el original no cambia
  assert.throws(() => conPcaManual(f, 'R-448A', 1387, 'corto'), /justificación/);
  assert.throws(() => conPcaManual(f, '', 1387, 'una justificación suficiente'), /gas/);
  assert.throws(() => conPcaManual(f, 'R-448A', 0, 'una justificación suficiente'), /mayor que cero/);
  const h = conPcaManual(g, 'HFC-134a', 1430, 'PCA del informe 2023 verificado; la calculadora 2023.2 trae 1530.');
  assert.equal(h.id.split('+ajustes').length, 2); assert.equal(h.notas.length, g.notas.length + 1);
});
