// Gas natural: la calculadora oficial del Registro balear usa kWh de poder calorífico superior (PCS).
// Las facturas pueden dar kWh «a secas», kWh PCI o m³; aquí se convierten con una nota que queda como evidencia.
import type { ExtraccionFactura } from './extraccion.ts';

/** Factor de paso de PCS a PCI del gas natural del Inventario Nacional (PCI = PCS × 0,901). */
export const PCI_SOBRE_PCS = 0.901;

export type ModoGas = '' | 'pcs' | 'pci' | 'm3';

const norm = (s?: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const redondeo = (n: number) => Math.round(n * 100) / 100;
const es = (n: number, d = 2) => n.toLocaleString('es-ES', { maximumFractionDigits: d });

/** Modo inicial según lo que dice la factura: PCS, PCI, m³ o sin determinar (hay que preguntar). */
export function modoInicialGas(unidad?: string): ModoGas {
  const u = norm(unidad);
  if (u.includes('pcs')) return 'pcs';
  if (u.includes('pci')) return 'pci';
  if (u === 'm3' || u === 'm³' || u.includes('m3') || u.includes('m³')) return 'm3';
  return '';
}

/** ¿Es una factura de gas natural en kWh sin indicar PCS ni PCI? (el caso que se resuelve con un clic). */
export const esKwhAmbiguo = (e: ExtraccionFactura) => e.tipo === 'gas_natural' && norm(e.unidad) === 'kwh';

/**
 * Devuelve la lectura en kWh PCS según lo que confirma la persona que revisa. Sin modo, o en m³ sin factor, no se toca
 * (la validación seguirá pidiendo aclarar la unidad).
 */
export function aplicarGas(e: ExtraccionFactura, modo: ModoGas, pcsKwhM3?: number): ExtraccionFactura {
  if (e.tipo !== 'gas_natural' || typeof e.cantidad !== 'number') return e;
  const origen = `${es(e.cantidad)} ${e.unidad ?? ''}`.trim();
  if (modo === 'pcs') return { ...e, unidad: 'kWh PCS', nota: norm(e.unidad).includes('pcs') ? e.nota : `Consumo de ${origen} confirmado como kWh PCS por la persona que revisa.` };
  if (modo === 'pci') return { ...e, cantidad: redondeo(e.cantidad / PCI_SOBRE_PCS), unidad: 'kWh PCS', nota: `Convertido de ${origen} (PCI) a PCS dividiendo entre ${es(PCI_SOBRE_PCS, 3)} (Inventario Nacional).` };
  if (modo === 'm3' && typeof pcsKwhM3 === 'number' && pcsKwhM3 > 0) {
    return { ...e, cantidad: redondeo(e.cantidad * pcsKwhM3), unidad: 'kWh PCS', nota: `Convertido de ${origen} × ${es(pcsKwhM3, 4)} kWh/m³ (factor de conversión de la factura).` };
  }
  return e;
}
