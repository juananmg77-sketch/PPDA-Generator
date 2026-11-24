import test from 'node:test';
import assert from 'node:assert/strict';
import { fmt, fmtOpc, fmtLibre, comoSeMuestra, DECIMALES } from '../formato.ts';

test('formato es-ES: coma decimal y punto de miles también con 4 cifras', () => {
  assert.equal(fmt(1494.36, 'pca'), '1.494,36');
  assert.equal(fmt(1494, 'pca'), '1.494');
  assert.equal(fmt(1234.5, 'actividad'), '1.234,50');
  assert.equal(fmt(435.4, 'tCO2e'), '435,40');
  assert.equal(fmtLibre(1234.5, 1), '1.234,5');
});
test('decimales por magnitud', () => {
  assert.equal(fmt(0.182, 'factor'), '0,182');
  assert.equal(fmt(0.3744, 'factor'), '0,3744');
  assert.equal(fmt(0.374, 'factor'), '0,374');
  assert.equal(fmt(1530, 'pca'), '1.530');
  assert.equal(fmt(27.9, 'pca'), '27,90');
  assert.equal(fmt(12.34, 'porcentaje'), '12,3');
  assert.equal(fmt(0.0433, 'ratio'), '0,0433');
  assert.equal(fmt(63.465, 'plantilla'), '63,465');
  assert.equal(fmt(136, 'entero'), '136');
  assert.equal(fmt(9122.34, 'kgCO2e'), '9.122,3');
  for (const m of Object.keys(DECIMALES) as Array<keyof typeof DECIMALES>) assert.ok(DECIMALES[m].min <= DECIMALES[m].max);
});
test('faltantes: «—» en tablas y omisión en frases; nunca null/undefined/NaN', () => {
  for (const v of [null, undefined, NaN, Infinity, -Infinity]) { assert.equal(fmt(v as never, 'tCO2e'), '—'); assert.equal(fmtOpc(v as never, 'tCO2e'), null); assert.equal(fmtLibre(v as never), '—'); }
  assert.equal(fmt(0, 'tCO2e'), '0,00');
});
test('un valor positivo que se redondea a cero no se muestra como 0', () => {
  assert.equal(fmt(0.003, 'tCO2e'), '< 0,01');
  assert.equal(fmt(0.04, 'porcentaje'), '< 0,1');
  assert.equal(fmt(0.01, 'tCO2e'), '0,01');
});
test('el valor mostrado se puede usar como divisor del ratio', () => {
  assert.equal(comoSeMuestra(63.4654, 'plantilla'), 63.465);
  assert.equal(comoSeMuestra(1.005, 'tCO2e') * 100 % 1, 0);
});

test('números a mano en formato español: miles con punto, decimales con coma, y aviso cuando es ambiguo', async () => {
  const { leerNumeroEs } = await import('../formato.ts');
  assert.deepEqual(leerNumeroEs('1.234,5'), { valor: 1234.5, ambiguo: false });
  assert.deepEqual(leerNumeroEs('25,765'), { valor: 25.765, ambiguo: false });
  assert.deepEqual(leerNumeroEs('25.765'), { valor: 25765, ambiguo: true });
  assert.deepEqual(leerNumeroEs('20.005,670'), { valor: 20005.67, ambiguo: false });
  assert.deepEqual(leerNumeroEs('7531'), { valor: 7531, ambiguo: false });
  assert.deepEqual(leerNumeroEs('12.5'), { valor: 12.5, ambiguo: false });
  assert.equal(leerNumeroEs('abc').valor, null);
});
