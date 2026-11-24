import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirConjunto } from '../factores.ts';
import { calcularInventario } from '../motor.ts';
import { calcularIncertidumbre, configIncertidumbre, esMezclaRefrigerante, incertidumbreLinea, INCERTIDUMBRE_POR_DEFECTO, origenPorDefecto, valoracion } from '../incertidumbre.ts';
import type { DatosCalculadora, LineaActividad } from '../tipos.ts';

const datos: DatosCalculadora = JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2024.1.json', import.meta.url), 'utf-8'));
const f = construirConjunto(datos, { anioInventario: 2024 });
const cfg = configIncertidumbre();
const calc = (ls: LineaActividad[]) => calcularInventario(ls, f).resultados;
const elec: LineaActividad = { id: 'e', centro: 'H', categoria: 'electricidad', fuente: '', cantidad: 100000, origenElectricidad: 'red', evidencia: 'doc1' };
const gas: LineaActividad = { id: 'g', centro: 'H', categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 50000, evidencia: 'doc2' };
const fuga: LineaActividad = { id: 'f', centro: 'H', categoria: 'fugitiva', fuente: 'HFC-134a', cantidad: 2, evidencia: 'doc3' };

test('catálogo por defecto y origen del dato: factura, parte de mantenimiento en recargas, lectura interna sin documento', () => {
  assert.deepEqual(Object.keys(INCERTIDUMBRE_POR_DEFECTO.dato).sort(), ['albaran', 'estimacion', 'factura', 'lectura_interna', 'parte_mantenimiento']);
  const [re, rg, rf] = calc([elec, gas, fuga]);
  assert.equal(origenPorDefecto(re), 'factura'); assert.equal(origenPorDefecto(rg), 'factura'); assert.equal(origenPorDefecto(rf), 'parte_mantenimiento');
  assert.equal(origenPorDefecto(calc([{ ...elec, evidencia: undefined }])[0]), 'lectura_interna');
  assert.equal(configIncertidumbre({ factor: { mixElectrico: 8 } as never }).factor.mixElectrico, 8); // se puede configurar sin perder el resto
  assert.equal(configIncertidumbre({ factor: { mixElectrico: 8 } as never }).factor.pcaMezcla, 15);
});
test('línea: electricidad = raíz de (dato² + factor²), sobre la emisión', () => {
  const r = calc([elec])[0]; const u = incertidumbreLinea(r, f, cfg);
  assert.equal(u.datoPct, 2); assert.equal(u.factorPct, 5);
  assert.ok(Math.abs(u.pct - Math.sqrt(2 ** 2 + 5 ** 2)) < 1e-9);
  assert.ok(Math.abs(u.absoluta - r.kgCO2e * Math.sqrt(29) / 100) < 1e-6);
});
test('combustión: el dato es común y los factores de CO₂, CH₄ y N₂O son independientes', () => {
  const r = calc([gas])[0]; const u = incertidumbreLinea(r, f, cfg);
  const ch4 = (r.gCH4 / 1000) * f.gwp.ch4, n2o = (r.gN2O / 1000) * f.gwp.n2o;
  const esperado = Math.sqrt((r.kgCO2e * 0.02) ** 2 + (r.kgCO2 * 0.05) ** 2 + (ch4 * 0.5) ** 2 + (n2o * 1.0) ** 2);
  assert.ok(Math.abs(u.absoluta - esperado) < 1e-9);
  assert.ok(u.pct > 2 && u.pct < 8, `±${u.pct}`); // dominado por el CO₂ (5 %) con CH₄/N₂O marginales
});
test('refrigerantes: PCA de gas puro frente a mezcla (R-410A, R-448A) y parte de mantenimiento como origen del dato', () => {
  assert.equal(esMezclaRefrigerante('HFC-134a'), false); assert.equal(esMezclaRefrigerante('R-410A'), true); assert.equal(esMezclaRefrigerante('R-448A'), true);
  const puro = incertidumbreLinea(calc([fuga])[0], f, cfg); assert.equal(puro.datoPct, 10); assert.equal(puro.factorPct, 10);
  const mezcla = incertidumbreLinea(calc([{ ...fuga, fuente: 'R-410A' }])[0], f, cfg); assert.equal(mezcla.factorPct, 15);
});
test('la línea hereda el catálogo y se ajusta con justificación; sin justificación es incidencia', () => {
  const aj = calc([{ ...elec, incertidumbre: { origen: 'estimacion', justificacion: 'Sin factura: estimación a partir del contador.' } }]);
  const u = incertidumbreLinea(aj[0], f, cfg); assert.equal(u.datoPct, 25); assert.equal(u.ajustada, true);
  const manual = incertidumbreLinea(calc([{ ...elec, incertidumbre: { datoPct: 7, factorPct: 3, justificacion: 'x' } }])[0], f, cfg);
  assert.equal(manual.datoPct, 7); assert.equal(manual.factorPct, 3);
  assert.deepEqual(calcularIncertidumbre(aj, f).incidencias.length, 0);
  const sin = calcularIncertidumbre(calc([{ ...elec, incertidumbre: { datoPct: 9 } }]), f);
  assert.equal(sin.incidencias.length, 1);
});
test('combinación por fuente, categoría y total: dato independiente entre líneas, factor común dentro de la fuente, cuadratura entre fuentes', () => {
  const rs = calc([elec, { ...elec, id: 'e2', cantidad: 50000 }, gas, fuga]);
  const r = calcularIncertidumbre(rs, f);
  const abs = r.lineas.map((x) => x.absoluta); const E = r.lineas.map((x) => x.emision);
  const eleFuente = r.porFuente.find((x) => x.nombre === 'Electricidad')!;
  const L = r.lineas; assert.ok(Math.abs(eleFuente.absoluta - Math.sqrt(L[0].absDato ** 2 + L[1].absDato ** 2 + (L[0].absFactor + L[1].absFactor) ** 2)) < 1e-9); // el factor del mix es el mismo en las dos facturas
  const cat1 = r.porCategoria.find((x) => x.n === 1)!;
  assert.ok(Math.abs(cat1.absoluta - Math.sqrt(abs[2] ** 2 + abs[3] ** 2)) < 1e-9);
  assert.ok(Math.abs(r.total.absoluta - Math.sqrt(eleFuente.absoluta ** 2 + abs[2] ** 2 + abs[3] ** 2)) < 1e-9);
  assert.ok(Math.abs(r.total.emision - E.reduce((t, x) => t + x, 0)) < 1e-9);
  // el total es menor que la suma simple de las absolutas (se compensan) y mayor que cada fuente
  assert.ok(r.total.absoluta < abs.reduce((t, x) => t + x, 0)); assert.ok(r.total.absoluta > Math.max(eleFuente.absoluta, abs[2], abs[3]));
  // principal fuente de incertidumbre de la categoría 1: la que más aporta a la varianza
  assert.ok(['Gas natural (kWhPCS)*', 'HFC-134a'].includes(cat1.principal!.fuente)); assert.ok(cat1.principal!.peso > 50 && cat1.principal!.peso <= 100);
});
test('valoración cualitativa con umbrales configurables', () => {
  assert.equal(valoracion(3, cfg), 'Baja'); assert.equal(valoracion(5, cfg), 'Baja'); assert.equal(valoracion(10, cfg), 'Media'); assert.equal(valoracion(20, cfg), 'Alta'); assert.equal(valoracion(31, cfg), 'Muy alta');
  assert.equal(valoracion(10, configIncertidumbre({ umbrales: { baja: 12, media: 20, alta: 40 } })), 'Baja'); assert.equal(valoracion(null, cfg), null);
});
test('sin emisión no hay división por cero ni NaN', () => {
  const r = calcularIncertidumbre(calc([{ ...elec, origenElectricidad: 'gdo_renovable_balear' }]), f);
  assert.equal(r.total.pct, null); assert.equal(r.total.valoracion, null); assert.ok(r.lineas.every((x) => Number.isFinite(x.pct) && Number.isFinite(x.absoluta)));
});

test('descripción por fuente: solo orígenes y factores aplicados en el inventario (sin catálogo por defecto)', async () => {
  const { descripcionPorFuente, calcularIncertidumbre } = await import('../incertidumbre.ts');
  const { calcularInventario } = await import('../motor.ts');
  const { readFileSync } = await import('node:fs');
  const { construirConjunto } = await import('../factores.ts');
  const { conMezclas } = await import('../mezclas.ts');
  const f = conMezclas(construirConjunto(JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2024.1.json', import.meta.url), 'utf-8')), { anioInventario: 2024 }));
  const L = [
    { id: 'g', centro: 'A', categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 1000, evidencia: 'f' },
    { id: 'e', centro: 'A', categoria: 'electricidad', fuente: '', cantidad: 1000, origenElectricidad: 'red', evidencia: 'f' },
    { id: 'r', centro: 'A', categoria: 'fugitiva', fuente: 'R-448A', cantidad: 3, evidencia: 'f' },
  ] as never[];
  const { resultados } = calcularInventario(L, f);
  const filas = descripcionPorFuente(resultados, calcularIncertidumbre(resultados, f));
  const por = Object.fromEntries(filas.map((x) => [x.fuente, x]));
  assert.match(por['Electricidad'].consumo, /±2,0 % · factura/); assert.match(por['Electricidad'].factor, /±5,0 % · mix eléctrico/);
  assert.match(por['Gas natural (kWhPCS)*'].factor, /CO₂ del combustible/);
  assert.match(por['R-448A'].consumo, /±10,0 % · parte de mantenimiento/); assert.match(por['R-448A'].factor, /±15,0 % · PCA de la mezcla/);
  const texto = filas.map((x) => `${x.consumo} ${x.factor}`).join(' ');
  assert.ok(!/albar|estimaci|lectura interna|N₂O|CH₄/i.test(texto)); // nada que no se use
});

test('varias facturas de una misma fuente no diluyen la incertidumbre del factor: 15 facturas de luz siguen en ±5 %, no en ±1,8 %', () => {
  const quince = calc(Array.from({ length: 15 }, (_, i) => ({ ...elec, id: `e${i}`, cantidad: 50000 })));
  const r = calcularIncertidumbre(quince, f);
  const e = r.porFuente.find((x) => x.nombre === 'Electricidad')!;
  assert.ok(e.pct! > 5 && e.pct! < 5.5, `±${e.pct}`); // 5 % del mix (sistemático) y 2 % del dato dividido por √15
  const una = calcularIncertidumbre(calc([{ ...elec, cantidad: 750000 }]), f).porFuente[0].pct!;
  assert.ok(Math.abs(e.pct! - una) < 0.5 && e.pct! < una); // algo menor que una sola factura del mismo total (solo se promedia el error del dato)
});
