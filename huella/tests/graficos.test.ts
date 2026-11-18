import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emisionesMensuales, etiquetaFuente, svgAnillo, svgBarrasAgrupadas, svgBarrasApiladas, svgBarrasHorizontales } from '../graficos.ts';

const limpio = (svg: string) => { assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>')); assert.ok(!/NaN|undefined|Infinity/.test(svg), 'valores inválidos'); };

test('nombres de fuente para leyendas', () => {
  assert.equal(etiquetaFuente('Gas butano (kg)'), 'Gas butano');
  assert.equal(etiquetaFuente('Gas natural (kWhPCS)*'), 'Gas natural');
  assert.equal(etiquetaFuente(''), 'Electricidad');
  assert.equal(etiquetaFuente(undefined), 'Electricidad');
});

test('anillo: leyenda con toneladas y porcentajes, total en el centro; sin datos no falla', () => {
  const g = svgAnillo([{ nombre: 'Electricidad', t: 96.4 }, { nombre: 'Gas natural', t: 6.02 }, { nombre: 'Nada', t: 0 }], 'Reparto');
  limpio(g.svg);
  assert.match(g.svg, /Electricidad/); assert.match(g.svg, /96,4 t · 94,1 %/); assert.match(g.svg, /102,4/); assert.doesNotMatch(g.svg, /Nada/);
  limpio(svgAnillo([], 'x').svg);
  limpio(svgAnillo([{ nombre: 'Único', t: 5 }], 'x').svg); // un solo sector: círculo completo
});

test('barras apiladas mensuales: 12 meses, leyenda y escala', () => {
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const g = svgBarrasApiladas(meses, [{ nombre: 'Electricidad', valores: [10, 12, 11, 0, 0, 0, 0, 0, 0, 0, 0, 14] }, { nombre: 'Gas natural', valores: [1, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1] }], 'Mensual');
  limpio(g.svg);
  assert.ok((g.svg.match(/<rect /g) ?? []).length >= 9); // fondo + barras + leyenda
  assert.match(g.svg, />dic</); assert.match(g.svg, /Gas natural/);
  limpio(svgBarrasApiladas(meses, [{ nombre: 'x', valores: Array(12).fill(0) }], 'vacío').svg);
});

test('barras por centro y comparación con el año anterior', () => {
  limpio(svgBarrasHorizontales([{ nombre: 'Hotel A', t: 10 }, { nombre: 'Hotel B con un nombre larguísimo que se recorta', t: 4 }], 'Centros').svg);
  assert.match(svgBarrasHorizontales([{ nombre: 'Hotel A', t: 10.5 }], 'c').svg, /10,50 t/);
  const g = svgBarrasAgrupadas(['Alcance 1', 'Alcance 2', 'Total'], [{ nombre: '2023', valores: [8, 30, 38] }, { nombre: '2024', valores: [14.7, 96.4, 111.1] }], 'Comparación');
  limpio(g.svg); assert.match(g.svg, /111,1/); assert.match(g.svg, />2023</);
});

test('emisiones mensuales: reparto por días y por fuente; sin periodo no se cuenta', () => {
  const m = emisionesMensuales([
    { fuente: '', kgCO2e: 3100, desde: '2024-03-01', hasta: '2024-03-31' },
    { fuente: 'Gas natural (kWhPCS)*', kgCO2e: 2000, desde: '2024-01-16', hasta: '2024-02-14' },
    { fuente: 'Gasóleo C (l)', kgCO2e: 999, desde: null, hasta: null },
  ], 2024);
  assert.ok(Math.abs(m['Electricidad'][2] - 3.1) < 1e-9);
  assert.ok(Math.abs(m['Gas natural'][0] + m['Gas natural'][1] - 2) < 1e-9);
  assert.equal(m['Gasóleo C'], undefined);
});
