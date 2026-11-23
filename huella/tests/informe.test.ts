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
f.resolucion = { ...f.resolucion!, enlace: 'https://boib.example/2023/35' }; // cita completa en el ejemplo (en el catálogo real la de 2023 aún no tiene enlace)

const lineas: LineaActividad[] = [
  { id: '1', centro: 'Hotel A', categoria: 'electricidad', fuente: '', cantidad: 100000, origenElectricidad: 'red', contador: 'ES1' },
  { id: '2', centro: 'Hotel A', categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 50000 },
  { id: '3', centro: 'Hotel A', categoria: 'fugitiva', fuente: 'HFC-134a', cantidad: 2 },
];
const { resultados, totales } = calcularInventario(lineas, f);

const base = (): DatosInforme => ({
  organizacion: { nombre: 'Grupo Demo', razonSocial: 'Grupo Demo Hoteles, S.L.', cif: 'B12345678', direccion: 'C/ Mar 1', cnae: '5510', iae: '685', criterio: 'control_operativo', justificacionConsolidacion: 'La organización explota y gestiona directamente el hotel.', responsable: { nombre: 'Ana Ruiz', cargo: 'Consultora de sostenibilidad', entidad: 'HS Consulting Group' } },
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
  assert.ok(m.pendientes.some((p) => /Categoría\(s\) .*5/.test(p)));
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
  assert.equal(construirInforme(e).declaracion.caso, 'b'); assert.ok(construirInforme(e).pendientes.some((p) => /significativa\(s\) sin cuantificar/.test(p)));
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

import { resumenDeInventario } from '../anioBase.ts';
import type { ResumenAnio } from '../anioBase.ts';
const resumenActual = () => resumenDeInventario({ anio: 2023, resultados, totales, factores: f, estancias: 40000, plantilla: 60, centros: ['Hotel A'] });
const resBase = (o: Partial<ResumenAnio> = {}): ResumenAnio => ({ ...resumenActual(), anio: 2019, total: resumenActual().total * 0.8, porCategoria: { 1: 5, 2: 25 }, factoresId: 'calculadora-2023.2@2019', factores: resumenActual().factores, ...o });

test('año base: el informe muestra su inventario, la comparación base · anterior · actual y lo dice si no existe', () => {
  const act = resumenActual();
  const d = base(); d.anterior = null;
  d.anioBase = { def: { anio: 2019, inventarioId: 'i0', justificacion: 'Primer año completo y verificado.' }, base: resBase(), anterior: { ...act, anio: 2022, total: act.total * 0.9 }, actual: act, config: null, decision: { metodologiaCambiada: false, decision: null, motivo: null } };
  const m = construirInforme(d); const t = texto(m);
  assert.match(t, /Inventario del año base/); assert.match(t, /Primer año completo y verificado/); assert.match(t, /calculadora-2023\.2@2019/);
  assert.match(t, /9\.5 Comparación con el año base \(2019\) y el año anterior \(2022\)/);
  assert.match(t, /Var\. vs base/); assert.match(t, /Var\. vs anterior/); assert.match(t, /t CO₂e por estancia/);
  assert.match(t, /No se cumple ninguna regla: no es necesario recalcular/);
  // sin año base
  const s = base(); s.anioBase = { def: null, base: null, anterior: null, actual: act, decision: null };
  const ms = construirInforme(s);
  assert.match(texto(ms), /No existe inventario del año base: la organización no ha definido su año base/);
  assert.match(texto(ms), /la comparación con el año base no se puede realizar/);
  assert.ok(ms.pendientes.some((p) => /año base/i.test(p)));
});
test('recálculo del año base: la regla disparada y su decisión documentada aparecen en el informe', () => {
  const act = { ...resumenActual(), centros: ['Hotel A', 'Hotel B'] };
  const d = base();
  d.anioBase = { def: { anio: 2019, inventarioId: 'i0', justificacion: 'j' }, base: resBase(), anterior: null, actual: act, decision: { metodologiaCambiada: false, decision: null, motivo: null } };
  const sin = construirInforme(d);
  assert.match(texto(sin), /Alta de «Hotel B»/); assert.match(texto(sin), /Falta documentar la decisión/);
  assert.ok(sin.pendientes.some((p) => /regla de recálculo/.test(p)));
  d.anioBase.decision = { metodologiaCambiada: false, decision: 'recalcula', motivo: 'Se incorpora el Hotel B.', fecha: '2025-03-05', usuario: 'Consultor' };
  const con = construirInforme(d);
  assert.match(texto(con), /se recalcula el año base/); assert.match(texto(con), /Se incorpora el Hotel B/);
  assert.ok(!con.pendientes.some((p) => /regla de recálculo/.test(p)));
});
test('variaciones del 20 % o más sin explicar son pendiente; con la explicación desaparece', () => {
  const act = resumenActual();
  const d = base(); d.anterior = null; d.inventario.cierre = null;
  d.anioBase = { def: { anio: 2019, inventarioId: 'i0', justificacion: 'j' }, base: resBase({ total: act.total / 2 }), anterior: null, actual: act, decision: { metodologiaCambiada: false, decision: null, motivo: null } };
  assert.ok(construirInforme(d).pendientes.some((p) => /explicar las variaciones/.test(p)));
  d.inventario.cierre = { analisisVariacion: 'Apertura de una nueva ala.' };
  assert.ok(!construirInforme(d).pendientes.some((p) => /explicar las variaciones/.test(p)));
});

test('organización: razón social frente a nombre comercial, criterio de consolidación único y responsable con cargo y entidad', () => {
  const t = texto(construirInforme(base()));
  assert.match(t, /Razón social/); assert.match(t, /Grupo Demo Hoteles, S\.L\./); assert.match(t, /Nombre comercial/);
  assert.match(t, /Criterio de consolidación: control operativo\./); assert.doesNotMatch(t, /operativo o financiero|control \(operativo/);
  assert.match(t, /Justificación: La organización explota y gestiona directamente el hotel/);
  assert.match(t, /Responsable de la elaboración del inventario: Ana Ruiz, Consultora de sostenibilidad, HS Consulting Group\./);
  const c = base(); c.organizacion.responsable = { ...c.organizacion.responsable, email: 'ana@hs.es' };
  assert.match(texto(construirInforme(c)), /HS Consulting Group \(ana@hs\.es\)/);
});
test('organización: lo obligatorio que falta es pendiente y, con el inventario cerrado, bloquea la versión final; el correo es opcional', () => {
  const d = base(); d.organizacion = { ...d.organizacion, razonSocial: null, iae: null, cnae: null, criterio: null, responsable: { nombre: 'Ana' } };
  const m = construirInforme(d); const p = m.pendientes.join(' | ');
  for (const f of ['razón social', 'IAE', 'CNAE', 'criterio de consolidación', 'cargo del responsable', 'entidad del responsable']) assert.match(p, new RegExp(f, 'i'));
  assert.match(texto(m), /Criterio de consolidación: sin definir/);
  assert.ok(m.bloqueantes.some((b) => /IAE/.test(b))); // el inventario del ejemplo está cerrado
  const borrador = { ...d, inventario: { ...d.inventario, estado: 'borrador' } }; assert.ok(!construirInforme(borrador).bloqueantes.some((b) => /IAE/.test(b)));
  assert.ok(!construirInforme(base()).pendientes.some((x) => /correo|email/i.test(x)));
});
test('organización: avisos si la razón social coincide con el nombre comercial o la forma no encaja con el CIF', () => {
  const d = base(); d.organizacion.razonSocial = 'Grupo Demo'; assert.ok(construirInforme(d).pendientes.some((x) => /coincide con el nombre comercial/.test(x)));
  d.organizacion.razonSocial = 'Grupo Demo Hoteles, S.A.'; assert.ok(construirInforme(d).pendientes.some((x) => /no encaja con el CIF/.test(x)));
});

import { calcularIncertidumbre } from '../incertidumbre.ts';
test('incertidumbre en el informe: tabla por categoría con t CO₂e, ±%, valoración y principal fuente, y una frase para el total', () => {
  const m = construirInforme(base()); const s8 = m.secciones.find((x) => x.id === '8')!;
  const tabla = s8.bloques.find((b) => b.k === 'tabla') as { cab: string[]; filas: string[][] };
  assert.deepEqual(tabla.cab, ['Categoría', 'Emisiones (t CO₂e)', 'Incertidumbre', 'Valoración', 'Principal fuente de incertidumbre']);
  assert.ok(tabla.filas.some((fila) => /Emisiones directas/.test(fila[0]))); assert.ok(tabla.filas.some((fila) => /Energía importada/.test(fila[0])));
  const total = tabla.filas[tabla.filas.length - 1]; assert.equal(total[0], 'Total del inventario'); assert.match(total[2], /^±[\d.]+,\d %$/); assert.match(total[3], /Baja|Media|Alta/);
  assert.match(total[4], /% de la varianza/);
  const inc = calcularIncertidumbre(resultados, f);
  assert.match(texto(m), new RegExp(`incertidumbre combinada del inventario es de ±${inc.total.pct!.toFixed(1).replace('.', ',')} %`));
  assert.match(texto(m), /raíz de la suma de cuadrados/); assert.match(texto(m), /intervalos de confianza del 95 %/);
});
test('incertidumbre: el catálogo es configurable, las líneas ajustadas salen con su justificación y los ajustes sin ella son pendientes', () => {
  const d = base(); d.incertidumbre = { factor: { mixElectrico: 8 } as never, umbrales: { baja: 2, media: 4, alta: 6 } as never };
  const t = texto(construirInforme(d));
  assert.match(t, /Mix eléctrico[^]*?±8,0 %/); assert.match(t, /Baja hasta ±2,0 %/);
  const ajustado = base(); ajustado.resultados = resultados.map((r, i) => (i === 0 ? { ...r, linea: { ...r.linea, incertidumbre: { origen: 'estimacion' as const, justificacion: 'Sin factura: lectura estimada.' } } } : r));
  const ma = construirInforme(ajustado); assert.match(texto(ma), /Sin factura: lectura estimada\./); assert.match(texto(ma), /Línea ajustada/);
  const sin = base(); sin.resultados = resultados.map((r, i) => (i === 0 ? { ...r, linea: { ...r.linea, incertidumbre: { datoPct: 9 } } } : r));
  assert.ok(construirInforme(sin).pendientes.some((p) => /ajustada sin justificación/.test(p)));
});

test('anexos: cada evidencia tiene un código EV-001…, y los anexos A y C ordenados por categoría, fuente y fecha enlazan con él con su periodo', () => {
  const d = base();
  d.documentos = [{ id: 'd2', nombre: 'b_gas.pdf', tipo: 'gas_natural', centro: 'Hotel A', periodoDesde: '2023-03-01', periodoHasta: '2023-03-31', estado: 'revisado' }, { id: 'd1', nombre: 'a_luz.pdf', tipo: 'electricidad', centro: 'Hotel A', periodoDesde: '2023-01-01', periodoHasta: '2023-01-31', estado: 'revisado' }];
  d.actividad = [
    { id: '1', documentoId: 'd1', documento: 'a_luz.pdf', centro: 'Hotel A', categoria: 'electricidad', fuente: '', cantidad: 100000, contador: 'ES1', periodoDesde: '2023-01-01', periodoHasta: '2023-01-31' },
    { id: '3', documentoId: null, documento: null, notas: 'contador', centro: 'Hotel A', categoria: 'fugitiva', fuente: 'HFC-134a', cantidad: 2, periodoDesde: '2023-06-01', periodoHasta: '2023-06-30' },
    { id: '2', documentoId: 'd2', documento: 'b_gas.pdf', centro: 'Hotel A', categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 50000, periodoDesde: '2023-03-01', periodoHasta: '2023-03-31' },
  ] as never;
  const m = construirInforme(d); const an = m.secciones.find((x) => x.id === '12')!.bloques.filter((b) => b.k === 'tabla') as Array<{ cab: string[]; filas: string[][] }>;
  const A = an.find((t) => t.cab[0] === 'Centro' && t.cab.includes('Cantidad'))!;
  assert.deepEqual(A.filas.map((x) => x[1]), ['Combustión fija', 'Emisiones fugitivas (refrigerantes)', 'Electricidad adquirida']); // por categoría
  assert.equal(A.filas[2][7], 'EV-001'); assert.equal(A.filas[0][7], 'EV-002'); assert.match(A.filas[1][7], /^Manual/); // electricidad (enero) es la primera evidencia por tipo
  assert.ok(A.filas[0][4].includes('01/03/2023')); // incluye el periodo
  const C = an.find((t) => t.cab.includes('Cálculo'))!; assert.deepEqual(C.cab.slice(0, 3), ['Centro', 'Fuente', 'Periodo']); assert.equal(C.cab[C.cab.length - 1], 'Evidencia');
  const E = an.find((t) => t.cab[0] === 'Código')!; assert.deepEqual(E.filas.map((x) => [x[0], x[1]]), [['EV-001', 'a_luz.pdf'], ['EV-002', 'b_gas.pdf']]);
});
test('anexo D calculado: «k» No cumple sin inventario del año base y Cumple con él', () => {
  const sinBase = construirInforme(base()); const tabla = (m: ReturnType<typeof construirInforme>) => (m.secciones.find((x) => x.id === '12')!.bloques.find((b) => b.k === 'tabla' && b.cab[0] === 'Apartado') as { filas: string[][] }).filas;
  const k = tabla(sinBase).find((x) => x[0] === 'k')!; assert.equal(k[3], 'No cumple'); assert.match(k[4], /No existe inventario del año base/);
  assert.equal(tabla(sinBase).length, 20);
  const act = resumenActual(); const d = base(); d.anioBase = { def: { anio: 2019, inventarioId: 'i0', justificacion: 'j' }, base: resBase(), anterior: null, actual: act, decision: { metodologiaCambiada: false, decision: null, motivo: null } };
  assert.equal(tabla(construirInforme(d)).find((x) => x[0] === 'k')![3], 'Cumple');
  assert.ok(tabla(sinBase).every((x) => ['Cumple', 'No cumple', 'No aplica'].includes(x[3])));
});
test('resumen ejecutivo: cifras clave, principales fuentes y tres conclusiones generadas', () => {
  const m = construirInforme(base()); const r = m.resumen!;
  assert.equal(r.titulo, 'Resumen ejecutivo');
  const kpi = r.bloques[0] as { filas: string[][] }; assert.ok(kpi.filas.some((x) => x[0] === 'Emisiones totales')); assert.ok(kpi.filas.some((x) => /Variación frente al año base/.test(x[0]) && /No existe inventario del año base/.test(x[1])));
  assert.ok(kpi.filas.some((x) => x[0] === 'Estado de verificación'));
  const lista = r.bloques.find((b) => b.k === 'lista') as { items: string[] }; assert.equal(lista.items.length, 3); assert.ok(lista.items.every((x) => !/NaN|undefined|null/.test(x)));
  assert.ok(r.bloques.some((b) => b.k === 'tabla' && b.cab[0] === 'Principales fuentes'));
});
test('plantilla: cláusula de confidencialidad configurable y citas de la resolución desde datos estructurados', () => {
  assert.match(construirInforme(base()).meta.confidencialidad, /pertenecen a la organización cliente/);
  const d = base(); d.plantilla = { confidencialidad: 'Cláusula propia.' }; assert.equal(construirInforme(d).meta.confidencialidad, 'Cláusula propia.');
  assert.match(texto(construirInforme(base())), /BOIB n\.º 35, de 20 de marzo de 2025.*versión 4/);
  const sin = base(); sin.factores = { ...f, resolucion: null, anioInventario: 2022 }; sin.inventario.anio = 2022;
  assert.ok(construirInforme(sin).pendientes.some((p) => /resolución oficial/.test(p)));
  const incompleta = base(); incompleta.factores = { ...f, resolucion: { ...f.resolucion!, enlace: null } };
  assert.ok(construirInforme(incompleta).pendientes.some((p) => /enlace/.test(p)));
});

test('categorías 3 a 6 excluidas con el mismo motivo: una sola fila y una sola justificación, sin repetirla por subcategoría', () => {
  const motivo = 'El programa aplicable exige cuantificar únicamente las categorías 1 y 2. Se excluye conforme a la ISO 14064-1.';
  const d = base(); d.exclusiones = [];
  d.significancia = { ...d.significancia!, evaluaciones: PLANTILLA_HOTELES.map((x) => ({ codigo: x.codigo, categoria: x.categoria, nombre: x.nombre, magnitudPct: null, influencia: null, datos: null, requisitos: null, resultado: 'no_significativa' as const, justificacion: motivo, cuantificada: false, metodo: 'no_aplica' as const })) };
  const m = construirInforme(d);
  const tablas = (id: string) => m.secciones.find((x) => x.id === id)!.bloques.filter((b) => b.k === 'tabla') as Array<{ cab: string[]; filas: string[][] }>;
  const s5 = tablas('5')[0]; assert.equal(s5.filas.length, 3); // categorías 1, 2 y «3 a 6»
  assert.match(s5.filas[2][0], /^Categorías 3 a 6 \(transporte; productos usados/); assert.equal(s5.filas[2][1], 'No significativa'); assert.equal(s5.filas[2][2], motivo);
  const s92 = tablas('9').find((t) => t.cab[0] === 'Categoría' && t.cab.includes('Justificación'))!; assert.equal(s92.filas.length, 2); // categoría 2 + «3 a 6»
  const completo = JSON.stringify(m); assert.equal(completo.split(motivo).length - 1, 3, 'el motivo aparece una vez por tabla/párrafo, no una por subcategoría'); // s5, 9.2 y el párrafo de subcategorías
  assert.ok(!tablas('9').some((t) => t.cab[0] === 'Subcategoría')); // sin tabla de trece filas iguales
  assert.match(texto(m), /excluidas como «no aplica» \(3\.1, 3\.2/);
  // con motivos distintos por categoría no se fusionan
  const e = base(); e.exclusiones = [];
  e.significancia = { ...e.significancia!, evaluaciones: PLANTILLA_HOTELES.map((x) => ({ codigo: x.codigo, categoria: x.categoria, nombre: x.nombre, magnitudPct: null, influencia: null, datos: null, requisitos: null, resultado: 'no_significativa' as const, justificacion: `Motivo de la categoría ${x.categoria}.`, cuantificada: false, metodo: 'no_aplica' as const })) };
  const s5b = (construirInforme(e).secciones.find((x) => x.id === '5')!.bloques[0] as { filas: string[][] }).filas; assert.equal(s5b.length, 6);
});
