// Butano, propano y GLP: reconocimiento del combustible, unidades (kg, litros, envases) y su factor de emisión.
import type { ExtraccionFactura } from './extraccion.ts';

const norm = (s?: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Peso habitual de una bombona de butano (kg); se ofrece como valor inicial y la persona que revisa lo confirma. */
export const KG_BOMBONA_BUTANO = 12.5;

/** ¿La unidad es un recipiente (bombona, botella, envase) y no kg ni litros? */
export function esEnvase(unidad?: string): boolean {
  const u = norm(unidad);
  return /bombon|botell|envase|cilindr|^uds?\.?$|^unidad/.test(u);
}

/** Factor de emisión (clave del conjunto) para butano, propano o GLP genérico según el producto y la unidad. */
export function fuenteGlp(producto?: string, unidad?: string): string {
  const p = norm(producto);
  const u = norm(unidad);
  if (p.includes('butano')) return 'Gas butano (kg)';
  if (p.includes('propano')) return 'Gas propano (kg)';
  if (u === 'l' || u.startsWith('litro') || u === 'lt') return 'LPG (l)';
  return '';
}

/** Pasa un consumo en envases a kg con los kg por envase que confirma la persona que revisa (deja nota como evidencia). */
export function aplicarEnvases(e: ExtraccionFactura, kgPorEnvase?: number): ExtraccionFactura {
  if (e.tipo !== 'glp' || typeof e.cantidad !== 'number' || !esEnvase(e.unidad)) return e;
  if (!(typeof kgPorEnvase === 'number' && kgPorEnvase > 0)) return e;
  const kg = Math.round(e.cantidad * kgPorEnvase * 100) / 100;
  return { ...e, cantidad: kg, unidad: 'kg', nota: `Convertido de ${e.cantidad.toLocaleString('es-ES')} ${e.unidad} × ${kgPorEnvase.toLocaleString('es-ES')} kg por envase.` };
}
