import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { unzipSync, strFromU8 } from 'fflate';
import { planCalculadora, ponerCeldasEnHoja, rellenarCalculadora, rellenarLibro, sectorDesdeCnae, versionDeFactores } from '../calculadoraOficial.ts';
import type { DatosOficiales } from '../calculadoraOficial.ts';

const plantilla = (v: string) => new Uint8Array(readFileSync(new URL(`../../public/plantillas/calculadora-${v}.xlsx`, import.meta.url)));
const datos = (): DatosOficiales => ({
  anio: 2024, verificacion: true,
  organizacion: { nombre: 'Explotaciones Turísticas Playa de la Luz', cif: 'B07000000', cnae: '5510' },
  centros: [{ nombre: 'Hotel Astoria Playa', enBaleares: true, isla: 'Mallorca', municipio: 'Alcúdia', direccion: 'C/ Mar 1' }],
  indice: { nombre: 'Estancias', valor: 120000, unidades: 'estancias' },
  lineas: [
    { centro: 'Hotel Astoria Playa', categoria: 'electricidad', fuente: '', cantidad: 400000, origenElectricidad: 'red', proveedor: 'ENDESA' },
    { centro: 'Hotel Astoria Playa', categoria: 'electricidad', fuente: '', cantidad: 100000, origenElectricidad: 'red', proveedor: 'ENDESA' },
    { centro: 'Hotel Astoria Playa', categoria: 'electricidad', fuente: '', cantidad: 30000, origenElectricidad: 'autoconsumo', proveedor: 'Solar' },
    { centro: 'Hotel Astoria Playa', categoria: 'combustion_fija', fuente: 'Gasóleo C (l)', cantidad: 5000 },
    { centro: 'Hotel Astoria Playa', categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 80000 },
    { centro: 'Hotel Astoria Playa', categoria: 'combustion_movil', fuente: 'B7 (l)|Furgonetas y furgones (N1)', cantidad: 900 },
    { centro: 'Hotel Astoria Playa', categoria: 'fugitiva', fuente: 'HFC-134a', cantidad: 2.5 },
  ],
});
const leer = (bytes: Uint8Array) => XLSX.read(bytes, { type: 'array', cellFormula: true });

test('rellena las hojas de entrada y suma lo que comparte centro, comercializadora y tipo', () => {
  const { bytes } = rellenarCalculadora(plantilla('2024.1'), datos());
  const wb = leer(bytes);
  const v = (h: string, ref: string) => wb.Sheets[h][ref]?.v;
  assert.equal(v('0.1_Datos generales organiz.', 'G3'), 2024);
  assert.equal(v('0.1_Datos generales organiz.', 'D6'), 'Explotaciones Turísticas Playa de la Luz');
  assert.equal(v('0.1_Datos generales organiz.', 'D9'), 'I.- Hostelería');
  assert.equal(v('0.1_Datos generales organiz.', 'E44'), 'Hotel Astoria Playa');
  assert.equal(v('0.1_Datos generales organiz.', 'H44'), 'Mallorca');
  assert.equal(v('0.1_Datos generales organiz.', 'F22'), 120000);
  assert.equal(v('2.1_Categoría 2 Balears', 'H18'), 500000); // dos facturas de la misma comercializadora
  assert.equal(v('2.1_Categoría 2 Balears', 'G18'), 'No');
  assert.equal(v('2.1_Categoría 2 Balears', 'G19'), 'Autoconsumo');
  assert.equal(v('2.1_Categoría 2 Balears', 'H19'), 30000);
  assert.equal(v('1.1_Instalaciones fijas', 'G15'), 'Gasóleo C (l)');
  assert.equal(v('1.1_Instalaciones fijas', 'H16'), 80000);
  assert.equal(v('1.2_Vehículos y maquinaria', 'G23'), 'Furgonetas y furgones (N1)');
  assert.equal(v('1.2_Vehículos y maquinaria', 'H23'), 'B7 (l)');
  assert.equal(v('1.2_Vehículos y maquinaria', 'I23'), 900);
  assert.equal(v('1.4_Emisiones fugitivas', 'G15'), 'HFC-134a');
  assert.equal(v('1.4_Emisiones fugitivas', 'N15'), 2.5);
});

test('conserva fórmulas, hojas ocultas y el resto de ficheros del libro oficial', () => {
  const orig = plantilla('2024.1'); const { bytes } = rellenarCalculadora(orig, datos());
  const a = unzipSync(orig), b = unzipSync(bytes);
  assert.deepEqual(Object.keys(b), Object.keys(a));
  const distintos = Object.keys(a).filter((k) => strFromU8(a[k]) !== strFromU8(b[k]) && !/\.(png|jpe?g|emf|bin)$/.test(k));
  assert.ok(distintos.length <= 8 && distintos.includes('xl/workbook.xml'), `ficheros modificados: ${distintos.join(', ')}`);
  assert.match(strFromU8(b['xl/workbook.xml']), /<calcPr[^>]*fullCalcOnLoad="1"/);
  const wb = leer(bytes);
  assert.match(String(wb.Sheets['1.1_Instalaciones fijas']['R15'].f), /Dades!\$H\$435/); // fórmula oficial intacta
  assert.equal(wb.Sheets['Dades'] !== undefined, true);
  assert.equal(wb.Workbook?.Sheets?.find((s) => s.name === 'Dades')?.Hidden, 1); // sigue oculta
});

test('funciona también con la calculadora 2023.2 (mismo diseño de hojas)', () => {
  const d = datos(); d.anio = 2023;
  const wb = leer(rellenarCalculadora(plantilla('2023.2'), d).bytes);
  assert.equal(wb.Sheets['2.1_Categoría 2 Balears']['H18'].v, 500000);
});

test('escribe en filas o celdas que no existen y escapa el texto', () => {
  const xml = '<worksheet><sheetData><row r="2"><c r="A2" s="3"/><c r="C2"/></row><row r="9"/></sheetData></worksheet>';
  const r = ponerCeldasEnHoja(xml, [{ ref: 'B2', valor: 'a & <b>' }, { ref: 'A2', valor: 5 }, { ref: 'D9', valor: 'x' }, { ref: 'A5', valor: 1 }]);
  assert.match(r, /<c r="A2" s="3"><v>5<\/v><\/c><c r="B2" t="inlineStr"><is><t xml:space="preserve">a &amp; &lt;b&gt;<\/t><\/is><\/c><c r="C2"\/>/);
  assert.match(r, /<row r="5"><c r="A5"><v>1<\/v><\/c><\/row><row r="9"><c r="D9" t="inlineStr">/);
});

test('avisa de lo que falta y no admite más filas de las que tiene el libro', () => {
  const p = planCalculadora(datos());
  assert.ok(p.pendientes.some((x) => /Tipo de organización/.test(x)));
  assert.ok(p.avisos.some((x) => /comercializadora se ha escrito/.test(x)));
  const d = datos(); d.lineas = Array.from({ length: 23 }, (_, i) => ({ centro: 'H', categoria: 'combustion_fija' as const, fuente: `Fuente ${i}`, cantidad: 1 }));
  assert.throws(() => planCalculadora(d), /solo admite 22/);
  assert.throws(() => rellenarLibro(plantilla('2024.1'), [{ hoja: 'Inexistente', ref: 'A1', valor: 1 }]), /no es la calculadora oficial/);
});

test('sector por CNAE y versión de la calculadora', () => {
  assert.equal(sectorDesdeCnae('5510'), 'I.- Hostelería'); assert.equal(sectorDesdeCnae('5610'), 'I.- Hostelería'); assert.equal(sectorDesdeCnae(null), null);
  assert.equal(versionDeFactores('calculadora-2024.1'), '2024.1'); assert.equal(versionDeFactores('calculadora-2030.1'), null);
});

test('un gas que la calculadora no trae va a «Otros» con su nombre y su PCA; si falta el PCA, falla', () => {
  const d = datos(); d.lineas.push({ centro: 'Hotel Astoria Playa', categoria: 'fugitiva', fuente: 'R-448A', cantidad: 87.8 });
  d.gases = { oficiales: ['HFC-134a', 'R-410A'], pca: { 'HFC-134a': 1530, 'R-448A': 1387 } };
  const wb = leer(rellenarCalculadora(plantilla('2024.1'), d).bytes); const h = wb.Sheets['1.4_Emisiones fugitivas'];
  assert.equal(h['G15'].v, 'HFC-134a'); assert.equal(h['G16'].v, 'Otros'); assert.equal(h['I16'].v, 'R-448A'); assert.equal(h['J16'].v, 1387); assert.equal(h['N16'].v, 87.8);
  assert.ok(planCalculadora(d).avisos.some((a) => /R-448A.*«Otros».*1\.?387/.test(a)));
  d.gases.pca = {}; assert.throws(() => planCalculadora(d), /no tiene su PCA/);
});

import { tipoOrganizacionPorPlantilla } from '../calculadoraOficial.ts';
test('tipo de organización por plantilla', () => {
  assert.equal(tipoOrganizacionPorPlantilla(63.465), 'Mediana');
  assert.equal(tipoOrganizacionPorPlantilla(9), 'Micro');
  assert.equal(tipoOrganizacionPorPlantilla(0), null);
});
