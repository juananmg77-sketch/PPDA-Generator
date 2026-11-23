import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirConjunto } from '../factores.ts';
import { calcularInventario } from '../motor.ts';
import { construirInforme } from '../informe.ts';
import type { DatosInforme } from '../informe.ts';
import { definicionInforme } from '../informePdf.ts';
import { informeAHtml } from '../informeHtml.ts';
import type { DatosCalculadora, LineaActividad } from '../tipos.ts';
import { NOTAS_FUENTES } from '../notasFuentes.ts';

const datos: DatosCalculadora = JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2024.1.json', import.meta.url), 'utf-8'));
const f = construirConjunto(datos, { anioInventario: 2024 });
const lineas: LineaActividad[] = [
  { id: '1', centro: 'Hotel A', categoria: 'electricidad', fuente: '', cantidad: 100000.5, origenElectricidad: 'red', contador: 'ES1' },
  { id: '2', centro: 'Hotel A', categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 50000 },
  { id: '3', centro: 'Hotel A', categoria: 'fugitiva', fuente: 'HFC-134a', cantidad: 2.345 },
];
const { resultados, totales } = calcularInventario(lineas, f);
const base = (): DatosInforme => ({
  organizacion: { nombre: 'Grupo Demo', cif: 'B12345678', direccion: 'C/ Mar 1', cnae: '5510', iae: null, criterio: 'control', consultorEmail: 'consultor@hs.es' },
  centros: [{ nombre: 'Hotel A', direccion: 'C/ Mar 1', municipio: 'Calvià', isla: 'Mallorca', enBaleares: true, unidades: 180, indice: 40000, plantilla: 63.465 }],
  inventario: { anio: 2024, estado: 'borrador', anioBase: null, cerradoEn: null, conjuntoFijado: true, cierre: null },
  factores: f, resultados, totales,
  actividad: lineas.map((l) => ({ centro: l.centro, categoria: l.categoria, fuente: l.fuente, cantidad: l.cantidad, contador: l.contador ?? null, periodoDesde: '2024-01-01', periodoHasta: '2024-12-31', documento: 'f.pdf' })),
  anterior: null, exclusiones: [{ fuente: 'Extintores', porcentaje: 0.004, justificacion: 'Recargas mínimas.' }],
  noConformidades: [], documentos: [{ nombre: 'f_1.pdf', tipo: 'electricidad', centro: 'Hotel A', estado: 'revisado' }],
  emitidoPor: 'Consultor HS', fecha: '2025-03-05',
});
const recursos = { portada: 'data:image/png;base64,AA', logoBlanco: 'data:image/png;base64,AA', logoGroup: 'data:image/png;base64,AA', logoGreen: 'data:image/png;base64,AA', banda: 'data:image/png;base64,AA' };

/** Todo el texto que llegaría al PDF (incluidos los SVG de los gráficos). */
function textos(nodo: unknown, out: string[] = []): string[] {
  if (typeof nodo === 'string') {
    // Un SVG aporta solo su texto visible (las coordenadas de sus atributos no son cantidades)
    if (nodo.startsWith('<svg')) for (const m of nodo.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) out.push(m[1]); else out.push(nodo);
  }
  else if (Array.isArray(nodo)) nodo.forEach((x) => textos(x, out));
  else if (nodo && typeof nodo === 'object') for (const [k, v] of Object.entries(nodo)) { if (k !== 'images') textos(v, out); }
  return out;
}
const todo = (b: DatosInforme) => textos(definicionInforme(construirInforme(b), recursos)).join('\n');

test('el PDF no contiene «null», «undefined» ni «NaN»', () => {
  assert.doesNotMatch(todo(base()), /\bnull\b|undefined|NaN/);
  // con datos que faltan: sin estancias, sin plantilla, sin cantidades, sin importes
  const b = base(); b.centros[0].indice = 0; b.centros[0].plantilla = undefined; b.exclusiones[0].porcentaje = null; b.organizacion.cnae = null;
  assert.doesNotMatch(todo(b), /\bnull\b|undefined|NaN/);
  const c = base(); (c.centros[0] as { unidades?: number | null }).unidades = null; c.anterior = { anio: 2023, a1: 0, a2: 0, total: 0 };
  assert.doesNotMatch(todo(c), /\bnull\b|undefined|NaN/);
});

test('ningún número del informe sale con punto decimal ni sin separador de miles', () => {
  const t = todo(base()).replace(/<[^>]*>/g, ' ');
  // fechas, versiones de calculadora e identificadores no son cantidades
  const sinIds = t.replace(/calculadora-\d{4}\.\d@\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|ISO \d+-\d:\d{4}|Decreto \d+\/\d{4}|n\.º \d+|\d{4}-\d{2}-\d{2}|HC-\d{4}-\w+|v\d+|versión \d+|apartados? \d+(?:\.\d+)*|huella \d+\.\d+/g, ' ').replace(/^\d+\.\d+ /gm, ' ').replace(/^\d+(?:\.\d+)+$/gm, ' '); // referencias a apartados (9.3, 7.4…)
  const malo = /\b\d{1,3}(?:\.\d{3})*\.\d{1,2}\b(?!\.\d)/.exec(sinIds);
  assert.equal(malo, null, `decimal con punto: «${malo ? malo[0] : ''}» en ${malo ? JSON.stringify(sinIds.slice(Math.max(0, malo.index - 40), malo.index + 40)) : ''}`);
  assert.doesNotMatch(sinIds, /(?<![\d.,])\d{4,},\d/, 'miles sin separador antes de la coma');
  assert.match(t, /100\.000,50/); // 100000,5 kWh con miles y 2 decimales
});

test('una misma magnitud se muestra con los mismos decimales', () => {
  const m = construirInforme(base());
  const colTCO2e = m.secciones.flatMap((s) => s.bloques).filter((b) => b.k === 'tabla').flatMap((b) => (b as { cab: string[]; filas: string[][] }).cab.map((c, i) => c.includes('t CO₂e') && !/por/.test(c) ? (b as { filas: string[][] }).filas.map((fila) => fila[i]) : []).flat());
  for (const v of colTCO2e.filter((x) => /\d/.test(x) && !x.includes('<'))) assert.match(v, /^[\d.]+,\d{2}$/, `t CO₂e con 2 decimales: ${v}`);
});

test('ratio por trabajador: el divisor mostrado es el que se usa en el cálculo', () => {
  const m = construirInforme(base()); const t = JSON.stringify(m);
  assert.match(t, /plantilla media 63,465/);
  const kg = totales.kgCO2eTotal; const esperado = (kg / 1000 / 63.465).toLocaleString('es-ES', { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: true } as never);
  assert.ok(t.includes(esperado), `ratio ${esperado} calculado con 63,465`);
});

test('las marcas (*) generan su nota al pie desde el catálogo de fuentes, en cada formato', () => {
  const m = construirInforme(base());
  const tablas = m.secciones.flatMap((s) => s.bloques).filter((b) => b.k === 'tabla' && b.notas?.length);
  assert.ok(tablas.length >= 2, 'varias tablas llevan la marca');
  for (const b of tablas) assert.ok((b as { notas: string[] }).notas.some((n) => n === `* ${NOTAS_FUENTES['*']}`));
  assert.ok(todo(base()).includes(NOTAS_FUENTES['*']));
  assert.ok(informeAHtml(m).includes('PCS'));
});

test('una marca sin nota en el catálogo es una incidencia pendiente, no se omite', () => {
  const b = base(); b.actividad[1].fuente = 'Gas natural (kWhPCS)***'; // marca no catalogada
  const m = construirInforme(b);
  assert.ok(m.pendientes.some((p) => p.includes('***')));
});
