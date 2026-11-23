// Evaluación de la significancia de las emisiones indirectas (ISO 14064-1:2018, apartado 5.2.3 y anexo H) y declaración de conformidad que depende de ella.
// Plantillas de subcategorías, criterios y textos de la declaración son DATOS de configuración (tablas en la base de datos con estos valores por defecto).
import { fmtOpc } from './formato.ts';

export type Influencia = 'alta' | 'media' | 'baja';
export type CalidadDatos = 'buenos' | 'parciales' | 'no_disponibles';
export type Resultado = 'significativa' | 'no_significativa';

export interface SubcategoriaPlantilla { sector: string; categoria: 3 | 4 | 5 | 6; codigo: string; nombre: string; descripcion?: string; orden: number; activa: boolean }

/** Plantilla por defecto del sector hoteles (la edita el administrador en la configuración; la base de datos la sustituye). */
export const PLANTILLA_HOTELES: SubcategoriaPlantilla[] = [
  { categoria: 3, codigo: '3.1', nombre: 'Transporte de mercancías (aguas arriba)' },
  { categoria: 3, codigo: '3.2', nombre: 'Desplazamientos de los empleados al trabajo' },
  { categoria: 3, codigo: '3.3', nombre: 'Transporte de clientes (llegada y salida de los huéspedes)' },
  { categoria: 3, codigo: '3.4', nombre: 'Viajes de negocios' },
  { categoria: 4, codigo: '4.1', nombre: 'Alimentos y bebidas' },
  { categoria: 4, codigo: '4.2', nombre: 'Otros bienes y servicios comprados' },
  { categoria: 4, codigo: '4.3', nombre: 'Bienes de capital' },
  { categoria: 4, codigo: '4.4', nombre: 'Residuos generados' },
  { categoria: 4, codigo: '4.5', nombre: 'Agua' },
  { categoria: 4, codigo: '4.6', nombre: 'Lavandería externalizada' },
  { categoria: 5, codigo: '5.1', nombre: 'Uso de los productos y servicios ofrecidos a los clientes' },
  { categoria: 5, codigo: '5.2', nombre: 'Final de vida de los productos suministrados' },
  { categoria: 6, codigo: '6.1', nombre: 'Otras fuentes de emisiones indirectas' },
].map((x, i) => ({ sector: 'hoteles', ...x, categoria: x.categoria as 3 | 4 | 5 | 6, orden: i + 1, activa: true }));

export const PLANTILLAS_POR_DEFECTO: Record<string, SubcategoriaPlantilla[]> = { hoteles: PLANTILLA_HOTELES };

/** Sector de la plantilla según el CNAE (división 55: alojamiento). */
export const sectorDeCnae = (cnae?: string | null): string => (/^55/.test((cnae ?? '').replace(/\D/g, '')) ? 'hoteles' : 'general');

export interface CriteriosSignificancia {
  /** % estimado del total del inventario a partir del cual una fuente es significativa por su magnitud. */
  umbralMagnitud: number;
  /** Criterios que se valoran en esta organización. */
  activos: { magnitud: boolean; influencia: boolean; datos: boolean; requisitos: boolean };
  /** Influencia mínima que, con datos disponibles, hace significativa la fuente (oportunidad de reducción). */
  influenciaMinima: Influencia;
  /** Umbrales de las exclusiones de la categoría 1: por fuente y en conjunto (% de las emisiones). */
  exclusionDirectaPorFuente: number;
  exclusionDirectaTotal: number;
}
export const CRITERIOS_POR_DEFECTO: CriteriosSignificancia = {
  umbralMagnitud: 1,
  activos: { magnitud: true, influencia: true, datos: true, requisitos: true },
  influenciaMinima: 'alta',
  exclusionDirectaPorFuente: 3,
  exclusionDirectaTotal: 5,
};
export const criteriosDe = (c?: Partial<CriteriosSignificancia> | null): CriteriosSignificancia => ({
  ...CRITERIOS_POR_DEFECTO, ...(c ?? {}), activos: { ...CRITERIOS_POR_DEFECTO.activos, ...(c?.activos ?? {}) },
});

export interface Valoracion {
  magnitudPct: number | null;
  influencia: Influencia | null;
  datos: CalidadDatos | null;
  /** Requisitos de clientes o normativos que obligan a cuantificarla. null = sin valorar. */
  requisitos: boolean | null;
}
export type MetodoEvaluacion = 'criterios' | 'no_aplica';
export interface Evaluacion extends Valoracion {
  /** «no_aplica»: la subcategoría se excluye directamente con una justificación, sin valorar los criterios. */
  metodo?: MetodoEvaluacion;
  codigo: string; categoria: number; nombre: string;
  /** Resultado guardado; si el criterio lo determina puede recalcularse con `evaluarSignificancia`. */
  resultado: Resultado | null;
  justificacion: string | null;
  cuantificada: boolean;
}

const NIVEL: Record<Influencia, number> = { baja: 0, media: 1, alta: 2 };

/** Resultado según los criterios activos. Si falta valorar alguno de ellos no hay resultado (la evaluación está incompleta). */
export function evaluarSignificancia(v: Valoracion, c: CriteriosSignificancia): { completa: boolean; resultado: Resultado | null; motivos: string[]; sinValorar: string[] } {
  const sinValorar: string[] = [];
  if (c.activos.magnitud && v.magnitudPct == null) sinValorar.push('magnitud estimada');
  if (c.activos.influencia && v.influencia == null) sinValorar.push('nivel de influencia');
  if (c.activos.datos && v.datos == null) sinValorar.push('disponibilidad y calidad de los datos');
  if (c.activos.requisitos && v.requisitos == null) sinValorar.push('requisitos de clientes o normativos');
  if (sinValorar.length) return { completa: false, resultado: null, motivos: [], sinValorar };
  const motivos: string[] = [];
  if (c.activos.magnitud && v.magnitudPct != null && v.magnitudPct >= c.umbralMagnitud) motivos.push(`magnitud estimada ${fmtOpc(v.magnitudPct, 'porcentaje')} % (umbral ${fmtOpc(c.umbralMagnitud, 'porcentaje')} %)`);
  if (c.activos.requisitos && v.requisitos) motivos.push('requisito de clientes o normativo');
  if (c.activos.influencia && v.influencia && NIVEL[v.influencia] >= NIVEL[c.influenciaMinima] && (!c.activos.datos || v.datos !== 'no_disponibles')) motivos.push(`influencia ${v.influencia} con datos accesibles`);
  return { completa: true, resultado: motivos.length ? 'significativa' : 'no_significativa', motivos, sinValorar: [] };
}

/** Resultado de una evaluación guardada: con «no aplica» la subcategoría queda excluida (no significativa) sin necesidad de valorar los criterios. */
export function evaluarEvaluacion(e: Evaluacion, c: CriteriosSignificancia): ReturnType<typeof evaluarSignificancia> {
  if (e.metodo === 'no_aplica') return { completa: true, resultado: 'no_significativa', motivos: ['no aplica (excluida con justificación)'], sinValorar: [] };
  return evaluarSignificancia(e, c);
}

export interface EstadoEvaluacion {
  /** Todas las subcategorías de la plantilla valoradas y las excluidas con su justificación. */
  completa: boolean;
  /** Todas las significativas están cuantificadas. */
  significativasCuantificadas: boolean;
  /** Lo que falta, subcategoría a subcategoría (se usa en la declaración y en el cierre). */
  faltas: string[];
  sinValorar: string[];
  excluidasSinJustificar: string[];
  significativasSinCuantificar: string[];
}

export function estadoEvaluacion(plantilla: Array<Pick<SubcategoriaPlantilla, 'codigo' | 'nombre' | 'activa'>>, evaluaciones: Evaluacion[], c: CriteriosSignificancia): EstadoEvaluacion {
  const sinValorar: string[] = [], excluidasSinJustificar: string[] = [], significativasSinCuantificar: string[] = [];
  for (const s of plantilla.filter((x) => x.activa)) {
    const nombre = `${s.codigo} ${s.nombre}`;
    const e = evaluaciones.find((x) => x.codigo === s.codigo);
    if (!e) { sinValorar.push(nombre); continue; }
    const r = evaluarEvaluacion(e, c);
    if (!r.completa) { sinValorar.push(nombre); continue; }
    if (r.resultado === 'no_significativa' && !(e.justificacion ?? '').trim()) excluidasSinJustificar.push(nombre);
    if (r.resultado === 'significativa' && !e.cuantificada) significativasSinCuantificar.push(nombre);
  }
  const faltas: string[] = [];
  if (sinValorar.length) faltas.push(`${sinValorar.length} subcategoría(s) sin valorar`);
  if (excluidasSinJustificar.length) faltas.push(`${excluidasSinJustificar.length} exclusión(es) sin justificación`);
  if (significativasSinCuantificar.length) faltas.push(`${significativasSinCuantificar.length} fuente(s) significativa(s) sin cuantificar`);
  return { completa: sinValorar.length === 0 && excluidasSinJustificar.length === 0, significativasCuantificadas: significativasSinCuantificar.length === 0, faltas, sinValorar, excluidasSinJustificar, significativasSinCuantificar };
}

/** Exclusiones de la categoría 1: cada una necesita % estimado y una evidencia; la suma se compara con el umbral configurado. */
export interface ExclusionDirecta { fuente: string; porcentaje: number | null; evidencia: boolean }
export function evaluarExclusionesDirectas(ex: ExclusionDirecta[], c: CriteriosSignificancia): { incidencias: string[]; suma: number; supera: boolean } {
  const incidencias: string[] = [];
  for (const x of ex) {
    if (x.porcentaje == null) incidencias.push(`Exclusión «${x.fuente}» (categoría 1): falta el porcentaje estimado.`);
    if (!x.evidencia) incidencias.push(`Exclusión «${x.fuente}» (categoría 1): falta la evidencia.`);
    if (x.porcentaje != null && x.porcentaje >= c.exclusionDirectaPorFuente) incidencias.push(`Exclusión «${x.fuente}» (categoría 1): ${fmtOpc(x.porcentaje, 'porcentaje')} % alcanza o supera el umbral por fuente (${fmtOpc(c.exclusionDirectaPorFuente, 'porcentaje')} %).`);
  }
  const suma = ex.reduce((t, x) => t + (x.porcentaje ?? 0), 0);
  const supera = suma > c.exclusionDirectaTotal;
  if (supera) incidencias.push(`La suma de las exclusiones de la categoría 1 (${fmtOpc(suma, 'porcentaje')} %) supera el umbral configurado (${fmtOpc(c.exclusionDirectaTotal, 'porcentaje')} %).`);
  return { incidencias, suma, supera };
}

// ── Declaración de conformidad ──
export interface TextosDeclaracion { programa: string; norma: string; a: string; b: string; falta: string }
export const TEXTOS_DECLARACION_POR_DEFECTO: TextosDeclaracion = {
  programa: 'Decreto 48/2021 del Registro balear de huella de carbono',
  norma: 'ISO 14064-1:2018',
  a: 'La organización declara que este inventario de GEI del año {anio} se ha elaborado conforme a la norma {norma} y a los requisitos del {programa}.',
  b: 'La organización declara que este inventario de GEI del año {anio} se ha elaborado conforme a los requisitos del {programa}, siguiendo la metodología de {norma}.',
  falta: 'No se declara la conformidad con {norma} porque la evaluación de la significancia de las emisiones indirectas no está completa: {motivos}.',
};

const rellenar = (t: string, v: Record<string, string>) => t.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));

export interface DeclaracionConformidad { caso: 'a' | 'b'; texto: string; faltas: string[] }
/** Caso a) evaluación completa y significativas cuantificadas; caso b) en cualquier otro. Los textos vienen de la configuración. */
export function declaracionConformidad(e: EstadoEvaluacion | null, anio: number, textos: Partial<TextosDeclaracion> = {}): DeclaracionConformidad {
  const t = { ...TEXTOS_DECLARACION_POR_DEFECTO, ...textos };
  const v = { anio: String(anio), norma: t.norma, programa: t.programa };
  if (e && e.completa && e.significativasCuantificadas) return { caso: 'a', texto: rellenar(t.a, v), faltas: [] };
  const faltas = e ? e.faltas : ['no se ha realizado la evaluación'];
  return { caso: 'b', texto: `${rellenar(t.b, v)} ${rellenar(t.falta, { ...v, motivos: faltas.join('; ') })}`, faltas };
}

/** Resumen por categoría (3 a 6) de la evaluación, para el estado de cada categoría en los resultados. */
export function resumenPorCategoria(plantilla: Array<Pick<SubcategoriaPlantilla, 'codigo' | 'nombre' | 'activa' | 'categoria'>>, evaluaciones: Evaluacion[], c: CriteriosSignificancia): Record<number, import('./iso.ts').ResumenEvaluacion> {
  const out: Record<number, import('./iso.ts').ResumenEvaluacion> = {};
  for (const s of plantilla.filter((x) => x.activa)) {
    const r = (out[s.categoria] ??= { total: 0, sinValorar: 0, significativas: 0, significativasSinCuantificar: 0, noSignificativas: 0, justificaciones: [] });
    r.total++;
    const e = evaluaciones.find((x) => x.codigo === s.codigo);
    const res = e ? evaluarEvaluacion(e, c) : null;
    if (!e || !res || !res.completa) { r.sinValorar++; continue; }
    if (res.resultado === 'significativa') { r.significativas++; if (!e.cuantificada) r.significativasSinCuantificar++; }
    else { r.noSignificativas++; if ((e.justificacion ?? '').trim()) r.justificaciones.push(`${s.codigo}: ${e.justificacion!.trim()}`); }
  }
  return out;
}

// ── Exclusión directa («no aplica») con una justificación que cumpla la ISO 14064-1 ──
export interface MotivoExclusion { id: string; titulo: string; texto: string }
/** Motivos habituales de exclusión de una fuente indirecta (ISO 14064-1:2018, 5.2.3: significancia; 9.3.1 i: exclusiones y su razón). Configurables. */
export const MOTIVOS_EXCLUSION_POR_DEFECTO: MotivoExclusion[] = [
  { id: 'no_significativa', titulo: 'Contribución no significativa', texto: 'La contribución estimada de la fuente al total del inventario es no significativa respecto a las emisiones directas y de energía importada cuantificadas.' },
  { id: 'sin_datos', titulo: 'Sin datos fiables y contribución no significativa', texto: 'No se dispone de datos de actividad fiables y su cuantificación mediante estimaciones no aportaría información relevante, dado que su contribución estimada no es significativa.' },
  { id: 'sin_control', titulo: 'Fuera del control e influencia de la organización', texto: 'La organización no tiene control ni influencia razonable sobre la fuente, por lo que no puede reducir sus emisiones ni obtener datos de ella.' },
  { id: 'no_aplica', titulo: 'No aplica a la actividad de la organización', texto: 'La fuente no existe en la actividad de la organización durante el periodo cubierto.' },
];

/** Redacta la justificación completa: el motivo elegido, el detalle concreto de la organización y la referencia a la norma. */
export function redactarJustificacion(motivo: MotivoExclusion | undefined, detalle: string, referencia = 'ISO 14064-1:2018, 5.2.3 y 9.3.1 i)'): string {
  const d = detalle.trim().replace(/\.*$/, '');
  return `${(motivo?.texto ?? '').trim()}${d ? ` ${d}.` : ''} Se excluye del inventario conforme a la ${referencia}.`.trim();
}
/** Una justificación es válida si hay un motivo y un detalle propio de la organización (no solo la frase tipo). */
export const justificacionValida = (motivo: MotivoExclusion | undefined, detalle: string, min = 15): boolean => !!motivo && detalle.trim().length >= min;
