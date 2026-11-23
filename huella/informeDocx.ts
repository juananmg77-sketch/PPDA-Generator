// Representación del informe en Word (.docx) editable, con la imagen corporativa de HS Consulting Group.
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionRelativeFrom, ImageRun, Packer, PageNumber, Paragraph, SectionType, ShadingType, Table, TableCell, TableRow, TextRun,
  TextWrappingType, VerticalPositionAlign, VerticalPositionRelativeFrom, WidthType, PageBreak, TabStopType,
} from 'docx';
import type { Bloque, ModeloInforme } from './informe.ts';
import { configPlantilla } from './configInforme.ts';

const AZUL = '0002C9', MARINO = '00093D', CABECERA_TABLA = '002060', CIAN = '24CBF5', GRIS = '9D9D9C', ZEBRA = 'F2F8FD', TEXTO = '344454', FUENTE = 'Montserrat';
const run = (text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) => new TextRun({ text, font: FUENTE, size: (o.size ?? 10) * 2, bold: o.bold, color: o.color ?? TEXTO, italics: o.italics });

/** Imágenes de marca (modelo de documento corporativo): logos, logo blanco y portada de ondas, y banda degradada del pie. */
export interface Logos { green?: Uint8Array; group?: Uint8Array; groupBlanco?: Uint8Array; portada?: Uint8Array; banda?: Uint8Array }
/** Convierte un gráfico SVG en PNG (solo en el navegador); sin él, los gráficos no se incluyen en el Word. */
export type Rasterizador = (svg: string, ancho: number, alto: number) => Promise<Uint8Array>;

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
    shading: cab ? { type: ShadingType.CLEAR, fill: CABECERA_TABLA, color: 'auto' } : zebra ? { type: ShadingType.CLEAR, fill: ZEBRA, color: 'auto' } : undefined,
    children: txt.split('\n').map((l) => new Paragraph({ alignment: num.has(i) ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [run(l, { size: 8.5, bold: cab, color: cab ? 'FFFFFF' : TEXTO })] })),
  });
  const filas = [
    new TableRow({ tableHeader: true, cantSplit: true, children: b.cab.map((c, i) => celda(c, i, true, false)) }),
    ...b.filas.map((f, r) => new TableRow({ cantSplit: true, children: f.map((c, i) => celda(c, i, false, r % 2 === 1)) })),
  ];
  const out: Array<Table | Paragraph> = [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: filas })];
  for (const nota of b.notas ?? []) out.push(new Paragraph({ spacing: { after: 40 }, children: [run(nota, { size: 8, color: '666666' })] }));
  out.push(new Paragraph({ spacing: { after: 120 }, children: b.pie ? [run(b.pie, { size: 8, color: '666666' })] : [] }));
  return out;
}

function bloqueADocx(b: Bloque, imagenes: Map<string, Uint8Array>): Array<Paragraph | Table> {
  switch (b.k) {
    case 'grafico': {
      const png = imagenes.get(b.svg);
      if (!png) return [];
      const ancho = 600, alto = Math.round((ancho * b.alto) / b.ancho);
      return [
        new Paragraph({ keepNext: true, spacing: { before: 160, after: 60 }, children: [run(b.titulo, { bold: true, size: 9, color: MARINO })] }),
        new Paragraph({ spacing: { after: b.pie ? 40 : 160 }, children: [new ImageRun({ type: 'png', data: png, transformation: { width: ancho, height: alto }, altText: { title: b.titulo, description: b.titulo, name: 'grafico' } })] }),
        ...(b.pie ? [new Paragraph({ spacing: { after: 160 }, children: [run(b.pie, { size: 8, color: '666666' })] })] : []),
      ];
    }
    case 'p': return [parrafoTexto(b.texto)];
    case 'nota': return [parrafoTexto(b.texto, { size: 8, color: '666666' })];
    case 'h': return [new Paragraph({ keepNext: true, spacing: { before: 200, after: 80 }, children: [run(b.texto, { bold: true, size: 10, color: AZUL })] })];
    case 'lista': return b.items.map((i) => new Paragraph({ bullet: { level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 }, children: [run(i)] }));
    case 'tabla': return tabla(b);
  }
}

export async function informeADocx(m: ModeloInforme, logos: Logos = {}, rasterizar?: Rasterizador): Promise<Blob> {
  // Los gráficos (SVG) se convierten antes a PNG; si no hay rasterizador se omiten
  const imagenes = new Map<string, Uint8Array>();
  if (rasterizar) {
    const graficos = m.secciones.flatMap((s) => s.bloques).filter((b): b is Extract<Bloque, { k: 'grafico' }> => b.k === 'grafico');
    await Promise.all(graficos.map(async (g) => { imagenes.set(g.svg, await rasterizar(g.svg, g.ancho, g.alto)); }));
  }
  const img = (data: Uint8Array | undefined, w: number, h: number) => (data ? [new ImageRun({ type: 'png', data, transformation: { width: w, height: h }, altText: { title: 'Logo', description: 'Logotipo', name: 'logo' } })] : []);
  // Cabecera de las páginas interiores: logos a la derecha (como en el modelo corporativo)
  const cabecera = new Header({ children: [new Paragraph({
    alignment: AlignmentType.RIGHT,
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E8E8E8', space: 4 } },
    children: [...img(logos.group, 90, 31), run('   '), ...img(logos.green, 100, 27)],
  })] });
  // Pie: banda degradada a pie de página, código y edición a la izquierda y «HS Consulting Group · X / Y» a la derecha
  const banda = logos.banda ? [new ImageRun({ type: 'png', data: logos.banda, transformation: { width: 794, height: 40 }, altText: { title: 'Banda', description: 'Banda de marca', name: 'banda' },
    floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.BOTTOM }, behindDocument: true, wrap: { type: TextWrappingType.NONE } } })] : [];
  const pie = new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: 9500 }], children: [
    ...banda,
    run(`${m.meta.codigo} · ${m.meta.edicion} · ${m.meta.estado}`, { size: 7, color: '435971' }), run('\t'),
    new TextRun({ children: ['HS Consulting Group   ', PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES], font: FUENTE, size: 16, color: '435971' }),
  ] })] });

  // Portada: fondo de ondas a toda la página, logo blanco, título en blanco y subtítulo en cian
  const fondo = logos.portada ? [new ImageRun({ type: 'jpg', data: logos.portada, transformation: { width: 794, height: 1123 }, altText: { title: 'Portada', description: 'Fondo de portada', name: 'portada' },
    floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 }, behindDocument: true, wrap: { type: TextWrappingType.NONE } } })] : [];
  const logoPortada = logos.groupBlanco ? [new ImageRun({ type: 'png', data: logos.groupBlanco, transformation: { width: 196, height: 70 }, altText: { title: 'HS Consulting Group', description: 'Logotipo', name: 'logo-portada' },
    floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 640000 }, verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 640000 }, behindDocument: false, wrap: { type: TextWrappingType.NONE } } })] : [];
  const BLANCO = 'FFFFFF';
  const portada: Paragraph[] = [
    new Paragraph({ children: [...fondo, ...logoPortada] }),
    new Paragraph({ spacing: { before: 7200, after: 160 }, children: [run(m.meta.titulo.toUpperCase(), { size: 26, color: BLANCO })] }),
    new Paragraph({ spacing: { after: 240 }, children: [run(m.meta.subtitulo.toUpperCase(), { size: 15, color: CIAN })] }),
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: CIAN, space: 4 } }, spacing: { after: 300 }, children: [] }),
    new Paragraph({ spacing: { after: 60 }, children: [run(m.meta.edicion, { size: 11, color: BLANCO })] }),
    new Paragraph({ spacing: { after: 60 }, children: [run(`${m.meta.norma} · Código ${m.meta.codigo}`, { size: 8.5, color: 'E8E8E8' })] }),
    new Paragraph({ spacing: { before: 160, after: 1800 }, children: [run(`Estado: ${m.meta.estado}`, { bold: true, size: 10, color: m.meta.estado === 'VERIFICADO' ? '7CFC9A' : CIAN })] }),
    new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [run(configPlantilla({ confidencialidad: m.meta.confidencialidad }).confidencialidad, { size: 6.5, color: 'E8E8E8' })] }),
  ];
  const resumen: Array<Paragraph | Table> = m.resumen ? [
    new Paragraph({ keepNext: true, spacing: { after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: CIAN, space: 2 } }, children: [run('RESUMEN EJECUTIVO', { bold: true, size: 11, color: MARINO })] }),
    ...m.resumen.bloques.flatMap((bl) => bloqueADocx(bl, imagenes)),
    new Paragraph({ children: [new PageBreak()] }),
  ] : [];
  const indice: Paragraph[] = [
    new Paragraph({ spacing: { after: 160 }, children: [run('ÍNDICE', { bold: true, size: 11, color: MARINO })] }),
    ...m.secciones.map((s) => new Paragraph({ spacing: { after: 80 }, children: [run(`${s.id}.  `, { bold: true, color: AZUL }), run(s.titulo)] })),
    new Paragraph({ children: [new PageBreak()] }),
  ];
  const cuerpo = m.secciones.flatMap((s) => [
    new Paragraph({ keepNext: true, spacing: { before: 280, after: 120 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: CIAN, space: 2 } }, children: [run(`${s.id}. ${s.titulo.toUpperCase()}`, { bold: true, size: 11, color: MARINO })] }),
    ...s.bloques.flatMap((bl) => bloqueADocx(bl, imagenes)),
  ]);

  const margenes = { page: { margin: { top: 1600, bottom: 1250, left: 1080, right: 1080 } } };
  const doc = new Document({
    creator: 'HS Consulting Group', title: `${m.meta.codigo} · ${m.meta.titulo}`, description: m.meta.subtitulo,
    styles: { default: { document: { run: { font: FUENTE, size: 20, color: TEXTO } } } },
    sections: [
      { properties: { page: { margin: { top: 1080, bottom: 700, left: 1440, right: 1440 } } }, children: portada },
      { properties: { type: SectionType.NEXT_PAGE, ...margenes }, headers: { default: cabecera }, footers: { default: pie }, children: [...resumen, ...indice, ...cuerpo] },
    ],
  });
  return Packer.toBlob(doc);
}
