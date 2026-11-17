// Representación del informe en Word (.docx) editable, con la imagen corporativa de HS Consulting Group.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType, PageBreak, TabStopType,
} from 'docx';
import type { Bloque, ModeloInforme } from './informe.ts';

const AZUL = '0002C9', MARINO = '00093D', GRIS = '9D9D9C', ZEBRA = 'F2F2F2', FUENTE = 'Montserrat';
const run = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) => new TextRun({ text, font: FUENTE, size: (o.size ?? 10) * 2, bold: o.bold, color: o.color, italics: o.italics });

export interface Logos { green?: Uint8Array; group?: Uint8Array }

function parrafoTexto(texto: string, o: { size?: number; color?: string; bold?: boolean } = {}) {
  const lineas = texto.split('\n');
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120, line: 276 }, children: lineas.flatMap((l, i) => (i ? [new TextRun({ break: 1 }), run(l, o)] : [run(l, o)])) });
}

function tabla(b: Extract<Bloque, { k: 'tabla' }>) {
  const n = b.cab.length;
  const num = new Set(b.numericas ?? []);
  const borde = { style: BorderStyle.SINGLE, size: 4, color: GRIS };
  const bordes = { top: borde, bottom: borde, left: borde, right: borde };
  const celda = (txt: string, i: number, cab: boolean, zebra: boolean) => new TableCell({
    width: { size: Math.floor(100 / n), type: WidthType.PERCENTAGE },
    borders: bordes,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    shading: cab ? { type: ShadingType.CLEAR, fill: AZUL, color: 'auto' } : zebra ? { type: ShadingType.CLEAR, fill: ZEBRA, color: 'auto' } : undefined,
    children: txt.split('\n').map((l) => new Paragraph({ alignment: num.has(i) ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(l, { size: 8.5, bold: cab, color: cab ? 'FFFFFF' : undefined })] })),
  });
  const filas = [
    new TableRow({ tableHeader: true, cantSplit: true, children: b.cab.map((c, i) => celda(c, i, true, false)) }),
    ...b.filas.map((f, r) => new TableRow({ cantSplit: true, children: f.map((c, i) => celda(c, i, false, r % 2 === 1)) })),
  ];
  const out: Array<Table | Paragraph> = [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas })];
  out.push(new Paragraph({ spacing: { after: 120 }, children: b.pie ? [run(b.pie, { size: 8, color: '666666' })] : [] }));
  return out;
}

function bloqueADocx(b: Bloque): Array<Paragraph | Table> {
  switch (b.k) {
    case 'p': return [parrafoTexto(b.texto)];
    case 'nota': return [parrafoTexto(b.texto, { size: 8, color: '666666' })];
    case 'h': return [new Paragraph({ keepNext: true, spacing: { before: 200, after: 80 }, children: [run(b.texto, { bold: true, size: 10, color: AZUL })] })];
    case 'lista': return b.items.map((i) => new Paragraph({ bullet: { level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 }, children: [run(i)] }));
    case 'tabla': return tabla(b);
  }
}

export async function informeADocx(m: ModeloInforme, logos: Logos = {}): Promise<Blob> {
  const img = (data: Uint8Array | undefined, w: number, h: number) => (data ? [new ImageRun({ type: 'png', data, transformation: { width: w, height: h }, altText: { title: 'Logo', description: 'Logotipo', name: 'logo' } })] : []);
  const cabecera = new Header({ children: [new Paragraph({
    tabStops: [{ type: TabStopType.RIGHT, position: 9500 }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GRIS, space: 4 } },
    children: [...img(logos.group, 90, 31), run('\t'), ...img(logos.green, 100, 27)],
  })] });
  const pie = new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: 9500 }], children: [
    run(`${m.meta.codigo} · ${m.meta.edicion} · ${m.meta.estado}`, { size: 7, color: '777777' }), run('\t'),
    new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], font: FUENTE, size: 16, color: '555555' }),
  ] })] });

  const portada: Paragraph[] = [
    new Paragraph({ spacing: { before: 2400, after: 200 }, children: [run(m.meta.titulo, { size: 24, bold: true, color: MARINO })] }),
    new Paragraph({ spacing: { after: 400 }, children: [run(m.meta.subtitulo, { size: 15, color: AZUL })] }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: AZUL, space: 4 } }, spacing: { after: 300 }, children: [] }),
    new Paragraph({ spacing: { after: 80 }, children: [run('Norma de referencia: ', { bold: true }), run(m.meta.norma)] }),
    new Paragraph({ spacing: { after: 80 }, children: [run('Código: ', { bold: true }), run(m.meta.codigo)] }),
    new Paragraph({ spacing: { after: 80 }, children: [run('Edición y fecha: ', { bold: true }), run(m.meta.edicion)] }),
    new Paragraph({ spacing: { before: 200, after: 800 }, children: [run(`Estado: ${m.meta.estado}`, { bold: true, color: m.meta.estado === 'VERIFICADO' ? '006600' : 'FF6600' })] }),
    new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [run('CONFIDENCIALIDAD: Este documento es propiedad de HS CONSULTING GROUP y contiene información confidencial destinada exclusivamente al cliente identificado en la portada. Queda prohibida su reproducción, distribución o comunicación pública sin autorización expresa y por escrito de HS CONSULTING GROUP.', { size: 7.5, color: '777777' })] }),
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ spacing: { after: 160 }, children: [run('ÍNDICE', { bold: true, size: 11, color: MARINO })] }),
    ...m.secciones.map((s) => new Paragraph({ spacing: { after: 80 }, children: [run(`${s.id}.  `, { bold: true, color: AZUL }), run(s.titulo)] })),
    new Paragraph({ children: [new PageBreak()] }),
  ];
  const cuerpo = m.secciones.flatMap((s) => [
    new Paragraph({ keepNext: true, spacing: { before: 280, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: AZUL, space: 2 } }, children: [run(`${s.id}. ${s.titulo.toUpperCase()}`, { bold: true, size: 11, color: MARINO })] }),
    ...s.bloques.flatMap(bloqueADocx),
  ]);

  const doc = new Document({
    creator: 'HS Consulting Group', title: `${m.meta.codigo} · ${m.meta.titulo}`, description: m.meta.subtitulo,
    styles: { default: { document: { run: { font: FUENTE, size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 1440, bottom: 1250, left: 1080, right: 1080 } } }, headers: { default: cabecera }, footers: { default: pie }, children: [...portada, ...cuerpo] }],
  });
  return Packer.toBlob(doc);
}
