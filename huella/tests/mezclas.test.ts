import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirConjunto } from '../factores.ts';
import { conMezclas, MEZCLAS, normalizarGas, pcaMezcla } from '../mezclas.ts';
import { calcularFugitiva } from '../motor.ts';
import { validarExtraccion } from '../extraccion.ts';
import type { DatosCalculadora } from '../tipos.ts';

const datos: DatosCalculadora = JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2024.1.json', import.meta.url), 'utf-8'));
const f = construirConjunto(datos, { anioInventario: 2024 });

test('el método reproduce las mezclas de la calculadora oficial (R-449A y R-410A)', () => {
  const comp449 = { componentes: { 'HFC-32': 0.243, 'HFC-125': 0.247, 'HFC-134a': 0.257, 'HFO-1234yf': 0.253 }, fuente: '' };
  const comp410 = { componentes: { 'HFC-32': 0.5, 'HFC-125': 0.5 }, fuente: '' };
  assert.ok(Math.abs(pcaMezcla('R-449A', f.pcaRefrigerantes, { 'R-449A': comp449 })! - f.pcaRefrigerantes['R-449A']) < 1.5);
  assert.ok(Math.abs(pcaMezcla('R-410A', f.pcaRefrigerantes, { 'R-410A': comp410 })! - f.pcaRefrigerantes['R-410A']) < 1);
});

test('R-448A: PCA ≈ 1.494 con los componentes del conjunto, y queda anotado', () => {
  assert.equal(f.pcaRefrigerantes['R-448A'], undefined);
  const v = pcaMezcla('R-448A', f.pcaRefrigerantes)!;
  assert.ok(v > 1493 && v < 1495.5, String(v));
  const g = conMezclas(f);
  assert.equal(g.pcaRefrigerantes['R-448A'], v);
  assert.equal(g.notas.length, 1);
  assert.match(g.notas[0], /R-448A.*media ponderada/);
  assert.equal(conMezclas(g), g); // idempotente: no duplica notas
  assert.equal(Object.keys(MEZCLAS).includes('R-448A'), true);
});

test('con la mezcla añadida, una recarga de R-448A se calcula y se valida', () => {
  const g = conMezclas(f);
  const r = calcularFugitiva({ id: '1', centro: 'H', categoria: 'fugitiva', fuente: 'R-448A', cantidad: 3 }, g);
  assert.ok(Math.abs(r.kgCO2e - 3 * g.pcaRefrigerantes['R-448A']) < 1e-6);
  const e = { tipo: 'refrigerante' as const, proveedor: 'S', periodoDesde: '2024-05-02', periodoHasta: '2024-05-02', cantidad: 3, unidad: 'kg', producto: 'R-448A' };
  assert.ok(validarExtraccion(e, { anioInventario: 2024, factores: f }).some((i) => i.codigo === 'gas_sin_pca')); // sin mezcla, error
  assert.deepEqual(validarExtraccion(e, { anioInventario: 2024, factores: g }).map((i) => i.codigo), []);
  assert.deepEqual(validarExtraccion({ ...e, producto: 'R448A' }, { anioInventario: 2024, factores: g }).map((i) => i.codigo), []); // escrito distinto
});

test('nombres de gases: R448A, r 448a y R-448 A se reconocen', () => {
  for (const x of ['R448A', 'r 448a', 'R-448 A', ' R-448A ']) assert.equal(normalizarGas(x), 'R-448A', x);
  assert.equal(normalizarGas('HFC-134a'), 'HFC-134a');
  assert.equal(normalizarGas('R410A'), 'R-410A');
});
