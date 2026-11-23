// Desglose de las emisiones por gas (ISO 14064-1: cada gas en su propia unidad y en CO2e con su potencial de calentamiento).
import type { ConjuntoFactores, ResultadoLinea } from './tipos.ts';

export interface FilaGas {
  gas: string;
  /** Familia: «CO₂», «CH₄», «N₂O», «HFC», «Mezcla HFC», «HCFC»… */
  familia: string;
  /** Toneladas del propio gas emitido. */
  toneladasGas: number;
  /** Potencial de calentamiento global usado (CO₂ = 1). */
  pca: number;
  toneladasCO2e: number;
  fluorado: boolean;
}

const familiaFluorado = (gas: string) => (/^HCFC/i.test(gas) ? 'HCFC' : /^HFC/i.test(gas) ? 'HFC' : /^R-?\d/i.test(gas) ? 'Mezcla HFC' : /^PFC|^FC-/i.test(gas) ? 'PFC' : /^SF6/i.test(gas) ? 'SF₆' : /^NF3/i.test(gas) ? 'NF₃' : 'Fluorado');

/**
 * CO₂, CH₄ y N₂O de la combustión y la electricidad, más cada gas fluorado (recargas) por separado.
 * Los gases fluorados se llevan a CO₂e igual que CH₄ y N₂O: kg de gas × PCA. La suma de toneladasCO2e es el total del inventario.
 */
export function desgloseGases(resultados: ResultadoLinea[], f: ConjuntoFactores): FilaGas[] {
  let co2 = 0, ch4g = 0, n2og = 0;
  const flu = new Map<string, { kgGas: number; kgCO2e: number }>();
  for (const r of resultados) {
    const c = r.linea.categoria;
    if (c === 'fugitiva') {
      const q = r.linea.cantidad * (r.linea.reparto?.proporcion ?? 1);
      const e = flu.get(r.linea.fuente) ?? { kgGas: 0, kgCO2e: 0 };
      e.kgGas += q; e.kgCO2e += r.kgCO2e; flu.set(r.linea.fuente, e);
    } else if (c === 'electricidad') co2 += r.kgCO2e;
    else { co2 += r.kgCO2; ch4g += r.gCH4; n2og += r.gN2O; }
  }
  const filas: FilaGas[] = [
    { gas: 'CO₂', familia: 'CO₂', toneladasGas: co2 / 1000, pca: 1, toneladasCO2e: co2 / 1000, fluorado: false },
    { gas: 'CH₄', familia: 'CH₄', toneladasGas: ch4g / 1e6, pca: f.gwp.ch4, toneladasCO2e: (ch4g / 1e6) * f.gwp.ch4, fluorado: false },
    { gas: 'N₂O', familia: 'N₂O', toneladasGas: n2og / 1e6, pca: f.gwp.n2o, toneladasCO2e: (n2og / 1e6) * f.gwp.n2o, fluorado: false },
  ];
  const fluorados = [...flu.entries()].map(([gas, v]) => ({ gas, familia: familiaFluorado(gas), toneladasGas: v.kgGas / 1000, pca: f.pcaRefrigerantes[gas] ?? (v.kgGas > 0 ? v.kgCO2e / v.kgGas : 0), toneladasCO2e: v.kgCO2e / 1000, fluorado: true }));
  return [...filas, ...fluorados.sort((a, b) => b.toneladasCO2e - a.toneladasCO2e)];
}
