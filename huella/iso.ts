// Estructura de resultados conforme a la ISO 14064-1: categorías (1 a 6, con subcategoría) y grupos de gas (CO₂, CH₄, N₂O, HFC, PFC, SF₆, NF₃, otros fluorados).
// Todo lo que asigna una fuente a una categoría o a un grupo de gas está en las tablas de este archivo (datos), no en el generador del informe.
import type { Categoria, ConjuntoFactores, ResultadoLinea, Totales } from './tipos.ts';

/** Umbrales del criterio de significancia (porcentaje de las emisiones). Configurables: el informe y el cierre los leen de aquí. */
export const UMBRALES_SIGNIFICANCIA = { porFuente: 3, total: 5 } as const;

export type GrupoGas = 'CO₂' | 'CH₄' | 'N₂O' | 'HFC' | 'PFC' | 'SF₆' | 'NF₃' | 'Otros fluorados';
export const GRUPOS_GAS: readonly GrupoGas[] = ['CO₂', 'CH₄', 'N₂O', 'HFC', 'PFC', 'SF₆', 'NF₃', 'Otros fluorados'];

export interface CategoriaIso { n: 1 | 2 | 3 | 4 | 5 | 6; nombre: string; resumen: string; subcategorias: string[] }
export const CATEGORIAS_ISO: readonly CategoriaIso[] = [
  { n: 1, nombre: 'Emisiones directas', resumen: '1 · Emisiones directas', subcategorias: ['1.1 Combustión estacionaria', '1.2 Combustión móvil', '1.3 Procesos', '1.4 Emisiones fugitivas'] },
  { n: 2, nombre: 'Energía importada', resumen: '2 · Energía importada', subcategorias: ['2.1 Electricidad importada'] },
  { n: 3, nombre: 'Transporte', resumen: '3 · Transporte', subcategorias: ['3.1 Transporte aguas arriba', '3.2 Transporte aguas abajo', '3.3 Desplazamientos de personal', '3.4 Visitantes', '3.5 Viajes de negocios'] },
  { n: 4, nombre: 'Productos usados por la organización', resumen: '4 · Productos usados por la organización', subcategorias: ['4.1 Bienes comprados', '4.2 Bienes de capital', '4.3 Residuos', '4.4 Activos arrendados', '4.5 Servicios'] },
  { n: 5, nombre: 'Uso de productos de la organización', resumen: '5 · Uso de productos de la organización', subcategorias: ['5.1 Uso del producto', '5.2 Activos arrendados a terceros', '5.3 Final de vida', '5.4 Inversiones'] },
  { n: 6, nombre: 'Otras fuentes', resumen: '6 · Otras fuentes', subcategorias: ['6.1 Otras fuentes'] },
];
export const CATEGORIAS_INDIRECTAS = CATEGORIAS_ISO.filter((c) => c.n >= 2);

/** Categoría ISO y subcategoría de cada tipo de fuente del catálogo. */
export const CATEGORIA_ISO_FUENTE: Record<Categoria, { n: CategoriaIso['n']; sub: string }> = {
  combustion_fija: { n: 1, sub: '1.1 Combustión estacionaria' },
  combustion_movil: { n: 1, sub: '1.2 Combustión móvil' },
  fugitiva: { n: 1, sub: '1.4 Emisiones fugitivas' },
  electricidad: { n: 2, sub: '2.1 Electricidad importada' },
};

/** Familia (grupo de gas ISO) de los refrigerantes, por patrón sobre el nombre; el primero que coincide manda. Las mezclas HFC/HFO cuentan como HFC. */
const FAMILIAS_REFRIGERANTE: Array<{ patron: RegExp; grupo: GrupoGas }> = [
  { patron: /^SF-?6|^SF₆/i, grupo: 'SF₆' },
  { patron: /^NF-?3|^NF₃/i, grupo: 'NF₃' },
  { patron: /^PFC|^FC-|^R-?(14|116|218|c318|3-1-10|31-10)\b/i, grupo: 'PFC' },
  { patron: /^HCFC|^CFC|^HFE|^halon/i, grupo: 'Otros fluorados' },
  { patron: /^HFC|^HFO|^R-?\d/i, grupo: 'HFC' }, // HFC puros, HFO y mezclas R-4xx / R-5xx (HFC/HFO)
];
export function grupoGasRefrigerante(nombre: string): GrupoGas {
  const n = nombre.trim();
  return FAMILIAS_REFRIGERANTE.find((x) => x.patron.test(n))?.grupo ?? 'Otros fluorados';
}

export interface FilaGrupo { grupo: GrupoGas; toneladasGas: number; /** PCA (medio ponderado en los grupos con varios gases); null si no hay emisión de un grupo con varios gases. */ pca: number | null; toneladasCO2e: number; porcentajeCat1: number | null }
export interface FilaRefrigerante { gas: string; grupo: GrupoGas; toneladasGas: number; pca: number; toneladasCO2e: number }
export type EstadoCategoria = 'Cuantificada' | 'No significativa' | 'Excluida' | 'Sin evaluar';
export interface FilaIndirecta { n: CategoriaIso['n']; nombre: string; estado: EstadoCategoria; toneladasCO2e: number | null; justificacion: string | null; porcentaje: number | null }
export interface ExclusionIso { fuente: string; porcentaje: number | null; justificacion: string; categoriaIso?: number | null }

export interface ResultadosIso {
  /** Categoría 1 (emisiones directas) por grupo de gas: siempre las 8 filas. */
  gases: FilaGrupo[];
  refrigerantes: FilaRefrigerante[];
  totalCat1: number;
  /** Estado de las seis categorías (la 1 con datos es «Cuantificada»). */
  categorias: FilaIndirecta[];
  indirectas: FilaIndirecta[];
  totalInventario: number;
  /** Total por categoría (1 a 6; las no cuantificadas, 0). */
  porCategoria: Record<number, number>;
  cuadre: { ok: boolean; incidencias: string[] };
}

const TOL = 1e-6; // toneladas (1 g)

/** Estado de una categoría indirecta: con datos → Cuantificada; con una exclusión registrada → No significativa (bajo el umbral) o Excluida; si no, Sin evaluar. */
export function estadoCategoria(cuantificada: boolean, ex: ExclusionIso | undefined, umbral: number = UMBRALES_SIGNIFICANCIA.porFuente): EstadoCategoria {
  if (cuantificada) return 'Cuantificada';
  if (ex) return ex.porcentaje != null && ex.porcentaje < umbral ? 'No significativa' : 'Excluida';
  return 'Sin evaluar';
}

/** Con `totales` (los que calcula el motor) las comprobaciones cruzan dos cálculos independientes: por línea y por total. */
export function resultadosIso(resultados: ResultadoLinea[], f: ConjuntoFactores, exclusiones: ExclusionIso[] = [], totales?: Totales): ResultadosIso {
  // Categoría 1: solo las fuentes cuya categoría ISO es 1 (la electricidad, categoría 2, no entra en la tabla por gas)
  const directas = resultados.filter((r) => CATEGORIA_ISO_FUENTE[r.linea.categoria].n === 1);
  let kgCO2 = 0, gCH4 = 0, gN2O = 0;
  const refri = new Map<string, FilaRefrigerante & { kg: number }>();
  for (const r of directas) {
    if (r.linea.categoria === 'fugitiva') {
      const kg = r.linea.cantidad * (r.linea.reparto?.proporcion ?? 1);
      const x = refri.get(r.linea.fuente) ?? { gas: r.linea.fuente, grupo: grupoGasRefrigerante(r.linea.fuente), toneladasGas: 0, pca: f.pcaRefrigerantes[r.linea.fuente] ?? 0, toneladasCO2e: 0, kg: 0 };
      x.kg += kg; x.toneladasGas = x.kg / 1000; x.toneladasCO2e += r.kgCO2e / 1000; refri.set(r.linea.fuente, x);
    } else { kgCO2 += r.kgCO2; gCH4 += r.gCH4; gN2O += r.gN2O; }
  }
  const refrigerantes = [...refri.values()].map(({ kg: _k, ...x }) => x).sort((a, b) => b.toneladasCO2e - a.toneladasCO2e);
  const totalCat1 = directas.reduce((t, r) => t + r.kgCO2e, 0) / 1000;

  const base: Record<GrupoGas, { gas: number; co2e: number }> = Object.fromEntries(GRUPOS_GAS.map((g) => [g, { gas: 0, co2e: 0 }])) as never;
  base['CO₂'] = { gas: kgCO2 / 1000, co2e: kgCO2 / 1000 };
  base['CH₄'] = { gas: gCH4 / 1e6, co2e: (gCH4 / 1e6) * f.gwp.ch4 };
  base['N₂O'] = { gas: gN2O / 1e6, co2e: (gN2O / 1e6) * f.gwp.n2o };
  for (const x of refrigerantes) { base[x.grupo].gas += x.toneladasGas; base[x.grupo].co2e += x.toneladasCO2e; }
  const gases: FilaGrupo[] = GRUPOS_GAS.map((grupo) => {
    const b = base[grupo];
    const fijo = grupo === 'CO₂' ? 1 : grupo === 'CH₄' ? f.gwp.ch4 : grupo === 'N₂O' ? f.gwp.n2o : null;
    return { grupo, toneladasGas: b.gas, pca: fijo ?? (b.gas > 0 ? b.co2e / b.gas : null), toneladasCO2e: b.co2e, porcentajeCat1: totalCat1 > 0 ? (b.co2e / totalCat1) * 100 : null };
  });

  // Categorías 2 a 6
  const porCategoria: Record<number, number> = { 1: totalCat1, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const cuantificadas = new Set<number>([1]);
  for (const r of resultados) { const c = CATEGORIA_ISO_FUENTE[r.linea.categoria].n; if (c !== 1) { porCategoria[c] += r.kgCO2e / 1000; cuantificadas.add(c); } }
  const categorias: FilaIndirecta[] = CATEGORIAS_ISO.map((c) => {
    const ex = exclusiones.find((x) => x.categoriaIso === c.n);
    const estado = estadoCategoria(cuantificadas.has(c.n), ex);
    return { n: c.n, nombre: c.nombre, estado, toneladasCO2e: estado === 'Cuantificada' ? porCategoria[c.n] : null, justificacion: estado === 'Cuantificada' ? null : ex?.justificacion ?? null, porcentaje: ex?.porcentaje ?? null };
  });

  const totalInventario = totales ? totales.kgCO2eTotal / 1000 : resultados.reduce((t, r) => t + r.kgCO2e, 0) / 1000;
  // Comprobaciones: la suma por gas = total de la categoría 1; la suma de categorías = total del inventario
  const incidencias: string[] = [];
  const sumaGases = gases.reduce((t, x) => t + x.toneladasCO2e, 0);
  if (Math.abs(sumaGases - totalCat1) > TOL) incidencias.push(`La suma de las emisiones por gas (${sumaGases.toFixed(6)} t CO₂e) no coincide con el total de la categoría 1 (${totalCat1.toFixed(6)} t CO₂e).`);
  if (totales && Math.abs(totalCat1 - totales.kgCO2eAlcance1 / 1000) > TOL) incidencias.push(`El total de la categoría 1 (${totalCat1.toFixed(6)} t CO₂e) no coincide con el Alcance 1 del cálculo (${(totales.kgCO2eAlcance1 / 1000).toFixed(6)} t CO₂e).`);
  const sumaCats = Object.values(porCategoria).reduce((t, x) => t + x, 0);
  if (Math.abs(sumaCats - totalInventario) > TOL) incidencias.push(`La suma de las categorías (${sumaCats.toFixed(6)} t CO₂e) no coincide con el total del inventario (${totalInventario.toFixed(6)} t CO₂e).`);
  const indirectas = categorias.filter((c) => c.n >= 2);
  return { gases, refrigerantes, totalCat1, categorias, indirectas, totalInventario, porCategoria, cuadre: { ok: incidencias.length === 0, incidencias } };
}
