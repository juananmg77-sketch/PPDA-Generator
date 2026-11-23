// Capa única de formato numérico (es-ES) de todo lo que se ve en los informes: coma decimal, punto de miles (también con 4 cifras),
// decimales fijados por tipo de magnitud y «—» cuando falta el valor. Ningún número debe llegar al PDF sin pasar por aquí.

export type Magnitud = 'tCO2e' | 'kgCO2e' | 'gramos' | 'actividad' | 'factor' | 'pca' | 'porcentaje' | 'ratio' | 'entero' | 'gasT' | 'plantilla';

/** Decimales (mínimo y máximo) de cada magnitud. Una misma magnitud se muestra siempre igual en todo el informe. */
export const DECIMALES: Record<Magnitud, { min: number; max: number }> = {
  tCO2e: { min: 2, max: 2 },       // toneladas de CO₂ equivalente
  kgCO2e: { min: 1, max: 1 },      // kilogramos de CO₂ (o CO₂e) de una línea
  gramos: { min: 1, max: 1 },      // gramos de CH₄ / N₂O
  actividad: { min: 2, max: 2 },   // cantidades de actividad (kWh, kg, l…)
  factor: { min: 3, max: 4 },      // factores de emisión (kg/ud, g/ud, kg CO₂e/kWh)
  pca: { min: 0, max: 2 },         // potencial de calentamiento: entero si lo es; si no, 2 decimales
  porcentaje: { min: 1, max: 1 },
  ratio: { min: 2, max: 4 },       // t CO₂e por estancia / por trabajador
  entero: { min: 0, max: 0 },      // recuentos (estancias, registros, habitaciones)
  gasT: { min: 2, max: 4 },        // toneladas del propio gas
  plantilla: { min: 0, max: 3 },   // plantilla media (puede ser fraccionaria)
};

/** Magnitudes en las que un valor positivo que se redondearía a cero se muestra como «< 0,01» en lugar de «0,00». */
const MARCA_MINIMO: ReadonlySet<Magnitud> = new Set(['tCO2e', 'kgCO2e', 'gramos', 'actividad', 'porcentaje']);

export const valido = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const nfs = new Map<string, Intl.NumberFormat>();
const formateador = (min: number, max: number) => {
  const k = `${min}-${max}`;
  let f = nfs.get(k);
  if (!f) { f = new Intl.NumberFormat('es-ES', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: 'always' as unknown as boolean }); nfs.set(k, f); }
  return f;
};

/** Valor tal como se muestra, redondeado a los decimales máximos de la magnitud (para calcular ratios con lo que se ve). */
export function comoSeMuestra(v: number, mag: Magnitud): number {
  const d = DECIMALES[mag].max;
  return Math.round((v + Number.EPSILON) * 10 ** d) / 10 ** d;
}

/** Texto numérico o null si el valor no existe (para omitir el término en una frase). */
export function fmtOpc(v: number | null | undefined, mag: Magnitud, o: { signo?: boolean } = {}): string | null {
  if (!valido(v)) return null;
  const { min, max } = DECIMALES[mag];
  // PCA: entero si lo es, si no, hasta 2 decimales
  const dec = mag === 'pca' ? { min: Number.isInteger(v) ? 0 : 2, max: Number.isInteger(v) ? 0 : 2 } : { min, max };
  const redondeado = comoSeMuestra(v, mag);
  if (v !== 0 && redondeado === 0 && MARCA_MINIMO.has(mag)) return `${v < 0 ? '> −' : '< '}${formateador(dec.min, dec.max).format(10 ** -dec.max)}`;
  const t = formateador(dec.min, dec.max).format(v);
  return o.signo && v > 0 ? `+${t}` : t;
}

/** Texto numérico para tablas: «—» si no hay valor. */
export const fmt = (v: number | null | undefined, mag: Magnitud, o: { signo?: boolean } = {}): string => fmtOpc(v, mag, o) ?? '—';

/** Número con decimales explícitos (ejes de gráficos y casos sin magnitud propia), con el mismo formato es-ES. */
export function fmtLibre(v: number | null | undefined, decimales = 2): string {
  return valido(v) ? formateador(decimales, decimales).format(v) : '—';
}

/** Número con unidad; si falta el valor, null (el término se omite de la frase). */
export const conUnidad = (v: number | null | undefined, mag: Magnitud, unidad: string): string | null => {
  const t = fmtOpc(v, mag);
  return t === null ? null : `${t} ${unidad}`;
};

/** Número con hasta `max` decimales (sin ceros sobrantes): para cantidades sueltas de una nota, p. ej. «20 bombonas × 12,5 kg». */
export function fmtMax(v: number | null | undefined, max = 2): string {
  return valido(v) ? formateador(0, max).format(v) : '—';
}
