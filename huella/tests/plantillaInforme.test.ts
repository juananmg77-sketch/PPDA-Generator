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
test('resumen ejecutivo: tres conclusiones por reglas (fuente > 25 %, variación > 15 %, incertidumbre alta…) y hechos de relleno', () => {
  const base = { anio: 2024, total: 100, cat1: 30, cat2: 70, porFuente: { Electricidad: 70, 'Gas natural': 20, R410A: 10 }, ratioEstancia: 0.01, ratioTrabajador: null, variacion: { pct: 20, anioRef: 2019, tipo: 'base' as const }, incertidumbre: { pct: 25, valoracion: 'Alta', principal: 'Gas natural' }, pendientes: 2 };
  const c = conclusiones(base);
  assert.equal(c.length, 3);
  assert.match(c[0], /«Electricidad» concentra el 70,0 %/); assert.match(c[1], /aumentan un 20,0 % respecto al año base \(2019\)/); assert.match(c[2], /incertidumbre combinada es alta/);
  // sin nada llamativo siempre salen tres, con hechos
  const calma = conclusiones({ ...base, porFuente: { A: 20, B: 20, C: 20, D: 20, E: 20 }, cat1: 50, cat2: 50, variacion: { pct: 5, anioRef: 2023, tipo: 'anterior' }, incertidumbre: { pct: 3, valoracion: 'Baja', principal: null }, pendientes: 0 });
  assert.equal(calma.length, 3); assert.ok(calma.every((x) => !/NaN|undefined|null/.test(x)));
  assert.match(conclusiones({ ...base, variacion: { pct: -30, anioRef: 2023, tipo: 'anterior' }, porFuente: { A: 20, B: 20, C: 20, D: 20, E: 20 } }).join(' '), /disminuyen un 30,0 % respecto al año anterior \(2023\)/);
  assert.deepEqual(fuentesPrincipales(base.porFuente, 100, 2).map((x) => x.fuente), ['Electricidad', 'Gas natural']);
  assert.equal(conclusiones({ ...base, variacion: null, pendientes: 0 }, { fuentePct: 80 }).some((x) => /concentra/.test(x)), false); // umbral configurable
});
test('cláusula de confidencialidad configurable; por defecto, datos del cliente y metodología de HS Consulting Group', () => {
  assert.match(CONFIDENCIALIDAD_POR_DEFECTO, /pertenecen a la organización cliente/); assert.match(CONFIDENCIALIDAD_POR_DEFECTO, /metodología, el formato y el diseño.*HS CONSULTING GROUP/);
  assert.equal(configPlantilla().confidencialidad, CONFIDENCIALIDAD_POR_DEFECTO);
  assert.equal(configPlantilla({ confidencialidad: 'Texto propio.' }).confidencialidad, 'Texto propio.');
  assert.equal(configPlantilla({ confidencialidad: '  ' }).confidencialidad, CONFIDENCIALIDAD_POR_DEFECTO);
});
