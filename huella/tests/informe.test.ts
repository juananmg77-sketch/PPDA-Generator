import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLANTILLA_HOTELES } from '../significancia.ts';
import { construirConjunto } from '../factores.ts';
import { calcularInventario } from '../motor.ts';
import { CORRESPONDENCIA_ISO, construirInforme } from '../informe.ts';
import type { DatosInforme } from '../informe.ts';
import type { DatosCalculadora, LineaActividad } from '../tipos.ts';

const datos: DatosCalculadora = JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2024.1.json', import.meta.url), 'utf-8'));
const f = construirConjunto(datos, { anioInventario: 2023 });

const lineas: LineaActividad[] = [
  { id: '1', centro: 'Hotel A', categoria: 'electricidad', fuente: '', cantidad: 100000, origenElectricidad: 'red', contador: 'ES1' },
  { id: '2', centro: 'Hotel A', categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 50000 },
  { id: '3', centro: 'Hotel A', categoria: 'fugitiva', fuente: 'HFC-134a', cantidad: 2 },
];
const { resultados, totales } = calcularInventario(lineas, f);

const base = (): DatosInforme => ({
  organizacion: { nombre: 'Grupo Demo', cif: 'B12345678', direccion: 'C/ Mar 1', cnae: '5510', iae: '685', criterio: 'control', consultorEmail: 'consultor@hs.es' },
  centros: [{ nombre: 'Hotel A', direccion: 'C/ Mar 1', municipio: 'Calvià', isla: 'Mallorca', enBaleares: true, unidades: 180, indice: 40000 }],
  inventario: { anio: 2023, estado: 'cerrado', anioBase: 2022, cerradoEn: '2024-03-01', conjuntoFijado: true, cierre: { analisisVariacion: 'Apertura de una nueva ala.' } },
  factores: f, resultados, totales,
  actividad: lineas.map((l) => ({ centro: l.centro, categoria: l.categoria, fuente: l.fuente, cantidad: l.cantidad, contador: l.contador ?? null, periodoDesde: '2023-01-01', periodoHasta: '2023-12-31', documento: `f_${l.id}.pdf` })),
  anterior: { anio: 2022, a1: 8000, a2: 30000, total: 38000 },
  exclusiones: [{ fuente: 'Extintores', porcentaje: 0.03, justificacion: 'Recargas mínimas.', categoriaIso: 1, evidencia: true }, ...[3, 4, 5, 6].map((n) => ({ fuente: `Categoría ${n}`, porcentaje: 0.5, justificacion: `Sin datos fiables de la categoría ${n}.`, categoriaIso: n }))],
  significancia: { plantilla: PLANTILLA_HOTELES, evaluaciones: PLANTILLA_HOTELES.map((x) => ({ codigo: x.codigo, categoria: x.categoria, nombre: x.nombre, magnitudPct: 0.2, influencia: 'baja' as const, datos: 'parciales' as const, requisitos: false, resultado: 'no_significativa' as const, justificacion: `Aporte marginal de ${x.nombre}.`, cuantificada: false })) },
  noConformidades: [], documentos: [{ nombre: 'f_1.pdf', tipo: 'electricidad', centro: 'Hotel A', estado: 'revisado' }],
  emitidoPor: 'Consultor HS', fecha: '2024-03-05',
});
const texto = (m: ReturnType<typeof construirInforme>) => JSON.stringify(m);

test('el informe tiene las 12 secciones del esquema acordado y cubre los apartados a)-t) de la norma', () => {
  const m = construirInforme(base());
  assert.deepEqual(m.secciones.map((s) => s.id), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  assert.equal(CORRESPONDENCIA_ISO.length, 20);
  assert.deepEqual(CORRESPONDENCIA_ISO.map((x) => x[0]), 'abcdefghijklmnopqrst'.split(''));
  assert.match(m.meta.estado, /PENDIENTE DE VERIFICACIÓN/);
});

test('las cifras del informe coinciden con las del motor (por categoría, por gas y por método eléctrico)', () => {
  const m = construirInforme(base());
  const t = texto(m);
  const aEs = (kg: number) => (kg / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.ok(t.includes(aEs(totales.kgCO2eTotal)), 'total');
  assert.ok(t.includes(aEs(totales.kgCO2eAlcance1)), 'alcance 1');
  assert.ok(t.includes(aEs(totales.kgCO2eAlcance2)), 'alcance 2');
  assert.ok(t.includes(aEs(totales.kgCO2PorGas.fluorados_co2e)), 'fluorados');
  assert.ok(t.includes('1 · Emisiones directas') && t.includes('Basado en la ubicación') && t.includes('Basado en el mercado'));
});

test('cita la resolución de 2023, los potenciales de calentamiento y la trazabilidad por línea', () => {
  const t = texto(construirInforme(base()));
  assert.match(t, /BOIB n\.º 35/);
  assert.ok(t.includes('27,90 kg CO₂e/kg') && t.includes('273 kg CO₂e/kg'));
  assert.ok(t.includes('HFC-134a') && t.includes('1.530'));
  assert.ok(t.includes('Anexo C'));
});

test('un inventario completo y cerrado no deja pendientes salvo la cita de resoluciones no catalogadas', () => {
  assert.deepEqual(construirInforme(base()).pendientes, []);
  const d = base(); d.inventario.anio = 2022; d.factores = construirConjunto(datos, { anioInventario: 2022 });
  assert.ok(construirInforme(d).pendientes.some((p) => /resolución oficial/.test(p)));
});

test('los datos que faltan se señalan: CIF, año base, estancias, borrador, datos manuales, exclusiones', () => {
  const d = base();
  d.organizacion.cif = null; d.inventario.anioBase = null; d.inventario.estado = 'borrador'; d.inventario.conjuntoFijado = false;
  d.centros[0].indice = 0; d.actividad[0].documento = null; d.exclusiones = [];
  const p = construirInforme(d).pendientes.join(' | ');
  for (const frag of ['CIF', 'año base', 'borrador', 'fijados', 'estancias', 'sin factura', 'fuentes excluidas']) assert.match(p, new RegExp(frag, 'i'));
  assert.equal(construirInforme(d).meta.estado, 'BORRADOR');
});

test('la comparación con el año anterior y su análisis solo aparecen si hay inventario previo', () => {
  assert.match(texto(construirInforme(base())), /Comparación con 2022/);
  assert.match(texto(construirInforme(base())), /Apertura de una nueva ala/);
  const d = base(); d.anterior = null;
  assert.doesNotMatch(texto(construirInforme(d)), /Comparación con/);
});

test('la declaración de verificación usa los datos del verificador cuando existen', () => {
  const d = base(); d.inventario.estado = 'verificado'; d.inventario.verificacion = { entidad: 'Entidad X', nivel: 'Limitado', fecha: '2024-04-10', referencia: 'V-123' };
  const m = construirInforme(d);
  assert.equal(m.meta.estado, 'VERIFICADO');
  assert.match(texto(m), /Entidad X/); assert.match(texto(m), /Limitado/); assert.match(texto(m), /V-123/);
});

test('el informe incluye gráficos en Resultados: reparto, evolución mensual (si hay datos), comparación, por grupo de gas y por categoría', () => {
  const d = base();
  d.mensualPorFuente = { Electricidad: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 'Gas natural': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] };
  const m = construirInforme(d);
  const r = m.secciones.find((s) => s.id === '9')!;
  const graf = r.bloques.filter((b) => b.k === 'grafico');
  assert.deepEqual(graf.map((g) => (g as { titulo: string }).titulo.split(' (')[0]), ['Reparto de las emisiones por fuente', 'Evolución mensual de las emisiones 2023', 'Comparación con 2022', 'Emisiones directas por grupo de gas', 'Emisiones por categoría']);
  for (const g of graf) assert.match((g as { svg: string }).svg, /^<svg/);
});

test('informe: con plantilla media añade el ratio por trabajador al resumen; sin ella no cambia', () => {
  const sin = texto(construirInforme(base()));
  assert.ok(!/por trabajador/.test(sin));
  const d = base(); d.centros[0].plantilla = 63.465;
  const con = texto(construirInforme(d));
  assert.match(con, /Ratio por trabajador/);
  assert.match(con, /63,465/);
});

test('con un único centro se ocultan la tabla y los gráficos por centro y sus ratios pasan al resumen ejecutivo', () => {
  const d = base();
  const m = construirInforme(d); const r = m.secciones.find((s) => s.id === '9')!;
  assert.ok(!r.bloques.some((b) => b.k === 'h' && /por centro/.test(b.texto)));
  assert.ok(!r.bloques.some((b) => b.k === 'grafico' && /por centro|Intensidad por estancia/.test(b.titulo)));
  const resumen = r.bloques.find((b) => b.k === 'tabla') as { filas: string[][] };
  assert.ok(resumen.filas.some((fila) => fila[0] === 'Ratio por estancia'));
  // con dos centros reaparecen
  const d2 = base(); d2.centros.push({ nombre: 'Hotel B', direccion: null, municipio: null, isla: null, enBaleares: true, unidades: 10, indice: 100 });
  const m2 = construirInforme(d2); const r2 = m2.secciones.find((s) => s.id === '9')!;
  assert.ok(r2.bloques.some((b) => b.k === 'h' && /por centro/.test(b.texto)));
});

import { GRUPOS_GAS, grupoGasRefrigerante, resultadosIso, estadoCategoria } from '../iso.ts';
test('9.1: la tabla por gas solo cuenta la categoría 1, siempre con las 8 filas, y cuadra con el total', () => {
  const iso = resultadosIso(resultados, f, [], totales);
  assert.deepEqual(iso.gases.map((x) => x.grupo), [...GRUPOS_GAS]);
  assert.equal(iso.gases.length, 8);
  assert.equal(iso.gases.find((x) => x.grupo === 'SF₆')!.toneladasCO2e, 0); // sin emisiones: fila a cero
  const hfc = iso.gases.find((x) => x.grupo === 'HFC')!;
  assert.ok(Math.abs(hfc.toneladasCO2e - 0.002 * f.pcaRefrigerantes['HFC-134a']) < 1e-9);
  // la electricidad (categoría 2) no entra en la tabla por gas
  assert.ok(Math.abs(iso.totalCat1 * 1000 - totales.kgCO2eAlcance1) < 1e-6);
  assert.ok(Math.abs(iso.gases.reduce((t, x) => t + x.toneladasCO2e, 0) - iso.totalCat1) < 1e-9);
  assert.ok(Math.abs(Object.values(iso.porCategoria).reduce((t, x) => t + x, 0) * 1000 - totales.kgCO2eTotal) < 1e-6);
  assert.equal(iso.cuadre.ok, true);
  const m = construirInforme(base());
  assert.match(JSON.stringify(m), /9\.1 Emisiones directas por gas/); assert.match(JSON.stringify(m), /Desglose por refrigerante|Refrigerante/); assert.match(JSON.stringify(m), /HFC-134a/);
  assert.deepEqual(m.bloqueantes, []);
});
test('cada refrigerante tiene su familia ISO; las mezclas HFC/HFO cuentan como HFC', () => {
  for (const [n, g] of [['HFC-134a', 'HFC'], ['R-410A', 'HFC'], ['R-448A', 'HFC'], ['R-1234yf', 'HFC'], ['HFO-1234ze', 'HFC'], ['SF6', 'SF₆'], ['NF3', 'NF₃'], ['PFC-14', 'PFC'], ['HCFC-22', 'Otros fluorados'], ['gas desconocido', 'Otros fluorados']] as const) assert.equal(grupoGasRefrigerante(n), g, n);
});
test('categorías 2 a 6: Cuantificada / No significativa / Excluida / Sin evaluar según los datos y las exclusiones', () => {
  assert.equal(estadoCategoria(true, undefined), 'Cuantificada');
  assert.equal(estadoCategoria(false, { fuente: 'x', porcentaje: 0.5, justificacion: 'j' }), 'No significativa');
  assert.equal(estadoCategoria(false, { fuente: 'x', porcentaje: 4, justificacion: 'j' }), 'Excluida');
  assert.equal(estadoCategoria(false, { fuente: 'x', porcentaje: null, justificacion: 'j' }), 'Excluida');
  assert.equal(estadoCategoria(false, undefined), 'Sin evaluar');
  const iso = resultadosIso(resultados, f, [{ fuente: 'Viajes', porcentaje: 0.3, justificacion: 'Escasos', categoriaIso: 3 }, { fuente: 'Compras', porcentaje: 6, justificacion: 'Sin datos', categoriaIso: 4 }], totales);
  assert.deepEqual(iso.indirectas.map((c) => [c.n, c.estado]), [[2, 'Cuantificada'], [3, 'No significativa'], [4, 'Excluida'], [5, 'Sin evaluar'], [6, 'Sin evaluar']]);
  const m = construirInforme({ ...base(), exclusiones: [], significancia: undefined });
  assert.ok(m.pendientes.some((p) => /Categoría 5/.test(p)));
});
test('si los totales no cuadran hay una incidencia bloqueante', () => {
  const malos = { ...totales, kgCO2eTotal: totales.kgCO2eTotal + 5 };
  const iso = resultadosIso(resultados, f, [], malos);
  assert.equal(iso.cuadre.ok, false); assert.ok(iso.cuadre.incidencias.length >= 1);
  const m = construirInforme({ ...base(), totales: malos });
  assert.ok(m.bloqueantes.length >= 1);
});

test('declaración de conformidad: caso a) con la evaluación completa; caso b) con lo que falta; nada fijo en el generador', () => {
  const a = construirInforme(base());
  assert.equal(a.declaracion.caso, 'a');
  assert.match(texto(a), /conforme a la norma ISO 14064-1:2018 y a los requisitos del Decreto 48\/2021/);
  const d = base(); d.significancia!.evaluaciones = d.significancia!.evaluaciones.slice(0, 5); // faltan subcategorías
  const b = construirInforme(d);
  assert.equal(b.declaracion.caso, 'b');
  assert.match(texto(b), /siguiendo la metodología de ISO 14064-1:2018/); assert.match(texto(b), /sin valorar/);
  assert.doesNotMatch(JSON.stringify(b.secciones.find((x) => x.id === '11')), /conforme a la norma ISO/);
  // una significativa sin cuantificar también pasa al caso b)
  const e = base(); e.significancia!.evaluaciones[0] = { ...e.significancia!.evaluaciones[0], requisitos: true, resultado: 'significativa', cuantificada: false };
  assert.equal(construirInforme(e).declaracion.caso, 'b'); assert.ok(construirInforme(e).pendientes.some((p) => /significativa y no está cuantificada/.test(p)));
  e.significancia!.evaluaciones[0].cuantificada = true; assert.equal(construirInforme(e).declaracion.caso, 'a');
  // textos desde la configuración
  const f2 = base(); f2.significancia!.textos = { programa: 'Programa Y', a: 'Conformidad {anio} con {programa}.' };
  assert.match(texto(construirInforme(f2)), /Conformidad 2023 con Programa Y\./);
  // sin evaluación: caso b) y pendiente
  const g = base(); g.significancia = undefined; const mg = construirInforme(g);
  assert.equal(mg.declaracion.caso, 'b'); assert.ok(mg.pendientes.some((p) => /No se ha realizado la evaluación/.test(p)));
});
test('exclusiones de la categoría 1 sin % o sin evidencia son pendientes; la evaluación se refleja en el estado de las categorías', () => {
  const d = base(); d.exclusiones[0] = { ...d.exclusiones[0], porcentaje: null, evidencia: false };
  const p = construirInforme(d).pendientes.join(' | ');
  assert.match(p, /falta el porcentaje/); assert.match(p, /falta la evidencia/);
  const e = base(); e.exclusiones = [];
  const m = construirInforme(e); const iso = JSON.stringify(m.secciones.find((x) => x.id === '9'));
  assert.match(iso, /No significativa/); // categorías 3 a 6 por la evaluación, sin exclusiones sueltas
  assert.match(iso, /3\.1 Transporte de mercancías/);
});
