import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluarCierre, evaluarExclusionesEstimadas, huecosMensuales } from '../cierre.ts';
import type { EntradaCierre } from '../cierre.ts';

const rev = (tipo: string, contador: string | null, d: string, h: string) => ({ estado: 'revisado' as const, tipo, contador, periodoDesde: d, periodoHasta: h });
const base: EntradaCierre = {
  anio: 2024, docs: [rev('electricidad', 'A', '2024-01-01', '2024-01-31'), rev('electricidad', 'A', '2024-02-01', '2024-02-29')],
  actividadConfirmada: 2, actividadManual: 0, fallosCalculo: 0, centrosSinIndice: [], factoresId: 'calculadora-2024.1@2024', factoresFijados: true,
  exclusiones: [], ncAbiertas: 0,
};
const niveles = (e: EntradaCierre) => evaluarCierre(e).items.filter((i) => i.nivel !== 'ok' && i.nivel !== 'info').map((i) => `${i.nivel}:${i.codigo}`);

test('un inventario completo se puede cerrar sin errores ni avisos', () => {
  const r = evaluarCierre(base);
  assert.equal(r.puedeCerrar, true);
  assert.deepEqual(niveles(base), []);
});

test('facturas pendientes, sin actividad o con fallos de cálculo bloquean el cierre', () => {
  assert.equal(evaluarCierre({ ...base, docs: [...base.docs, { estado: 'leido', tipo: 'gas_natural' }] }).puedeCerrar, false);
  assert.equal(evaluarCierre({ ...base, actividadConfirmada: 0 }).puedeCerrar, false);
  assert.equal(evaluarCierre({ ...base, fallosCalculo: 1 }).puedeCerrar, false);
});

test('huecos de meses entre el primero y el último cubierto, por contador', () => {
  const docs = [rev('electricidad', 'A', '2024-01-01', '2024-01-31'), rev('electricidad', 'A', '2024-04-01', '2024-04-30'), rev('electricidad', 'B', '2024-01-01', '2024-02-29')];
  const h = huecosMensuales(docs, 2024);
  assert.equal(h.length, 1);
  assert.deepEqual(h[0].faltan, ['feb', 'mar']);
  assert.ok(niveles({ ...base, docs }).includes('aviso:hueco_meses'));
});

test('variación de más del 20 % exige análisis escrito', () => {
  const v = [{ nombre: 'Alcance 2', actual: 130, anterior: 100 }, { nombre: 'Total', actual: 105, anterior: 100 }];
  assert.equal(evaluarCierre({ ...base, variaciones: v }).puedeCerrar, false);
  assert.equal(evaluarCierre({ ...base, variaciones: v, analisisVariacion: 'Apertura de nuevas instalaciones en abril.' }).puedeCerrar, true);
  assert.equal(evaluarCierre({ ...base, variaciones: [{ nombre: 'Total', actual: 105, anterior: 100 }] }).puedeCerrar, true);
  assert.ok(evaluarCierre(base).items.some((i) => i.codigo === 'sin_anterior'));
});

test('exclusiones: criterio de insignificancia (cada fuente < 3 %, total ≤ 5 %) y justificación obligatoria', () => {
  assert.equal(evaluarExclusionesEstimadas([{ porcentaje: 0.03 }, { porcentaje: 0.004 }]).cumple, true);
  assert.equal(evaluarExclusionesEstimadas([{ porcentaje: 3.5 }]).cumple, false);
  assert.equal(evaluarExclusionesEstimadas([{ porcentaje: 2.5 }, { porcentaje: 2.9 }]).cumple, false); // suma 5,4
  assert.equal(evaluarExclusionesEstimadas([{ porcentaje: null }]).cumple, false);
  const ok = { ...base, exclusiones: [{ fuente: 'Extintores', porcentaje: 0.03, justificacion: 'Recargas mínimas, < 0,1 % del total.' }] };
  assert.equal(evaluarCierre(ok).puedeCerrar, true);
  assert.equal(evaluarCierre({ ...ok, exclusiones: [{ fuente: 'X', porcentaje: 1, justificacion: '' }] }).puedeCerrar, false);
  assert.ok(niveles({ ...ok, exclusiones: [{ fuente: 'X', porcentaje: 4, justificacion: 'poco' }] }).includes('aviso:exclusion_criterio'));
});

test('avisos: centros sin índice y no conformidades abiertas no bloquean', () => {
  const e = { ...base, centrosSinIndice: ['Hotel B'], ncAbiertas: 2 };
  assert.equal(evaluarCierre(e).puedeCerrar, true);
  assert.deepEqual(niveles(e), ['aviso:indice_actividad', 'aviso:nc_abiertas']);
});

test('el origen de la electricidad se recuerda una vez al cerrar, sin bloquear', () => {
  const sinOrigen = { ...base, docs: [rev('electricidad', 'A', '2024-01-01', '2024-01-31')] };
  const r = evaluarCierre(sinOrigen);
  assert.ok(r.items.some((i) => i.codigo === 'origen_electricidad' && i.nivel === 'info' && /1 factura/.test(i.mensaje)));
  assert.equal(r.puedeCerrar, true);
  const conOrigen = { ...base, docs: [{ ...rev('electricidad', 'A', '2024-01-01', '2024-01-31'), origenElectricidad: 'no' }] };
  assert.ok(!evaluarCierre(conOrigen).items.some((i) => i.codigo === 'origen_electricidad'));
});

test('las comprobaciones que afectan a facturas indican cuáles son y dónde resolverlas', () => {
  const r = evaluarCierre({
    anio: 2024, docs: [
      { nombre: 'a.pdf', estado: 'subido', tipo: 'electricidad' }, { nombre: 'b.pdf', estado: 'leido', tipo: 'gas_natural' },
      { nombre: 'c.pdf', estado: 'revisado', tipo: 'electricidad', periodoDesde: '2024-01-01', periodoHasta: '2024-01-31' },
    ],
    actividadConfirmada: 3, actividadManual: 0, fallosCalculo: 1, fallosDetalle: ['Hotel · Gasóleo: falta el factor'], centrosSinIndice: [], factoresId: 'x', factoresFijados: true, exclusiones: [], ncAbiertas: 0,
  });
  const pend = r.items.find((i) => i.codigo === 'facturas_pendientes')!;
  assert.deepEqual(pend.detalle!.map((d) => d.texto), ['a.pdf', 'b.pdf']);
  assert.equal(pend.ir, 'facturas');
  assert.deepEqual(r.items.find((i) => i.codigo === 'origen_electricidad')!.detalle!.map((d) => d.texto), ['c.pdf']);
  const f = r.items.find((i) => i.codigo === 'fallos_calculo')!;
  assert.equal(f.ir, 'consumos'); assert.equal(f.detalle![0].texto, 'Hotel · Gasóleo: falta el factor');
});

// ── Correo al cliente con lo pendiente ──
import { mesesSinFactura, redactarCorreoPendientes } from '../correo.ts';
const rv = (centro: string, tipo: string, contador: string | null, d: string, h: string, origen?: string) => ({ estado: 'revisado' as const, centro, tipo, contador, periodoDesde: d, periodoHasta: h, origenElectricidad: origen as never });

test('correo: meses sin factura (año completo pide también enero y diciembre; en curso solo huecos)', () => {
  const docs = [rv('Hotel A', 'electricidad', 'C1', '2024-02-01', '2024-03-31'), rv('Hotel A', 'electricidad', 'C1', '2024-05-01', '2024-05-31')];
  assert.deepEqual(mesesSinFactura(docs, 2024, false)[0].faltan, ['abril']);
  assert.equal(mesesSinFactura(docs, 2024, true)[0].faltan.length, 9);
  assert.deepEqual(mesesSinFactura(docs, 2024, true)[0].faltan.slice(0, 2), ['enero', 'abril']);
  assert.deepEqual(mesesSinFactura([{ ...docs[0], estado: 'subido' as const }], 2024, true), []); // sin cobertura no se reclama
});

test('correo: lista faltantes, ilegibles y electricidad sin garantía; sin pendientes lo dice', () => {
  const docs = [
    rv('Hotel A', 'electricidad', 'C1', '2024-01-01', '2024-01-31'), rv('Hotel A', 'electricidad', 'C1', '2024-03-01', '2024-03-31', 'no'),
    { estado: 'subido' as const, nombre: 'oct.pdf', centro: 'Hotel A', tipo: 'electricidad' }, { estado: 'rechazado' as const, nombre: 'dic.pdf', tipo: 'gas_natural' },
  ];
  const c = redactarCorreoPendientes({ organizacion: 'Cadena X', anio: 2024, anioCompleto: false, docs, remitente: 'Juanan' });
  assert.ok(c.hayPendientes && /febrero/.test(c.cuerpo) && /oct\.pdf \(Hotel A\)/.test(c.cuerpo) && /dic\.pdf/.test(c.cuerpo) && /Garantía de origen/.test(c.cuerpo));
  assert.match(c.asunto, /Cadena X/); assert.match(c.cuerpo, /Juanan$/);
  const ok = redactarCorreoPendientes({ organizacion: 'Cadena X', anio: 2024, anioCompleto: false, docs: [rv('Hotel A', 'electricidad', 'C1', '2024-01-01', '2024-01-31', 'no')], remitente: 'J' });
  assert.equal(ok.hayPendientes, false); assert.match(ok.cuerpo, /no hay documentación pendiente/);
});
