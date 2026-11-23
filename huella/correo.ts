// Correo tipo al cliente con lo que falta por aportar para cerrar el cálculo. Solo redacta un borrador: lo revisa y lo envía una persona.
import { mesesTocados } from './mensual.ts';
import type { DocCierre } from './cierre.ts';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const TIPO: Record<string, string> = { electricidad: 'Electricidad', gas_natural: 'Gas natural' };

export interface EntradaCorreo {
  organizacion: string;
  anio: number;
  /** Año ya terminado: se piden también los meses de los extremos (enero…diciembre). Si no, solo los huecos intermedios. */
  anioCompleto: boolean;
  docs: DocCierre[];
  remitente: string;
}
export interface SerieFaltante { centro: string; tipo: string; contador: string; faltan: string[] }
export interface CorreoPendientes {
  asunto: string; cuerpo: string;
  faltantes: SerieFaltante[]; ilegibles: string[]; sinOrigen: string[];
  hayPendientes: boolean;
}

/** Meses sin factura de cada serie (centro + tipo + contador). Una serie sin ninguna factura confirmada o leída no se reclama: no se sabe si existe. */
export function mesesSinFactura(docs: DocCierre[], anio: number, anioCompleto: boolean): SerieFaltante[] {
  const m = new Map<string, { centro: string; tipo: string; contador: string; cubiertos: Set<number> }>();
  for (const d of docs) {
    if ((d.estado !== 'revisado' && d.estado !== 'leido') || (d.tipo !== 'electricidad' && d.tipo !== 'gas_natural')) continue;
    const centro = d.centro ?? 'Centro sin nombre'; const contador = (d.contador ?? '').trim() || 'sin contador';
    const k = `${centro}\u0000${d.tipo}\u0000${contador}`;
    const s = m.get(k) ?? { centro, tipo: d.tipo, contador, cubiertos: new Set<number>() };
    for (const x of mesesTocados(d.periodoDesde, d.periodoHasta, anio)) s.cubiertos.add(x);
    m.set(k, s);
  }
  const out: SerieFaltante[] = [];
  for (const s of m.values()) {
    if (s.cubiertos.size === 0) continue;
    const desde = anioCompleto ? 0 : Math.min(...s.cubiertos), hasta = anioCompleto ? 11 : Math.max(...s.cubiertos);
    const faltan: string[] = [];
    for (let i = desde; i <= hasta; i++) if (!s.cubiertos.has(i)) faltan.push(MESES[i]);
    if (faltan.length) out.push({ centro: s.centro, tipo: s.tipo, contador: s.contador, faltan });
  }
  return out.sort((a, b) => a.centro.localeCompare(b.centro) || a.tipo.localeCompare(b.tipo));
}

export function redactarCorreoPendientes(e: EntradaCorreo): CorreoPendientes {
  const faltantes = mesesSinFactura(e.docs, e.anio, e.anioCompleto);
  const nombre = (d: DocCierre) => d.nombre ?? 'Factura sin nombre';
  const ilegibles = e.docs.filter((d) => d.estado === 'subido' || d.estado === 'rechazado').map((d) => `${nombre(d)}${d.centro ? ` (${d.centro})` : ''}`);
  const sinOrigen = e.docs.filter((d) => d.estado === 'revisado' && d.tipo === 'electricidad' && (!d.origenElectricidad || d.origenElectricidad === 'desconocida')).map((d) => `${nombre(d)}${d.centro ? ` (${d.centro})` : ''}`);
  const hayPendientes = faltantes.length + ilegibles.length + sinOrigen.length > 0;

  const asunto = `Huella de carbono ${e.anio} · ${e.organizacion}: documentación pendiente`;
  const secciones: string[] = [];
  let n = 0;
  if (faltantes.length) {
    n++;
    secciones.push(`${n}. Facturas que faltan\n${faltantes.map((f) => `• ${f.centro} · ${TIPO[f.tipo] ?? f.tipo}${f.contador !== 'sin contador' ? ` (${f.contador})` : ''}: ${f.faltan.join(', ')}`).join('\n')}\nSi en alguno de esos meses el centro no estuvo operativo o no hubo consumo, indicádnoslo y lo dejamos constado.`);
  }
  if (ilegibles.length) {
    n++;
    secciones.push(`${n}. Facturas que no hemos podido leer o validar\n${ilegibles.map((x) => `• ${x}`).join('\n')}\nOs agradeceríamos una copia en PDF original (no fotografía ni escaneo girado) o, si no existe, el dato de consumo del periodo.`);
  }
  if (sinOrigen.length) {
    n++;
    secciones.push(`${n}. Garantía de origen de la electricidad\nEn estas facturas no consta si la energía tiene garantía de origen renovable:\n${sinOrigen.map((x) => `• ${x}`).join('\n')}\nSi vuestra comercializadora la acredita (o hay autoconsumo), enviadnos el certificado o la factura donde figure. Si no, las trataremos como energía de red.`);
  }
  const cuerpo = hayPendientes
    ? `Buenos días,\n\nEn la revisión de los datos de la huella de carbono ${e.anio} de ${e.organizacion} hemos visto que faltan algunos documentos para poder cerrar el cálculo. Os agradeceríamos que nos los hicierais llegar cuando podáis:\n\n${secciones.join('\n\n')}\n\nCon esa documentación podremos cerrar el cálculo. Quedo a vuestra disposición para cualquier duda.\n\nUn saludo,\n${e.remitente}`
    : `Buenos días,\n\nPor ahora no hay documentación pendiente para la huella de carbono ${e.anio} de ${e.organizacion}.\n\nUn saludo,\n${e.remitente}`;
  return { asunto, cuerpo, faltantes, ilegibles, sinOrigen, hayPendientes };
}
