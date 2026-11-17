import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirConjunto } from '../factores.ts';
import { asignarContador, evaluarExclusiones, normalizarContador, proponerActividad, validarExtraccion, variacionAnual } from '../extraccion.ts';
import type { ContextoValidacion, ExtraccionFactura } from '../extraccion.ts';
import type { DatosCalculadora } from '../tipos.ts';

const datos: DatosCalculadora = JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2024.1.json', import.meta.url), 'utf-8'));
const factores = construirConjunto(datos, { anioInventario: 2024 });
const ctx: ContextoValidacion = { anioInventario: 2024, factores };
const codigos = (e: ExtraccionFactura, c = ctx) => validarExtraccion(e, c).map((i) => i.codigo);

const luz: ExtraccionFactura = {
  tipo: 'electricidad', proveedor: 'Comercializadora X', periodoDesde: '2024-03-01', periodoHasta: '2024-03-31',
  cantidad: 15000, unidad: 'kWh', garantiaOrigen: 'no', confianza: 0.95,
};

test('una factura de electricidad correcta no genera incidencias', () => {
  assert.deepEqual(codigos(luz), []);
});

test('gas natural: la unidad debe ser kWh PCS; con kWh sin más o m3 se pide confirmar', () => {
  const gas: ExtraccionFactura = { tipo: 'gas_natural', proveedor: 'G', periodoDesde: '2024-01-01', periodoHasta: '2024-01-31', cantidad: 5000, unidad: 'kWh', confianza: 0.9 };
  assert.ok(codigos(gas).includes('unidad_gas'));
  assert.ok(codigos({ ...gas, unidad: 'm3' }).includes('unidad_gas'));
  assert.deepEqual(codigos({ ...gas, unidad: 'kWh PCS' }), []);
});

test('periodo fuera de año, cruzando años o demasiado largo', () => {
  assert.ok(codigos({ ...luz, periodoDesde: '2023-03-01', periodoHasta: '2023-03-31' }).includes('fuera_de_anio'));
  assert.ok(codigos({ ...luz, periodoDesde: '2024-12-15', periodoHasta: '2025-01-14' }).includes('cruza_anio'));
  assert.ok(codigos({ ...luz, periodoDesde: '2024-01-01', periodoHasta: '2024-06-30' }).includes('periodo_largo'));
  assert.ok(codigos({ ...luz, periodoDesde: '2024-03-31', periodoHasta: '2024-03-01' }).includes('periodo_invertido'));
  assert.ok(codigos({ ...luz, periodoDesde: undefined }).includes('periodo'));
});

test('cantidad y unidad obligatorias; cero y baja confianza generan aviso', () => {
  assert.ok(codigos({ ...luz, cantidad: undefined }).includes('cantidad'));
  assert.ok(codigos({ ...luz, cantidad: -5 }).includes('cantidad'));
  assert.ok(codigos({ ...luz, cantidad: 0 }).includes('cantidad_cero'));
  assert.ok(codigos({ ...luz, unidad: undefined }).includes('unidad'));
  assert.ok(codigos({ ...luz, confianza: 0.5 }).includes('confianza_baja'));
});

test('electricidad sin origen conocido ya no avisa por factura; refrigerante sin PCA es un error', () => {
  assert.ok(!codigos({ ...luz, garantiaOrigen: 'desconocida' }).includes('origen_electricidad')); // ya no se avisa por factura
  const gas: ExtraccionFactura = { tipo: 'refrigerante', proveedor: 'S', periodoDesde: '2024-05-02', periodoHasta: '2024-05-02', cantidad: 3, unidad: 'kg', producto: 'R-410A' };
  assert.deepEqual(codigos(gas), []);
  assert.ok(codigos({ ...gas, producto: 'R-999' }).includes('gas_sin_pca'));
});

test('duplicados, mismo periodo con otra cantidad y solapes', () => {
  const ya = { id: 'F1', proveedor: 'Comercializadora X', periodoDesde: '2024-03-01', periodoHasta: '2024-03-31', cantidad: 15000, tipo: 'electricidad' as const };
  assert.ok(codigos(luz, { ...ctx, existentes: [ya] }).includes('duplicada'));
  assert.ok(codigos({ ...luz, cantidad: 14000 }, { ...ctx, existentes: [ya] }).includes('mismo_periodo'));
  assert.ok(codigos({ ...luz, periodoDesde: '2024-03-15', periodoHasta: '2024-04-14' }, { ...ctx, existentes: [ya] }).includes('solape'));
});

test('propuesta de actividad: queda en borrador con la evidencia y el origen de la electricidad', () => {
  const l = proponerActividad({ ...luz, garantiaOrigen: 'renovable_balear' }, { id: 'a1', centro: 'Hotel', documentoId: 'DOC-1' });
  assert.equal(l.categoria, 'electricidad');
  assert.equal(l.origenElectricidad, 'gdo_renovable_balear');
  assert.equal(l.evidencia, 'DOC-1');
  const g = proponerActividad({ tipo: 'gas_natural', cantidad: 100, unidad: 'kWh PCS' }, { id: 'a2', centro: 'Hotel', documentoId: 'DOC-2' });
  assert.equal(g.fuente, 'Gas natural (kWhPCS)*');
  assert.equal(g.categoria, 'combustion_fija');
});

test('variación anual: se obliga a analizar por encima del 20 %', () => {
  assert.equal(variacionAnual(130, 100).analizar, true);
  assert.equal(variacionAnual(110, 100).analizar, false);
  assert.equal(variacionAnual(50, 0).variacion, null);
});

test('exclusión por insignificancia: cada fuente < 3 % y el conjunto ≤ 5 %', () => {
  const fuentes = [
    { fuente: 'gas', kgCO2e: 90000 }, { fuente: 'extintores', kgCO2e: 275 }, { fuente: 'grupo', kgCO2e: 40 }, { fuente: 'luz', kgCO2e: 9685 },
  ];
  const ok = evaluarExclusiones(fuentes, ['extintores', 'grupo']);
  assert.equal(ok.permitido, true);
  const ko = evaluarExclusiones(fuentes, ['luz']);
  assert.equal(ko.permitido, false);
});

test('solapes: contadores distintos no son conflicto; sin contador se pide identificarlo; mismo contador sí avisa', () => {
  const x = { id: 'F1', proveedor: 'Comercializadora X', contador: 'ES0021000000000001AA', periodoDesde: '2024-03-01', periodoHasta: '2024-03-31', cantidad: 15000, tipo: 'electricidad' as const };
  const otro = { ...luz, contador: 'ES0021000000000002BB' };
  assert.deepEqual(codigos(otro, { ...ctx, existentes: [x] }), []); // mismo periodo y misma cantidad, pero otro contador
  assert.deepEqual(codigos({ ...otro, periodoDesde: '2024-03-15', periodoHasta: '2024-04-14' }, { ...ctx, existentes: [x] }), []);
  const sin = validarExtraccion(luz, { ...ctx, existentes: [x] });
  assert.ok(sin.some((i) => i.codigo === 'duplicada' && /contadores distintos/.test(i.mensaje)));
  assert.ok(codigos({ ...luz, contador: x.contador, periodoDesde: '2024-03-15', periodoHasta: '2024-04-14' }, { ...ctx, existentes: [x] }).includes('solape'));
  assert.ok(codigos({ ...luz, contador: 'VARIOS' }).includes('varios_contadores'));
});

test('la propuesta de actividad conserva el contador', () => {
  assert.equal(proponerActividad({ ...luz, contador: 'ES1' }, { id: 'a', centro: 'H', documentoId: 'D' }).contador, 'ES1');
});

const ex = (id: string, contador: string | undefined, d: string, h: string, proveedor = 'Comercializadora X') => ({ id, proveedor, contador, periodoDesde: d, periodoHasta: h, cantidad: 1000, tipo: 'electricidad' as const });

test('CUPS: se normaliza (mayúsculas, sin espacios, sin los 2 caracteres de control)', () => {
  assert.equal(normalizarContador('es 0021 0000 1234 5678 ab 0f'), 'ES0021000012345678AB');
  assert.equal(normalizarContador('ES0021000012345678AB'), 'ES0021000012345678AB');
  assert.equal(normalizarContador(' 12-345 '), '12345');
  assert.equal(normalizarContador(undefined), '');
  // con y sin los caracteres de control es el mismo contador: no hay conflicto de «contadores distintos»
  const x = { ...ex('F1', 'ES0021000012345678AB0F', '2024-03-01', '2024-03-31'), cantidad: 15000 };
  assert.ok(codigos({ ...luz, contador: 'ES0021000012345678AB' }, { ...ctx, existentes: [x] }).includes('duplicada'));
});

test('contador por exclusión: si el periodo se solapa con el de un contador, pertenece al otro', () => {
  const existentes = [ex('F1', 'ES0021000000000001AA', '2024-03-01', '2024-03-31'), ex('F2', 'ES0021000000000002BB', '2024-02-01', '2024-02-29')];
  const a = asignarContador({ ...luz, contador: undefined }, { existentes });
  assert.equal(a.contador, 'ES0021000000000002BB');
  assert.deepEqual(a.solapaCon, ['ES0021000000000001AA']);
  assert.match(a.motivo!, /se solapa/);
  // ya tiene contador: no se toca
  assert.equal(asignarContador({ ...luz, contador: 'ES0021000000000001AA' }, { existentes }).contador, undefined);
  // sin solape: no se deduce nada
  assert.equal(asignarContador({ ...luz, periodoDesde: '2024-05-01', periodoHasta: '2024-05-31' }, { existentes }).contador, undefined);
});

test('contador por continuidad cuando quedan varios posibles; si no, candidatos', () => {
  const existentes = [
    ex('F1', 'ES0021000000000001AA', '2024-03-01', '2024-03-31'),
    ex('F2', 'ES0021000000000002BB', '2024-02-01', '2024-02-29'),
    ex('F3', 'ES0021000000000003CC', '2024-06-01', '2024-06-30'),
  ];
  const a = asignarContador({ ...luz }, { existentes });
  assert.equal(a.contador, 'ES0021000000000002BB'); // BB termina el 29-feb, pegado al 1-mar
  const dudoso = asignarContador({ ...luz, periodoDesde: '2024-03-10', periodoHasta: '2024-04-09' }, { existentes: [ex('F1', 'ES0021000000000001AA', '2024-03-01', '2024-03-31'), ex('F2', 'ES0021000000000002BB', '2024-01-01', '2024-01-31'), ex('F3', 'ES0021000000000003CC', '2024-07-01', '2024-07-31')] });
  assert.equal(dudoso.contador, undefined);
  assert.deepEqual(dudoso.candidatos.sort(), ['ES0021000000000002BB', 'ES0021000000000003CC']);
});

test('los contadores pertenecen a un centro: no se mezclan facturas de otro centro', () => {
  const existentes = [{ ...ex('F1', 'ES0021000000000001AA', '2024-03-01', '2024-03-31'), centro: 'C2' }];
  assert.equal(asignarContador({ ...luz }, { centro: 'C1', existentes }).candidatos.length, 0);
  assert.deepEqual(codigos(luz, { ...ctx, centro: 'C1', existentes }), []);
  assert.ok(codigos({ ...luz, contador: 'ES0021000000000001AA' }, { ...ctx, centro: 'C2', existentes }).includes('mismo_periodo'));
});

test('consumo cero: se puede validar aunque falte la unidad o sea de otro tipo; solo avisa', () => {
  assert.deepEqual(codigos({ ...luz, cantidad: 0, unidad: undefined }), ['cantidad_cero']);
  const gas: ExtraccionFactura = { tipo: 'gas_natural', proveedor: 'G', periodoDesde: '2024-01-01', periodoHasta: '2024-01-31', cantidad: 0, unidad: 'm3', confianza: 0.9 };
  assert.deepEqual(codigos(gas), ['cantidad_cero']);
  assert.ok(codigos({ ...gas, cantidad: 5 }).includes('unidad_gas')); // con consumo sí exige aclarar la unidad
  assert.ok(codigos({ ...luz, cantidad: undefined }).includes('cantidad')); // faltar la cantidad sigue siendo un error
});
