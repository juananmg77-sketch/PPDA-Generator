// Suministros (puntos de consumo) de un centro: una misma instalación puede figurar en las facturas con su CUPS, su nº de contador
// o su contrato según lo que lea cada vez la IA. Aquí se unen todos los identificadores que aparecen juntos en alguna factura.
import { normalizarContador } from './extraccion.ts';

export interface EntradaSuministro {
  tipo?: string; contador?: string | null; cups?: string | null; numeroContador?: string | null; contrato?: string | null;
  usoSuministro?: string | null; direccionSuministro?: string | null; peaje?: string | null;
}
export interface Suministro {
  /** Identificador canónico: el CUPS si consta; si no, el primer identificador conocido. */
  id: string;
  etiqueta: string;
  uso?: string; direccion?: string; peaje?: string; contrato?: string; cups?: string; numeroContador?: string;
  identificadores: string[];
}

const norm = (x?: string | null) => normalizarContador(x) || '';
const esCups = (x: string) => /^ES\d{16}[A-Z]{2}/.test(x);

/** Une los identificadores que aparecen en una misma factura y devuelve los suministros resultantes. */
export function agruparSuministros(entradas: EntradaSuministro[]): Suministro[] {
  const padre = new Map<string, string>();
  const raiz = (x: string): string => { let r = x; while ((padre.get(r) ?? r) !== r) r = padre.get(r)!; padre.set(x, r); return r; };
  const unir = (a: string, b: string) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) padre.set(rb, ra); };
  const idsDe = (e: EntradaSuministro) => [norm(e.cups), norm(e.contador), norm(e.numeroContador), norm(e.contrato)].filter((x) => x && x !== 'VARIOS');
  for (const e of entradas) { const ids = idsDe(e); ids.forEach((i) => { if (!padre.has(i)) padre.set(i, i); }); for (let k = 1; k < ids.length; k++) unir(ids[0], ids[k]); }
  const grupos = new Map<string, { ids: Set<string>; e: EntradaSuministro[] }>();
  for (const e of entradas) {
    const ids = idsDe(e); if (!ids.length) continue;
    const r = raiz(ids[0]); const g = grupos.get(r) ?? { ids: new Set<string>(), e: [] };
    ids.forEach((i) => g.ids.add(i)); g.e.push(e); grupos.set(r, g);
  }
  // Los identificadores de un mismo grupo pueden haberse conocido por facturas distintas: se recogen todos los del grupo
  for (const i of padre.keys()) grupos.get(raiz(i))?.ids.add(i);
  const primero = (g: { e: EntradaSuministro[] }, k: keyof EntradaSuministro) => g.e.map((x) => (x[k] as string | null | undefined)?.trim()).find((x) => !!x) || undefined;
  return [...grupos.values()].map((g) => {
    const ids = [...g.ids];
    const cups = ids.find(esCups);
    const id = cups ?? ids[0];
    const uso = primero(g, 'usoSuministro');
    const numeroContador = norm(primero(g, 'numeroContador')) || undefined;
    return { id, etiqueta: uso ? `${uso} · …${id.slice(-6)}` : id, uso, direccion: primero(g, 'direccionSuministro'), peaje: primero(g, 'peaje'), contrato: primero(g, 'contrato'), cups, numeroContador, identificadores: ids };
  });
}

/** Devuelve una función que traduce cualquier identificador conocido (CUPS, contador o contrato) a la etiqueta de su suministro. */
export function resolutorSuministro(entradas: EntradaSuministro[]): (id?: string | null) => string | undefined {
  const mapa = new Map<string, string>();
  for (const s of agruparSuministros(entradas)) for (const i of s.identificadores) mapa.set(i, s.etiqueta);
  return (id) => { const n = norm(id); return n ? mapa.get(n) ?? (id ?? '').trim() : undefined; };
}

/** Suministro al que pertenece una factura (por cualquiera de sus identificadores), si se conoce. */
export function suministroDe(sums: Suministro[], e: EntradaSuministro): Suministro | undefined {
  const ids = [norm(e.cups), norm(e.contador), norm(e.numeroContador), norm(e.contrato)].filter(Boolean);
  return ids.length ? sums.find((s) => ids.some((i) => s.identificadores.includes(i))) : undefined;
}
