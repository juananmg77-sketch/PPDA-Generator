// Resolución oficial que aprueba los factores de emisión de cada año: datos estructurados (no texto fijo) que cada conjunto de factores conserva.
export interface ResolucionFactores {
  /** Año de los factores que aprueba. */
  anio: number;
  organo: string;
  titulo: string;
  boletin: string;
  numero: string;
  /** AAAA-MM-DD */
  fecha: string;
  enlace: string | null;
  /** Archivo del MITECO al que remite (nombre, versión y fecha de publicación). */
  archivoMiteco: { nombre: string; version: string; fecha: string } | null;
  /** De dónde se tomó la cita y si está comprobada en el boletín oficial. */
  nota?: string;
}

/** Catálogo de resoluciones por año de los factores. Se amplía aquí al publicarse cada resolución. */
export const RESOLUCIONES_FACTORES: Record<number, ResolucionFactores> = {
  2023: {
    anio: 2023, organo: 'Consejero de Empresa, Empleo y Energía', titulo: 'Resolución por la que se aprueban los factores de emisión de las Illes Balears durante el año 2023',
    boletin: 'BOIB', numero: '35', fecha: '2025-03-20', enlace: null,
    archivoMiteco: { nombre: 'Factores de emisión 2007-2023', version: '4', fecha: '2024-05-16' },
    nota: 'Cita tomada del informe de inventario 2023 verificado; falta el enlace al boletín.',
  },
  2024: {
    anio: 2024, organo: 'Conseller de Empresa, Autónomos y Energía', titulo: 'Resolución por la que se aprueban los factores de emisión para cuantificar las emisiones de gases de efecto invernadero de las Illes Balears durante el año 2024',
    boletin: 'BOIB', numero: '35', fecha: '2026-03-19', enlace: 'https://intranet.caib.es/eboibfront/pdf/ca/2026/35/1215259',
    archivoMiteco: { nombre: 'Factores de emisión 2007-2024', version: '5', fecha: '2025-05-06' },
  },
};
export const resolucionDeAnio = (anio: number): ResolucionFactores | null => RESOLUCIONES_FACTORES[anio] ?? null;

const fechaLarga = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return `${d} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][m - 1]} de ${a}`; };
const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');

/** Cita completa de la resolución, generada de sus datos. */
export function textoResolucion(r: ResolucionFactores): string {
  return `${r.titulo} (${r.boletin} n.º ${r.numero}, de ${fechaLarga(r.fecha)})${r.archivoMiteco ? `, que remite al archivo «${r.archivoMiteco.nombre}, versión ${r.archivoMiteco.version}» (${fechaCorta(r.archivoMiteco.fecha)}) del MITECO` : ''}.`;
}

/** Campos que faltan en una cita (el enlace y el archivo del MITECO se comprueban aparte como avisos). */
export function validarResolucion(r: ResolucionFactores | null | undefined): string[] {
  if (!r) return ['No hay resolución registrada para estos factores.'];
  const out: string[] = [];
  if (!r.boletin?.trim()) out.push('Falta el boletín de la resolución.');
  if (!r.numero?.trim()) out.push('Falta el número del boletín.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fecha ?? '')) out.push('Falta la fecha de la resolución.');
  if (!r.enlace?.trim()) out.push('Falta el enlace al boletín.');
  if (!r.archivoMiteco?.nombre?.trim() || !r.archivoMiteco?.version?.trim()) out.push('Falta el archivo del MITECO y su versión.');
  return out;
}

/** Comprueba que dos años distintos no repiten los mismos datos de cita (boletín + número + fecha, o el mismo enlace). */
export function validarCatalogoResoluciones(c: Record<number, ResolucionFactores> = RESOLUCIONES_FACTORES): string[] {
  const out: string[] = []; const vistos = new Map<string, number>();
  for (const [anio, r] of Object.entries(c)) {
    const clave = `${r.boletin}|${r.numero}|${r.fecha}`;
    const otro = vistos.get(clave);
    if (otro !== undefined) out.push(`Los años ${otro} y ${anio} repiten la misma cita (${r.boletin} n.º ${r.numero}, ${r.fecha}).`);
    vistos.set(clave, Number(anio));
    if (Number(anio) !== r.anio) out.push(`La resolución guardada para ${anio} declara el año ${r.anio}.`);
  }
  const enlaces = Object.values(c).map((r) => r.enlace).filter((x): x is string => !!x);
  if (new Set(enlaces).size !== enlaces.length) out.push('Dos años distintos comparten el mismo enlace.');
  const archivos = Object.values(c).map((r) => r.archivoMiteco ? `${r.archivoMiteco.nombre}|${r.archivoMiteco.version}|${r.archivoMiteco.fecha}` : null).filter(Boolean);
  if (new Set(archivos).size !== archivos.length) out.push('Dos años distintos remiten al mismo archivo del MITECO (misma versión y fecha).');
  return out;
}
