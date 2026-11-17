import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirConjunto } from '../factores.ts';
import { cubreAnio, diferencias, versionPorDefecto } from '../catalogo.ts';
import type { DatosCalculadora } from '../tipos.ts';

const cargar = (v: string): DatosCalculadora => JSON.parse(readFileSync(new URL(`../datos/factores-calculadora-${v}.json`, import.meta.url), 'utf-8'));
const d23 = cargar('2023.2');
const d24 = cargar('2024.1');

test('cada versión cubre solo los años para los que trae mix y factores', () => {
  assert.equal(cubreAnio(d23, 2023), true);
  assert.equal(cubreAnio(d23, 2024), false);
  assert.equal(cubreAnio(d24, 2024), true);
  assert.equal(cubreAnio(d24, 2023), true);
  assert.equal(cubreAnio(d24, 2030), false);
});

test('por defecto se propone la edición más reciente que cubra el año', () => {
  assert.equal(versionPorDefecto(['2023.2', '2024.1']), '2024.1');
  assert.equal(versionPorDefecto(['2023.2']), '2023.2');
  assert.equal(versionPorDefecto([]), undefined);
});

test('el mismo año 2023 tiene factores distintos según la edición y se detecta', () => {
  const a = construirConjunto(d24, { anioInventario: 2023 });
  const b = construirConjunto(d23, { anioInventario: 2023 });
  const dif = diferencias(a, b);
  const gasoleoC = dif.combustibles.find((c) => c.clave === 'Gasóleo C (l)');
  assert.ok(gasoleoC, 'el gasóleo C 2023 difiere entre la 2023.2 y la 2024.1');
  assert.equal(dif.mix, null); // mix balear 2023 igual en ambas (0,374)
  assert.equal(diferencias(a, a).combustibles.length, 0);
});

test('un inventario 2023 con la 2023.2 usa su propio factor de gasóleo C', () => {
  const b = construirConjunto(d23, { anioInventario: 2023 });
  assert.equal(b.combustibles['Gasóleo C (l)'].co2, 2.705);
  assert.equal(b.mixElectrico, 0.374);
});
