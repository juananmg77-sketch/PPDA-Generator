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

test('cierre: avisa (info) de centros sin plantilla media solo si se ha usado', () => {
  const sin = evaluarCierre({ ...base, centrosSinPlantilla: ['Hotel B'] }).items.find((i) => i.codigo === 'plantilla_media');
  assert.ok(sin && sin.nivel === 'info' && /Hotel B/.test(sin.mensaje));
  assert.ok(!evaluarCierre({ ...base, centrosSinPlantilla: [] }).items.some((i) => i.codigo === 'plantilla_media'));
  assert.ok(evaluarCierre({ ...base, centrosSinPlantilla: ['Hotel B'] }).puedeCerrar);
});

// ── Caso real: un mismo contrato de gas con tres identificadores distintos ──
import { facturasDuplicadas, seriesDeSuministro } from '../cierre.ts';
const g = (nombre: string, contador: string | null, d: string, h: string, cantidad: number) => ({ nombre, centro: 'Hotel A', estado: 'revisado' as const, tipo: 'gas_natural', contador, periodoDesde: d, periodoHasta: h, cantidad });
const gasAstoria = [
  g('ene (falta 2ª pág.)', null, '2023-12-21', '2024-01-23', 0), g('feb', 'ES0238833000167922NX', '2024-01-23', '2024-02-21', 0), g('mar', '816000231', '2024-02-21', '2024-03-20', 5930),
  g('abr1 DUPLICADO', 'ES0238330000167922NX', '2024-03-20', '2024-04-02', 7389), g('abr1', '816000231', '2024-03-20', '2024-04-02', 7389), g('abr2', '816000231', '2024-04-02', '2024-04-22', 11354),
  g('may', 'ES0238330000167922NX', '2024-04-22', '2024-05-27', 23287), g('jun', '816000231', '2024-05-27', '2024-06-20', 16091), g('jul', '816000231', '2024-06-20', '2024-07-22', 21295),
  g('ago', 'ES0238330000167922NX', '2024-07-22', '2024-08-23', 21509), g('sep', 'ES0238330000167922NX', '2024-08-23', '2024-09-21', 20005.67), g('oct', '816000231', '2024-09-21', '2024-10-22', 18287.27),
  g('nov', 'ES0238330000167922NX', '2024-10-22', '2024-11-21', 25765), g('dic', null, '2024-12-01', '2024-12-31', 0),
];
test('un mismo suministro con identificadores distintos no genera huecos falsos; se detectan duplicado y consumos a cero', () => {
  assert.equal(seriesDeSuministro(gasAstoria).length, 1);
  assert.deepEqual(huecosMensuales(gasAstoria, 2024), []);
  const dup = facturasDuplicadas(gasAstoria); assert.equal(dup.length, 1); assert.deepEqual(dup[0].map((d) => d.nombre).sort(), ['abr1', 'abr1 DUPLICADO']);
  const r = evaluarCierre({ ...base, docs: gasAstoria });
  assert.equal(r.puedeCerrar, false);
  assert.ok(r.items.some((i) => i.codigo === 'facturas_duplicadas' && i.nivel === 'error'));
  assert.deepEqual(r.items.find((i) => i.codigo === 'consumo_cero')!.detalle!.map((d) => d.texto), ['ene (falta 2ª pág.)', 'feb', 'dic']);
  assert.ok(!r.items.some((i) => i.codigo === 'hueco_meses'));
});
test('dos contadores que facturan a la vez siguen siendo series distintas', () => {
  const a = [g('a1', 'A', '2024-01-01', '2024-01-31', 10), g('a2', 'A', '2024-04-01', '2024-04-30', 10), g('b1', 'B', '2024-01-01', '2024-03-31', 10)];
  assert.equal(seriesDeSuministro(a).length, 2);
  assert.deepEqual(huecosMensuales(a, 2024)[0].faltan, ['feb', 'mar']);
});

test('cada factura afectada lleva su identificador para poder abrirla y decidir sobre ella', () => {
  const docs = gasAstoria.map((d, i) => ({ ...d, id: `doc-${i}` }));
  const r = evaluarCierre({ ...base, docs });
  const dup = r.items.find((i) => i.codigo === 'facturas_duplicadas')!.detalle!;
  assert.ok(dup.every((x) => x.docId && x.docId.startsWith('doc-')));
  assert.equal(r.items.find((i) => i.codigo === 'consumo_cero')!.detalle!.length, 3);
  assert.ok(r.items.find((i) => i.codigo === 'consumo_cero')!.detalle!.every((x) => !!x.docId));
});

test('si los resultados por gas/categoría no cuadran con el total, el cierre se bloquea', () => {
  const ok = evaluarCierre({ ...base, cuadreIso: { ok: true, incidencias: [] } });
  assert.ok(!ok.items.some((i) => i.codigo === 'cuadre_iso'));
  const mal = evaluarCierre({ ...base, cuadreIso: { ok: false, incidencias: ['La suma por gas no coincide con la categoría 1.'] } });
  const item = mal.items.find((i) => i.codigo === 'cuadre_iso')!;
  assert.equal(item.nivel, 'error'); assert.equal(mal.puedeCerrar, false);
  assert.match(item.detalle![0].texto, /suma por gas/);
});
test('las categorías ISO sin evaluar se avisan una a una', () => {
  const r = evaluarCierre({ ...base, categoriasSinEvaluar: [{ n: 3, nombre: 'Transporte' }, { n: 5, nombre: 'Uso de productos de la organización' }] });
  const item = r.items.find((i) => i.codigo === 'categorias_sin_evaluar')!;
  assert.equal(item.nivel, 'aviso'); assert.equal(item.detalle!.length, 2);
  assert.ok(!evaluarCierre(base).items.some((i) => i.codigo === 'categorias_sin_evaluar'));
});

test('significancia en el cierre: no realizada, incompleta, significativas sin cuantificar y exclusiones directas', () => {
  const codigos = (r: ReturnType<typeof evaluarCierre>) => r.items.map((i) => i.codigo);
  assert.ok(!codigos(evaluarCierre(base)).includes('significancia_no_realizada')); // sin dato: no se avisa
  assert.ok(codigos(evaluarCierre({ ...base, significancia: null })).includes('significancia_no_realizada'));
  const mal = evaluarCierre({ ...base, significancia: { completa: false, significativasCuantificadas: false, sinValorar: ['3.1 Transporte'], excluidasSinJustificar: ['3.2 x'], significativasSinCuantificar: ['4.1 Alimentos'], faltas: [] } });
  for (const c of ['significancia_incompleta', 'significativas_sin_cuantificar', 'declaracion_parcial']) assert.ok(codigos(mal).includes(c), c);
  assert.equal(mal.items.find((i) => i.codigo === 'significancia_incompleta')!.detalle!.length, 2);
  const ok = evaluarCierre({ ...base, significancia: { completa: true, significativasCuantificadas: true, sinValorar: [], excluidasSinJustificar: [], significativasSinCuantificar: [], faltas: [] } });
  assert.ok(!codigos(ok).some((c) => /significancia|significativas|declaracion/.test(c)));
  const dir = evaluarCierre({ ...base, exclusionesDirectas: ['Exclusión «X» (categoría 1): falta la evidencia.'] });
  assert.equal(dir.items.find((i) => i.codigo === 'exclusiones_directas')!.nivel, 'error'); assert.equal(dir.puedeCerrar, false);
});

test('año base en el cierre: sin definir, sin datos y regla de recálculo sin decisión (bloquea) o documentada', () => {
  const cod = (r: ReturnType<typeof evaluarCierre>) => r.items.map((i) => i.codigo);
  assert.ok(cod(evaluarCierre({ ...base, anioBase: { definido: false, conDatos: false, recalculo: null } })).includes('anio_base_sin_definir'));
  assert.ok(cod(evaluarCierre({ ...base, anioBase: { definido: true, conDatos: false, recalculo: null } })).includes('anio_base_sin_datos'));
  const disp = [{ titulo: 'Cambio de límites (alta o baja de centros)', detalle: ['Alta de «Hotel B»'] }];
  const sin = evaluarCierre({ ...base, anioBase: { definido: true, conDatos: true, recalculo: { disparadores: disp, noEvaluables: [], incidencias: ['Se cumple una regla de recálculo del año base: hay que documentar si se recalcula o no.'] } } });
  assert.equal(sin.items.find((i) => i.codigo === 'recalculo_sin_decision')!.nivel, 'error'); assert.equal(sin.puedeCerrar, false);
  const con = evaluarCierre({ ...base, anioBase: { definido: true, conDatos: true, recalculo: { disparadores: disp, noEvaluables: ['Cambio de metodología: falta declarar.'], incidencias: [] } } });
  assert.ok(cod(con).includes('recalculo_documentado')); assert.ok(cod(con).includes('recalculo_no_evaluable')); assert.ok(!cod(con).includes('recalculo_sin_decision'));
});

test('datos de la organización en el cierre: lo obligatorio que falta bloquea; los avisos de razón social no', () => {
  assert.ok(!evaluarCierre(base).items.some((i) => i.codigo === 'organizacion_datos'));
  const mal = evaluarCierre({ ...base, organizacion: { faltan: ['Falta el IAE de la organización.', 'Falta el cargo del responsable del informe.'], avisos: [] } });
  const item = mal.items.find((i) => i.codigo === 'organizacion_datos')!;
  assert.equal(item.nivel, 'error'); assert.equal(mal.puedeCerrar, false); assert.equal(item.detalle!.length, 2);
  const av = evaluarCierre({ ...base, organizacion: { faltan: [], avisos: ['La razón social coincide con el nombre comercial.'] } });
  assert.equal(av.items.find((i) => i.codigo === 'organizacion_avisos')!.nivel, 'aviso');
  assert.ok(!av.items.some((i) => i.codigo === 'organizacion_datos'));
});
