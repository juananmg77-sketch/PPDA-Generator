import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirConjunto } from '../factores.ts';
import { ESQUEMA_BASE, ESQUEMA_EXTRACCION, MODELO_BASE, MODELO_REFUERZO, instrucciones, leerFactura, validarEntrada } from '../lectura.ts';
import type { LlamarModelo } from '../lectura.ts';
import type { ExtraccionFactura } from '../extraccion.ts';
import type { DatosCalculadora } from '../tipos.ts';

const datos: DatosCalculadora = JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2024.1.json', import.meta.url), 'utf-8'));
const ctx = { anioInventario: 2024, factores: construirConjunto(datos, { anioInventario: 2024 }) };
const buena: ExtraccionFactura = { tipo: 'electricidad', proveedor: 'X', periodoDesde: '2024-03-01', periodoHasta: '2024-03-31', cantidad: 15000, unidad: 'kWh', garantiaOrigen: 'no', confianza: 0.95 };
const mala: ExtraccionFactura = { ...buena, cantidad: undefined, confianza: 0.5 };

const simulado = (respuestas: Record<string, ExtraccionFactura | Error>): { llamar: LlamarModelo; llamadas: string[] } => {
  const llamadas: string[] = [];
  return {
    llamadas,
    llamar: async (m) => {
      llamadas.push(m);
      const r = respuestas[m];
      if (r instanceof Error) throw r;
      return { extraccion: r, tokensEntrada: 3000, tokensSalida: 300 };
    },
  };
};

test('lectura buena con el modelo barato: no se usa el modelo mayor', async () => {
  const s = simulado({ [MODELO_BASE]: buena });
  const r = await leerFactura(s.llamar, { texto: 'factura' }, ctx);
  assert.deepEqual(s.llamadas, [MODELO_BASE]);
  assert.equal(r.usoRefuerzo, false);
  assert.deepEqual(r.incidencias, []);
});

test('lectura dudosa: se reintenta con el modelo mayor y se queda con la mejor', async () => {
  const s = simulado({ [MODELO_BASE]: mala, [MODELO_REFUERZO]: buena });
  const r = await leerFactura(s.llamar, { texto: 'factura' }, ctx);
  assert.deepEqual(s.llamadas, [MODELO_BASE, MODELO_REFUERZO]);
  assert.equal(r.modelo, MODELO_REFUERZO);
  assert.equal(r.consumo.length, 2);
});

test('si el refuerzo falla o empeora, se conserva la primera lectura con sus incidencias', async () => {
  const falla = simulado({ [MODELO_BASE]: mala, [MODELO_REFUERZO]: new Error('caído') });
  const r1 = await leerFactura(falla.llamar, { texto: 'f' }, ctx);
  assert.equal(r1.modelo, MODELO_BASE);
  assert.ok(r1.incidencias.some((i) => i.codigo === 'cantidad'));
  const peor = simulado({ [MODELO_BASE]: mala, [MODELO_REFUERZO]: { ...mala, unidad: undefined } });
  assert.equal((await leerFactura(peor.llamar, { texto: 'f' }, ctx)).modelo, MODELO_BASE);
});

test('una incidencia que no es de lectura (p. ej. fuera de año) no gasta el modelo mayor', async () => {
  const s = simulado({ [MODELO_BASE]: { ...buena, periodoDesde: '2023-03-01', periodoHasta: '2023-03-31' } });
  await leerFactura(s.llamar, { texto: 'f' }, ctx);
  assert.deepEqual(s.llamadas, [MODELO_BASE]);
});

test('entrada: límites de tamaño, formato y vacío', () => {
  assert.ok(validarEntrada({}));
  assert.ok(validarEntrada({ base64: 'AAAA', mediaType: 'image/gif' as never }));
  assert.ok(validarEntrada({ base64: 'A'.repeat(8 * 1024 * 1024), mediaType: 'application/pdf' }));
  assert.equal(validarEntrada({ base64: 'AAAA', mediaType: 'application/pdf' }), null);
  assert.equal(validarEntrada({ texto: 'hola' }), null);
});

test('el esquema coincide con ExtraccionFactura (todas las claves del tipo están definidas)', () => {
  const claves = Object.keys(ESQUEMA_EXTRACCION.properties).sort();
  assert.deepEqual(claves, ['cantidad', 'confianza', 'contador', 'factorConversion', 'garantiaOrigen', 'importe', 'periodoDesde', 'periodoHasta', 'producto', 'proveedor', 'suministro', 'tipo', 'unidad']);
});

test('tipo indicado de antemano: va en las instrucciones y una lectura distinta obliga a revisar', async () => {
  assert.match(instrucciones('gas_natural'), /gas natural: usa tipo = gas_natural/);
  assert.doesNotMatch(instrucciones(), /El usuario indica/);
  const s = simulado({ [MODELO_BASE]: buena, [MODELO_REFUERZO]: buena });
  const r = await leerFactura(s.llamar, { texto: 'f', tipoEsperado: 'gas_natural' }, ctx);
  assert.ok(r.incidencias.some((i) => i.codigo === 'tipo_distinto' && i.gravedad === 'error'));
  const ok = await leerFactura(simulado({ [MODELO_BASE]: buena }).llamar, { texto: 'f', tipoEsperado: 'electricidad' }, ctx);
  assert.deepEqual(ok.incidencias, []);
});

test('esquema: tamaño contenido (la API rechaza esquemas complejos) y la cadena de suministro se interpreta', async () => {
  const props = Object.keys(ESQUEMA_EXTRACCION.properties);
  assert.ok(props.length <= 13, `propiedades: ${props.length}`);
  assert.deepEqual(Object.keys(ESQUEMA_BASE.properties).length, props.length - 1);
  const e = { tipo: 'gas_natural', confianza: 0.9, cantidad: 100, periodoDesde: '2024-01-01', periodoHasta: '2024-01-31', unidad: 'kWh PCS', suministro: 'CUPS=ES0238330000167922NX; contador=816000231; direccion=Av. Mèxic 1 – GAS COCINA' };
  const r = await leerFactura(simulado({ [MODELO_BASE]: e as never }).llamar, { texto: 'f' }, ctx);
  assert.equal(r.extraccion.cups, 'ES0238330000167922NX'); assert.equal(r.extraccion.contador, 'ES0238330000167922NX');
  assert.equal(r.extraccion.numeroContador, '816000231'); assert.equal(r.extraccion.direccionSuministro, 'Av. Mèxic 1 – GAS COCINA');
  assert.equal('suministro' in r.extraccion, false);
  // sin suministro en la lectura: el CUPS único del texto de la factura
  const t = await leerFactura(simulado({ [MODELO_BASE]: { ...e, suministro: '' } as never }).llamar, { texto: 'Punto de suministro ES0238 3300 0016 7922 NX contrato' }, ctx);
  assert.equal(t.extraccion.cups, 'ES0238330000167922NX');
});

test('CUPS mal leído en un escaneo: se corrige por su dígito de control o se avisa', async () => {
  const e = (cups: string) => ({ tipo: 'electricidad', confianza: 0.9, cantidad: 7531, periodoDesde: '2023-12-31', periodoHasta: '2024-01-31', unidad: 'kWh', suministro: `CUPS=${cups}; contador=063015258` });
  const r = await leerFactura(simulado({ [MODELO_BASE]: e('ES0031500189603001ES0F') as never }).llamar, { texto: 'f' }, ctx);
  assert.equal(r.extraccion.cups, 'ES0031500199603001ES');
  assert.ok(r.incidencias.some((i) => i.codigo === 'cups_corregido'));
  assert.equal(r.extraccion.numeroContador, '063015258');
  // ambiguo sin contexto: se avisa y se pide segunda lectura; con el CUPS conocido del centro se corrige
  const a = await leerFactura(simulado({ [MODELO_BASE]: e('ES0031500109603001ES') as never, [MODELO_REFUERZO]: e('ES0031500109603001ES') as never }).llamar, { texto: 'f' }, ctx);
  assert.ok(a.incidencias.some((i) => i.codigo === 'cups_invalido') && a.usoRefuerzo);
  const k = await leerFactura(simulado({ [MODELO_BASE]: e('ES0031500109603001ES') as never }).llamar, { texto: 'f', cupsConocidos: ['ES0031500199603001ES'] }, ctx);
  assert.equal(k.extraccion.cups, 'ES0031500199603001ES');
});

test('las instrucciones recogen los formatos reales: gas envasado, recarga de refrigerante y gas de red', () => {
  const t = instrucciones();
  assert.match(t, /Fianza envases/); assert.match(t, /Total Kg/);
  assert.match(t, /Impuesto sobre gases fluorados.*NO la sumes/s);
  assert.match(t, /periodoDesde = periodoHasta/);
});
