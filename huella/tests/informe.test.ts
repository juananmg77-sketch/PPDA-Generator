import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
  exclusiones: [{ fuente: 'Extintores', porcentaje: 0.03, justificacion: 'Recargas mínimas.' }],
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
  assert.ok(t.includes(`${f.gwp.ch4} kg CO₂e/kg`) && t.includes(`${f.gwp.n2o} kg CO₂e/kg`));
  assert.ok(t.includes('HFC-134a') && t.includes('1530'));
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

test('el informe incluye gráficos en Resultados: reparto, evolución mensual (si hay datos) y comparación con el año anterior', () => {
  const d = base();
  d.mensualPorFuente = { Electricidad: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], 'Gas natural': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] };
  const m = construirInforme(d);
  const r = m.secciones.find((s) => s.id === '9')!;
  const graf = r.bloques.filter((b) => b.k === 'grafico');
  assert.deepEqual(graf.map((g) => (g as { titulo: string }).titulo.split(' (')[0]), ['Reparto de las emisiones por fuente', 'Evolución mensual de las emisiones 2023', 'Comparación con 2022']);
  for (const g of graf) assert.match((g as { svg: string }).svg, /^<svg/);
  const sinMensual = construirInforme({ ...base(), anterior: null }).secciones.find((s) => s.id === '9')!.bloques.filter((b) => b.k === 'grafico');
  assert.equal(sinMensual.length, 1); // solo el reparto por fuente
});
