import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RESOLUCIONES_FACTORES, textoResolucion, validarCatalogoResoluciones, validarResolucion } from '../resolucion.ts';
import { construirConjunto } from '../factores.ts';
import { APARTADOS_ISO, evaluarCorrespondencia } from '../correspondenciaIso.ts';
import type { ContextoCorrespondencia } from '../correspondenciaIso.ts';
import { conclusiones, fuentesPrincipales } from '../resumenEjecutivo.ts';
import { CONFIDENCIALIDAD_POR_DEFECTO, configPlantilla } from '../configInforme.ts';
import type { DatosCalculadora } from '../tipos.ts';

test('resolución de factores: datos estructurados por año, cita generada y sin repetir citas entre años distintos', () => {
  assert.deepEqual(validarCatalogoResoluciones(), []);
  const r24 = RESOLUCIONES_FACTORES[2024];
  assert.equal(r24.boletin, 'BOIB'); assert.equal(r24.numero, '35'); assert.equal(r24.fecha, '2026-03-19'); assert.match(r24.enlace!, /^https:\/\//); assert.equal(r24.archivoMiteco!.version, '5');
  assert.match(textoResolucion(r24), /BOIB n\.º 35, de 19 de marzo de 2026.*versión 5.*06\/05\/2025/);
  assert.deepEqual(validarResolucion(r24), []);
  assert.ok(validarResolucion(RESOLUCIONES_FACTORES[2023]).some((x) => /enlace/.test(x))); // la de 2023 aún no tiene enlace
  assert.ok(validarResolucion(null).length === 1);
  // la misma cita en dos años distintos es un error
  const dup = { 2023: { ...r24, anio: 2023 }, 2024: r24 };
  assert.ok(validarCatalogoResoluciones(dup).some((x) => /repiten la misma cita/.test(x)));
  assert.ok(validarCatalogoResoluciones({ 2023: { ...r24, anio: 2023, fecha: '2025-03-20' }, 2024: { ...r24, enlace: r24.enlace } }).some((x) => /mismo enlace|mismo archivo/.test(x)));
});
test('cada conjunto de factores guarda la resolución de su año', () => {
  const d23: DatosCalculadora = JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2023.2.json', import.meta.url), 'utf-8'));
  const d24: DatosCalculadora = JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2024.1.json', import.meta.url), 'utf-8'));
  assert.equal(construirConjunto(d23, { anioInventario: 2023 }).resolucion!.fecha, '2025-03-20');
  assert.equal(construirConjunto(d24, { anioInventario: 2024 }).resolucion!.fecha, '2026-03-19');
  assert.notDeepEqual(construirConjunto(d23, { anioInventario: 2023 }).resolucion, construirConjunto(d24, { anioInventario: 2024 }).resolucion);
});

const ok: ContextoCorrespondencia = { organizacionCompleta: true, responsableCompleto: true, criterioConsolidacion: true, centros: 1, evaluacionCompleta: true, categoriasSinEvaluar: 0, exclusiones: { total: 1, sinJustificar: 0, directasIncompletas: 0 }, baseDefinida: true, baseConDatos: true, recalculoSinDecision: false, metodologiaDeclarada: true, hayBiogenico: false, resolucionCompleta: true, conjuntoFijado: true, gwpConFuente: true, incertidumbreCalculada: true, incidenciasIncertidumbre: 0, cuadreOk: true, declaracionCaso: 'a', verificado: false, verificacionCompleta: false };
const est = (c: ContextoCorrespondencia, a: string) => evaluarCorrespondencia(c).find((x) => x.apartado === a)!;
test('correspondencia con el 9.3.1: cada apartado Cumple / No cumple / No aplica según los datos', () => {
  const f = evaluarCorrespondencia(ok);
  assert.deepEqual(f.map((x) => x.apartado), 'abcdefghijklmnopqrst'.split('')); assert.equal(f.length, APARTADOS_ISO.length);
  assert.equal(est(ok, 'k').estado, 'Cumple'); assert.equal(est(ok, 'g').estado, 'No aplica'); assert.equal(est(ok, 'h').estado, 'No aplica'); assert.equal(est(ok, 's').estado, 'No aplica'); assert.equal(est(ok, 'r').estado, 'Cumple');
  // «k» no cumple si no hay inventario del año base
  assert.equal(est({ ...ok, baseDefinida: false, baseConDatos: false }, 'k').estado, 'No cumple'); assert.match(est({ ...ok, baseDefinida: false, baseConDatos: false }, 'k').motivo, /No existe inventario del año base/);
  assert.equal(est({ ...ok, baseConDatos: false }, 'l').estado, 'No cumple');
  assert.equal(est({ ...ok, recalculoSinDecision: true }, 'l').estado, 'No cumple');
  assert.equal(est({ ...ok, evaluacionCompleta: null }, 'e').estado, 'No cumple');
  assert.equal(est({ ...ok, declaracionCaso: 'b' }, 'r').estado, 'No cumple');
  assert.equal(est({ ...ok, categoriasSinEvaluar: 2 }, 'j').estado, 'No cumple');
  assert.equal(est({ ...ok, exclusiones: { total: 2, sinJustificar: 1, directasIncompletas: 0 } }, 'i').estado, 'No cumple');
  assert.equal(est({ ...ok, exclusiones: { total: 0, sinJustificar: 0, directasIncompletas: 0 } }, 'i').estado, 'No aplica');
  assert.equal(est({ ...ok, resolucionCompleta: false }, 'o').estado, 'No cumple');
  assert.equal(est({ ...ok, hayBiogenico: true }, 'g').estado, 'Cumple');
  assert.equal(est({ ...ok, verificado: true, verificacionCompleta: false }, 's').estado, 'No cumple');
  assert.equal(est({ ...ok, verificado: true, verificacionCompleta: true }, 's').estado, 'Cumple');
  assert.equal(est({ ...ok, incidenciasIncertidumbre: 1 }, 'q').estado, 'No cumple');
});
test('conclusiones: siempre valoran (evolución frente al año base, fuentes de mayor a menor, cambios por fuente, intensidad) y no incluyen avisos internos', () => {
  const ref = { anio: 2023, tipo: 'base' as const, total: 120, ratioEstancia: 0.012, ratioTrabajador: null };
  const base = { anio: 2024, total: 100, cat1: 30, cat2: 70, porFuente: { 'Gas natural': 20, Electricidad: 70, R410A: 10 }, ratioEstancia: 0.01, ratioTrabajador: null, variacion: { pct: -16.7, anioRef: 2023, tipo: 'base' as const }, incertidumbre: { pct: 4, valoracion: 'Baja', principal: 'Gas natural' }, pendientes: 2, ref, cambiosFuente: [{ fuente: 'Electricidad', actual: 70, ref: 85 }, { fuente: 'Combustibles', actual: 20, ref: 15 }, { fuente: 'Fugitivas', actual: 10, ref: 20 }] };
  const c = conclusiones(base);
  assert.equal(c.length, 4);
  assert.match(c[0], /Evolución: en 2024 se emiten 100,00 t CO₂e/); assert.match(c[0], /Frente al año base \(2023: 120,00 t\) bajan 20,00 t \(−16,7 %\): evolución claramente favorable/);
  assert.match(c[1], /de mayor a menor: Electricidad \(70,0 %, 70,00 t\); Gas natural \(20,0 %/); assert.match(c[1], /«Electricidad» supera el umbral/);
  assert.match(c[2], /la que más aumenta es «Combustibles» \(\+5,00 t, \+33,3 %\) y la que más disminuye es «Electricidad» \(−15,00 t, −17,6 %\)/);
  assert.match(c[3], /Intensidad: 0,0100 t CO₂e por estancia \(0,0120 en 2023; −16,7 %, mejora\)/);
  assert.ok(!c.some((x) => /pendiente|por resolver/i.test(x))); // los avisos internos no van en las conclusiones
  // empeora / estable
  assert.match(conclusiones({ ...base, total: 140, variacion: { pct: 16.7, anioRef: 2023, tipo: 'base' } })[0], /suben 20,00 t \(\+16,7 %\): evolución claramente desfavorable/);
  assert.match(conclusiones({ ...base, total: 121 })[0], /estable/);
  // sin año base: lo dice y no inventa valoración
  const sin = conclusiones({ ...base, ref: null, variacion: null, cambiosFuente: [] });
  assert.match(sin[0], /No hay año base ni año anterior/); assert.ok(sin.every((x) => !/NaN|undefined|null/.test(x)));
  assert.deepEqual(fuentesPrincipales(base.porFuente, 100, 2).map((x) => x.fuente), ['Electricidad', 'Gas natural']);
  // incertidumbre alta se destaca
  assert.ok(conclusiones({ ...base, incertidumbre: { pct: 25, valoracion: 'Alta', principal: 'Gas natural' } }).some((x) => /Calidad del dato/.test(x)));
});
test('cláusula de confidencialidad configurable; por defecto, datos del cliente y metodología de HS Consulting Group', () => {
  assert.match(CONFIDENCIALIDAD_POR_DEFECTO, /pertenecen a la organización cliente/); assert.match(CONFIDENCIALIDAD_POR_DEFECTO, /metodología, el formato y el diseño.*HS CONSULTING GROUP/);
  assert.equal(configPlantilla().confidencialidad, CONFIDENCIALIDAD_POR_DEFECTO);
  assert.equal(configPlantilla({ confidencialidad: 'Texto propio.' }).confidencialidad, 'Texto propio.');
  assert.equal(configPlantilla({ confidencialidad: '  ' }).confidencialidad, CONFIDENCIALIDAD_POR_DEFECTO);
});
