// Lectura con IA del certificado / facturas de mantenimiento de extintores: tipos, esquema, instrucciones y reglas de inclusión por defecto.
import type { LineaExtintor } from './exclusiones.ts';

export type OperacionExt = 'recarga' | 'retimbrado' | 'nuevo' | 'revision' | 'otro';
export type DocumentoExt = 'factura' | 'parte_revision' | 'otro';
export interface LineaCertificado {
  documento: DocumentoExt;
  pagina?: number;
  fecha?: string; // AAAA-MM-DD si consta
  concepto: string; // tal como figura
  agente: 'CO2' | 'polvo' | 'agua' | 'espuma' | 'otro' | 'desconocido';
  kgPorExtintor?: number;
  cantidad: number;
  operacion: OperacionExt;
}
export interface LecturaExtintores { lineas: LineaCertificado[]; observaciones?: string }

export const OPERACIONES: Record<OperacionExt, string> = {
  recarga: 'Recarga', retimbrado: 'Retimbrado (se descarga y se rellena)', nuevo: 'Extintor nuevo (suministro)', revision: 'Solo revisión', otro: 'Otro',
};

export const ESQUEMA_EXTINTORES = {
  type: 'object', additionalProperties: false, required: ['lineas'],
  properties: {
    observaciones: { type: 'string' },
    lineas: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['documento', 'concepto', 'agente', 'cantidad', 'operacion'],
        properties: {
          documento: { type: 'string', enum: ['factura', 'parte_revision', 'otro'] },
          pagina: { type: 'integer' },
          fecha: { type: 'string' },
          concepto: { type: 'string' },
          agente: { type: 'string', enum: ['CO2', 'polvo', 'agua', 'espuma', 'otro', 'desconocido'] },
          kgPorExtintor: { type: 'number' },
          cantidad: { type: 'number' },
          operacion: { type: 'string', enum: ['recarga', 'retimbrado', 'nuevo', 'revision', 'otro'] },
        },
      },
    },
  },
} as const;

export const INSTRUCCIONES_EXTINTORES = `Lees documentación escaneada de mantenimiento de extintores (facturas del instalador, partes de revisión, albaranes). Puede estar girada, borrosa o parcialmente ilegible: no inventes nada que no se vea.
Devuelve una línea por cada operación sobre extintores:
- documento: «factura» (líneas facturadas), «parte_revision» (tabla de extintores revisados con su columna Operación) u «otro».
- concepto: el texto de la línea tal como figura.
- agente: el agente extintor (CO2 / «Co/2» / nieve carbónica = CO2; polvo ABC = polvo; agua; espuma). «desconocido» si no consta.
- kgPorExtintor: kilos de carga de UN extintor (p. ej. 2, 5). Si la línea es un encabezado «EXTINTOR Co2 2KG» y las líneas siguientes («Retimbrado CO2», «Recarga…») no repiten los kilos, aplica los del encabezado a esas líneas. Omítelo si no se puede saber.
- cantidad: número de extintores de esa línea.
- operacion: «recarga», «retimbrado» (prueba de presión: el extintor se vacía y se rellena), «nuevo» (suministro de un extintor nuevo), «revision» (solo revisión anual o cuota de revisión, sin recarga) u «otro».
No incluyas líneas que no sean extintores (mangueras, señalización, trompas difusoras, BIES, luces de emergencia, mano de obra). Incluye fecha (AAAA-MM-DD) y página cuando consten. Si la misma operación aparece en una factura y en su parte de revisión, devuélvela en ambos con su «documento». En «observaciones» indica en una frase lo que no hayas podido leer.`;

export function limpiarLectura(l: LecturaExtintores): LecturaExtintores {
  return {
    observaciones: l.observaciones?.slice(0, 500),
    lineas: (l.lineas ?? []).filter((x) => Number.isFinite(x.cantidad) && x.cantidad > 0 && x.cantidad < 10_000).map((x) => ({ ...x, kgPorExtintor: x.kgPorExtintor && x.kgPorExtintor > 0 && x.kgPorExtintor < 100 ? x.kgPorExtintor : undefined, concepto: x.concepto.slice(0, 200) })),
  };
}

/** Marcado por defecto: solo recargas y retimbrados de CO2 con kilos conocidos; si hay facturas, solo las de factura (el parte repite las mismas operaciones). */
export function incluirPorDefecto(lineas: LineaCertificado[]): boolean[] {
  const hayFacturas = lineas.some((l) => l.documento === 'factura' && l.agente === 'CO2' && (l.operacion === 'recarga' || l.operacion === 'retimbrado'));
  return lineas.map((l) => l.agente === 'CO2' && !!l.kgPorExtintor && (l.operacion === 'recarga' || l.operacion === 'retimbrado') && (!hayFacturas || l.documento === 'factura'));
}

/** Agrupa las líneas elegidas por tamaño de extintor. */
export function agruparPorKg(lineas: Array<{ cantidad: number; kgPorExtintor: number }>): LineaExtintor[] {
  const m = new Map<number, number>();
  for (const l of lineas) m.set(l.kgPorExtintor, (m.get(l.kgPorExtintor) ?? 0) + l.cantidad);
  return [...m].sort((a, b) => a[0] - b[0]).map(([kgPorExtintor, cantidad]) => ({ cantidad, kgPorExtintor }));
}
