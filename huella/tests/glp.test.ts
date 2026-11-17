import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarEnvases, esEnvase, fuenteGlp, KG_BOMBONA_BUTANO } from '../glp.ts';
import type { ExtraccionFactura } from '../extraccion.ts';

const glp = (o: Partial<ExtraccionFactura> = {}): ExtraccionFactura => ({ tipo: 'glp', producto: 'Butano', cantidad: 20, unidad: 'bombonas', ...o });

test('se reconocen los envases y no los kg ni los litros', () => {
  for (const u of ['bombonas', 'Bombona 12,5 kg', 'botellas', 'envases', 'uds', 'unidades']) assert.equal(esEnvase(u), true, u);
  for (const u of ['kg', 'kilos', 'l', 'litros', 'kWh', undefined]) assert.equal(esEnvase(u), false, String(u));
});

test('factor según el producto: butano, propano y GLP genérico en litros', () => {
  assert.equal(fuenteGlp('Butano 12,5 kg', 'kg'), 'Gas butano (kg)');
  assert.equal(fuenteGlp('PROPANO', 'kg'), 'Gas propano (kg)');
  assert.equal(fuenteGlp('GLP', 'litros'), 'LPG (l)');
  assert.equal(fuenteGlp('GLP', 'kg'), '');
  assert.equal(fuenteGlp(undefined, undefined), '');
});

test('bombonas a kg con los kg por envase que se confirman', () => {
  const r = aplicarEnvases(glp(), KG_BOMBONA_BUTANO);
  assert.deepEqual([r.cantidad, r.unidad], [250, 'kg']);
  assert.match(r.nota!, /20 bombonas × 12,5 kg por envase/);
  assert.equal(aplicarEnvases(glp()).unidad, 'bombonas'); // sin kg por envase no se toca
  const kg = glp({ unidad: 'kg', cantidad: 100 });
  assert.equal(aplicarEnvases(kg), kg);
});
