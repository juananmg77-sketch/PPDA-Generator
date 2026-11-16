import type { ConjuntoFactores, DatosCalculadora, FactorCombustible } from './tipos.ts';

export interface OpcionesConjunto {
  anioInventario: number;
  /** Potenciales de calentamiento de CH4 y N2O si difieren de los de la calculadora (p. ej. 28 y 265 en el inventario 2022). */
  gwp?: { ch4: number; n2o: number; fuente: string };
  /** Sustituye PCA de refrigerantes (p. ej. valores AR5 del documento MITECO vigente entonces). */
  pcaRefrigerantes?: Record<string, number>;
  /** Sustituye factores de combustibles (clave → factor) cuando el documento usado difiere de la calculadora. */
  combustibles?: Record<string, FactorCombustible>;
  /** Mix eléctrico si no está en la calculadora (p. ej. años posteriores a la versión). */
  mixElectrico?: number;
  /** Justificación de cada cambio manual: obligatoria si se usa alguna sobrescritura. */
  notas?: string[];
}

/**
 * Construye el conjunto de factores de un inventario a partir de una versión de la calculadora oficial.
 * Los cambios manuales quedan registrados en `notas` y no pueden hacerse sin justificación.
 */
export function construirConjunto(datos: DatosCalculadora, o: OpcionesConjunto): ConjuntoFactores {
  const anio = String(o.anioInventario);
  const hayCambios = !!(o.gwp || o.pcaRefrigerantes || o.combustibles || o.mixElectrico !== undefined);
  if (hayCambios && (!o.notas || o.notas.length === 0)) {
    throw new Error('Los cambios manuales sobre los factores oficiales requieren una nota de justificación.');
  }

  const combustibles: Record<string, FactorCombustible> = {};
  const unidades: Record<string, string | null> = {};
  for (const tabla of [datos.combustiblesFijos, datos.vehiculosPorUnidad, datos.vehiculosPorKm]) {
    for (const [clave, x] of Object.entries(tabla)) {
      const f = x.porAnio[anio];
      if (f) {
        combustibles[clave] = f;
        unidades[clave] = x.unidad;
      }
    }
  }
  for (const [clave, f] of Object.entries(o.combustibles ?? {})) combustibles[clave] = f;

  const pca: Record<string, number> = {};
  for (const [gas, x] of Object.entries({ ...datos.refrigerantes, ...datos.otrosGases })) {
    if (typeof x.pca === 'number') pca[gas] = x.pca;
  }
  Object.assign(pca, o.pcaRefrigerantes ?? {});

  const mix = o.mixElectrico ?? datos.mixElectricoBalear[anio];
  if (typeof mix !== 'number') {
    throw new Error(`No hay mix eléctrico balear para ${anio} en ${datos.version}; hay que indicarlo con su resolución.`);
  }

  return {
    id: `${datos.version}@${anio}${hayCambios ? '+ajustes' : ''}`,
    anioInventario: o.anioInventario,
    version: datos.version,
    procedencia: datos.procedencia,
    gwp: o.gwp ?? { ...datos.gwpCalculadora, fuente: `Calculadora ${datos.version}` },
    pcaRefrigerantes: pca,
    mixElectrico: mix,
    combustibles,
    unidades,
    notas: o.notas ?? [],
  };
}
