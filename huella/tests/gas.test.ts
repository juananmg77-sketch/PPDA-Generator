import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarGas, esKwhAmbiguo, modoInicialGas, PCI_SOBRE_PCS } from '../gas.ts';
import type { ExtraccionFactura } from '../extraccion.ts';

const gas = (o: Partial<ExtraccionFactura> = {}): ExtraccionFactura => ({ tipo: 'gas_natural', proveedor: 'G', periodoDesde: '2024-01-01', periodoHasta: '2024-01-31', cantidad: 10000, unidad: 'kWh', confianza: 0.9, ...o });

test('modo inicial según la unidad de la factura; kWh a secas queda sin determinar', () => {
  assert.equal(modoInicialGas('kWh PCS'), 'pcs');
  assert.equal(modoInicialGas('kWh PCI'), 'pci');
  assert.equal(modoInicialGas('m³'), 'm3');
  assert.equal(modoInicialGas('kWh'), '');
  assert.equal(esKwhAmbiguo(gas()), true);
  assert.equal(esKwhAmbiguo(gas({ unidad: 'kWh PCS' })), false);
  assert.equal(esKwhAmbiguo({ ...gas(), tipo: 'electricidad' }), false);
});

test('kWh confirmados como PCS: no cambia la cantidad y deja nota', () => {
  const r = aplicarGas(gas(), 'pcs');
  assert.deepEqual([r.cantidad, r.unidad], [10000, 'kWh PCS']);
  assert.match(r.nota!, /confirmado como kWh PCS/);
});

test('kWh PCI: se convierten a PCS dividiendo entre 0,901', () => {
  const r = aplicarGas(gas({ unidad: 'kWh PCI', cantidad: 9010 }), 'pci');
  assert.equal(r.cantidad, 10000);
  assert.equal(r.unidad, 'kWh PCS');
  assert.equal(PCI_SOBRE_PCS, 0.901);
  assert.match(r.nota!, /dividiendo entre 0,901/);
});

test('m³: se convierten con el factor de la factura; sin factor no se toca', () => {
  const r = aplicarGas(gas({ unidad: 'm3', cantidad: 1000 }), 'm3', 11.63);
  assert.equal(r.cantidad, 11630);
  assert.equal(r.unidad, 'kWh PCS');
  assert.match(r.nota!, /11,63 kWh\/m³/);
  assert.equal(aplicarGas(gas({ unidad: 'm3' }), 'm3').unidad, 'm3');
  assert.equal(aplicarGas(gas(), '').unidad, 'kWh');
});

test('no toca otros tipos de factura', () => {
  const luz: ExtraccionFactura = { tipo: 'electricidad', cantidad: 100, unidad: 'kWh' };
  assert.equal(aplicarGas(luz, 'pcs'), luz);
});
