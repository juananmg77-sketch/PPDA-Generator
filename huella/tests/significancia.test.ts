import test from 'node:test';
import assert from 'node:assert/strict';
import { CRITERIOS_POR_DEFECTO, criteriosDe, declaracionConformidad, estadoEvaluacion, evaluarExclusionesDirectas, evaluarSignificancia, PLANTILLA_HOTELES, sectorDeCnae } from '../significancia.ts';
import type { Evaluacion } from '../significancia.ts';

const c = CRITERIOS_POR_DEFECTO;
const val = (o: object = {}) => ({ magnitudPct: 0.2, influencia: 'baja' as const, datos: 'parciales' as const, requisitos: false, ...o });

test('plantilla de hoteles: subcategorías de las categorías 3 a 6 y sector por CNAE', () => {
  assert.ok(PLANTILLA_HOTELES.length >= 12);
  assert.deepEqual([...new Set(PLANTILLA_HOTELES.map((x) => x.categoria))].sort(), [3, 4, 5, 6]);
  for (const nombre of ['Transporte de mercancías', 'Desplazamientos de los empleados', 'Transporte de clientes', 'Alimentos y bebidas', 'Otros bienes y servicios comprados', 'Bienes de capital', 'Residuos', 'Agua', 'Lavandería externalizada']) assert.ok(PLANTILLA_HOTELES.some((x) => x.nombre.includes(nombre)), nombre);
  assert.equal(sectorDeCnae('5510'), 'hoteles'); assert.equal(sectorDeCnae('4711'), 'general'); assert.equal(sectorDeCnae(null), 'general');
});
test('criterios: magnitud, requisitos e influencia con datos; por defecto y configurables', () => {
  assert.equal(evaluarSignificancia(val(), c).resultado, 'no_significativa');
  assert.equal(evaluarSignificancia(val({ magnitudPct: 1 }), c).resultado, 'significativa');
  assert.equal(evaluarSignificancia(val({ requisitos: true }), c).resultado, 'significativa');
  assert.equal(evaluarSignificancia(val({ influencia: 'alta' }), c).resultado, 'significativa');
  assert.equal(evaluarSignificancia(val({ influencia: 'alta', datos: 'no_disponibles' }), c).resultado, 'no_significativa');
  // umbral por organización
  assert.equal(evaluarSignificancia(val({ magnitudPct: 1 }), criteriosDe({ umbralMagnitud: 5 })).resultado, 'no_significativa');
  // un criterio desactivado no se exige
  const r = evaluarSignificancia({ magnitudPct: 3, influencia: null, datos: null, requisitos: null }, criteriosDe({ activos: { magnitud: true, influencia: false, datos: false, requisitos: false } }));
  assert.equal(r.completa, true); assert.equal(r.resultado, 'significativa');
});
test('falta valorar un criterio activo: no hay resultado y se dice cuál', () => {
  const r = evaluarSignificancia(val({ magnitudPct: null, requisitos: null }), c);
  assert.equal(r.completa, false); assert.equal(r.resultado, null); assert.deepEqual(r.sinValorar, ['magnitud estimada', 'requisitos de clientes o normativos']);
});
const plantilla = PLANTILLA_HOTELES.slice(0, 3);
const ev = (codigo: string, o: Partial<Evaluacion> = {}): Evaluacion => ({ codigo, categoria: 3, nombre: 'x', ...val(), resultado: null, justificacion: null, cuantificada: false, ...o });
test('evaluación completa: todo valorado, exclusiones justificadas y significativas cuantificadas', () => {
  const ok = estadoEvaluacion(plantilla, [ev('3.1', { justificacion: 'Escasa' }), ev('3.2', { requisitos: true, cuantificada: true }), ev('3.3', { justificacion: 'Sin datos' })], c);
  assert.equal(ok.completa, true); assert.equal(ok.significativasCuantificadas, true); assert.deepEqual(ok.faltas, []);
  const falta = estadoEvaluacion(plantilla, [ev('3.1'), ev('3.2', { requisitos: true })], c);
  assert.equal(falta.completa, false);
  assert.deepEqual(falta.sinValorar.map((x) => x.slice(0, 3)), ['3.3']);
  assert.deepEqual(falta.excluidasSinJustificar.map((x) => x.slice(0, 3)), ['3.1']);
  assert.deepEqual(falta.significativasSinCuantificar.map((x) => x.slice(0, 3)), ['3.2']);
  assert.equal(falta.faltas.length, 3);
});
test('exclusión sin justificación es incidencia aunque el resto esté completo', () => {
  const e = estadoEvaluacion(plantilla, plantilla.map((p) => ev(p.codigo, { justificacion: '  ' })), c);
  assert.equal(e.completa, false); assert.equal(e.excluidasSinJustificar.length, 3);
});
test('exclusiones de la categoría 1: % y evidencia obligatorios y suma contra el umbral configurado', () => {
  assert.deepEqual(evaluarExclusionesDirectas([{ fuente: 'Extintores', porcentaje: 0.4, evidencia: true }], c).incidencias, []);
  const r = evaluarExclusionesDirectas([{ fuente: 'A', porcentaje: null, evidencia: false }, { fuente: 'B', porcentaje: 2.5, evidencia: true }, { fuente: 'C', porcentaje: 2.8, evidencia: true }], c);
  assert.ok(r.incidencias.some((x) => /«A».*porcentaje/.test(x))); assert.ok(r.incidencias.some((x) => /«A».*evidencia/.test(x)));
  assert.equal(r.supera, true); assert.ok(r.incidencias.some((x) => /suma/.test(x)));
  assert.equal(evaluarExclusionesDirectas([{ fuente: 'B', porcentaje: 2.5, evidencia: true }, { fuente: 'C', porcentaje: 2.8, evidencia: true }], criteriosDe({ exclusionDirectaTotal: 10 })).supera, false);
});
test('declaración: caso a) completa y cuantificada; caso b) en otro caso, con lo que falta; textos desde la configuración', () => {
  const ok = estadoEvaluacion(plantilla, plantilla.map((p) => ev(p.codigo, { justificacion: 'j' })), c);
  const a = declaracionConformidad(ok, 2024);
  assert.equal(a.caso, 'a'); assert.match(a.texto, /conforme a la norma ISO 14064-1:2018 y a los requisitos del Decreto 48\/2021/);
  const malo = estadoEvaluacion(plantilla, [ev('3.1')], c);
  const b = declaracionConformidad(malo, 2024);
  assert.equal(b.caso, 'b'); assert.match(b.texto, /siguiendo la metodología de ISO 14064-1:2018/); assert.doesNotMatch(b.texto.split('.')[0], /conforme a la norma/); assert.match(b.texto, /sin valorar/);
  const sin = declaracionConformidad(null, 2024); assert.equal(sin.caso, 'b');
  const cfg = declaracionConformidad(ok, 2025, { programa: 'Programa X', a: 'A {anio} {programa}' });
  assert.equal(cfg.texto, 'A 2025 Programa X');
  assert.doesNotMatch(b.texto, /\{|undefined|null|NaN/);
});
