// Prueba de aceptación: el motor debe reproducir los resultados del informe de ejemplo (hotel de Mallorca, inventario 2022,
// verificado por entidad acreditada). Los resultados por fuente se leen de las gráficas del informe (kg de CO2).
// Datos y cifras de terceros: solo se usan aquí como referencia numérica de validación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { construirConjunto } from '../factores.ts';
import { calcularInventario, ratio } from '../motor.ts';
import type { DatosCalculadora, LineaActividad } from '../tipos.ts';

const datos2023: DatosCalculadora = JSON.parse(
  readFileSync(new URL('../datos/factores-calculadora-2023.2.json', import.meta.url), 'utf-8'),
);

// El informe de 2022 usó el documento MITECO vigente entonces (v23): los factores de combustibles coinciden con la
// calculadora 2023.2 (gasóleo C 2,705 kg/l), no con la 2024.1 (2,881). Los PCA de refrigerantes son los AR5 de ese documento
// (R-134a 1.300, R-449A 1.282, R-410A 1.924), y los GWP de CH4 y N2O los de la resolución de 2022 (28 y 265).
const f2022 = construirConjunto(datos2023, {
  anioInventario: 2022,
  gwp: { ch4: 28, n2o: 265, fuente: 'Resolución del Govern para 2022 (19/03/2024), según el informe de ejemplo; pendiente de contrastar con el BOIB' },
  pcaRefrigerantes: { 'HFC-134a': 1300, 'R-449A': 1282, 'R-410A': 1924 },
  combustibles: {
    // Factor implícito en el informe (389,15 kg / 171,96 l); no figura en la calculadora: origen por identificar.
    'Gasolina maquinaria (l)': { co2: 2.263, ch4: null, n2o: null },
  },
  notas: [
    'GWP 28/265 y PCA AR5 de refrigerantes: valores del documento MITECO v23 citado por el informe de ejemplo.',
    'Gasolina de maquinaria: factor CO2 implícito 2,263 kg/l deducido del informe; sin CH4 ni N2O.',
  ],
});

const centro = 'Hotel de ejemplo';
const L = (id: string, categoria: LineaActividad['categoria'], fuente: string, cantidad: number, extra: Partial<LineaActividad> = {}): LineaActividad =>
  ({ id, centro, categoria, fuente, cantidad, ...extra });

// Datos de actividad del informe. Nota: en el texto del informe las etiquetas N1 y M2 aparecen intercambiadas respecto a
// la gráfica; aquí se asignan según los factores que reproducen la gráfica (277,84 l → N1; 2.006,4 l → M2).
const lineas: LineaActividad[] = [
  L('gn', 'combustion_fija', 'Gas natural (kWhPCS)*', 650293),
  L('gc', 'combustion_fija', 'Gasóleo C (l)', 17945),
  L('glp', 'combustion_fija', 'LPG (l)', 3196),
  L('maq', 'combustion_movil', 'Gasolina maquinaria (l)', 171.96),
  L('n1', 'combustion_movil', 'B7 (l)|Furgonetas y furgones (N1)', 277.84),
  L('gn1', 'combustion_movil', 'E5 (l)|Furgonetas y furgones (N1)', 30.35),
  L('m2', 'combustion_movil', 'B7 (l)|Autobuses (M2, M3)', 2006.4),
  L('r134', 'fugitiva', 'HFC-134a', 4),
  L('r449', 'fugitiva', 'R-449A', 5),
  L('r410', 'fugitiva', 'R-410A', 10),
  L('el', 'electricidad', '', 1798417, { origenElectricidad: 'red' }),
];

const { resultados, totales } = calcularInventario(lineas, f2022);
const co2 = (id: string) => resultados.find((r) => r.linea.id === id)!.kgCO2;
const cerca = (real: number, esperado: number, tol: number, etiqueta: string) =>
  assert.ok(Math.abs(real - esperado) <= tol, `${etiqueta}: calculado ${real.toFixed(2)} frente a ${esperado} (tolerancia ${tol})`);

test('reproduce exactamente las fuentes principales', () => {
  cerca(co2('gn'), 118353.33, 0.01, 'gas natural');
  cerca(co2('gc'), 48541.23, 0.01, 'gasóleo C (con el factor de la calculadora 2023.2)');
  cerca(co2('glp'), 4925, 0.1, 'GLP');
  cerca(totales.kgCO2PorGas.fluorados_co2e, 30850, 0.001, 'fluorados (PCA AR5)');
  cerca(totales.kgCO2eAlcance2, 751738.31, 0.01, 'electricidad (mix 2022 = 0,418)');
});

test('reproduce los vehículos y la maquinaria con tolerancias explicadas', () => {
  cerca(co2('maq'), 389.15, 0.01, 'gasolina de maquinaria (factor implícito)');
  cerca(co2('n1'), 690.71, 0.05, 'gasoil N1');
  cerca(co2('gn1'), 67.8, 0.1, 'gasolina N1');
  // 0,04 %: el informe usa ≈ 2,483 kg/l para el autobús y la calculadora 2023.2 da 2,482
  cerca(co2('m2'), 4981.89, 2.5, 'gasoil M2');
});

test('los totales del informe: Alcance 1 = 209,53 t, Alcance 2 = 751,74 t, total = 961,27 t', () => {
  cerca(totales.kgCO2eAlcance1 / 1000, 209.53, 0.2, 'Alcance 1 (t)'); // ±0,1 %
  cerca(totales.kgCO2eAlcance2 / 1000, 751.74, 0.005, 'Alcance 2 (t)');
  cerca(totales.kgCO2eTotal / 1000, 961.27, 0.25, 'total (t)');
});

test('ratio por estancia: 0,0074-0,0075 t CO2e por estancia (128.751 estancias)', () => {
  const t = ratio(totales.kgCO2eTotal, 128751) / 1000;
  cerca(t, 0.0075, 0.0001, 't CO2e por estancia');
});

test('el informe debe poder mostrar el desglose por gas y por categoría', () => {
  assert.ok(totales.kgCO2PorGas.ch4_co2e > 0 && totales.kgCO2PorGas.n2o_co2e > 0);
  assert.equal(Object.keys(totales.porCategoria).sort().join(','), 'combustion_fija,combustion_movil,electricidad,fugitiva');
});
