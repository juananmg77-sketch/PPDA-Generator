import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agruparPorTipoYContador, mesesTocados, repartirPorMes } from '../mensual.ts';

const suma = (a: number[]) => a.reduce((s, x) => s + x, 0);

test('un periodo dentro de un mes va entero a ese mes', () => {
  const r = repartirPorMes('2024-03-01', '2024-03-31', 3100, 2024);
  assert.equal(Math.round(r.meses[2]), 3100);
  assert.equal(suma(r.meses.filter((_, i) => i !== 2)), 0);
  assert.equal(r.fueraDeAnio, 0);
});

test('un periodo a caballo entre dos meses se reparte por días (15 feb-15 mar de 2024, bisiesto)', () => {
  const r = repartirPorMes('2024-02-15', '2024-03-15', 3000, 2024); // 29 días: 15 de feb (15..29) y 15 de mar
  assert.ok(Math.abs(r.meses[1] - (3000 * 15) / 30) < 1e-6); // 15 días en febrero
  assert.ok(Math.abs(suma(r.meses) - 3000) < 1e-6);
});

test('un periodo que cruza de año solo cuenta la parte del año y avisa de lo que queda fuera', () => {
  const r = repartirPorMes('2024-12-16', '2025-01-15', 3100, 2024);
  assert.ok(Math.abs(r.meses[11] - 1600) < 1) ;
  assert.ok(Math.abs(r.fueraDeAnio - 1500) < 1);
  assert.ok(Math.abs(suma(r.meses) + r.fueraDeAnio - 3100) < 1e-6);
});

test('sin periodo válido no se reparte', () => {
  assert.equal(repartirPorMes(null, null, 10, 2024).sinPeriodo, true);
  assert.equal(repartirPorMes('2024-05-10', '2024-05-01', 10, 2024).sinPeriodo, true);
});

test('meses tocados y agrupación por tipo y contador', () => {
  assert.deepEqual(mesesTocados('2024-01-20', '2024-03-05', 2024), [0, 1, 2]);
  const g = agruparPorTipoYContador(
    [{ t: 'electricidad', c: 'A' }, { t: 'electricidad', c: 'B' }, { t: 'electricidad', c: 'A' }, { t: 'gas_natural', c: '' }],
    (x) => x.t, (x) => x.c,
  );
  assert.deepEqual(g.map((x) => [x.tipo, x.contador, x.items.length]), [['electricidad', 'A', 2], ['electricidad', 'B', 1], ['gas_natural', 'sin contador', 1]]);
});

test('mes de facturación: el mes con más días del periodo', async () => {
  const { mesFacturacion } = await import('../mensual.ts');
  assert.equal(mesFacturacion('2023-12-31', '2024-01-31'), 'Ene 2024');
  assert.equal(mesFacturacion('2024-03-20', '2024-04-22'), 'Abr 2024');
  assert.equal(mesFacturacion('2024-02-21', '2024-03-20'), 'Mar 2024');
  assert.equal(mesFacturacion('2024-04-02', '2024-04-02'), 'Abr 2024');
  assert.equal(mesFacturacion('2024-02-15', '2024-03-15'), 'Mar 2024'); // empate: el posterior
  assert.equal(mesFacturacion(undefined, undefined), null);
});
