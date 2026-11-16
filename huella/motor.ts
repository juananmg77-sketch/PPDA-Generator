import type {
  ConjuntoFactores,
  LineaActividad,
  ResultadoLinea,
  Totales,
} from './tipos.ts';

/** Se lanza cuando falta un factor: nunca se asume cero para no ocultar un dato sin respaldo. */
export class FactorNoEncontrado extends Error {
  clave: string;
  conjunto: string;
  constructor(clave: string, conjunto: string) {
    super(`No hay factor para «${clave}» en ${conjunto}`);
    this.clave = clave;
    this.conjunto = conjunto;
  }
}

const aKg = (g: number) => g / 1000;

/** Combustión (fija o móvil): cantidad × factor; CH4 y N2O (g) se pasan a CO2e con los GWP del conjunto. */
export function calcularCombustion(l: LineaActividad, f: ConjuntoFactores): ResultadoLinea {
  const fac = f.combustibles[l.fuente];
  if (!fac) throw new FactorNoEncontrado(l.fuente, f.id);
  const q = l.cantidad * (l.reparto?.proporcion ?? 1);
  const kgCO2 = q * (fac.co2 ?? 0);
  const gCH4 = q * (fac.ch4 ?? 0);
  const gN2O = q * (fac.n2o ?? 0);
  const kgCO2e = kgCO2 + aKg(gCH4) * f.gwp.ch4 + aKg(gN2O) * f.gwp.n2o;
  return {
    linea: l,
    alcance: 1,
    kgCO2,
    gCH4,
    gN2O,
    kgCO2e,
    trazabilidad: {
      conjunto: f.id,
      factorUsado: `CO2 ${fac.co2} kg/ud · CH4 ${fac.ch4} g/ud · N2O ${fac.n2o} g/ud · GWP CH4 ${f.gwp.ch4}, N2O ${f.gwp.n2o}`,
      formula: 'cantidad × factor; CO2e = CO2 + CH4(kg)×GWP + N2O(kg)×GWP',
    },
  };
}

/** Emisiones fugitivas: kg de gas perdido (recarga) × PCA; sin factor de emisión. */
export function calcularFugitiva(l: LineaActividad, f: ConjuntoFactores): ResultadoLinea {
  const pca = f.pcaRefrigerantes[l.fuente];
  if (typeof pca !== 'number') throw new FactorNoEncontrado(l.fuente, f.id);
  const q = l.cantidad * (l.reparto?.proporcion ?? 1);
  const kgCO2e = q * pca;
  return {
    linea: l,
    alcance: 1,
    kgCO2: 0,
    gCH4: 0,
    gN2O: 0,
    kgCO2e,
    trazabilidad: { conjunto: f.id, factorUsado: `PCA ${pca}`, formula: 'kg recargados × PCA' },
  };
}

/**
 * Electricidad (Alcance 2). Devuelve los DOS métodos por separado, como pide la ISO 14064-1 (anexo E):
 *  - ubicación: siempre el mix de la red del año;
 *  - mercado: 0 si hay autoconsumo o garantía de origen renovable.
 * El valor que entra en el total es el del registro balear: 0 solo con autoconsumo o GdO renovable de Baleares.
 */
export function calcularElectricidad(l: LineaActividad, f: ConjuntoFactores): ResultadoLinea {
  const origen = l.origenElectricidad ?? 'red';
  const q = l.cantidad * (l.reparto?.proporcion ?? 1);
  const ubicacion = q * f.mixElectrico;
  const mercado = origen === 'red' ? ubicacion : 0;
  const registroBalear = origen === 'red' || origen === 'gdo_otra' ? ubicacion : 0;
  return {
    linea: l,
    alcance: 2,
    kgCO2: registroBalear,
    gCH4: 0,
    gN2O: 0,
    kgCO2e: registroBalear,
    electricidad: { kgCO2eUbicacion: ubicacion, kgCO2eMercado: mercado },
    trazabilidad: {
      conjunto: f.id,
      factorUsado: `mix balear ${f.anioInventario}: ${f.mixElectrico} kg CO2e/kWh (origen: ${origen})`,
      formula: 'kWh × mix; 0 con autoconsumo o GdO renovable de Baleares (registro balear)',
    },
  };
}

export function calcularLinea(l: LineaActividad, f: ConjuntoFactores): ResultadoLinea {
  switch (l.categoria) {
    case 'combustion_fija':
    case 'combustion_movil':
      return calcularCombustion(l, f);
    case 'fugitiva':
      return calcularFugitiva(l, f);
    case 'electricidad':
      return calcularElectricidad(l, f);
  }
}

export function calcularInventario(lineas: LineaActividad[], f: ConjuntoFactores): { resultados: ResultadoLinea[]; totales: Totales } {
  const resultados = lineas.map((l) => calcularLinea(l, f));
  const totales: Totales = {
    kgCO2eAlcance1: 0,
    kgCO2eAlcance2: 0,
    kgCO2eTotal: 0,
    porCategoria: {},
    porCentro: {},
    kgCO2PorGas: { co2: 0, ch4_co2e: 0, n2o_co2e: 0, fluorados_co2e: 0 },
  };
  for (const r of resultados) {
    if (r.alcance === 1) totales.kgCO2eAlcance1 += r.kgCO2e;
    else totales.kgCO2eAlcance2 += r.kgCO2e;
    totales.porCategoria[r.linea.categoria] = (totales.porCategoria[r.linea.categoria] ?? 0) + r.kgCO2e;
    totales.porCentro[r.linea.centro] = (totales.porCentro[r.linea.centro] ?? 0) + r.kgCO2e;
    if (r.linea.categoria === 'fugitiva') totales.kgCO2PorGas.fluorados_co2e += r.kgCO2e;
    else if (r.linea.categoria === 'electricidad') totales.kgCO2PorGas.co2 += r.kgCO2e;
    else {
      totales.kgCO2PorGas.co2 += r.kgCO2;
      totales.kgCO2PorGas.ch4_co2e += aKg(r.gCH4) * f.gwp.ch4;
      totales.kgCO2PorGas.n2o_co2e += aKg(r.gN2O) * f.gwp.n2o;
    }
  }
  totales.kgCO2eTotal = totales.kgCO2eAlcance1 + totales.kgCO2eAlcance2;
  return { resultados, totales };
}

/** Ratio por índice de actividad (p. ej. estancias): kg CO2e por unidad. */
export function ratio(kgCO2e: number, indice: number): number {
  if (!(indice > 0)) throw new Error('El índice de actividad debe ser mayor que cero.');
  return kgCO2e / indice;
}
