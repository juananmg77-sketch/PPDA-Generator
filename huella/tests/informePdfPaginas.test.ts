import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extractText, getDocumentProxy } from 'unpdf';
import { construirConjunto } from '../factores.ts';
import { calcularInventario } from '../motor.ts';
import { construirInforme } from '../informe.ts';
import { definicionInforme } from '../informePdf.ts';

// Genera el PDF real (pdfmake en Node, con la tipografía y las imágenes de la aplicación) y comprueba su paginación.
const require = createRequire(import.meta.url);
const PdfPrinter = require('pdfmake');
const datos = JSON.parse(readFileSync(new URL('../datos/factores-calculadora-2024.1.json', import.meta.url), 'utf-8'));
const f = construirConjunto(datos, { anioInventario: 2024 });
const url = (p: string) => 'data:' + (p.endsWith('jpg') ? 'image/jpeg' : 'image/png') + ';base64,' + readFileSync(new URL('../../public' + p, import.meta.url)).toString('base64');
const ft = (n: string) => new URL('../../public/fonts/Montserrat-' + n + '.ttf', import.meta.url).pathname;
const recursos = { portada: url('/brand/informe/portada-ondas.jpg'), logoBlanco: url('/brand/informe/logo-hs-group-blanco.png'), logoGroup: url('/logo-hs-group.png'), logoGreen: url('/logo-hsgreen-recortado.png'), banda: url('/brand/informe/banda-degradado.png') };

function datosInforme(nMeses: number): any {
const lineas: any[] = []; const acts: any[] = []; const docs: any[] = [];
for (let m = 1; m <= nMeses; m++) {
  const mm = String(m).padStart(2, '0');
  lineas.push({ id: `e${m}`, centro: 'Astoria Playa', categoria: 'electricidad', fuente: '', cantidad: 60000 + m * 3000, origenElectricidad: 'red', contador: 'ES0031500199603001ES', evidencia: `d${m}` });
  acts.push({ id: `e${m}`, documentoId: `d${m}`, documento: `${mm} Luz.pdf`, centro: 'Astoria Playa', categoria: 'electricidad', fuente: '', cantidad: 60000 + m * 3000, contador: 'ES0031500199603001ES', periodoDesde: `2024-${mm}-01`, periodoHasta: `2024-${mm}-28` });
  docs.push({ id: `d${m}`, nombre: `${mm} Luz.pdf`, tipo: 'electricidad', centro: 'Astoria Playa', periodoDesde: `2024-${mm}-01`, periodoHasta: `2024-${mm}-28`, estado: 'revisado' });
  lineas.push({ id: `g${m}`, centro: 'Astoria Playa', categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 9000, evidencia: `g${m}` });
  acts.push({ id: `g${m}`, documentoId: `g${m}`, documento: `gas${mm}.pdf`, centro: 'Astoria Playa', categoria: 'combustion_fija', fuente: 'Gas natural (kWhPCS)*', cantidad: 9000, periodoDesde: `2024-${mm}-01`, periodoHasta: `2024-${mm}-28` });
  docs.push({ id: `g${m}`, nombre: `gas${mm}.pdf`, tipo: 'gas_natural', centro: 'Astoria Playa', periodoDesde: `2024-${mm}-01`, periodoHasta: `2024-${mm}-28`, estado: 'revisado' });
}
lineas.push({ id: 'f1', centro: 'Astoria Playa', categoria: 'fugitiva', fuente: 'R-410A', cantidad: 7.8, evidencia: 'dx' }); acts.push({ id: 'f1', documentoId: 'dx', documento: 'recarga.pdf', centro: 'Astoria Playa', categoria: 'fugitiva', fuente: 'R-410A', cantidad: 7.8, periodoDesde: '2024-09-12', periodoHasta: '2024-09-12' });
docs.push({ id: 'dx', nombre: 'recarga.pdf', tipo: 'refrigerante', centro: 'Astoria Playa', periodoDesde: '2024-09-12', periodoHasta: '2024-09-12', estado: 'revisado' });
const { resultados, totales } = calcularInventario(lineas, f);
const d: any = {
  organizacion: { nombre: 'Astoria Playa', razonSocial: 'Hoteles Alcúdia, S.L.', cif: 'B57198053', direccion: "Carrer de l'Astoria, 1", cnae: '5510', iae: '681', criterio: 'control_operativo', justificacionConsolidacion: 'Gestiona el hotel.', responsable: { nombre: 'Juan Antonio Muñoz', cargo: 'Director General EMEA', entidad: 'HS Consulting Group' } },
  centros: [{ nombre: 'Astoria Playa', direccion: 'C/ Mar 1', municipio: 'Calvià', isla: 'Mallorca', enBaleares: true, unidades: 136, indice: 40000, plantilla: 63.465 }],
  inventario: { anio: 2024, estado: 'borrador', anioBase: null, cerradoEn: null, conjuntoFijado: true, cierre: null },
  factores: f, resultados, totales, actividad: acts, anterior: null, exclusiones: [], noConformidades: [], documentos: docs, emitidoPor: 'Consultor HS', fecha: '2025-03-05',
  mensualPorFuente: { Electricidad: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41], 'Gas natural': [5, 5, 5, 4, 4, 3, 3, 3, 4, 4, 5, 5] },
};
  return d;
}

async function paginas(nMeses: number): Promise<string[]> {
  const printer = new PdfPrinter({ Montserrat: { normal: ft('Regular'), bold: ft('SemiBold'), italics: ft('Italic'), bolditalics: ft('SemiBoldItalic') } });
  const doc = printer.createPdfKitDocument(definicionInforme(construirInforme(datosInforme(nMeses)), recursos));
  const trozos: Buffer[] = [];
  await new Promise<void>((res) => { doc.on('data', (c: Buffer) => trozos.push(c)); doc.on('end', () => res()); doc.end(); });
  const pdf = await getDocumentProxy(new Uint8Array(Buffer.concat(trozos)));
  return (await extractText(pdf, { mergePages: false })).text;
}

for (const n of [3, 12]) {
  test(`PDF con ${n} meses: sin hojas en blanco, resumen ejecutivo en la página 2 y el índice en la 3`, async () => {
    const p = await paginas(n);
    p.forEach((t, i) => { if (i > 0) assert.ok(t.replace(/\s+/g, ' ').trim().length > 120, `la página ${i + 1} está (casi) en blanco: «${t.trim().slice(0, 60)}»`); });
    assert.match(p[1], /RESUMEN EJECUTIVO/); assert.match(p[1], /Conclusiones/);
    assert.match(p[2], /^\s*ÍNDICE/);
    assert.ok(p.length >= 8 && p.length < 40);
  });
}
