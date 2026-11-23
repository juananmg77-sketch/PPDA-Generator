// Informe en PDF generado directamente (no es un documento de impresión): A4 con márgenes fijos, cabecera con logos, pie con numeración y banda degradada,
// portada de ondas y tablas con cabecera repetida. Tipografía Montserrat (ficheros en /fonts). Se construye con pdfmake a partir del mismo modelo que la vista previa.
import type { Bloque, ModeloInforme } from './informe.ts';

export interface RecursosPdf { portada: string; logoBlanco: string; logoGroup: string; logoGreen: string; banda: string }

const A4 = { w: 595.28, h: 841.89 };
const MARGEN = { izq: 48, der: 48, sup: 82, inf: 72 }; // 17 mm laterales, 29 mm arriba, 25 mm abajo
const ANCHO = A4.w - MARGEN.izq - MARGEN.der;
const C = { azul: '#002060', marino: '#00093D', cian: '#24CBF5', texto: '#344454', gris: '#9D9D9C', zebra: '#F2F8FD', pie: '#435971', fuerte: '#0002C9' };

const quitarFuente = (svg: string) => svg.replace(/font-family="[^"]*"/g, 'font-family="Montserrat"');

/** Anchos de columna (pt): proporcionales al contenido, pero ninguna menor que su palabra más larga (el título no se parte ni se sale de la página). */
function anchos(cab: string[], filas: string[][], fs: number): number[] {
  const peso = cab.map((c, i) => {
    const largos = [c.length, ...filas.slice(0, 60).map((f) => Math.max(...(f[i] ?? '').split('\n').map((l) => l.length), 0))];
    const media = largos.reduce((x, y) => x + y, 0) / largos.length;
    return Math.min(40, Math.max(4, (Math.max(...largos) + media) / 2));
  });
  // Anchura mínima: la de la palabra más larga del título y del cuerpo (los dígitos de Montserrat son más anchos que las letras)
  const palabraPt = (w: string, negrita: boolean) => ([...w].reduce((t, ch) => t + (/\d/.test(ch) ? 5.6 : /[.,]/.test(ch) ? 2.6 : /[A-ZÁÉÍÓÚ]/.test(ch) ? 5.9 : 5.1), 0) * (negrita ? 1.07 : 1) * fs) / 8 + 1;
  const minimo = cab.map((c, i) => Math.min(150, Math.max(
    ...c.split(/\s+/).map((w) => palabraPt(w, true)),
    ...filas.slice(0, 80).flatMap((f) => (f[i] ?? '').split(/\s+/)).map((w) => palabraPt(w.slice(0, 14), false)),
  )));
  // pdfmake suma el relleno de cada celda (4 + 4 pt) y los bordes fuera de la anchura indicada: se descuentan para no pasarse del margen
  const util = ANCHO - cab.length * 8 - (cab.length + 1) * 0.5;
  const total = peso.reduce((x, y) => x + y, 0);
  let w = peso.map((p) => (util * p) / total);
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const falta = w.reduce((t, x, i) => t + Math.max(0, minimo[i] - x), 0);
    if (falta < 0.5) break;
    const holgura = w.reduce((t, x, i) => t + Math.max(0, x - minimo[i]), 0);
    if (holgura <= 0) break;
    w = w.map((x, i) => (x < minimo[i] ? minimo[i] : x - (Math.max(0, x - minimo[i]) / holgura) * falta));
  }
  const suma = w.reduce((x, y) => x + y, 0);
  if (suma > util) w = w.map((x) => (x * util) / suma); // si los mínimos no caben, se reparte la falta
  return w.map((x) => Math.floor(x * 10) / 10 - 0.1);
}

function bloque(b: Bloque): unknown[] {
  switch (b.k) {
    case 'p': return [{ text: b.texto, margin: [0, 0, 0, 6] }];
    case 'h': return [{ text: b.texto, fontSize: 10, bold: true, color: C.fuerte, margin: [0, 8, 0, 3], headlineLevel: 2 }];
    case 'nota': return [{ text: b.texto, italics: true, fontSize: 8.5, color: C.pie, margin: [0, 0, 0, 6] }];
    case 'lista': return [{ ul: b.items.map((t) => ({ text: t, margin: [0, 0, 0, 2] })), markerColor: C.cian, margin: [0, 0, 0, 6] }];
    case 'grafico': {
      const w = Math.min(b.ancho, ANCHO);
      return [{ unbreakable: true, margin: [0, 4, 0, 8], stack: [
        { text: b.titulo, bold: true, fontSize: 9, color: C.marino, margin: [0, 0, 0, 3], alignment: 'left' },
        { svg: quitarFuente(b.svg), width: w, height: (w * b.alto) / b.ancho },
        ...(b.pie ? [{ text: b.pie, fontSize: 7.5, color: C.pie, margin: [0, 3, 0, 0] }] : []),
      ] }];
    }
    case 'tabla': {
      const num = new Set(b.numericas ?? []);
      const fs = b.cab.length >= 8 ? 7 : 8;
      const celda = (t: string, i: number, cab: boolean) => ({ text: t, alignment: num.has(i) ? 'right' : 'left', ...(cab ? { bold: true, color: '#FFFFFF', fillColor: C.azul } : {}), fontSize: fs });
      const notas = (b.notas ?? []).map((n) => ({ text: n, fontSize: 7.5, color: C.pie, margin: [0, 0, 0, 2], alignment: 'left' }));
      const tabla = { margin: [0, 2, 0, b.pie || notas.length ? 2 : 8], table: { headerRows: 1, dontBreakRows: true, keepWithHeaderRows: 1, widths: anchos(b.cab, b.filas, fs),
          body: [b.cab.map((c, i) => celda(c, i, true)), ...b.filas.map((f) => f.map((t, i) => celda(t, i, false)))] },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => C.gris, vLineColor: () => C.gris, paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 2.5, paddingBottom: () => 2.5,
            fillColor: (fila: number) => (fila > 0 && fila % 2 === 0 ? C.zebra : null) } };
      const pie = b.pie ? [{ text: b.pie, fontSize: 7.5, color: C.pie, margin: [0, 0, 0, 8] }] : [];
      // La nota va con su tabla en la misma página; si la tabla es demasiado larga para caber en una, la nota queda al final de ella
      return b.filas.length <= 22 && notas.length ? [{ unbreakable: true, stack: [tabla, ...notas, ...pie] }] : [tabla, ...notas, ...pie];
    }
  }
}

/** Definición del documento (pura: no toca el navegador, se puede probar en Node). */
export function definicionInforme(m: ModeloInforme, r: RecursosPdf): Record<string, unknown> {
  const meta = m.meta;
  const h2 = (texto: string, saltar = false) => ({
    headlineLevel: 1, ...(saltar ? { pageBreak: 'before' } : {}), margin: [0, 10, 0, 6],
    stack: [{ text: texto, fontSize: 11, bold: true, color: C.marino, alignment: 'left' }, { canvas: [{ type: 'line', x1: 0, y1: 2, x2: ANCHO, y2: 2, lineWidth: 1, lineColor: C.cian }] }],
  });

  const portada = [
    { image: 'logoBlanco', absolutePosition: { x: 51, y: 51 }, width: 140 },
    { absolutePosition: { x: 68, y: 505 }, width: A4.w - 136, stack: [
      { text: meta.titulo.toUpperCase(), fontSize: 25, color: '#FFFFFF', lineHeight: 1.1, alignment: 'left', margin: [0, 0, 0, 6] },
      { text: meta.subtitulo.toUpperCase(), fontSize: 13, color: C.cian, alignment: 'left', margin: [0, 0, 0, 10] },
      { canvas: [{ type: 'rect', x: 0, y: 0, w: A4.w - 136, h: 2.2, color: C.cian }], margin: [0, 0, 0, 12] },
      { text: meta.edicion, fontSize: 10.5, color: '#FFFFFF', alignment: 'left', margin: [0, 0, 0, 4] },
      { text: `${meta.norma} · Código ${meta.codigo}`, fontSize: 8, color: '#E8E8E8', alignment: 'left', margin: [0, 0, 0, 14] },
      { table: { body: [[{ text: meta.estado, bold: true, fontSize: 7.5, color: C.marino, fillColor: C.cian, margin: [5, 2, 5, 2] }]] }, layout: 'noBorders' },
    ] },
    { absolutePosition: { x: 68, y: A4.h - 98 }, width: A4.w - 136, stack: [
      { fontSize: 5.8, color: '#E8E8E8', lineHeight: 1.3, alignment: 'justify',
        text: 'CONFIDENCIALIDAD: Este documento es propiedad de HS CONSULTING GROUP y contiene información confidencial destinada exclusivamente al cliente identificado en la portada. Queda prohibida su reproducción, distribución o comunicación pública sin autorización expresa y por escrito de HS CONSULTING GROUP.' }] },
  ];

  const indice = [h2('ÍNDICE', true), { ul: m.secciones.map((s) => ({ text: `${s.id}. ${s.titulo}`, margin: [0, 0, 0, 3], alignment: 'left' })), markerColor: C.cian, margin: [0, 4, 0, 0] }];
  const cuerpo = m.secciones.flatMap((s, i) => [h2(`${s.id}. ${s.titulo.toUpperCase()}`, i === 0), ...s.bloques.flatMap(bloque)]);

  return {
    pageSize: 'A4',
    pageMargins: [MARGEN.izq, MARGEN.sup, MARGEN.der, MARGEN.inf],
    info: { title: `${meta.codigo} · ${meta.titulo}`, author: 'HS Consulting Group', subject: `${meta.organizacion} · ${meta.anio}`, keywords: 'huella de carbono, ISO 14064-1' },
    defaultStyle: { font: 'Montserrat', fontSize: 9.5, color: C.texto, lineHeight: 1.3, alignment: 'justify' },
    images: { portada: r.portada, logoBlanco: r.logoBlanco, logoGroup: r.logoGroup, logoGreen: r.logoGreen, banda: r.banda },
    background: (pagina: number) => (pagina === 1 ? { image: 'portada', width: A4.w, height: A4.h } : null),
    header: (pagina: number) => (pagina === 1 ? null : [
      { margin: [MARGEN.izq, 24, MARGEN.der, 0], columns: [{ width: '*', text: '' }, { image: 'logoGroup', width: 82, margin: [0, 0, 12, 0] }, { image: 'logoGreen', width: 104 }] },
      { canvas: [{ type: 'line', x1: MARGEN.izq, y1: 0, x2: A4.w - MARGEN.der, y2: 0, lineWidth: 0.5, lineColor: '#E8E8E8' }], absolutePosition: { x: 0, y: 64 } },
    ]),
    footer: (pagina: number, total: number) => (pagina === 1 ? null : [
      { image: 'banda', absolutePosition: { x: 0, y: A4.h - 11 }, width: A4.w, height: 11 },
      { margin: [MARGEN.izq, 16, MARGEN.der, 0], columns: [
        { width: '*', text: `${meta.codigo} · ${meta.edicion} · ${meta.estado}`, fontSize: 7, color: C.pie, alignment: 'left' },
        { width: 'auto', text: `HS Consulting Group   ${pagina} / ${total}`, fontSize: 8, color: C.pie, alignment: 'right' },
      ] },
    ]),
    // Un título que quedaría en los últimos ~35 mm de la página pasa a la siguiente (no se queda huérfano)
    pageBreakBefore: (nodo: { headlineLevel?: number; startPosition?: { top?: number } }) => nodo.headlineLevel !== undefined && (nodo.startPosition?.top ?? 0) > A4.h - MARGEN.inf - 95,
    content: [...portada, ...indice, ...cuerpo],
  };
}

const aDataUrl = async (url: string): Promise<string> => {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`No se pudo cargar ${url}`);
  const blob = await resp.blob();
  return await new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result)); f.onerror = () => rej(new Error('Lectura de imagen fallida')); f.readAsDataURL(blob); });
};
const aBase64 = async (url: string): Promise<string> => (await aDataUrl(url)).split(',')[1];

/** Genera el PDF en el navegador y lo devuelve como Blob. */
export async function generarInformePdf(m: ModeloInforme, base = ''): Promise<Blob> {
  const [{ default: pdfMake }, recursos, vfs] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    Promise.all(['/brand/informe/portada-ondas.jpg', '/brand/informe/logo-hs-group-blanco.png', '/logo-hs-group.png', '/logo-hsgreen-recortado.png', '/brand/informe/banda-degradado.png'].map((u) => aDataUrl(base + u))),
    Promise.all(['Regular', 'SemiBold', 'Italic', 'SemiBoldItalic'].map(async (n) => [`Montserrat-${n}.ttf`, await aBase64(`${base}/fonts/Montserrat-${n}.ttf`)] as const)),
  ]);
  pdfMake.vfs = Object.fromEntries(vfs);
  pdfMake.fonts = { Montserrat: { normal: 'Montserrat-Regular.ttf', bold: 'Montserrat-SemiBold.ttf', italics: 'Montserrat-Italic.ttf', bolditalics: 'Montserrat-SemiBoldItalic.ttf' } };
  const [portada, logoBlanco, logoGroup, logoGreen, banda] = recursos;
  const def = definicionInforme(m, { portada, logoBlanco, logoGroup, logoGreen, banda });
  return await new Promise<Blob>((res, rej) => { try { pdfMake.createPdf(def).getBlob((b: Blob) => res(b)); } catch (e) { rej(e); } });
}
