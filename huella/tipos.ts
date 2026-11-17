// Tipos del motor de cálculo de la huella de carbono (Categorías 1 y 2 del Registro balear, ISO 14064-1).
// Unidades: CO2 en kg, CH4 y N2O en g por unidad de actividad; resultados en kg CO2e.

export interface FactorCombustible {
  co2: number | null; // kg CO2 por unidad
  ch4: number | null; // g CH4 por unidad
  n2o: number | null; // g N2O por unidad
}

/** Contenido de un JSON generado por scripts/extraer_factores.py (una versión de la calculadora oficial). */
export interface DatosCalculadora {
  version: string;
  procedencia: string;
  anioSeleccionadoEnLaCalculadora: number | null;
  gwpCalculadora: { ch4: number; n2o: number };
  combustiblesFijos: Record<string, { unidad: string | null; porAnio: Record<string, FactorCombustible> }>;
  vehiculosPorUnidad: Record<string, { unidad: string | null; porAnio: Record<string, FactorCombustible> }>;
  vehiculosPorKm: Record<string, { unidad: string; porAnio: Record<string, FactorCombustible> }>;
  refrigerantes: Record<string, { formula: string | null; pca: number | null }>;
  otrosGases: Record<string, { formula: string | null; pca: number | null }>;
  mixElectricoBalear: Record<string, number>;
  electricidadEspecial: Record<string, number>;
}

/**
 * Conjunto de factores que se aplica a UN inventario. Se guarda con el inventario para poder reproducirlo
 * siempre igual: los factores de un mismo año cambian entre versiones del documento del MITECO.
 */
export interface ConjuntoFactores {
  id: string;
  anioInventario: number;
  version: string; // p. ej. «calculadora-2023.2»
  procedencia: string;
  gwp: { ch4: number; n2o: number; fuente: string };
  pcaRefrigerantes: Record<string, number>;
  mixElectrico: number; // kg CO2e por kWh, método de ubicación (mix de la red balear del año)
  combustibles: Record<string, FactorCombustible>; // clave: «Gasóleo C (l)» o «B7 (l)|Furgonetas y furgones (N1)»
  unidades: Record<string, string | null>;
  /** Cambios manuales respecto a la versión de partida (cada uno con su justificación). */
  notas: string[];
}

export type Categoria = 'combustion_fija' | 'combustion_movil' | 'fugitiva' | 'electricidad';
export type Alcance = 1 | 2;
export type OrigenElectricidad = 'red' | 'autoconsumo' | 'gdo_renovable_balear' | 'gdo_otra';

export interface LineaActividad {
  id: string;
  centro: string;
  categoria: Categoria;
  /** Clave del factor (combustibles), nombre del gas (fugitivas) o vacío (electricidad). */
  fuente: string;
  cantidad: number; // en la unidad del factor; kWh para electricidad; kg para fugitivas
  origenElectricidad?: OrigenElectricidad;
  /** Referencia a la factura o evidencia de la que sale el dato (trazabilidad para el verificador). */
  evidencia?: string;
  /** Punto de suministro (CUPS, nº de contador) del que sale el dato, si se conoce. */
  contador?: string;
  /** Si se aplica un reparto (p. ej. 85/15) se guarda aquí la proporción y su justificación. */
  reparto?: { proporcion: number; justificacion: string };
}

export interface ResultadoLinea {
  linea: LineaActividad;
  alcance: Alcance;
  kgCO2: number;
  gCH4: number;
  gN2O: number;
  kgCO2e: number;
  /** Para electricidad: resultado por cada método, informados por separado (ISO 14064-1, anexo E). */
  electricidad?: { kgCO2eUbicacion: number; kgCO2eMercado: number };
  trazabilidad: {
    conjunto: string;
    factorUsado: string;
    formula: string;
  };
}

export interface Totales {
  kgCO2eAlcance1: number;
  kgCO2eAlcance2: number;
  kgCO2eTotal: number;
  porCategoria: Record<string, number>;
  porCentro: Record<string, number>;
  kgCO2PorGas: { co2: number; ch4_co2e: number; n2o_co2e: number; fluorados_co2e: number };
}
